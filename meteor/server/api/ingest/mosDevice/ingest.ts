import * as _ from 'underscore'
import * as MOS from 'mos-connection'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { getStudioFromDevice, getSegmentId, canBeUpdated, getRundown } from '../lib'
import {
	getRundownIdFromMosRO,
	getPartIdFromMosStory,
	getSegmentExternalId,
	fixIllegalObject,
	parseMosString
} from './lib'
import { literal, asyncCollectionUpdate } from '../../../../lib/lib'
import { IngestPart, IngestSegment, IngestRundown } from 'tv-automation-sofie-blueprints-integration'
import { IngestDataCache, IngestCacheType } from '../../../../lib/collections/IngestDataCache'
import {
	updateSegmentFromIngestData,
	rundownSyncFunction,
	RundownSyncFunctionPriority,
	handleUpdatedRundownInner,
	handleUpdatedPartInner
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
import { removeSegments } from '../../rundown'
import { UpdateNext } from '../updateNext'

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
	previousPartId: MOS.MosString128,
	removePrevious: boolean,
	newStories: MOS.IMOSROStory[]
) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const ingestRundown = loadCachedRundownData(rundown._id, rundown.externalId)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)

		const insertBeforePartIdStr = parseMosString(previousPartId)
		const oldIndex = ingestParts.findIndex(p => p.externalId === insertBeforePartIdStr)
		if (oldIndex === -1) {
			throw new Meteor.Error(404, `Part ${insertBeforePartIdStr} in rundown ${rundown.externalId} not found`)
		}

		const newParts = _.compact(storiesToIngestParts(rundown._id, newStories || [], true))
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
		ingestParts.splice(oldIndex, 0, ...newParts)
		if (removePrevious) {
			ingestParts.splice(oldIndex + 1, 1)
		}

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
	insertBefore: MOS.MosString128,
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
		const insertBeforeStr = insertBefore ? parseMosString(insertBefore) || '' : ''
		const insertIndex =
			insertBeforeStr !== ''
				? filteredParts.findIndex(p => p.externalId === insertBeforeStr)
				: filteredParts.length
		if (insertIndex === -1) {
			throw new Meteor.Error(404, `Part ${insertBefore} was not found in rundown ${rundown.externalId}`)
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

	// Save new cache
	const newIngestRundown = _.clone(ingestRundown)
	newIngestRundown.segments = ingestSegments
	saveRundownCache(rundown._id, newIngestRundown)

	// Update segment ranks
	let ps: Array<Promise<any>> = []
	_.each(segmentDiff.rankChanged, ranks => {
		const rank = ranks[1]
		ps.push(
			asyncCollectionUpdate(
				Segments,
				{
					rundownId: rundown._id,
					_id: getSegmentId(rundown._id, newIngestRundown.segments[rank].externalId)
				},
				{
					$set: {
						_rank: rank
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

	// Create/Update segments
	for (const i of segmentDiff.changed) {
		updateSegmentFromIngestData(studio, rundown, ingestSegments[i])
	}
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
	const rankChanged: number[][] = [] // (Old, New) index
	const unchanged: number[] = [] // New index
	const removed: number[] = [] // Old index
	const changed: number[] = [] // New index

	// Convert to object to track their original index in the arrays
	const unusedOldSegmentEntries = _.map(oldSegmentEntries, (e, i) => ({ e, i }))
	const unusedNewSegmentEntries = _.map(newSegmentEntries, (e, i) => ({ e, i }))

	let prune: number[] = []

	// Deep compare
	_.each(newSegmentEntries, (e, i) => {
		const matching = unusedOldSegmentEntries.findIndex(o => _.isEqual(o.e, e))
		if (matching !== -1) {
			if (i === unusedOldSegmentEntries[matching].i) {
				unchanged.push(i)
			} else {
				rankChanged.push([unusedOldSegmentEntries[matching].i, i])
			}

			unusedOldSegmentEntries.splice(matching, 1)
			prune.push(i)
		}
	})

	// Remove any which were matching
	_.each(prune.reverse(), i => unusedNewSegmentEntries.splice(i, 1))
	prune = []

	// Match any by name
	_.each(unusedNewSegmentEntries, (e, i) => {
		const matching = unusedOldSegmentEntries.findIndex(o => o.e.name === e.e.name)
		if (matching !== -1) {
			const oldItem = unusedOldSegmentEntries[matching]
			if (e.e.id !== oldItem.e.id) {
				// If Id has changed, then the old one needs to be explicitly removed
				removed.push(oldItem.i)
			}
			changed.push(e.i)
			unusedOldSegmentEntries.splice(matching, 1)
			prune.push(i)
		}
	})

	// Remove any which were matching
	_.each(prune.reverse(), i => unusedNewSegmentEntries.splice(i, 1))
	prune = []

	changed.push(..._.map(unusedNewSegmentEntries, e => e.i))
	removed.push(..._.map(unusedOldSegmentEntries, e => e.i))

	return {
		rankChanged,
		unchanged,
		removed,
		changed
	}
}
