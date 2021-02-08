import * as _ from 'underscore'
import * as MOS from 'mos-connection'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import {
	getSegmentId,
	canBeUpdated,
	getPartId,
	rundownIngestSyncFunction,
	getRundownId,
	getRundown2,
	IngestPlayoutInfo,
} from '../lib'
import { getPartIdFromMosStory, getSegmentExternalId, fixIllegalObject, parseMosString } from './lib'
import { literal, protectString, unprotectString, getCurrentTime, normalizeArray } from '../../../../lib/lib'
import { IngestPart, IngestSegment } from '@sofie-automation/blueprints-integration'
import { IngestCacheType } from '../../../../lib/collections/IngestDataCache'
import {
	prepareUpdateRundownInner,
	prepareUpdatePartInner,
	savePreparedRundownChanges,
	savePreparedSegmentChanges,
	afterIngestChangedData,
	prepareUpdateSegmentFromIngestData,
	PreparedSegmentChanges,
} from '../rundownInput'
import {
	loadCachedRundownData,
	saveRundownCache,
	loadCachedIngestSegment,
	loadIngestDataCachePart,
	LocalIngestRundown,
	LocalIngestSegment,
	LocalIngestPart,
	updateIngestRundownWithData,
	RundownIngestDataCacheCollection,
} from '../ingestCache'
import { Rundown, RundownId } from '../../../../lib/collections/Rundowns'
import { Segment, SegmentId } from '../../../../lib/collections/Segments'
import { ChangedSegmentsRankInfo, removeSegments, ServerRundownAPI } from '../../rundown'
import { UpdateNext } from '../updateNext'
import { logger } from '../../../../lib/logging'
import { PartId } from '../../../../lib/collections/Parts'
import { CacheForIngest, ReadOnlyCache } from '../../../cache/DatabaseCaches'
import { Settings } from '../../../../lib/Settings'
import { ReadonlyDeep } from 'type-fest'
import { PartInstances } from '../../../../lib/collections/PartInstances'
import { loadShowStyleBlueprint } from '../../blueprints/cache'
import { getShowStyleCompound2 } from '../../../../lib/collections/ShowStyleVariants'
import { profiler } from '../../profiler'

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
	createFresh: boolean
) {
	const span = profiler.startSpan('ingest.handleMosRundownData')
	const rundownExternalId = parseMosString(mosRunningOrder.ID)

	rundownIngestSyncFunction(
		'handleMosRundownData',
		peripheralDevice,
		rundownExternalId,
		(cache, ingestDataCache) => {
			const rundownId = getRundownId(cache.Studio.doc, rundownExternalId)

			const parts = _.compact(storiesToIngestParts(rundownId, mosRunningOrder.Stories || [], !createFresh, []))
			const groupedStories = groupIngestParts(parts)

			// If this is a reload of a RO, then use cached data to make the change more seamless
			if (!createFresh) {
				const partIds = _.map(parts, (p) => p.partId)
				const partCache = ingestDataCache.findFetch({
					partId: { $in: partIds },
					type: IngestCacheType.PART,
				})

				const partCacheMap: { [id: string]: IngestPart } = {}
				_.each(partCache, (p) => {
					if (p.partId) {
						partCacheMap[unprotectString(p.partId)] = p.data as IngestPart
					}
				})

				_.each(parts, (s) => {
					const cached = partCacheMap[unprotectString(s.partId)]
					if (cached) {
						s.ingest.payload = cached.payload
					}
				})
			}

			const ingestSegments = groupedPartsToSegments(rundownId, groupedStories)

			const ingestRundown = literal<LocalIngestRundown>({
				externalId: parseMosString(mosRunningOrder.ID),
				name: parseMosString(mosRunningOrder.Slug),
				type: 'mos',
				segments: ingestSegments,
				payload: mosRunningOrder,
				modified: getCurrentTime(),
			})

			return prepareUpdateRundownInner(
				cache,
				ingestDataCache,
				ingestRundown,
				undefined,
				createFresh ? 'mosCreate' : 'mosList',
				peripheralDevice
			)
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				savePreparedRundownChanges(cache, playoutInfo, preparedChanges)
			}
		}
	)
	span?.end()
}
export function handleMosRundownMetadata(
	peripheralDevice: PeripheralDevice,
	mosRunningOrderBase: MOS.IMOSRunningOrderBase
) {
	const span = profiler.startSpan('mosDevice.ingest.handleMosRundownMetadata')
	const rundownExternalId = parseMosString(mosRunningOrderBase.ID)

	rundownIngestSyncFunction(
		'handleMosRundownMetadata',
		peripheralDevice,
		rundownExternalId,
		(cache, ingestDataCache) => {
			const rundown = getRundown2(cache)

			// Load the cached RO Data
			const ingestRundown = loadCachedRundownData(ingestDataCache, rundown._id, rundown.externalId)
			ingestRundown.payload = _.extend(ingestRundown.payload, mosRunningOrderBase)
			ingestRundown.modified = getCurrentTime()
			// TODO - verify this doesn't lose data, it was doing more work before

			// TODO - make this more lightweight?
			return prepareUpdateRundownInner(
				cache,
				ingestDataCache,
				ingestRundown,
				undefined,
				'mosRoMetadata',
				peripheralDevice
			)
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				savePreparedRundownChanges(cache, playoutInfo, preparedChanges)
			}
		}
	)
	span?.end()
}

export function handleMosFullStory(peripheralDevice: PeripheralDevice, story: MOS.IMOSROFullStory) {
	const span = profiler.startSpan('mosDevice.ingest.handleMosFullStory')

	fixIllegalObject(story)

	const rundownExternalId = parseMosString(story.RunningOrderId)

	rundownIngestSyncFunction(
		'handleMosFullStory',
		peripheralDevice,
		rundownExternalId,
		(cache, ingestDataCache) => {
			const rundown = getRundown2(cache)
			const partId = getPartIdFromMosStory(rundown._id, story.ID)

			const cachedPartData = loadIngestDataCachePart(
				ingestDataCache,
				parseMosString(story.RunningOrderId),
				partId,
				parseMosString(story.ID)
			)
			if (!cachedPartData.segmentId)
				throw new Meteor.Error(500, `SegmentId missing for part "${partId}" (MOSFullStory)`)

			const ingestSegment: IngestSegment = loadCachedIngestSegment(
				ingestDataCache,
				parseMosString(story.RunningOrderId),
				cachedPartData.segmentId,
				unprotectString(cachedPartData.segmentId)
			)

			const ingestPart: IngestPart = cachedPartData.data
			// TODO - can the name change during a fullStory? If so then we need to be sure to update the segment groupings too
			// ingestPart.name = story.Slug ? parseMosString(story.Slug) : ''
			ingestPart.payload = story

			// Update db with the full story:
			return prepareUpdatePartInner(cache, ingestDataCache, ingestSegment.externalId, ingestPart)
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				const { segmentId: updatedSegmentId, oldPartIdsAndRanks } = savePreparedSegmentChanges(
					cache,
					playoutInfo,
					preparedChanges
				)
				if (updatedSegmentId) {
					afterIngestChangedData(cache, playoutInfo, [{ segmentId: updatedSegmentId, oldPartIdsAndRanks }])
				}
			}
		}
	)
	span?.end()
}
export function handleMosDeleteStory(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	stories: Array<MOS.MosString128>
) {
	if (stories.length === 0) return

	// no point in measuring a simple prop check => return
	const span = profiler.startSpan('mosDevice.ingest.handleMosDeleteStory')

	const rundownExternalId = parseMosString(runningOrderMosId)

	rundownIngestSyncFunction(
		'handleMosDeleteStory',
		peripheralDevice,
		rundownExternalId,
		(cache, ingestDataCache) => {
			const rundown = getRundown2(cache)
			if (!canBeUpdated(rundown)) return undefined

			const ingestRundown = loadCachedRundownData(ingestDataCache, rundown._id, rundown.externalId)
			const ingestParts = getAnnotatedIngestParts(ingestRundown)
			const ingestPartIds = ingestParts.map((part) => part.externalId)

			const storyIds = stories.map(parseMosString)

			logger.debug(`handleMosDeleteStory storyIds: [${storyIds.join(',')}]`)

			const missingIds = storyIds.filter((id) => ingestPartIds.indexOf(id) === -1)
			if (missingIds.length > 0) {
				throw new Meteor.Error(
					404,
					`Parts ${missingIds.join(', ')} in rundown ${rundown.externalId} were not found`
				)
			}

			const newIngestSegments = makeChangeToIngestParts(rundown, ingestParts, (ingestParts) => {
				const filteredParts = ingestParts.filter((p) => storyIds.indexOf(p.externalId) === -1)
				// if (filteredParts.length === ingestParts.length) return // Nothing was removed
				logger.debug(`handleMosDeleteStory, new part count ${filteredParts.length} (was ${ingestParts.length})`)

				return filteredParts
			})

			return prepareMosSegmentChanges(cache, ingestDataCache, ingestRundown, newIngestSegments)
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				applyMosSegmentChanges(cache, playoutInfo, preparedChanges)
				UpdateNext.ensureNextPartIsValid(cache, playoutInfo)
			}
		}
	)
	span?.end()
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
export function handleInsertParts(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	insertBeforeStoryId: MOS.MosString128 | null,
	removePrevious: boolean,
	newStories: MOS.IMOSROStory[]
) {
	// inserts stories and all of their defined items before the referenced story in a Running Order
	// ...and roStoryReplace message replaces the referenced story with another story or stories
	const span = profiler.startSpan('mosDevice.ingest.handleInsertParts')

	const rundownExternalId = parseMosString(runningOrderMosId)

	rundownIngestSyncFunction(
		'handleInsertParts',
		peripheralDevice,
		rundownExternalId,
		(cache, ingestDataCache) => {
			const rundown = getRundown2(cache)
			if (!canBeUpdated(rundown)) return undefined

			const ingestRundown = loadCachedRundownData(ingestDataCache, rundown._id, rundown.externalId)
			const ingestParts = getAnnotatedIngestParts(ingestRundown)

			const insertBeforePartExternalId = insertBeforeStoryId ? parseMosString(insertBeforeStoryId) || '' : ''
			const insertIndex = !insertBeforePartExternalId // insert last
				? ingestParts.length
				: ingestParts.findIndex((p) => p.externalId === insertBeforePartExternalId)
			if (insertIndex === -1) {
				throw new Meteor.Error(
					404,
					`Part ${insertBeforePartExternalId} in rundown ${rundown.externalId} not found`
				)
			}

			const newParts = storiesToIngestParts(rundown._id, newStories || [], true, ingestParts).filter(
				(p): p is AnnotatedIngestPart => !!p // remove falsy values from array
			)
			const newPartExtenalIds = new Set(newParts.map((part) => part.externalId))

			const newIngestSegments = makeChangeToIngestParts(rundown, ingestParts, (ingestPartsToModify) => {
				const modifiedIngestParts = [...ingestPartsToModify] // clone
				if (removePrevious) {
					modifiedIngestParts.splice(insertIndex, 1) // Replace the previous part with new parts
				}

				const collidingPartIds = modifiedIngestParts
					.filter((part) => newPartExtenalIds.has(part.externalId))
					.map((part) => part.externalId)
				if (collidingPartIds.length > 0) {
					throw new Meteor.Error(
						500,
						`Parts ${collidingPartIds.join(', ')} already exist in rundown ${rundown.externalId}`
					)
				}
				// Update parts list
				modifiedIngestParts.splice(insertIndex, 0, ...newParts)

				return modifiedIngestParts
			})

			return {
				preparedChanges: prepareMosSegmentChanges(cache, ingestDataCache, ingestRundown, newIngestSegments),
				newPartExtenalIds,
			}
		},
		(cache, playoutInfo, data) => {
			if (data) {
				applyMosSegmentChanges(cache, playoutInfo, data.preparedChanges)
			}
		}
	)
	span?.end()
}
export function handleSwapStories(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	story0: MOS.MosString128,
	story1: MOS.MosString128
) {
	const story0Str = parseMosString(story0)
	const story1Str = parseMosString(story1)
	if (story0Str === story1Str) {
		throw new Meteor.Error(
			400,
			`Cannot swap part ${story0Str} with itself in rundown ${parseMosString(runningOrderMosId)}`
		)
	}

	const span = profiler.startSpan('mosDevice.ingest.handleSwapStories')

	const rundownExternalId = parseMosString(runningOrderMosId)

	rundownIngestSyncFunction(
		'handleSwapStories',
		peripheralDevice,
		rundownExternalId,
		(cache, ingestDataCache) => {
			const rundown = getRundown2(cache)
			if (!canBeUpdated(rundown)) return undefined

			const ingestRundown = loadCachedRundownData(ingestDataCache, rundown._id, rundown.externalId)
			const ingestParts = getAnnotatedIngestParts(ingestRundown)

			const newIngestSegments = makeChangeToIngestParts(rundown, ingestParts, (ingestParts) => {
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

			return prepareMosSegmentChanges(cache, ingestDataCache, ingestRundown, newIngestSegments)
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				applyMosSegmentChanges(cache, playoutInfo, preparedChanges)
				UpdateNext.ensureNextPartIsValid(cache, playoutInfo)
			}
		}
	)
	span?.end()
}
export function handleMoveStories(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	insertBeforeStoryId: MOS.MosString128 | null,
	stories: MOS.MosString128[]
) {
	const span = profiler.startSpan('mosDevice.ingest.handleMoveStories')
	const rundownExternalId = parseMosString(runningOrderMosId)

	rundownIngestSyncFunction(
		'handleMoveStories',
		peripheralDevice,
		rundownExternalId,
		(cache, ingestDataCache) => {
			const rundown = getRundown2(cache)
			if (!canBeUpdated(rundown)) return undefined
			const ingestRundown = loadCachedRundownData(ingestDataCache, rundown._id, rundown.externalId)
			const ingestParts = getAnnotatedIngestParts(ingestRundown)

			// Get story data
			const storyIds = stories.map(parseMosString)

			const newIngestSegments = makeChangeToIngestParts(rundown, ingestParts, (ingestParts) => {
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
						`Parts ${missingIds.join(', ')} were not found in rundown ${rundown.externalId}`
					)
				}

				// Find insert point
				const insertBeforePartExternalId = insertBeforeStoryId ? parseMosString(insertBeforeStoryId) || '' : ''
				const insertIndex = !insertBeforePartExternalId // insert last
					? filteredParts.length
					: filteredParts.findIndex((p) => p.externalId === insertBeforePartExternalId)
				if (insertIndex === -1) {
					throw new Meteor.Error(
						404,
						`Part ${insertBeforeStoryId} was not found in rundown ${rundown.externalId}`
					)
				}

				// Reinsert parts
				filteredParts.splice(insertIndex, 0, ...movingParts)

				return filteredParts
			})

			return prepareMosSegmentChanges(cache, ingestDataCache, ingestRundown, newIngestSegments)
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				applyMosSegmentChanges(cache, playoutInfo, preparedChanges)
				UpdateNext.ensureNextPartIsValid(cache, playoutInfo)
			}
		}
	)
	span?.end()
}
/** Takes a list of ingestParts, modify it, then output them grouped together into ingestSegments, keeping track of the modified property */
function makeChangeToIngestParts(
	rundown: ReadonlyDeep<Rundown>,
	ingestParts: AnnotatedIngestPart[],
	modifyFunction: (ingestParts: AnnotatedIngestPart[]) => AnnotatedIngestPart[]
): LocalIngestSegment[] {
	const span = profiler.startSpan('mosDevice.ingest.makeChangeToIngestParts')

	// Before making the modification to ingestParts, create a list of segments from the original data, to use for calculating the
	// .modified property below.
	const referenceIngestSegments = groupPartsIntoIngestSegments(rundown, ingestParts)

	const modifiedParts = modifyFunction(ingestParts)

	// Compare to reference, to make sure that ingestSegment.modified is updated in case of a change
	const newIngestSegments = groupPartsIntoIngestSegments(rundown, modifiedParts)

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
	rundown: ReadonlyDeep<Rundown>,
	newIngestParts: AnnotatedIngestPart[]
): LocalIngestSegment[] {
	// Group the parts and make them into Segments:
	const newGroupedParts = groupIngestParts(newIngestParts)
	const newIngestSegments = groupedPartsToSegments(rundown._id, newGroupedParts)

	return newIngestSegments
}

function prepareMosSegmentChanges(
	cache: ReadOnlyCache<CacheForIngest>,
	ingestDataCache: RundownIngestDataCacheCollection,
	oldIngestRundown: LocalIngestRundown,
	newIngestSegments: LocalIngestSegment[]
): PreparedMosSegmentChanges {
	const span = profiler.startSpan('mosDevice.ingest.prepareMosSegmentChanges')
	const rundown = getRundown2(cache)

	// Fetch all existing segments:
	const oldSegments = cache.Segments.findFetch({ rundownId: rundown._id })

	const oldSegmentEntries = compileSegmentEntries(oldIngestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(newIngestSegments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries, oldSegments)

	// Save new cache
	const newIngestRundown = updateIngestRundownWithData(oldIngestRundown, newIngestSegments)
	saveRundownCache(ingestDataCache, rundown._id, newIngestRundown) // TODO-CACHE - defer

	// Create/Update segments
	const sortedIngestSegments = _.sortBy(
		[..._.values(segmentDiff.added), ..._.values(segmentDiff.changed)],
		(se) => se.rank
	)
	let preparedSegmentChanges: PreparedSegmentChanges[] = []
	if (sortedIngestSegments.length > 0) {
		const showStyle = getShowStyleCompound2(rundown)
		const blueprint = loadShowStyleBlueprint(showStyle)
		for (const ingestSegment of sortedIngestSegments) {
			preparedSegmentChanges.push(prepareUpdateSegmentFromIngestData(cache, showStyle, blueprint, ingestSegment))
		}
	}

	span?.end()

	return {
		newIngestSegments,
		segmentDiff,
		preparedSegmentChanges,
	}
}

interface PreparedMosSegmentChanges {
	newIngestSegments: LocalIngestSegment[]
	segmentDiff: DiffSegmentEntries
	preparedSegmentChanges: PreparedSegmentChanges[]
}

function applyMosSegmentChanges(
	cache: CacheForIngest,
	playoutInfo: IngestPlayoutInfo,
	preparedChanges: PreparedMosSegmentChanges
): void {
	const span = profiler.startSpan('mosDevice.ingest.applyMosSegmentChanges')
	const rundown = getRundown2(cache)

	// Check if operation affect currently playing Part:
	if (
		playoutInfo.playlist.activationId &&
		playoutInfo.currentPartInstance &&
		playoutInfo.currentPartInstance.rundownId === rundown._id &&
		!playoutInfo.currentPartInstance.orphaned
	) {
		const currentPartInstance = playoutInfo.currentPartInstance
		let currentPart: LocalIngestPart | undefined = undefined

		for (let i = 0; currentPart === undefined && i < preparedChanges.newIngestSegments.length; i++) {
			const { parts } = preparedChanges.newIngestSegments[i]
			currentPart = parts.find((ingestPart) => {
				const partId = getPartId(rundown._id, ingestPart.externalId)
				return partId === currentPartInstance.part._id
			})
		}

		if (!currentPart) {
			// Looks like the currently playing part has been removed.
			logger.warn(
				`Currently playing part "${currentPartInstance.part._id}" was removed during ingestData. Unsyncing the rundown!`
			)
			if (Settings.allowUnsyncedSegments) {
				ServerRundownAPI.unsyncSegmentInner(cache, currentPartInstance.part.segmentId)
			} else {
				ServerRundownAPI.unsyncRundownInner(cache)
			}
			span?.end()
			return
		} else {
			// TODO: add logic for determining whether to allow changes to the currently playing Part.
			// TODO: use isUpdateAllowed()
		}
	}

	// Update segment ranks:
	_.each(preparedChanges.segmentDiff.onlyRankChanged, (newRank, segmentExternalId) => {
		cache.Segments.update(
			{
				rundownId: rundown._id,
				_id: getSegmentId(rundown._id, segmentExternalId),
			},
			{
				$set: {
					_rank: newRank,
				},
			}
		)
	})
	// Updated segments that has had their segment.externalId changed:
	_.each(preparedChanges.segmentDiff.onlyExternalIdChanged, (newSegmentExternalId, oldSegmentExternalId) => {
		const oldSegmentId = getSegmentId(rundown._id, oldSegmentExternalId)
		const newSegmentId = getSegmentId(rundown._id, newSegmentExternalId)

		// Move over those parts to the new segmentId.
		// These parts will be orphaned temporarily, but will be picked up inside of updateSegmentsFromIngestData later
		cache.Parts.update(
			{
				rundownId: rundown._id,
				segmentId: oldSegmentId,
			},
			{
				$set: {
					segmentId: newSegmentId,
				},
			}
		)

		cache.defer(() => {
			// TODO-PartInstance - pending new data flow
			PartInstances.update(
				{
					rundownId: rundown._id,
					segmentId: oldSegmentId,
				},
				{
					$set: {
						segmentId: newSegmentId,
						'part.segmentId': newSegmentId,
					},
				}
			)
		})
	})

	// Remove old segments
	const removedSegmentIds = _.map(preparedChanges.segmentDiff.removed, (_segmentEntry, segmentExternalId) =>
		getSegmentId(rundown._id, segmentExternalId)
	)
	removeSegments(cache, removedSegmentIds)

	// Store updated sgements
	const changedSegments: ChangedSegmentsRankInfo = []
	for (const segmentChanges of preparedChanges.preparedSegmentChanges) {
		const { segmentId, oldPartIdsAndRanks } = savePreparedSegmentChanges(cache, playoutInfo, segmentChanges)
		if (segmentId !== null) {
			changedSegments.push({ segmentId, oldPartIdsAndRanks })
		}
	}
	if (changedSegments.length > 0) {
		afterIngestChangedData(cache, playoutInfo, changedSegments)
	}

	span?.end()
}

export interface SegmentEntries {
	[segmentExternalId: string]: LocalIngestSegment
}
export function compileSegmentEntries(ingestSegments: LocalIngestSegment[]): SegmentEntries {
	let segmentEntries: SegmentEntries = {}

	_.each(ingestSegments, (ingestSegment: LocalIngestSegment, rank: number) => {
		if (segmentEntries[ingestSegment.externalId]) {
			throw new Meteor.Error(
				500,
				`compileSegmentEntries: Non-unique segment external ID: "${ingestSegment.externalId}"`
			)
		}
		segmentEntries[ingestSegment.externalId] = _.clone(ingestSegment)
	})

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
	onlyExternalIdChanged: { [removedSegmentExternalId: string]: string } // contains the added segment's externalId
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
		onlyExternalIdChanged: {},
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
			diff.onlyExternalIdChanged[segmentExternalId] = newSegmentEntry.externalId
		}
	})

	return diff
}
