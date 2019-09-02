import * as _ from 'underscore'
import * as MOS from 'mos-connection'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { getStudioFromDevice, getSegmentId, canBeUpdated, getRundown, getPartId } from '../lib'
import {
	getRundownIdFromMosRO,
	getPartIdFromMosStory,
	getSegmentExternalId,
	fixIllegalObject,
	parseMosString
} from './lib'
import { literal, asyncCollectionUpdate, waitForPromiseAll } from '../../../../lib/lib'
import { IngestPart, IngestSegment, IngestRundown } from 'tv-automation-sofie-blueprints-integration'
import { IngestDataCache, IngestCacheType } from '../../../../lib/collections/IngestDataCache'
import {
	rundownSyncFunction,
	RundownSyncFunctionPriority,
	handleUpdatedRundownInner,
	handleUpdatedPartInner,
	updateSegmentsFromIngestData,
	afterIngestChangedData
} from '../rundownInput'
import {
	loadCachedRundownData,
	saveRundownCache,
	loadCachedIngestSegment,
	loadIngestDataCachePart
} from '../ingestCache'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { Studio } from '../../../../lib/collections/Studios'
import { ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { Segments } from '../../../../lib/collections/Segments'
import { loadShowStyleBlueprints } from '../../blueprints/cache'
import { removeSegments, ServerRundownAPI } from '../../rundown'
import { UpdateNext } from '../updateNext'
import { logger } from '../../../../lib/logging'

interface AnnotatedIngestPart {
	externalId: string
	partId: string
	segmentName: string
	ingest: IngestPart
}
function storiesToIngestParts (
	rundownId: string,
	stories: MOS.IMOSStory[],
	undefinedPayload: boolean
): (AnnotatedIngestPart | null)[] {
	return _.map(stories, (s, i) => {
		if (!s) return null

		const name = s.Slug ? parseMosString(s.Slug) : ''
		return {
			externalId: parseMosString(s.ID),
			partId: getPartIdFromMosStory(rundownId, s.ID),
			segmentName: name.split(';')[0],
			ingest: literal<IngestPart>({
				externalId: parseMosString(s.ID),
				name: name,
				rank: i,
				payload: undefinedPayload ? undefined : {}
			})
		}
	})
}
function groupIngestParts (parts: AnnotatedIngestPart[]): { name: string; parts: IngestPart[] }[] {
	const groupedStories: { name: string; parts: IngestPart[] }[] = []
	_.each(parts, s => {
		const lastSegment = _.last(groupedStories)
		if (lastSegment && lastSegment.name === s.segmentName) {
			lastSegment.parts.push(s.ingest)
		} else {
			groupedStories.push({ name: s.segmentName, parts: [s.ingest] })
		}
	})

	// Ensure ranks are correct
	_.each(groupedStories, group => {
		for (let i = 0; i < group.parts.length; i++) {
			group.parts[i].rank = i
		}
	})

	return groupedStories
}
function groupedPartsToSegments (
	rundownId: string,
	groupedParts: { name: string; parts: IngestPart[] }[]
): IngestSegment[] {
	return _.map(groupedParts, (grp, i) =>
		literal<IngestSegment>({
			externalId: getSegmentExternalId(rundownId, grp.parts[0]),
			name: grp.name,
			rank: i,
			parts: grp.parts
		})
	)
}

export function handleMosRundownData (
	peripheralDevice: PeripheralDevice,
	mosRunningOrder: MOS.IMOSRunningOrder,
	createFresh: boolean
) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, mosRunningOrder.ID)

	// Create or update a rundown (ie from rundownCreate or rundownList)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const parts = _.compact(storiesToIngestParts(rundownId, mosRunningOrder.Stories || [], !createFresh))
		const groupedStories = groupIngestParts(parts)

		// If this is a reload of a RO, then use cached data to make the change more seamless
		if (!createFresh) {
			const partIds = _.map(parts, p => p.partId)
			const partCache = IngestDataCache.find({
				rundownId: rundownId,
				partId: { $in: partIds },
				type: IngestCacheType.PART
			}).fetch()

			const partCacheMap: { [id: string]: IngestPart } = {}
			_.each(partCache, p => {
				if (p.partId) {
					partCacheMap[p.partId] = p.data as IngestPart
				}
			})

			_.each(parts, s => {
				const cached = partCacheMap[s.partId]
				if (cached) {
					s.ingest.payload = cached.payload
				}
			})
		}

		const ingestSegments = groupedPartsToSegments(rundownId, groupedStories)

		const ingestRundown = literal<IngestRundown>({
			externalId: parseMosString(mosRunningOrder.ID),
			name: parseMosString(mosRunningOrder.Slug),
			type: 'mos',
			segments: ingestSegments,
			payload: mosRunningOrder
		})

		handleUpdatedRundownInner(
			studio,
			rundownId,
			ingestRundown,
			createFresh ? 'mosCreate' : 'mosList',
			peripheralDevice
		)
	})
}
export function handleMosRundownMetadata (
	peripheralDevice: PeripheralDevice,
	mosRunningOrderBase: MOS.IMOSRunningOrderBase
) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, mosRunningOrderBase.ID)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
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
		const showStyleBlueprint = loadShowStyleBlueprints(showStyleBase)

		// Load the cached RO Data
		const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
		ingestRundown.payload = _.extend(ingestRundown.payload, mosRunningOrderBase)
		// TODO - verify this doesn't lose data, it was doing more work before

		// TODO - make this more lightweight?
		handleUpdatedRundownInner(studio, rundownId, ingestRundown, 'mosRoMetadata', peripheralDevice)
	})
}

export function handleMosFullStory (peripheralDevice: PeripheralDevice, story: MOS.IMOSROFullStory) {
	fixIllegalObject(story)
	// @ts-ignore
	// logger.debug(story)

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, story.RunningOrderId)
	const partId = getPartIdFromMosStory(rundownId, story.ID)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(story.RunningOrderId))
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
			cachedPartData.segmentId
		)

		const ingestPart: IngestPart = cachedPartData.data
		// TODO - can the name change during a fullStory? If so then we need to be sure to update the segment groupings too
		// ingestPart.name = story.Slug ? parseMosString(story.Slug) : ''
		ingestPart.payload = story

		// Update db with the full story:
		handleUpdatedPartInner(studio, rundown, ingestSegment.externalId, ingestPart)
	})
}
export function handleMosDeleteStory (
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	stories: Array<MOS.MosString128>
) {
	if (stories.length === 0) return

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)
		const ingestPartIds = _.map(ingestParts, part => part.externalId)

		const storyIds = _.map(stories, parseMosString)
		const missingIds = _.filter(storyIds, id => ingestPartIds.indexOf(id) === -1)
		if (missingIds.length > 0) {
			throw new Meteor.Error(
				404,
				`Parts ${missingIds.join(', ')} in rundown ${rundown.externalId} were not found`
			)
		}

		const filteredParts = ingestParts.filter(p => storyIds.indexOf(p.externalId) === -1)
		if (filteredParts.length === ingestParts.length) return // Nothing was removed

		diffAndApplyChanges(studio, rundown, ingestRundown, filteredParts)

		UpdateNext.ensureNextPartIsValid(rundown)
	})
}

function getAnnotatedIngestParts (ingestRundown: IngestRundown): AnnotatedIngestPart[] {
	const ingestParts: AnnotatedIngestPart[] = []
	_.each(ingestRundown.segments, s => {
		_.each(s.parts, p => {
			ingestParts.push({
				externalId: p.externalId,
				partId: '', // Not used
				segmentName: s.name,
				ingest: p
			})
		})
	})
	return ingestParts
}
export function handleInsertParts (
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	insertBeforeStoryId: MOS.MosString128 | null,
	removePrevious: boolean,
	newStories: MOS.IMOSROStory[]
) {
	// inserts stories and all of their defined items before the referenced story in a Running Order
	// ...and roStoryReplace message replaces the referenced story with another story or stories

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)

		const insertBeforePartExternalId = insertBeforeStoryId ? parseMosString(insertBeforeStoryId) || '' : ''
		const insertIndex = (
			!insertBeforePartExternalId ? // insert last
				ingestParts.length :
				ingestParts.findIndex(p => p.externalId === insertBeforePartExternalId)
		)
		if (insertIndex === -1) {
			throw new Meteor.Error(404, `Part ${insertBeforePartExternalId} in rundown ${rundown.externalId} not found`)
		}

		const newParts = _.compact(storiesToIngestParts(rundown._id, newStories || [], true))

		if (removePrevious) {
			ingestParts.splice(insertIndex, 1) // Replace the previous part with new parts
		}

		const newPartIds = _.map(newParts, part => part.externalId)
		const collidingPartIds = _.map(
			_.filter(ingestParts, part => newPartIds.indexOf(part.externalId) !== -1),
			part => part.externalId
		)
		if (collidingPartIds.length > 0) {
			throw new Meteor.Error(
				500,
				`Parts ${collidingPartIds.join(', ')} already exist in rundown ${rundown.externalId}`
			)
		}

		// Update parts list
		ingestParts.splice(insertIndex, 0, ...newParts)

		diffAndApplyChanges(studio, rundown, ingestRundown, ingestParts)

		UpdateNext.afterInsertParts(rundown, newPartIds, removePrevious)
	})
}
export function handleSwapStories (
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	story0: MOS.MosString128,
	story1: MOS.MosString128
) {
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

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)

		const story0Index = ingestParts.findIndex(p => p.externalId === story0Str)
		if (story0Index === -1) {
			throw new Meteor.Error(404, `Story ${story0} not found in rundown ${parseMosString(runningOrderMosId)}`)
		}
		const story1Index = ingestParts.findIndex(p => p.externalId === story1Str)
		if (story1Index === -1) {
			throw new Meteor.Error(404, `Story ${story1} not found in rundown ${parseMosString(runningOrderMosId)}`)
		}

		const tmp = ingestParts[story0Index]
		ingestParts[story0Index] = ingestParts[story1Index]
		ingestParts[story1Index] = tmp

		diffAndApplyChanges(studio, rundown, ingestRundown, ingestParts)

		UpdateNext.ensureNextPartIsValid(rundown)
	})
}
export function handleMoveStories (
	peripheralDevice: PeripheralDevice,
	runningOrderMosId: MOS.MosString128,
	insertBeforeStoryId: MOS.MosString128 | null,
	stories: MOS.MosString128[]
) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)

		// Get story data
		const storyIds = _.map(stories, parseMosString)
		const movingParts = _.sortBy(ingestParts.filter(p => storyIds.indexOf(p.externalId) !== -1), p =>
			storyIds.indexOf(p.externalId)
		)

		// Ensure all stories to move were found
		const movingIds = _.map(movingParts, p => p.externalId)
		const missingIds = _.filter(storyIds, id => movingIds.indexOf(id) === -1)
		if (missingIds.length > 0) {
			throw new Meteor.Error(
				404,
				`Parts ${missingIds.join(', ')} were not found in rundown ${rundown.externalId}`
			)
		}

		const filteredParts = ingestParts.filter(p => storyIds.indexOf(p.externalId) === -1)

		// Find insert point
		const insertBeforePartExternalId = insertBeforeStoryId ? parseMosString(insertBeforeStoryId) || '' : ''
		const insertIndex = (
			!insertBeforePartExternalId ? // insert last
				filteredParts.length :
				filteredParts.findIndex(p => p.externalId === insertBeforePartExternalId)
		)
		if (insertIndex === -1) {
			throw new Meteor.Error(404, `Part ${insertBeforeStoryId} was not found in rundown ${rundown.externalId}`)
		}

		// Reinsert parts
		filteredParts.splice(insertIndex, 0, ...movingParts)

		diffAndApplyChanges(studio, rundown, ingestRundown, filteredParts)

		UpdateNext.ensureNextPartIsValid(rundown)
	})
}

function diffAndApplyChanges (
	studio: Studio,
	rundown: Rundown,
	ingestRundown: IngestRundown,
	ingestParts: AnnotatedIngestPart[]
) {
	// Save the new parts list
	const groupedParts = groupIngestParts(ingestParts)
	const ingestSegments = groupedPartsToSegments(rundown._id, groupedParts)

	const oldSegmentEntries = compileSegmentEntries(ingestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(ingestSegments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries)

	// Check if operation affect currently playing Part:
	if (rundown.active && rundown.currentPartId) {
		const currentPart = _.find(ingestParts, (ingestPart) => {
			const partId = getPartId(rundown._id, ingestPart.externalId)
			return partId === rundown.currentPartId
		})
		if (!currentPart) {
			// Looks like the currently playing part has been removed.
			logger.warn(`Currently playing part "${rundown.currentPartId}" was removed during ingestData. Unsyncing the rundown!`)
			ServerRundownAPI.unsyncRundown(rundown._id)
			return
		} else {
			// TODO: add logic for determining whether to allow changes to the currently playing Part.
		}
	}


	// Save new cache
	const newIngestRundown = _.clone(ingestRundown)
	newIngestRundown.segments = ingestSegments
	saveRundownCache(rundown._id, newIngestRundown)

	// Update segment ranks
	let ps: Array<Promise<any>> = []
	_.each(segmentDiff.rankChanged, (rankChange) => {
		ps.push(
			asyncCollectionUpdate(
				Segments,
				{
					rundownId: rundown._id,
					_id: getSegmentId(rundown._id, newIngestRundown.segments[rankChange.newRank].externalId)
				},
				{
					$set: {
						_rank: rankChange.newRank
					}
				}
			)
		)
	})
	// Remove old segments
	const removedSegmentIds = _.map(segmentDiff.removed, i =>
		getSegmentId(rundown._id, ingestRundown.segments[i].externalId)
	)
	removeSegments(rundown._id, removedSegmentIds)

	waitForPromiseAll(ps)

	// Create/Update segments
	updateSegmentsFromIngestData(studio, rundown, _.map(segmentDiff.changed, i => ingestSegments[i]))

	afterIngestChangedData(rundown, _.map(segmentDiff.rankChanged, i => getSegmentId(rundown._id, newIngestRundown.segments[i.newRank].externalId)))
}

export interface SegmentEntry {
	id: string
	name: string
	parts: string[]
}
function compileSegmentEntries (ingestSegments: IngestSegment[]): SegmentEntry[] {
	return _.map(ingestSegments, s => ({
		id: s.externalId,
		name: s.name,
		parts: _.map(s.parts, p => p.externalId)
	}))
}

export function diffSegmentEntries (oldSegmentEntries: SegmentEntry[], newSegmentEntries: SegmentEntry[]) {
	const rankChanged: { oldRank: number, newRank: number }[] = []
	const unchanged: number[] = [] // New index
	const changed: number[] = [] // New index
	const removed: number[] = [] // Old index

	// Convert to object to track their original index in the arrays
	const unusedOldSegmentEntries = _.map(oldSegmentEntries, (segmentEntry, rank) => ({ segmentEntry, rank }))
	const unusedNewSegmentEntries = _.map(newSegmentEntries, (segmentEntry, rank) => ({ segmentEntry, rank }))

	let prune: number[] = []

	// Deep compare
	_.each(newSegmentEntries, (segmentEntry, newRank) => {
		const matching = unusedOldSegmentEntries.findIndex(old => _.isEqual(old.segmentEntry, segmentEntry))
		if (matching !== -1) {
			const oldRank = unusedOldSegmentEntries[matching].rank
			if (newRank === oldRank) {
				unchanged.push(newRank)
			} else {
				rankChanged.push({ oldRank, newRank })
			}

			unusedOldSegmentEntries.splice(matching, 1)
			prune.push(newRank)
		}
	})

	// Remove any which were matching
	_.each(prune.reverse(), i => unusedNewSegmentEntries.splice(i, 1))
	prune = []

	// Match any by name
	_.each(unusedNewSegmentEntries, (unused, i) => {
		const matching = unusedOldSegmentEntries.findIndex(old => old.segmentEntry.name === unused.segmentEntry.name)
		if (matching !== -1) {
			const oldItem = unusedOldSegmentEntries[matching]
			if (unused.segmentEntry.id !== oldItem.segmentEntry.id) {
				// If Id has changed, then the old one needs to be explicitly removed
				removed.push(oldItem.rank)
			}
			changed.push(unused.rank)
			unusedOldSegmentEntries.splice(matching, 1)
			prune.push(i)
		}
	})

	// Remove any which were matching
	_.each(prune.reverse(), i => unusedNewSegmentEntries.splice(i, 1))
	prune = []

	changed.push(..._.map(unusedNewSegmentEntries, e => e.rank))
	removed.push(..._.map(unusedOldSegmentEntries, e => e.rank))

	return {
		rankChanged,
		unchanged,
		removed,
		changed
	}
}
