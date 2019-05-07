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
import { literal, asyncCollectionUpdate } from '../../../../lib/lib'
import { IngestPart, IngestSegment, IngestRundown } from 'tv-automation-sofie-blueprints-integration'
import { IngestDataCache, IngestCacheType } from '../../../../lib/collections/IngestDataCache'
import { updateSegmentFromIngestData, rundownSyncFunction, RundownSyncFunctionPriority, handleUpdatedRundownInner, handleUpdatedPartInner } from '../rundownInput'
import { loadCachedRundownData, saveRundownCache, loadCachedIngestSegment, loadIngestDataCachePart } from '../ingestCache'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { Studio } from '../../../../lib/collections/Studios'
import { Parts } from '../../../../lib/collections/Parts'
import { ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { Segments } from '../../../../lib/collections/Segments'
import { ServerPlayoutAPI } from '../../playout/playout'
import { loadShowStyleBlueprints } from '../../blueprints/cache'
import { removeSegments } from '../../rundown'

interface AnnotatedIngestPart {
	externalId: string
	partId: string
	segmentName: string
	ingest: IngestPart
}
function storiesToIngestParts (rundownId: string, stories: MOS.IMOSStory[], undefinedPayload: boolean): (AnnotatedIngestPart | null)[] {
	return _.map(stories, (s, i) => {
		if (!s) return null

		const name = (s.Slug ? parseMosString(s.Slug) : '')
		return {
			externalId: parseMosString(s.ID),
			partId: getPartIdFromMosStory(rundownId, s.ID),
			segmentName: name.split(';')[0],
			ingest: literal<IngestPart>({
				externalId: parseMosString(s.ID),
				name: name,
				rank: i,
				payload: undefinedPayload ? undefined : {},
			})
		}
	})
}
function groupIngestParts (parts: AnnotatedIngestPart[]): { name: string, parts: IngestPart[]}[] {
	const groupedStories: { name: string, parts: IngestPart[]}[] = []
	_.each(parts, s => {
		const lastStory = _.last(groupedStories)
		if (lastStory && lastStory.name === s.segmentName) {
			lastStory.parts.push(s.ingest)
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
function groupedPartsToSegments (rundownId: string, groupedParts: { name: string, parts: IngestPart[]}[]): IngestSegment[] {
	return _.map(groupedParts, (grp, i) => literal<IngestSegment>({
		externalId: getSegmentExternalId(rundownId, grp.parts[0], i),
		name: grp.name,
		rank: i,
		parts: grp.parts,
	}))
}

export function handleMosRundownData (peripheralDevice: PeripheralDevice, mosRunningOrder: MOS.IMOSRunningOrder, createFresh: boolean) {
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

		handleUpdatedRundownInner(studio, rundownId, ingestRundown, createFresh ? 'mosCreate' : 'mosList', peripheralDevice)
	})
}
export function handleMosRundownMetadata (peripheralDevice: PeripheralDevice, mosRunningOrderBase: MOS.IMOSRunningOrderBase) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, mosRunningOrderBase.ID)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(mosRunningOrderBase.ID))
		if (!canBeUpdated(rundown)) return // TODO - more stuff in this file need this guard?

		// Load the blueprint to process the data
		const showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(500, `Failed to ShowStyleBase "${rundown.showStyleBaseId}" for rundown "${rundown._id}"`)
		const showStyleBlueprint = loadShowStyleBlueprints(showStyleBase)

		// Load the cached RO Data
		const ingestRundown = loadCachedRundownData(rundown._id)
		ingestRundown.payload = _.extend(ingestRundown.payload, mosRunningOrderBase)
		// TODO - verify this doesn't lose data, it was doing more work before

		handleUpdatedRundownInner(studio, rundownId, ingestRundown, 'mosRoMetadata', peripheralDevice) // TODO - make this more lightweight?
	})
}

export function handleMosFullStory (peripheralDevice: PeripheralDevice, story: MOS.IMOSROFullStory) {
	fixIllegalObject(story)
	// @ts-ignore
	// logger.debug(story)

	const runningOrderExternalId = story.RunningOrderId

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderExternalId)
	const partId = getPartIdFromMosStory(rundownId, story.ID)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		// canBeUpdated is done inside handleUpdatedPartInner

		const cachedPartData = loadIngestDataCachePart(rundownId, partId)
		if (!cachedPartData.segmentId) {
			throw new Meteor.Error(500, `SegmentId missing for part "${partId}" (MOSFullStory)`)
		}

		const ingestSegment: IngestSegment = loadCachedIngestSegment(rundownId, cachedPartData.segmentId)

		const ingestPart: IngestPart = cachedPartData.data
		ingestPart.name = story.Slug ? parseMosString(story.Slug) : ''
		ingestPart.payload = story

		// Need the raw id, not the hashed copy
		const segmentId = getSegmentExternalId(rundownId, ingestPart, ingestSegment.rank)

		// Update db with the full story:
		handleUpdatedPartInner(studio, rundownId, parseMosString(runningOrderExternalId), segmentId, ingestPart)
	})
}
export function handleMosDeleteStory (peripheralDevice: PeripheralDevice, runningOrderMosId: MOS.MosString128, stories: Array<MOS.MosString128>) {
	if (stories.length === 0) return

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const ingestRundown = loadCachedRundownData(rundown._id)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)
		const ingestPartIds = _.map(ingestParts, part => part.externalId)

		const storyIds = _.map(stories, parseMosString)
		const missingIds = _.filter(storyIds, id => ingestPartIds.indexOf(id) === -1)
		if (missingIds.length > 0) {
			throw new Meteor.Error(404, `Parts ${missingIds.join(', ')} in rundown ${rundown.externalId} were not found`)
		}

		const filteredParts = ingestParts.filter(p => storyIds.indexOf(p.externalId) === -1)
		if (filteredParts.length === ingestParts.length) return // Nothing was removed

		diffAndApplyChanges(studio, rundown, ingestRundown, filteredParts)
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
				ingest: p,
			})
		})
	})
	return ingestParts
}
export function handleInsertParts (peripheralDevice: PeripheralDevice, runningOrderMosId: MOS.MosString128, previousPartId: MOS.MosString128, removePrevious: boolean, newStories: MOS.IMOSROStory[]) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const ingestRundown = loadCachedRundownData(rundown._id)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)

		const previousPartIdStr = parseMosString(previousPartId)
		const oldIndex = ingestParts.findIndex(p => p.externalId === previousPartIdStr)
		if (oldIndex === -1) throw new Meteor.Error(404, `Part ${previousPartIdStr} in rundown ${rundown.externalId} not found`)

		const newParts = _.compact(storiesToIngestParts(rundown._id, newStories || [], true))
		const newPartIds = _.map(newParts, part => part.externalId)
		const collidingPartIds = _.map(_.filter(ingestParts, part => newPartIds.indexOf(part.externalId) !== -1), part => part.externalId)
		if (collidingPartIds.length > 0) {
			throw new Meteor.Error(500, `Parts ${collidingPartIds.join(', ')} already exist in rundown ${rundown.externalId}`)
		}

		// Update parts list
		ingestParts.splice(oldIndex, 0, ...newParts)
		if (removePrevious) {
			ingestParts.splice(oldIndex + 1, 1)
		}

		diffAndApplyChanges(studio, rundown, ingestRundown, ingestParts)

		// Update next if we inserted before the part that is next
		// Note: the case where we remove the previous line is handled inside diffAndApplyChanges
		if (!removePrevious && !rundown.nextPartManual && rundown.nextPartId) {
			const previousPart = Parts.findOne({
				rundownId: rundown._id,
				externalId: previousPartIdStr
			})
			if (previousPart && rundown.nextPartId === previousPart._id) {
				const newNextPart = Parts.findOne({
					rundownId: rundown._id,
					externalId: { $in: newPartIds },
					_rank: { $gt: previousPart._rank }
				}, {
					sort: {
						rank: 1
					}
				})
				if (newNextPart) {
					// Move up next-point to the first inserted part
					ServerPlayoutAPI.setNextPartInner(rundown, newNextPart._id)
				}
			}
		}
	})
}
export function handleSwapStories (peripheralDevice: PeripheralDevice, runningOrderMosId: MOS.MosString128, story0: MOS.MosString128, story1: MOS.MosString128) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const ingestRundown = loadCachedRundownData(rundown._id)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)

		const story0Index = ingestParts.findIndex(p => p.externalId === parseMosString(story0))
		if (story0Index === -1) throw new Meteor.Error(404, `Failed to find story ${story0}`)
		const story1Index = ingestParts.findIndex(p => p.externalId === parseMosString(story1))
		if (story1Index === -1) throw new Meteor.Error(404, `Failed to find story ${story1}`)

		// Don't bother swapping with itself
		if (story0Index === story1Index) return

		const tmp = ingestParts[story0Index]
		ingestParts[story0Index] = ingestParts[story1Index]
		ingestParts[story1Index] = tmp

		diffAndApplyChanges(studio, rundown, ingestRundown, ingestParts)

		// Update next
		if (!rundown.nextPartManual && rundown.nextPartId) {
			const parts = Parts.find({
				rundownId: rundown._id,
				externalId: { $in: [ parseMosString(story0), parseMosString(story1) ] }
			}).fetch()
			const nextPart = parts.find(p => p._id === rundown.nextPartId)
			// One of the swapped was next so it should now be the other
			if (nextPart) {
				// Find the first part from the other Story (could be multiple)
				const newNextPart = _.sortBy(parts, p => p._rank).find(p => p.externalId !== nextPart.externalId)
				if (newNextPart) {
					ServerPlayoutAPI.setNextPartInner(rundown, newNextPart._id)
				}
			}
		}
	})
}
export function handleMoveStories (peripheralDevice: PeripheralDevice, runningOrderMosId: MOS.MosString128, insertBefore: MOS.MosString128, stories: MOS.MosString128[]) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownIdFromMosRO(studio, runningOrderMosId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, parseMosString(runningOrderMosId))
		if (!canBeUpdated(rundown)) return

		const ingestRundown = loadCachedRundownData(rundown._id)
		const ingestParts = getAnnotatedIngestParts(ingestRundown)

		// Get story data
		const storyIds = _.map(stories, parseMosString)
		const movingParts = _.sortBy(ingestParts.filter(p => storyIds.indexOf(p.externalId) !== -1), p => storyIds.indexOf(p.externalId))

		const filteredParts = ingestParts.filter(p => storyIds.indexOf(p.externalId) === -1)

		// Find insert point
		const insertBeforeStr = insertBefore ? parseMosString(insertBefore) || '' : ''
		const insertIndex = insertBeforeStr !== '' ? filteredParts.findIndex(p => p.externalId === insertBeforeStr) : filteredParts.length
		if (insertIndex === -1) throw new Meteor.Error(404, `Failed to find story ${insertBefore}`)

		// Reinsert parts
		filteredParts.splice(insertIndex, 0, ...movingParts)

		diffAndApplyChanges(studio, rundown, ingestRundown, ingestParts)

		// TODO - update next
	})
}

function diffAndApplyChanges (studio: Studio, rundown: Rundown, ingestRundown: IngestRundown, ingestParts: AnnotatedIngestPart[]) {
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
	// let ps: Array<Promise<any>> = []
	// _.each(segmentDiff.changed, rank => {
	// 	ps.push(asyncCollectionUpdate(Segments, {
	// 		rundownId: rundown._id,
	// 		_id: getSegmentId(rundown._id, newIngestRundown.segments[rank].externalId)
	// 	}, { $set: {
	// 		_rank: rank
	// 	}}))
	// })
	// // _.each(segmentDiff.rankChanged, i => {
	// // 	ps.push(asyncCollectionUpdate(Segments, {
	// // 		rundownId: rundown._id,
	// // 		_id: getSegmentId(rundown._id, newIngestRundown.segments[rank].externalId)
	// // 	}, { $set: {
	// // 		_rank: rank
	// // 	}}))
	// // })
	// Promise.all(ps)
	// TODO - are rankChanged being 'renamed' properly? - NO. this needs fixing
	// For now below we are very brute force removing and regenerating anything that had a rank change

	// Remove old segments
	const removed = [
		...segmentDiff.removed,
		..._.map(segmentDiff.rankChanged, n => n[0])
	]
	const removedSegmentIds = _.map(removed, i => getSegmentId(rundown._id, ingestRundown.segments[i].externalId))
	removeSegments(rundown._id, removedSegmentIds)

	// Create/Update segments
	const changed = [
		...segmentDiff.changed,
		..._.map(segmentDiff.rankChanged, n => n[1])
	]
	for (const i of changed) {
		updateSegmentFromIngestData(studio, rundown, ingestSegments[i])
	}

	// Ensure the next-id is still valid
	if (rundown.nextPartId) {
		const nextPart = Parts.findOne({
			rundownId: rundown._id,
			_id: rundown.nextPartId
		})
		if (!nextPart) {
			// TODO finish this
		}
	}
}

export interface SegmentEntry {
	name: string
	parts: string[]
}
function compileSegmentEntries (ingestSegments: IngestSegment[]): SegmentEntry[] {
	return _.map(ingestSegments, s => ({
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
