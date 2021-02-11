import * as _ from 'underscore'
import * as MOS from 'mos-connection'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { getStudioFromDevice, getSegmentId, canRundownBeUpdated, getPartId, getRundownId, getRundown2 } from '../lib'
import {
	getRundownIdFromMosRO,
	getPartIdFromMosStory,
	getSegmentExternalId,
	fixIllegalObject,
	parseMosString,
} from './lib'
import {
	literal,
	protectString,
	getCurrentTime,
	normalizeArray,
	asyncCollectionInsert,
	asyncCollectionRemove,
	asyncCollectionUpdate,
	clone,
} from '../../../../lib/lib'
import { IngestPart, IngestSegment } from '@sofie-automation/blueprints-integration'
import { handleUpdatedRundownInner } from '../rundownInput'
import { LocalIngestRundown, LocalIngestSegment, LocalIngestPart } from '../ingestCache'
import { Rundown, RundownId } from '../../../../lib/collections/Rundowns'
import { Segment, SegmentId, Segments } from '../../../../lib/collections/Segments'
import { logger } from '../../../../lib/logging'
import { Parts, PartId } from '../../../../lib/collections/Parts'
import { PartInstances } from '../../../../lib/collections/PartInstances'
import { profiler } from '../../profiler'
import { Pieces } from '../../../../lib/collections/Pieces'
import { CommitIngestData, ingestLockFunction } from '../syncFunction'
import { calculateSegmentsFromIngestData, saveSegmentChangesToCache, updateSegmentFromIngestData } from '../generation'
import { removeSegmentContents } from '../cleanup'
import { ReadonlyDeep } from 'type-fest'
import { CacheForIngest } from '../cache'
import { Settings } from '../../../../lib/Settings'

interface AnnotatedIngestPart {
	externalId: string
	partId: PartId
	segmentName: string
	ingest: LocalIngestPart
}
function storiesToIngestParts(
	rundownId: RundownId,
	stories: MOS.IMOSStory[],
	undefinedPayload: boolean,
	existingIngestParts: AnnotatedIngestPart[]
): (AnnotatedIngestPart | null)[] {
	const span = profiler.startSpan('ingest.storiesToIngestParts')

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

export function handleMosRundownData(
	peripheralDevice: PeripheralDevice,
	mosRunningOrder: MOS.IMOSRunningOrder,
	isCreateAction: boolean
) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, mosRunningOrder.ID)
	const rundownExternalId = parseMosString(mosRunningOrder.ID)

	// Create or update a rundown (ie from rundownCreate or rundownList)

	return ingestLockFunction(
		'handleMosRundownData',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			const parts = _.compact(storiesToIngestParts(rundownId, mosRunningOrder.Stories || [], !isCreateAction, []))
			const groupedStories = groupIngestParts(parts)

			// If this is a reload of a RO, then use cached data to make the change more seamless
			if (!isCreateAction && ingestRundown) {
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
				externalId: parseMosString(mosRunningOrder.ID),
				name: parseMosString(mosRunningOrder.Slug),
				type: 'mos',
				segments: ingestSegments,
				payload: mosRunningOrder,
				modified: getCurrentTime(),
			})
		},
		async (cache, newIngestRundown, oldIngestRundown) => {
			if (!newIngestRundown) throw new Meteor.Error(`handleMosRundownData lost the IngestRundown...`)

			if (!canRundownBeUpdated(cache.Rundown.doc, isCreateAction)) return null

			let renamedSegments: CommitIngestData['renamedSegments'] = []
			if (cache.Rundown.doc && oldIngestRundown) {
				// If we already have a rundown, update any modified segment ids
				renamedSegments = diffAndUpdateSegmentIds(cache, oldIngestRundown, newIngestRundown)
			}

			const res = await handleUpdatedRundownInner(cache, newIngestRundown, isCreateAction, peripheralDevice)
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
export function handleMosRundownMetadata(
	peripheralDevice: PeripheralDevice,
	mosRunningOrderBase: MOS.IMOSRunningOrderBase
) {
	const studio = getStudioFromDevice(peripheralDevice)

	const rundownExternalId = parseMosString(mosRunningOrderBase.ID)

	return ingestLockFunction(
		'handleMosRundownMetadata',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				ingestRundown.payload = _.extend(ingestRundown.payload, mosRunningOrderBase)
				ingestRundown.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			if (!ingestRundown) throw new Meteor.Error(`handleMosRundownMetadata lost the IngestRundown...`)

			return handleUpdatedRundownInner(cache, ingestRundown, false, peripheralDevice)
		}
	)
}

export function handleMosFullStory(peripheralDevice: PeripheralDevice, story: MOS.IMOSROFullStory) {
	const span = profiler.startSpan('mosDevice.ingest.handleMosFullStory')

	fixIllegalObject(story)
	// @ts-ignore
	// logger.debug(story)

	const studio = getStudioFromDevice(peripheralDevice)

	const partExternalId = parseMosString(story.ID)
	const rundownExternalId = parseMosString(story.RunningOrderId)

	return ingestLockFunction(
		'handleMosFullStory',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestPart = ingestRundown.segments
					.map((s) => s.parts)
					.flat()
					.find((p) => p.externalId === partExternalId)
				if (!ingestPart) {
					logger.warn(
						`handleMosFullStory: Missing MOS Story "${partExternalId}" in Rundown ingest data for "${rundownExternalId}"`
					)
					return null
				}

				// TODO - can the name change during a fullStory? If so then we need to be sure to update the segment groupings too
				// ingestPart.name = story.Slug ? parseMosString(story.Slug) : ''
				ingestPart.payload = story

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) =>
				s.parts.find((p) => p.externalId === partExternalId)
			)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment for story "${partExternalId}" is missing!`)
			return updateSegmentFromIngestData(cache, ingestSegment, false)
		}
	)
}
export function handleMosDeleteStory(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	stories: Array<MOS.MosString128>
) {
	if (stories.length === 0) return

	const studio = getStudioFromDevice(peripheralDevice)

	const rundownExternalId = parseMosString(runningOrderMosId)
	const rundownId = getRundownId(studio, rundownExternalId)
	return ingestLockFunction(
		'handleMosDeleteStory',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestParts = getAnnotatedIngestParts(ingestRundown)
				const ingestPartIds = ingestParts.map((part) => part.externalId)

				const storyIds = stories.map(parseMosString)

				logger.debug(`handleMosDeleteStory storyIds: [${storyIds.join(',')}]`)

				const missingIds = storyIds.filter((id) => ingestPartIds.indexOf(id) === -1)
				if (missingIds.length > 0) {
					throw new Meteor.Error(
						404,
						`Parts ${missingIds.join(', ')} in rundown ${rundownExternalId} were not found`
					)
				}

				ingestRundown.segments = makeChangeToIngestParts(rundownId, ingestParts, (ingestParts) => {
					const filteredParts = ingestParts.filter((p) => storyIds.indexOf(p.externalId) === -1)
					// if (filteredParts.length === ingestParts.length) return // Nothing was removed
					logger.debug(
						`handleMosDeleteStory, new part count ${filteredParts.length} (was ${ingestParts.length})`
					)

					return filteredParts
				})

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		diffAndApplyChanges
	)
}

function getAnnotatedIngestParts(ingestRundown: LocalIngestRundown): AnnotatedIngestPart[] {
	const span = profiler.startSpan('mosDevice.ingest.getAnnotatedIngestParts')
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
export function handleMosInsertParts(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	insertBeforeStoryId: MOS.MosString128 | null,
	removePrevious: boolean,
	newStories: MOS.IMOSROStory[]
) {
	// inserts stories and all of their defined items before the referenced story in a Running Order
	// ...and roStoryReplace message replaces the referenced story with another story or stories

	const studio = getStudioFromDevice(peripheralDevice)

	const rundownExternalId = parseMosString(runningOrderMosId)
	const rundownId = getRundownId(studio, rundownExternalId)
	return ingestLockFunction(
		'handleMosInsertParts',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestParts = getAnnotatedIngestParts(ingestRundown)

				// The part of which we are about to insert stories after
				const insertBeforePartExternalId = insertBeforeStoryId ? parseMosString(insertBeforeStoryId) || '' : ''
				const insertIndex = !insertBeforePartExternalId // insert last
					? ingestParts.length
					: ingestParts.findIndex((p) => p.externalId === insertBeforePartExternalId)
				if (insertIndex === -1) {
					throw new Meteor.Error(
						404,
						`Part ${insertBeforePartExternalId} in rundown ${rundownExternalId} not found`
					)
				}

				const newParts = storiesToIngestParts(rundownId, newStories || [], true, ingestParts).filter(
					(p): p is AnnotatedIngestPart => !!p // remove falsy values from array
				)
				const newPartExtenalIds = newParts.map((part) => part.externalId)

				ingestRundown.segments = makeChangeToIngestParts(rundownId, ingestParts, (ingestPartsToModify) => {
					const modifiedIngestParts = [...ingestPartsToModify] // clone

					if (removePrevious) {
						modifiedIngestParts.splice(insertIndex, 1) // Replace the previous part with new parts
					}

					const collidingPartIds = modifiedIngestParts
						.filter((part) => newPartExtenalIds.indexOf(part.externalId) > -1)
						.map((part) => part.externalId)

					if (collidingPartIds.length > 0) {
						throw new Meteor.Error(
							500,
							`Parts ${collidingPartIds.join(', ')} already exist in rundown ${rundownExternalId}`
						)
					}
					// Update parts list
					modifiedIngestParts.splice(insertIndex, 0, ...newParts)

					return modifiedIngestParts
				})

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		diffAndApplyChanges
	)
}

export function handleMosSwapStories(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	story0: MOS.MosString128,
	story1: MOS.MosString128
) {
	const studio = getStudioFromDevice(peripheralDevice)

	const story0Str = parseMosString(story0)
	const story1Str = parseMosString(story1)
	if (story0Str === story1Str) {
		throw new Meteor.Error(
			400,
			`Cannot swap part ${story0Str} with itself in rundown ${parseMosString(runningOrderMosId)}`
		)
	}

	const rundownExternalId = parseMosString(runningOrderMosId)
	const rundownId = getRundownId(studio, rundownExternalId)
	return ingestLockFunction(
		'handleMosSwapStories',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestParts = getAnnotatedIngestParts(ingestRundown)

				ingestRundown.segments = makeChangeToIngestParts(rundownId, ingestParts, (ingestParts) => {
					const story0Index = ingestParts.findIndex((p) => p.externalId === story0Str)
					if (story0Index === -1) {
						throw new Meteor.Error(
							404,
							`Story ${story0} not found in rundown ${parseMosString(runningOrderMosId)}`
						)
					}
					const story1Index = ingestParts.findIndex((p) => p.externalId === story1Str)
					if (story1Index === -1) {
						throw new Meteor.Error(
							404,
							`Story ${story1} not found in rundown ${parseMosString(runningOrderMosId)}`
						)
					}
					const tmp = ingestParts[story0Index]
					ingestParts[story0Index] = ingestParts[story1Index]
					ingestParts[story1Index] = tmp

					return ingestParts
				})

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		diffAndApplyChanges
	)
}
export function handleMosMoveStories(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	insertBeforeStoryId: MOS.MosString128 | null,
	stories: MOS.MosString128[]
) {
	const studio = getStudioFromDevice(peripheralDevice)

	const rundownExternalId = parseMosString(runningOrderMosId)
	const rundownId = getRundownId(studio, rundownExternalId)
	return ingestLockFunction(
		'handleMosMoveStories',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestParts = getAnnotatedIngestParts(ingestRundown)

				// Get story data
				const storyIds = stories.map(parseMosString)

				ingestRundown.segments = makeChangeToIngestParts(rundownId, ingestParts, (ingestParts) => {
					// Extract the parts-to-be-moved:
					const movingParts = _.sortBy(
						ingestParts.filter((p) => storyIds.indexOf(p.externalId) !== -1),
						(p) => storyIds.indexOf(p.externalId)
					)
					const filteredParts = ingestParts.filter((p) => storyIds.indexOf(p.externalId) === -1)

					// Ensure all stories to move were found
					const movingIds = _.map(movingParts, (p) => p.externalId)
					const missingIds = _.filter(storyIds, (id) => movingIds.indexOf(id) === -1)
					if (missingIds.length > 0) {
						throw new Meteor.Error(
							404,
							`Parts ${missingIds.join(', ')} were not found in rundown ${rundownExternalId}`
						)
					}

					// Find insert point
					const insertBeforePartExternalId = insertBeforeStoryId
						? parseMosString(insertBeforeStoryId) || ''
						: ''
					const insertIndex = !insertBeforePartExternalId // insert last
						? filteredParts.length
						: filteredParts.findIndex((p) => p.externalId === insertBeforePartExternalId)
					if (insertIndex === -1) {
						throw new Meteor.Error(
							404,
							`Part ${insertBeforeStoryId} was not found in rundown ${rundownExternalId}`
						)
					}

					// Reinsert parts
					filteredParts.splice(insertIndex, 0, ...movingParts)

					return filteredParts
				})

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		diffAndApplyChanges
	)
}
/** Takes a list of ingestParts, modify it, then output them grouped together into ingestSegments, keeping track of the modified property */
function makeChangeToIngestParts(
	rundownId: RundownId,
	ingestParts: AnnotatedIngestPart[],
	modifyFunction: (ingestParts: AnnotatedIngestPart[]) => AnnotatedIngestPart[]
): LocalIngestSegment[] {
	const span = profiler.startSpan('mosDevice.ingest.makeChangeToIngestParts')

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
				if (ref.parts.length === ingestSegment.parts.length) {
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
	const newIngestSegments = groupedPartsToSegments(rundownId, newGroupedParts)

	return newIngestSegments
}

function diffAndUpdateSegmentIds(
	cache: CacheForIngest,
	oldIngestRundown: ReadonlyDeep<LocalIngestRundown>,
	newIngestRundown: ReadonlyDeep<LocalIngestRundown>
): CommitIngestData['renamedSegments'] {
	const span = profiler.startSpan('mosDevice.ingest.diffAndApplyChanges')

	// TODO this is a duplicate of a loop found in diffAndApplyChanges but modified to not run against a cache.
	// This should be improved once the caches change, and we have access to one in time for this

	const oldSegments = cache.Segments.findFetch()
	const oldSegmentEntries = compileSegmentEntries(oldIngestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(newIngestRundown.segments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries, oldSegments)

	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = applyExternalIdDiff(cache, segmentDiff)

	span?.end()
	return renamedSegments
}

function applyExternalIdDiff(
	cache: CacheForIngest,
	segmentDiff: DiffSegmentEntries
): CommitIngestData['renamedSegments'] {
	// Updated segments that has had their segment.externalId changed:
	const renamedSegments: Array<[SegmentId, SegmentId]> = []
	_.each(segmentDiff.externalIdChanged, (newSegmentExternalId, oldSegmentExternalId) => {
		const oldSegmentId = getSegmentId(cache.RundownId, oldSegmentExternalId)
		const newSegmentId = getSegmentId(cache.RundownId, newSegmentExternalId)

		// Some data will be orphaned temporarily, but will be picked up/cleaned up before the cache gets saved

		// TODO ORPHAN - can this be done in a more generic way?

		const oldSegment = cache.Segments.findOne(oldSegmentId)
		renamedSegments.push([oldSegmentId, newSegmentId])
		if (oldSegment) {
			cache.Segments.remove(oldSegmentId)
			cache.Segments.insert({
				...oldSegment,
				_id: newSegmentId,
			})
		}

		// Move over those parts to the new segmentId.
		cache.Parts.update((p) => p.segmentId === oldSegmentId, {
			$set: {
				segmentId: newSegmentId,
			},
		})

		cache.Pieces.update((p) => p.startRundownId === cache.RundownId && p.startSegmentId === oldSegmentId, {
			$set: {
				startSegmentId: newSegmentId,
			},
		})
	})

	return renamedSegments
}

async function diffAndApplyChanges(
	cache: CacheForIngest,
	oldIngestRundown: ReadonlyDeep<LocalIngestRundown> | undefined,
	newIngestRundown: ReadonlyDeep<LocalIngestRundown> | undefined
	// newIngestParts: AnnotatedIngestPart[]
): Promise<CommitIngestData | null> {
	if (!newIngestRundown) throw new Meteor.Error(`handleMosDeleteStory lost the new IngestRundown...`)
	if (!oldIngestRundown) throw new Meteor.Error(`handleMosDeleteStory lost the old IngestRundown...`)

	const rundown = getRundown2(cache)

	// TODO - this has been removed, are the modified times being updated correctly???
	// const newIngestRundown = updateIngestRundownWithData(oldIngestRundown, newIngestSegments)

	const span = profiler.startSpan('mosDevice.ingest.diffAndApplyChanges')

	// Fetch all existing segments:
	const oldSegments = cache.Segments.findFetch({ rundownId: rundown._id })

	const oldSegmentEntries = compileSegmentEntries(oldIngestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(newIngestRundown.segments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries, oldSegments)

	// TODO - do we need to do these 'clever' updates anymore? As we don't store any playout properties on the Parts, destroying and recreating won't have negative impacts?
	// The one exception is PartInstances when the segmentId changes, but that is handled by `updatePartInstancesBasicProperties()` as a general data integrity enforcement step

	// Update segment ranks:
	_.each(segmentDiff.onlyRankChanged, (newRank, segmentExternalId) => {
		cache.Segments.update(getSegmentId(rundown._id, segmentExternalId), {
			$set: {
				_rank: newRank,
			},
		})
	})

	// Updated segments that has had their segment.externalId changed:
	const renamedSegments = applyExternalIdDiff(cache, segmentDiff)

	// Create/Update segments
	const segmentChanges = await calculateSegmentsFromIngestData(
		cache,
		rundown,
		_.sortBy([...Object.values(segmentDiff.added), ...Object.values(segmentDiff.changed)], (se) => se.rank)
	)

	// Remove/orphan old segments
	const segmentIdsToRemove = new Set(Object.keys(segmentDiff.removed).map((id) => getSegmentId(rundown._id, id)))
	// We orphan it and queue for deletion. the commit phase will complete if possible
	cache.Segments.update((s) => segmentIdsToRemove.has(s._id), {
		$set: {
			orphaned: 'deleted',
		},
	})

	if (!Settings.allowUnsyncedSegments) {
		// Remove everything inside the segment
		removeSegmentContents(cache, segmentIdsToRemove)
	}

	await saveSegmentChangesToCache(cache, segmentChanges, false)

	span?.end()
	return literal<CommitIngestData>({
		changedSegmentIds: segmentChanges.segments.map((s) => s._id),
		removedSegmentIds: Array.from(segmentIdsToRemove),
		renamedSegments: renamedSegments,

		removeRundown: false,

		showStyle: segmentChanges.showStyle,
		blueprint: segmentChanges.blueprint,
	})
}

export type SegmentEntries = { [segmentExternalId: string]: LocalIngestSegment }
export function compileSegmentEntries(ingestSegments: ReadonlyDeep<Array<LocalIngestSegment>>): SegmentEntries {
	const segmentEntries: SegmentEntries = {}

	for (const ingestSegment of ingestSegments) {
		if (segmentEntries[ingestSegment.externalId]) {
			throw new Meteor.Error(
				500,
				`compileSegmentEntries: Non-unique segment external ID: "${ingestSegment.externalId}"`
			)
		}
		segmentEntries[ingestSegment.externalId] = clone<LocalIngestSegment>(ingestSegment)
	}

	return segmentEntries
}
export interface DiffSegmentEntries {
	added: { [segmentExternalId: string]: LocalIngestSegment }
	changed: { [segmentExternalId: string]: LocalIngestSegment }
	removed: { [segmentExternalId: string]: LocalIngestSegment }
	unchanged: { [segmentExternalId: string]: LocalIngestSegment }

	// Note: The objects present below are also present in the collections above

	/** Reference to segments which only had their ranks updated */
	onlyRankChanged: { [segmentExternalId: string]: number } // contains the new rank

	/** Reference to segments which has been REMOVED, but it looks like there is an ADDED segment that is closely related to the removed one */
	externalIdChanged: { [removedSegmentExternalId: string]: string } // contains the added segment's externalId
}
export function diffSegmentEntries(
	oldSegmentEntries: SegmentEntries,
	newSegmentEntries: SegmentEntries,
	oldSegments: Segment[] | null
): DiffSegmentEntries {
	const diff: DiffSegmentEntries = {
		added: {},
		changed: {},
		removed: {},
		unchanged: {},

		onlyRankChanged: {},
		externalIdChanged: {},
	}
	const oldSegmentMap: { [externalId: string]: Segment } | null =
		oldSegments === null ? null : normalizeArray(oldSegments, 'externalId')

	_.each(newSegmentEntries, (newSegmentEntry, segmentExternalId) => {
		const oldSegmentEntry = oldSegmentEntries[segmentExternalId] as IngestSegment | undefined
		let oldSegment: Segment | undefined
		if (oldSegmentMap) {
			oldSegment = oldSegmentMap[newSegmentEntry.externalId]
			if (!oldSegment) {
				// Segment has been added
				diff.added[segmentExternalId] = newSegmentEntry
				return
			}
		}
		if (oldSegmentEntry) {
			const modifiedIsEqual = oldSegment ? newSegmentEntry.modified === oldSegment.externalModified : true
			// deep compare:
			const ingestContentIsEqual = _.isEqual(_.omit(newSegmentEntry, 'rank'), _.omit(oldSegmentEntry, 'rank'))
			const rankIsEqual = oldSegment
				? newSegmentEntry.rank === oldSegment._rank
				: newSegmentEntry.rank === oldSegmentEntry.rank

			// Compare the modified timestamps:
			if (modifiedIsEqual && ingestContentIsEqual && rankIsEqual) {
				diff.unchanged[segmentExternalId] = newSegmentEntry
			} else {
				// Something has changed
				diff.changed[segmentExternalId] = newSegmentEntry

				// Check if it's only the rank that has changed:
				if (ingestContentIsEqual && !rankIsEqual) {
					diff.onlyRankChanged[segmentExternalId] = newSegmentEntry.rank
				}
			}
		} else {
			// Segment has been added
			diff.added[segmentExternalId] = newSegmentEntry
		}
	})

	_.each(oldSegmentEntries, (oldSegmentEntry, segmentExternalId) => {
		const newSegmentEntry = newSegmentEntries[segmentExternalId] as IngestSegment | undefined
		if (!newSegmentEntry) {
			diff.removed[segmentExternalId] = oldSegmentEntry
		}
	})

	// Handle when the externalId has change
	_.each(diff.removed, (segmentEntry, segmentExternalId) => {
		// try finding "it" in the added, using name
		let newSegmentEntry = _.find(diff.added, (se) => se.name === segmentEntry.name)
		if (!newSegmentEntry) {
			// second try, match with any parts:
			newSegmentEntry = _.find(diff.added, (se) => {
				let found = false
				_.each(segmentEntry.parts, (part) => {
					if (found || _.find(se.parts, (p) => p.externalId === part.externalId)) {
						found = true
					}
				})
				return found
			})
		}
		if (newSegmentEntry) {
			diff.externalIdChanged[segmentExternalId] = newSegmentEntry.externalId
		}
	})

	return diff
}
