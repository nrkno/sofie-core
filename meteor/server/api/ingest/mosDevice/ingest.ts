import * as _ from 'underscore'
import * as MOS from 'mos-connection'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { getStudioFromDevice, getSegmentId, canBeUpdated, getRundown, getPartId, getRundownPlaylist } from '../lib'
import {
	getRundownIdFromMosRO,
	getPartIdFromMosStory,
	getSegmentExternalId,
	fixIllegalObject,
	parseMosString,
} from './lib'
import {
	literal,
	asyncCollectionUpdate,
	waitForPromiseAll,
	protectString,
	unprotectString,
	waitForPromise,
	getCurrentTime,
	normalizeArray,
} from '../../../../lib/lib'
import { IngestPart, IngestSegment, IngestRundown } from 'tv-automation-sofie-blueprints-integration'
import { IngestDataCache, IngestCacheType } from '../../../../lib/collections/IngestDataCache'
import {
	rundownPlaylistSyncFunction,
	RundownSyncFunctionPriority,
	handleUpdatedRundownInner,
	handleUpdatedPartInner,
	updateSegmentsFromIngestData,
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
} from '../ingestCache'
import { Rundown, RundownId, Rundowns } from '../../../../lib/collections/Rundowns'
import { Studio } from '../../../../lib/collections/Studios'
import { ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { Segments, Segment, SegmentUnsyncedReason } from '../../../../lib/collections/Segments'
import { loadShowStyleBlueprint } from '../../blueprints/cache'
import { removeSegments, ServerRundownAPI } from '../../rundown'
import { UpdateNext } from '../updateNext'
import { logger } from '../../../../lib/logging'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { Parts, PartId } from '../../../../lib/collections/Parts'
import { PartInstances } from '../../../../lib/collections/PartInstances'
import { initCacheForRundownPlaylist, CacheForRundownPlaylist } from '../../../DatabaseCaches'
import { getSelectedPartInstancesFromCache } from '../../playout/lib'
import { Settings } from '../../../../lib/Settings'
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
	const groupedStories: { name: string; parts: LocalIngestPart[] }[] = []
	_.each(parts, (s) => {
		const lastSegment = _.last(groupedStories)
		if (lastSegment && lastSegment.name === s.segmentName) {
			lastSegment.parts.push(s.ingest)
		} else {
			groupedStories.push({ name: s.segmentName, parts: [s.ingest] })
		}
	})

	// Ensure ranks are correct
	_.each(groupedStories, (group) => {
		for (let i = 0; i < group.parts.length; i++) {
			group.parts[i].rank = i
		}
	})

	return groupedStories
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

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, mosRunningOrder.ID)

	const rundown = Rundowns.findOne(rundownId)
	const playlistId = rundown ? rundown.playlistId : protectString('newPlaylist')

	// Create or update a rundown (ie from rundownCreate or rundownList)

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleMosRundownData', () => {
		const parts = _.compact(storiesToIngestParts(rundownId, mosRunningOrder.Stories || [], !createFresh, []))
		const groupedStories = groupIngestParts(parts)

		// If this is a reload of a RO, then use cached data to make the change more seamless
		if (!createFresh) {
			const partIds = _.map(parts, (p) => p.partId)
			const partCache = IngestDataCache.find({
				rundownId: rundownId,
				partId: { $in: partIds },
				type: IngestCacheType.PART,
			}).fetch()

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

		handleUpdatedRundownInner(
			studio,
			rundownId,
			ingestRundown,
			createFresh ? 'mosCreate' : 'mosList',
			peripheralDevice
		)

		span?.end()
	})
}
export function handleMosRundownMetadata(
	peripheralDevice: PeripheralDevice,
	mosRunningOrderBase: MOS.IMOSRunningOrderBase
) {
	const span = profiler.startSpan('mosDevice.ingest.handleMosRundownMetadata')

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, mosRunningOrderBase.ID)

	const playlistId = getRundown(rundownId, mosRunningOrderBase.ID.toString()).playlistId

	return rundownPlaylistSyncFunction(
		playlistId,
		RundownSyncFunctionPriority.INGEST,
		'handleMosRundownMetadata',
		() => {
			const rundown = getRundown(rundownId, parseMosString(mosRunningOrderBase.ID))
			if (!canBeUpdated(rundown)) return

			// Load the blueprint to process the data
			const showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
			if (!showStyleBase) {
				throw new Meteor.Error(
					500,
					`Failed to ShowStyleBase "${rundown.showStyleBaseId}" for rundown "${rundown._id}"`
				)
			}
			const showStyleBlueprint = loadShowStyleBlueprint(showStyleBase)

			// Load the cached RO Data
			const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
			ingestRundown.payload = _.extend(ingestRundown.payload, mosRunningOrderBase)
			ingestRundown.modified = getCurrentTime()
			// TODO - verify this doesn't lose data, it was doing more work before

			// TODO - make this more lightweight?
			handleUpdatedRundownInner(studio, rundownId, ingestRundown, 'mosRoMetadata', peripheralDevice)
		}
	)
}

export function handleMosFullStory(peripheralDevice: PeripheralDevice, story: MOS.IMOSROFullStory) {
	const span = profiler.startSpan('mosDevice.ingest.handleMosFullStory')

	fixIllegalObject(story)
	// @ts-ignore
	// logger.debug(story)

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, story.RunningOrderId)
	const partId = getPartIdFromMosStory(rundownId, story.ID)

	const playlistId = getRundown(rundownId, story.RunningOrderId.toString()).playlistId

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleMosFullStory', () => {
		const rundown = getRundown(rundownId, parseMosString(story.RunningOrderId))
		const playlist = getRundownPlaylist(rundown)
		// canBeUpdated is done inside handleUpdatedPartInner

		const cachedPartData = loadIngestDataCachePart(
			rundownId,
			parseMosString(story.RunningOrderId),
			partId,
			parseMosString(story.ID)
		)
		if (!cachedPartData.segmentId) {
			throw new Meteor.Error(500, `SegmentId missing for part "${partId}" (MOSFullStory)`)
		}

		const ingestSegment: IngestSegment = loadCachedIngestSegment(
			rundownId,
			parseMosString(story.RunningOrderId),
			cachedPartData.segmentId,
			unprotectString(cachedPartData.segmentId)
		)

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist))
		const ingestPart: IngestPart = cachedPartData.data
		// TODO - can the name change during a fullStory? If so then we need to be sure to update the segment groupings too
		// ingestPart.name = story.Slug ? parseMosString(story.Slug) : ''
		ingestPart.payload = story

		// Update db with the full story:
		handleUpdatedPartInner(cache, studio, playlist, rundown, ingestSegment.externalId, ingestPart)
		waitForPromise(cache.saveAllToDatabase())

		span?.end()
	})
}
export function handleMosDeleteStory(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	stories: Array<MOS.MosString128>
) {
	if (stories.length === 0) return

	// no point in measuring a simple prop check => return
	const span = profiler.startSpan('mosDevice.ingest.handleMosDeleteStory')

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	const playlistId = getRundown(rundownId, runningOrderMosId.toString()).playlistId

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleMosDeleteStory', () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) {
			span?.end()
			return
		}

		const playlist = getRundownPlaylist(rundown)

		const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
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

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist)) // todo: change this
		diffAndApplyChanges(cache, studio, playlist, rundown, ingestRundown, newIngestSegments)
		UpdateNext.ensureNextPartIsValid(cache, playlist)
		waitForPromise(cache.saveAllToDatabase())

		span?.end()
	})
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

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	const playlistId = getRundown(rundownId, runningOrderMosId.toString()).playlistId

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleInsertParts', () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const playlist = getRundownPlaylist(rundown)

		const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)

		const insertBeforePartExternalId = insertBeforeStoryId ? parseMosString(insertBeforeStoryId) || '' : ''
		const insertIndex = !insertBeforePartExternalId // insert last
			? ingestParts.length
			: ingestParts.findIndex((p) => p.externalId === insertBeforePartExternalId)
		if (insertIndex === -1) {
			throw new Meteor.Error(404, `Part ${insertBeforePartExternalId} in rundown ${rundown.externalId} not found`)
		}

		const newParts = storiesToIngestParts(rundown._id, newStories || [], true, ingestParts).filter(
			(p): p is AnnotatedIngestPart => !!p
		)
		const newPartIds = newParts.map((part) => part.externalId)

		const newIngestSegments = makeChangeToIngestParts(rundown, ingestParts, (ingestParts) => {
			if (removePrevious) {
				ingestParts.splice(insertIndex, 1) // Replace the previous part with new parts
			}

			const collidingPartIds = ingestParts
				.filter((part) => newPartIds.indexOf(part.externalId) > -1)
				.map((part) => part.externalId)

			if (collidingPartIds.length > 0) {
				throw new Meteor.Error(
					500,
					`Parts ${collidingPartIds.join(', ')} already exist in rundown ${rundown.externalId}`
				)
			}
			// Update parts list
			ingestParts.splice(insertIndex, 0, ...newParts)

			return ingestParts
		})

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist)) // todo: change this
		diffAndApplyChanges(cache, studio, playlist, rundown, ingestRundown, newIngestSegments, removePrevious)
		waitForPromise(cache.saveAllToDatabase())

		span?.end()
	})
}
export function handleSwapStories(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	story0: MOS.MosString128,
	story1: MOS.MosString128
) {
	const span = profiler.startSpan('mosDevice.ingest.handleSwapStories')

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	const story0Str = parseMosString(story0)
	const story1Str = parseMosString(story1)
	if (story0Str === story1Str) {
		throw new Meteor.Error(
			400,
			`Cannot swap part ${story0Str} with itself in rundown ${parseMosString(runningOrderMosId)}`
		)
	}

	const playlistId = getRundown(rundownId, runningOrderMosId.toString()).playlistId

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleSwapStories', () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const playlist = getRundownPlaylist(rundown)

		const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)

		const newIngestSegments = makeChangeToIngestParts(rundown, ingestParts, (ingestParts) => {
			const story0Index = ingestParts.findIndex((p) => p.externalId === story0Str)
			if (story0Index === -1) {
				throw new Meteor.Error(404, `Story ${story0} not found in rundown ${parseMosString(runningOrderMosId)}`)
			}
			const story1Index = ingestParts.findIndex((p) => p.externalId === story1Str)
			if (story1Index === -1) {
				throw new Meteor.Error(404, `Story ${story1} not found in rundown ${parseMosString(runningOrderMosId)}`)
			}
			const tmp = ingestParts[story0Index]
			ingestParts[story0Index] = ingestParts[story1Index]
			ingestParts[story1Index] = tmp

			return ingestParts
		})

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist)) // todo: change this
		diffAndApplyChanges(cache, studio, playlist, rundown, ingestRundown, newIngestSegments)
		UpdateNext.ensureNextPartIsValid(cache, playlist)
		waitForPromise(cache.saveAllToDatabase())

		span?.end()
	})
}
export function handleMoveStories(
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	insertBeforeStoryId: MOS.MosString128 | null,
	stories: MOS.MosString128[]
) {
	const span = profiler.startSpan('mosDevice.ingest.handleMoveStories')

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)
	const playlistId = getRundown(rundownId, runningOrderMosId.toString()).playlistId

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleMoveStories', () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const playlist = getRundownPlaylist(rundown)

		const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
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

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist)) // todo: change this
		diffAndApplyChanges(cache, studio, playlist, rundown, ingestRundown, newIngestSegments)
		UpdateNext.ensureNextPartIsValid(cache, playlist)
		waitForPromise(cache.saveAllToDatabase())

		span?.end()
	})
}
/** Takes a list of ingestParts, modify it, then output them grouped together into ingestSegments, keeping track of the modified property */
function makeChangeToIngestParts(
	rundown: Rundown,
	ingestParts: AnnotatedIngestPart[],
	modifyFunction: (ingestParts: AnnotatedIngestPart[]) => AnnotatedIngestPart[]
): LocalIngestSegment[] {
	const span = profiler.startSpan('mosDevice.ingest.makeChangeToIngestParts')

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
function groupPartsIntoIngestSegments(rundown: Rundown, newIngestParts: AnnotatedIngestPart[]): LocalIngestSegment[] {
	// Group the parts and make them into Segments:
	const newGroupedParts = groupIngestParts(newIngestParts)
	const newIngestSegments = groupedPartsToSegments(rundown._id, newGroupedParts)

	return newIngestSegments
}

function diffAndApplyChanges(
	cache: CacheForRundownPlaylist,
	studio: Studio,
	playlist: RundownPlaylist,
	rundown: Rundown,
	oldIngestRundown: LocalIngestRundown,
	newIngestSegments: LocalIngestSegment[],
	removePreviousParts?: boolean
	// newIngestParts: AnnotatedIngestPart[]
) {
	const span = profiler.startSpan('mosDevice.ingest.diffAndApplyChanges')

	// Fetch all existing segments:
	const oldSegments = cache.Segments.findFetch({ rundownId: rundown._id })

	const oldSegmentEntries = compileSegmentEntries(oldIngestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(newIngestSegments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries, oldSegments)

	// Check if operation affect currently playing Part:
	const { currentPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)
	if (playlist.active && currentPartInstance) {
		let currentPart: LocalIngestPart | undefined = undefined

		for (let i = 0; currentPart === undefined && i < newIngestSegments.length; i++) {
			const { parts } = newIngestSegments[i]
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
				ServerRundownAPI.unsyncSegmentInner(
					cache,
					rundown._id,
					currentPartInstance.part.segmentId,
					SegmentUnsyncedReason.CHANGED
				)
			} else {
				ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
			}
			span?.end()
			return
		} else {
			// TODO: add logic for determining whether to allow changes to the currently playing Part.
			// TODO: use isUpdateAllowed()
		}

		span?.end()
	}

	// Save new cache
	const newIngestRundown = updateIngestRundownWithData(oldIngestRundown, newIngestSegments)
	saveRundownCache(rundown._id, newIngestRundown)

	// Update segment ranks:
	_.each(segmentDiff.onlyRankChanged, (newRank, segmentExternalId) => {
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
	_.each(segmentDiff.onlyExternalIdChanged, (newSegmentExternalId, oldSegmentExternalId) => {
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

		cache.PartInstances.update(
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

	// Remove old segments
	const removedSegmentIds = _.map(segmentDiff.removed, (_segmentEntry, segmentExternalId) =>
		getSegmentId(rundown._id, segmentExternalId)
	)
	removeSegments(cache, rundown._id, removedSegmentIds)

	// Create/Update segments
	updateSegmentsFromIngestData(
		cache,
		studio,
		playlist,
		rundown,
		_.sortBy([..._.values(segmentDiff.added), ..._.values(segmentDiff.changed)], (se) => se.rank),
		removePreviousParts
	)
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
