import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	MosDeleteStoryProps,
	MosFullStoryProps,
	MosInsertStoryProps,
	MosMoveStoryProps,
	MosStoryStatusProps,
	MosSwapStoryProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { logger } from '../../logging'
import _ = require('underscore')
import { JobContext } from '../../jobs'
import { updateSegmentFromIngestData } from '../generationSegment'
import { LocalIngestRundown } from '../ingestCache'
import { canRundownBeUpdated, getRundownId } from '../lib'
import { runIngestJob, runWithRundownLock } from '../lock'
import { diffAndApplyChanges } from './diff'
import { fixIllegalObject, getPartIdFromMosStory, parseMosString } from './lib'
import { AnnotatedIngestPart, makeChangeToIngestParts, storiesToIngestParts } from './mosToIngest'

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

/**
 * Update the status of a mos story
 */
export async function handleMosStoryStatus(context: JobContext, data: MosStoryStatusProps): Promise<void> {
	const rundownId = getRundownId(context.studioId, data.rundownExternalId)

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
							'part.status': data.status,
						},
					}
				),
			])
		} else {
			throw new Error(`Part ${data.partExternalId} in rundown ${rundown._id} not found`)
		}
	})
}

/**
 * Update the payload of a mos story
 */
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

/**
 * Delete a mos story
 */
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

/**
 * Insert a mos story before the referenced existing story
 */
export async function handleMosInsertStories(context: JobContext, data: MosInsertStoryProps): Promise<void> {
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

/**
 * Swap positions of two mos stories
 */
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

/**
 * Move a list of mos stories
 */
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
