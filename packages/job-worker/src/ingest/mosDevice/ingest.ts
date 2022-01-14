import { PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	MosDeleteStoryProps,
	MosFullStoryProps,
	MosInsertStoryProps,
	MosMoveStoryProps,
	MosRundownMetadataProps,
	MosRundownProps,
	MosRundownReadyToAirProps,
	MosRundownStatusProps,
	MosStoryStatusProps,
	MosSwapStoryProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { MOS } from '@sofie-automation/corelib'
import { logger } from '../../logging'
import _ = require('underscore')
import { JobContext } from '../../jobs'
import { updateSegmentFromIngestData } from '../generation'
import { LocalIngestPart, LocalIngestRundown, LocalIngestSegment } from '../ingestCache'
import { canRundownBeUpdated, getPartId, getRundownId } from '../lib'
import { CommitIngestData, runIngestJob, runWithRundownLock } from '../lock'
import { diffAndApplyChanges, diffAndUpdateSegmentIds } from './diff'
import { fixIllegalObject, getPartIdFromMosStory, getSegmentExternalId, parseMosString } from './lib'
import { getCurrentTime } from '../../lib'
import { normalizeArray, literal } from '@sofie-automation/corelib/dist/lib'
import { IngestPart } from '@sofie-automation/blueprints-integration'
import { handleUpdatedRundownInner, handleUpdatedRundownMetaDataInner } from '../rundownInput'

interface AnnotatedIngestPart {
	externalId: string
	partId: PartId
	segmentName: string
	ingest: LocalIngestPart
}
function storiesToIngestParts(
	context: JobContext,
	rundownId: RundownId,
	stories: MOS.IMOSStory[],
	undefinedPayload: boolean,
	existingIngestParts: AnnotatedIngestPart[]
): (AnnotatedIngestPart | null)[] {
	const span = context.startSpan('ingest.storiesToIngestParts')

	const existingIngestPartsMap = normalizeArray(existingIngestParts, 'externalId')

	const parts = stories.map((s, i) => {
		if (!s) return null

		const externalId = parseMosString(s.ID)
		const existingIngestPart = existingIngestPartsMap[externalId]

		const name = s.Slug ? parseMosString(s.Slug) : ''
		return {
			externalId: externalId,
			partId: getPartIdFromMosStory(rundownId, s.ID),
			segmentName: name.split(';')[0],
			ingest: literal<LocalIngestPart>({
				externalId: parseMosString(s.ID),
				name: name,
				rank: i,
				payload: undefinedPayload ? undefined : {},
				modified: existingIngestPart ? existingIngestPart.ingest.modified : getCurrentTime(),
			}),
		}
	})

	span?.end()
	return parts
}
/** Group IngestParts together into something that could be Segments */
function groupIngestParts(parts: AnnotatedIngestPart[]): { name: string; parts: LocalIngestPart[] }[] {
	const groupedParts: { name: string; parts: LocalIngestPart[] }[] = []
	_.each(parts, (part) => {
		const lastSegment = _.last(groupedParts)
		if (lastSegment && lastSegment.name === part.segmentName) {
			lastSegment.parts.push(part.ingest)
		} else {
			groupedParts.push({ name: part.segmentName, parts: [part.ingest] })
		}
	})

	// Ensure ranks are correct
	_.each(groupedParts, (group) => {
		for (let i = 0; i < group.parts.length; i++) {
			group.parts[i].rank = i
		}
	})

	return groupedParts
}
function groupedPartsToSegments(
	rundownId: RundownId,
	groupedParts: { name: string; parts: LocalIngestPart[] }[]
): LocalIngestSegment[] {
	return _.map(groupedParts, (grp, i) => {
		return literal<LocalIngestSegment>({
			externalId: getSegmentExternalId(rundownId, grp.parts[0]),
			name: grp.name,
			rank: i,
			parts: grp.parts,
			modified: Math.max(...grp.parts.map((p) => p.modified)), // pick the latest
		})
	})
}

export async function handleMosRundownData(context: JobContext, data: MosRundownProps): Promise<void> {
	// Create or update a rundown (ie from rundownCreate or rundownList)

	if (parseMosString(data.mosRunningOrder.ID) !== data.rundownExternalId)
		throw new Error('mosRunningOrder.ID and rundownExternalId mismatch!')

	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			const rundownId = getRundownId(context.studioId, data.rundownExternalId)
			const parts = _.compact(
				storiesToIngestParts(context, rundownId, data.mosRunningOrder.Stories || [], !data.isCreateAction, [])
			)
			const groupedStories = groupIngestParts(parts)

			// If this is a reload of a RO, then use cached data to make the change more seamless
			if (!data.isCreateAction && ingestRundown) {
				const partCacheMap = new Map<PartId, IngestPart>()
				for (const segment of ingestRundown.segments) {
					for (const part of segment.parts) {
						partCacheMap.set(getPartId(rundownId, part.externalId), part)
					}
				}

				for (const annotatedPart of parts) {
					const cached = partCacheMap.get(annotatedPart.partId)
					if (cached && !annotatedPart.ingest.payload) {
						annotatedPart.ingest.payload = cached.payload
					}
				}
			}

			const ingestSegments = groupedPartsToSegments(rundownId, groupedStories)

			return literal<LocalIngestRundown>({
				externalId: data.rundownExternalId,
				name: parseMosString(data.mosRunningOrder.Slug),
				type: 'mos',
				segments: ingestSegments,
				payload: data.mosRunningOrder,
				modified: getCurrentTime(),
			})
		},
		async (context, cache, newIngestRundown, oldIngestRundown) => {
			if (!newIngestRundown) throw new Error(`handleMosRundownData lost the IngestRundown...`)

			if (!canRundownBeUpdated(cache.Rundown.doc, data.isCreateAction)) return null

			let renamedSegments: CommitIngestData['renamedSegments'] = new Map()
			if (cache.Rundown.doc && oldIngestRundown) {
				// If we already have a rundown, update any modified segment ids
				renamedSegments = diffAndUpdateSegmentIds(context, cache, oldIngestRundown, newIngestRundown)
			}

			const res = await handleUpdatedRundownInner(
				context,
				cache,
				newIngestRundown,
				data.isCreateAction,
				data.peripheralDeviceId
			)
			if (res) {
				return {
					...res,
					renamedSegments: renamedSegments,
				}
			} else {
				return null
			}
		}
	)
}
export async function handleMosRundownMetadata(context: JobContext, data: MosRundownMetadataProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				ingestRundown.payload = _.extend(ingestRundown.payload, data.mosRunningOrderBase)
				ingestRundown.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, cache, ingestRundown) => {
			if (!ingestRundown) throw new Error(`handleMosRundownMetadata lost the IngestRundown...`)

			return handleUpdatedRundownMetaDataInner(context, cache, ingestRundown, data.peripheralDeviceId)
		}
	)
}

export async function handleMosRundownStatus(context: JobContext, data: MosRundownStatusProps): Promise<void> {
	const rundownId = getRundownId(context.studio, data.rundownExternalId)

	return runWithRundownLock(context, rundownId, async (rundown) => {
		if (!rundown) throw new Error(`Rundown "${rundownId}" not found!`)

		if (!canRundownBeUpdated(rundown, false)) return

		await context.directCollections.Rundowns.update(rundown._id, {
			$set: {
				status: data.status,
			},
		})
	})
}

export async function handleMosRundownReadyToAir(context: JobContext, data: MosRundownReadyToAirProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				// No change
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, cache, ingestRundown) => {
			if (!ingestRundown) throw new Error(`handleMosRundownReadyToAir lost the IngestRundown...`)

			if (!cache.Rundown.doc || cache.Rundown.doc.airStatus === data.status) return null

			// If rundown is orphaned, then it should be ignored
			if (cache.Rundown.doc.orphaned) return null

			cache.Rundown.update({
				$set: {
					airStatus: data.status,
				},
			})

			return handleUpdatedRundownMetaDataInner(context, cache, ingestRundown, data.peripheralDeviceId)
		}
	)
}

export async function handleMosStoryStatus(context: JobContext, data: MosStoryStatusProps): Promise<void> {
	const rundownId = getRundownId(context.studio, data.rundownExternalId)

	return runWithRundownLock(context, rundownId, async (rundown) => {
		if (!rundown) throw new Error(`Rundown "${rundownId}" not found!`)

		if (!canRundownBeUpdated(rundown, false)) return
		// TODO ORPHAN include segment in check

		// Save Stories (aka Part ) status into database:
		const part = await context.directCollections.Parts.findOne({
			_id: getPartIdFromMosStory(rundown._id, data.partExternalId),
			rundownId: rundown._id,
		})
		if (part) {
			await Promise.all([
				context.directCollections.Parts.update(part._id, {
					$set: {
						status: data.status,
					},
				}),
				// TODO-PartInstance - pending new data flow
				context.directCollections.PartInstances.update(
					{
						'part._id': part._id,
						reset: { $ne: true },
					},
					{
						$set: {
							status: data.status,
						},
					}
				),
			])
		} else {
			throw new Error(`Part ${data.partExternalId} in rundown ${rundown._id} not found`)
		}
	})
}

export async function handleMosFullStory(context: JobContext, data: MosFullStoryProps): Promise<void> {
	fixIllegalObject(data.story)

	const partExternalId = parseMosString(data.story.ID)

	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestPart = ingestRundown.segments
					.map((s) => s.parts)
					.flat()
					.find((p) => p.externalId === partExternalId)
				if (!ingestPart) {
					throw new Error(
						`handleMosFullStory: Missing MOS Story "${partExternalId}" in Rundown ingest data for "${data.rundownExternalId}"`
					)
				}

				// TODO - can the name change during a fullStory? If so then we need to be sure to update the segment groupings too
				// ingestPart.name = story.Slug ? parseMosString(story.Slug) : ''
				ingestPart.payload = data.story

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`handleMosFullStory: Missing MOS Rundown "${data.rundownExternalId}"`)
			}
		},
		async (context, cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) =>
				s.parts.find((p) => p.externalId === partExternalId)
			)
			if (!ingestSegment) throw new Error(`IngestSegment for story "${partExternalId}" is missing!`)
			return updateSegmentFromIngestData(context, cache, ingestSegment, false)
		}
	)
}

export async function handleMosDeleteStory(context: JobContext, data: MosDeleteStoryProps): Promise<void> {
	if (data.stories.length === 0) return

	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestParts = getAnnotatedIngestParts(context, ingestRundown)
				const ingestPartIds = new Set(ingestParts.map((part) => part.externalId))

				const storyIds = data.stories.map(parseMosString)

				logger.debug(`handleMosDeleteStory storyIds: [${storyIds.join(',')}]`)

				const missingIds = storyIds.filter((id) => !ingestPartIds.has(id))
				if (missingIds.length > 0) {
					throw new Error(
						`Parts ${missingIds.join(', ')} in rundown ${data.rundownExternalId} were not found`
					)
				}

				const rundownId = getRundownId(context.studioId, data.rundownExternalId)
				ingestRundown.segments = makeChangeToIngestParts(context, rundownId, ingestParts, (rundownParts) => {
					const storyIdsSet = new Set(storyIds)
					const filteredParts = rundownParts.filter((p) => !storyIdsSet.has(p.externalId))

					logger.debug(
						`handleMosDeleteStory, new part count ${filteredParts.length} (was ${rundownParts.length})`
					)

					return filteredParts
				})

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		diffAndApplyChanges
	)
}

function getAnnotatedIngestParts(context: JobContext, ingestRundown: LocalIngestRundown): AnnotatedIngestPart[] {
	const span = context.startSpan('mosDevice.ingest.getAnnotatedIngestParts')
	const ingestParts: AnnotatedIngestPart[] = []
	_.each(ingestRundown.segments, (s) => {
		_.each(s.parts, (p) => {
			ingestParts.push({
				externalId: p.externalId,
				partId: protectString(''), // Not used
				segmentName: s.name,
				ingest: p,
			})
		})
	})

	span?.end()
	return ingestParts
}

export async function handleMosInsertStories(context: JobContext, data: MosInsertStoryProps): Promise<void> {
	// inserts stories and all of their defined items before the referenced story in a Running Order
	// ...and roStoryReplace message replaces the referenced story with another story or stories

	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestParts = getAnnotatedIngestParts(context, ingestRundown)

				// The part of which we are about to insert stories after
				const insertBeforePartExternalId = data.insertBeforeStoryId
					? parseMosString(data.insertBeforeStoryId) || ''
					: ''
				const insertIndex = !insertBeforePartExternalId // insert last
					? ingestParts.length
					: ingestParts.findIndex((p) => p.externalId === insertBeforePartExternalId)
				if (insertIndex === -1) {
					throw new Error(`Part ${insertBeforePartExternalId} in rundown ${data.rundownExternalId} not found`)
				}

				const rundownId = getRundownId(context.studioId, data.rundownExternalId)
				const newParts = storiesToIngestParts(
					context,
					rundownId,
					data.newStories || [],
					true,
					ingestParts
				).filter(
					(p): p is AnnotatedIngestPart => !!p // remove falsy values from array
				)

				ingestRundown.segments = makeChangeToIngestParts(
					context,
					rundownId,
					ingestParts,
					(ingestPartsToModify) => {
						const modifiedIngestParts = [...ingestPartsToModify] // clone

						if (data.replace) {
							modifiedIngestParts.splice(insertIndex, 1) // Replace the previous part with new parts
						}

						const newPartExtenalIds = new Set(newParts.map((part) => part.externalId))
						const collidingPartIds = modifiedIngestParts
							.filter((part) => newPartExtenalIds.has(part.externalId))
							.map((part) => part.externalId)

						if (collidingPartIds.length > 0) {
							throw new Error(
								`Parts ${collidingPartIds.join(', ')} already exist in rundown ${
									data.rundownExternalId
								}`
							)
						}
						// Update parts list
						modifiedIngestParts.splice(insertIndex, 0, ...newParts)

						return modifiedIngestParts
					}
				)

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		diffAndApplyChanges
	)
}

export async function handleMosSwapStories(context: JobContext, data: MosSwapStoryProps): Promise<void> {
	const story0Str = parseMosString(data.story0)
	const story1Str = parseMosString(data.story1)
	if (story0Str === story1Str) {
		throw new Error(`Cannot swap part ${story0Str} with itself in rundown ${data.rundownExternalId}`)
	}

	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestParts = getAnnotatedIngestParts(context, ingestRundown)

				const rundownId = getRundownId(context.studioId, data.rundownExternalId)
				ingestRundown.segments = makeChangeToIngestParts(context, rundownId, ingestParts, (rundownParts) => {
					const story0Index = rundownParts.findIndex((p) => p.externalId === story0Str)
					if (story0Index === -1) {
						throw new Error(`Story ${story0Str} not found in rundown ${data.rundownExternalId}`)
					}
					const story1Index = rundownParts.findIndex((p) => p.externalId === story1Str)
					if (story1Index === -1) {
						throw new Error(`Story ${story1Str} not found in rundown ${data.rundownExternalId}`)
					}
					const tmp = rundownParts[story0Index]
					rundownParts[story0Index] = rundownParts[story1Index]
					rundownParts[story1Index] = tmp

					return rundownParts
				})

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		diffAndApplyChanges
	)
}
export async function handleMosMoveStories(context: JobContext, data: MosMoveStoryProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestParts = getAnnotatedIngestParts(context, ingestRundown)

				// Get story data
				const storyIds = data.stories.map(parseMosString)

				const rundownId = getRundownId(context.studioId, data.rundownExternalId)
				ingestRundown.segments = makeChangeToIngestParts(context, rundownId, ingestParts, (rundownParts) => {
					// Extract the parts-to-be-moved:
					const movingParts = _.sortBy(
						rundownParts.filter((p) => storyIds.indexOf(p.externalId) !== -1),
						(p) => storyIds.indexOf(p.externalId)
					)
					const filteredParts = rundownParts.filter((p) => storyIds.indexOf(p.externalId) === -1)

					// Ensure all stories to move were found
					const movingIds = _.map(movingParts, (p) => p.externalId)
					const missingIds = _.filter(storyIds, (id) => movingIds.indexOf(id) === -1)
					if (missingIds.length > 0) {
						throw new Error(
							`Parts ${missingIds.join(', ')} were not found in rundown ${data.rundownExternalId}`
						)
					}

					// Find insert point
					const insertBeforePartExternalId = data.insertBeforeStoryId
						? parseMosString(data.insertBeforeStoryId) || ''
						: ''
					const insertIndex = !insertBeforePartExternalId // insert last
						? filteredParts.length
						: filteredParts.findIndex((p) => p.externalId === insertBeforePartExternalId)
					if (insertIndex === -1) {
						throw new Error(
							`Part ${insertBeforePartExternalId} was not found in rundown ${data.rundownExternalId}`
						)
					}

					// Reinsert parts
					filteredParts.splice(insertIndex, 0, ...movingParts)

					return filteredParts
				})

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		diffAndApplyChanges
	)
}

/** Takes a list of ingestParts, modify it, then output them grouped together into ingestSegments, keeping track of the modified property */
function makeChangeToIngestParts(
	context: JobContext,
	rundownId: RundownId,
	ingestParts: AnnotatedIngestPart[],
	modifyFunction: (ingestParts: AnnotatedIngestPart[]) => AnnotatedIngestPart[]
): LocalIngestSegment[] {
	const span = context.startSpan('mosDevice.ingest.makeChangeToIngestParts')

	// Before making the modification to ingestParts, create a list of segments from the original data, to use for calculating the
	// .modified property below.
	const referenceIngestSegments = groupPartsIntoIngestSegments(rundownId, ingestParts)

	const modifiedParts = modifyFunction(ingestParts)

	// Compare to reference, to make sure that ingestSegment.modified is updated in case of a change
	const newIngestSegments = groupPartsIntoIngestSegments(rundownId, modifiedParts)

	_.each(newIngestSegments, (ingestSegment) => {
		if (!ingestSegment.modified) {
			ingestSegment.modified = getCurrentTime()
		} else {
			const ref = referenceIngestSegments.find((s) => s.externalId === ingestSegment.externalId)
			if (ref) {
				if (ref.parts.length !== ingestSegment.parts.length) {
					// A part has been added, or removed
					ingestSegment.modified = getCurrentTime()
				} else {
					// No obvious change.
					// (If an individual part has been updated, the segment.modified property has already been updated anyway)
				}
			} else {
				// The reference doesn't exist (can happen for example if a segment has been merged, or split into two)
				ingestSegment.modified = getCurrentTime()
			}
		}
	})

	span?.end()
	return newIngestSegments
}
function groupPartsIntoIngestSegments(
	rundownId: RundownId,
	newIngestParts: AnnotatedIngestPart[]
): LocalIngestSegment[] {
	// Group the parts and make them into Segments:
	const newGroupedParts = groupIngestParts(newIngestParts)
	return groupedPartsToSegments(rundownId, newGroupedParts)
}
