import * as _ from 'underscore'
import * as MOS from 'mos-connection'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { getStudioFromDevice, getRundown, getSegmentId, canBeUpdated } from '../lib'
import { getMosRundownId, getMosPartId, getSegmentExternalId, fixIllegalObject } from './lib'
import { literal } from '../../../../lib/lib'
import { IngestPart, IngestSegment, IngestRundown } from 'tv-automation-sofie-blueprints-integration'
import { IngestDataCache, IngestCacheType } from '../../../../lib/collections/IngestDataCache'
import { handleUpdatedRundown, handleUpdatedPart, updateSegmentFromIngestData, removeSegment } from '../rundownInput'
import { loadCachedRundownData, saveRundownCache } from '../ingestCache'
import { Rundown, Rundowns } from '../../../../lib/collections/Rundowns'
import { Studio } from '../../../../lib/collections/Studios'
import { Parts } from '../../../../lib/collections/Parts'
import { ServerPlayoutAPI } from '../../playout'
import { loadShowStyleBlueprints } from '../../blueprints/cache'
import { ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { ShowStyleContext } from '../../blueprints/context'

interface AnnotatedIngestPart {
	externalId: string
	partId: string
	segmentName: string
	ingest: IngestPart
}
function storiesToIngestParts (rundownId: string, stories: MOS.IMOSStory[], undefinedPayload: boolean): (AnnotatedIngestPart | null)[] {
	return _.map(stories, (s, i) => {
		if (!s) return null

		const name = (s.Slug ? s.Slug.toString() : '')
		return {
			externalId: s.ID.toString(),
			partId: getMosPartId(rundownId, s.ID),
			segmentName: name.split(';')[0],
			ingest: literal<IngestPart>({
				externalId: s.ID.toString(),
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
			groupedStories.push({ name: s.segmentName, parts: [s.ingest]})
		}
	})
	return groupedStories
}
function groupedPartsToSegments (mosRundownId: MOS.MosString128, groupedParts: { name: string, parts: IngestPart[]}[]): IngestSegment[] {
	return _.map(groupedParts, (grp, i) => literal<IngestSegment>({
		externalId: getSegmentExternalId(mosRundownId, grp.parts[0], i),
		name: grp.name,
		rank: i,
		parts: grp.parts,
	}))
}

export function handleMosRundownData (peripheralDevice: PeripheralDevice, mosRundown: MOS.IMOSRunningOrder, createFresh: boolean) {
	const studio = getStudioFromDevice(peripheralDevice)

	// Create or update a rundown (ie from rundownCreate or rundownList)

	const rundownId = getMosRundownId(studio, mosRundown.ID)

	const stories = _.compact(storiesToIngestParts(rundownId, mosRundown.Stories || [], !createFresh))
	const groupedStories = groupIngestParts(stories)

	// If this is a reload of a RO, then use cached data to make the change more seamless
	if (!createFresh) {
		const partIds = _.map(stories, s => s.externalId)
		const partCache = IngestDataCache.find({
			rundownId: rundownId,
			partId: { $in: partIds },
			type: IngestCacheType.PART
		}).fetch()

		const partCacheMap: { [id: string]: IngestPart } = {}
		_.each(partCache, p => partCacheMap[p._id] = p.data as IngestPart)

		_.each(stories, s => {
			const cached = partCacheMap[s.partId]
			if (cached) {
				s.ingest.payload = cached.payload
			}
		})
	}

	const ingestSegments = groupedPartsToSegments(mosRundown.ID, groupedStories)

	const ingestRundown = literal<IngestRundown>({
		externalId: mosRundown.ID.toString(),
		name: mosRundown.Slug.toString(),
		type: 'mos',
		segments: ingestSegments,
		payload: mosRundown
	})

	handleUpdatedRundown(peripheralDevice, ingestRundown, createFresh ? 'mosCreate' : 'mosList')
}
export function handleMosRundownMetadata (peripheralDevice: PeripheralDevice, rundownData: MOS.IMOSRunningOrderBase) {
	const studio = getStudioFromDevice(peripheralDevice)

	const rundown = getRundown(getMosRundownId(studio, rundownData.ID))
	if (!canBeUpdated(rundown)) return // TODO - more stuff in this file need this guard?

	// Load the blueprint to process the data
	const showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
	if (!showStyleBase) throw new Meteor.Error(500, `Failed to ShowStyleBase "${rundown.showStyleBaseId}" for rundown "${rundown._id}"`)
	const showStyleBlueprint = loadShowStyleBlueprints(showStyleBase)

	// Load the cached RO Data
	const ingestRundown = loadCachedRundownData(rundown._id)
	ingestRundown.payload = _.extend(ingestRundown.payload, rundownData)
	// TODO - verify this doesn't lose data, it was doing more work before

	handleUpdatedRundown(peripheralDevice, ingestRundown, 'mosRoMetadata') // TODO - make this more lightweight?
}

export function handleMosFullStory (peripheralDevice: PeripheralDevice, story: MOS.IMOSROFullStory) {
	fixIllegalObject(story)
	// @ts-ignore
	// logger.debug(story)

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getMosRundownId(studio, story.RunningOrderId)
	const partId = getMosPartId(rundownId, story.ID)
	const cachedPart = IngestDataCache.findOne({
		rundownId: rundownId,
		partId: partId,
		type: IngestCacheType.PART,
	})
	if (!cachedPart || !cachedPart.segmentId) {
		throw new Meteor.Error(500, 'Got MOSFullStory for an unknown Part')
	}
	const cachedSegment = IngestDataCache.findOne({
		rundownId: rundownId,
		segmentId: cachedPart.segmentId,
		type: IngestCacheType.SEGMENT,
	})
	if (!cachedSegment) {
		throw new Meteor.Error(500, 'Got MOSFullStory for an unknown Segment')
	}

	const ingestPart = cachedPart.data as IngestPart
	ingestPart.name = story.Slug ? story.Slug.toString() : ''
	ingestPart.payload = story

	// Need the raw id, not the hashed copy
	const segmentId = getSegmentExternalId(story.RunningOrderId, ingestPart, (cachedSegment.data as IngestSegment).rank)

	// Update db with the full story:
	handleUpdatedPart(peripheralDevice, story.RunningOrderId.toString(), segmentId, story.ID.toString(), ingestPart)
}
export function handleMosDeleteStory (peripheralDevice: PeripheralDevice, rundownId: MOS.MosString128, stories: Array<MOS.MosString128>) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundown = getRundown(getMosRundownId(studio, rundownId))

	const ingestRundown = loadCachedRundownData(rundown._id)
	const ingestParts = getAnnotatedIngestParts(ingestRundown)

	const storyIds = _.map(stories, s => s.toString())
	const filteredParts = ingestParts.filter(p => storyIds.indexOf(p.externalId) === -1)

	if (filteredParts.length === ingestParts.length) return // Nothing was removed

	diffAndApplyChanges(studio, rundownId, rundown, ingestRundown, filteredParts)
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
export function handleInsertParts (peripheralDevice: PeripheralDevice, rundownId: MOS.MosString128, previousPartId: MOS.MosString128, removePrevious: boolean, newStories: MOS.IMOSROStory[]) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundown = getRundown(getMosRundownId(studio, rundownId))

	const ingestRundown = loadCachedRundownData(rundown._id)
	const ingestParts = getAnnotatedIngestParts(ingestRundown)

	const previousPartIdStr = previousPartId.toString()
	const oldIndex = ingestParts.findIndex(p => p.externalId === previousPartIdStr)
	if (oldIndex === -1) throw new Meteor.Error(404, `Failed to find part ${previousPartId}`)

	// Update parts list with the changes
	const newParts = _.compact(storiesToIngestParts(rundown._id, newStories || [], true))
	ingestParts.splice(oldIndex, 0, ...newParts)
	if (removePrevious) {
		ingestParts.splice(oldIndex, 1)
	}

	const newPartIds = _.map(newParts, p => p.externalId)
	diffAndApplyChanges(studio, rundownId, rundown, ingestRundown, ingestParts)

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
				ServerPlayoutAPI.rundownSetNext(rundown._id, newNextPart._id)
			}
		}
	}
}
export function handleSwapStories (peripheralDevice: PeripheralDevice, rundownId: MOS.MosString128, story0: MOS.MosString128, story1: MOS.MosString128) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundown = getRundown(getMosRundownId(studio, rundownId))

	const ingestRundown = loadCachedRundownData(rundown._id)
	const ingestParts = getAnnotatedIngestParts(ingestRundown)

	const story0Index = ingestParts.findIndex(p => p.externalId === story0.toString())
	if (story0Index === -1) throw new Meteor.Error(404, `Failed to find story ${story0}`)
	const story1Index = ingestParts.findIndex(p => p.externalId === story1.toString())
	if (story1Index === -1) throw new Meteor.Error(404, `Failed to find story ${story1}`)

	// Don't bother swapping with itself
	if (story0Index === story1Index) return

	const tmp = ingestParts[story0Index]
	ingestParts[story0Index] = ingestParts[story1Index]
	ingestParts[story1Index] = tmp

	diffAndApplyChanges(studio, rundownId, rundown, ingestRundown, ingestParts)

	// Update next
	if (!rundown.nextPartManual && rundown.nextPartId) {
		const parts = Parts.find({
			rundownId: rundown._id,
			externalId: { $in: [ story0.toString(), story1.toString() ] }
		}).fetch()
		const nextPart = parts.find(p => p._id === rundown.nextPartId)
		// One of the swapped was next so it should now be the other
		if (nextPart) {
			// Find the first part from the other Story (could be multiple)
			const newNextPart = _.sortBy(parts, p => p._rank).find(p => p.externalId !== nextPart.externalId)
			if (newNextPart) {
				ServerPlayoutAPI.rundownSetNext(rundown._id, newNextPart._id)
			}
		}
	}
}
export function handleMoveStories (peripheralDevice: PeripheralDevice, rundownId: MOS.MosString128, insertBefore: MOS.MosString128, stories: MOS.MosString128[]) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundown = getRundown(getMosRundownId(studio, rundownId))

	const ingestRundown = loadCachedRundownData(rundown._id)
	const ingestParts = getAnnotatedIngestParts(ingestRundown)

	// Get story data
	const storyIds = _.map(stories, s => s.toString())
	const movingParts = _.sortBy(ingestParts.filter(p => storyIds.indexOf(p.externalId) !== -1), p => storyIds.indexOf(p.externalId))

	const filteredParts = ingestParts.filter(p => storyIds.indexOf(p.externalId) === -1)

	// Find insert point
	const insertBeforeStr = insertBefore ? insertBefore.toString() || '' : ''
	const insertIndex = insertBeforeStr !== '' ? filteredParts.findIndex(p => p.externalId === insertBeforeStr) : filteredParts.length
	if (insertIndex === -1) throw new Meteor.Error(404, `Failed to find story ${insertBefore}`)

	// Reinsert parts
	filteredParts.splice(insertIndex, 0, ...movingParts)

	diffAndApplyChanges(studio, rundownId, rundown, ingestRundown, ingestParts)
}

function diffAndApplyChanges (studio: Studio, rundownId: MOS.MosString128, rundown: Rundown, ingestRundown: IngestRundown, ingestParts: AnnotatedIngestPart[]) {
	// Save the new parts list
	const groupedParts = groupIngestParts(ingestParts)
	const ingestSegments = groupedPartsToSegments(rundownId, groupedParts)

	const oldSegmentEntries = compileSegmentEntries(ingestRundown.segments)
	const newSegmentEntries = compileSegmentEntries(ingestSegments)
	const segmentDiff = diffSegmentEntries(oldSegmentEntries, newSegmentEntries)

	console.log(JSON.stringify(newSegmentEntries, undefined, 4))

	// Save new cache
	const newIngestRundown = _.clone(ingestRundown)
	newIngestRundown.segments = ingestSegments
	saveRundownCache(rundown._id, newIngestRundown)

	// Update segment ranks
	// TODO for any references in segmentDiff.rankChanged

	// Remove old segments
	for (const i of segmentDiff.removed) {
		const segmentId = getSegmentId(rundown._id, ingestRundown.segments[i].externalId)
		// TODO - batch promise?
		removeSegment(segmentId)
	}
	// Create/Update segments
	for (const i of segmentDiff.changed) {
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
	const rankChanged: number[] = [] // New index
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
				rankChanged.push(i)
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
