import * as _ from 'underscore'
import * as MOS from 'mos-connection'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { getStudioFromDevice, updateDeviceLastDataReceived, getRundown, getSegmentId } from '../lib'
import { getMosRundownId, getMosPartId, getSegmentExternalId, fixIllegalObject } from './lib'
import { literal } from '../../../../lib/lib'
import { IngestPart, IngestSegment, IngestRundown } from 'tv-automation-sofie-blueprints-integration'
import { IngestDataCache, IngestCacheType } from '../../../../lib/collections/IngestDataCache'
import { handleUpdatedRundown, handleUpdatedPart, handleRemovedPart, updateSegmentFromIngestData, removeSegment } from '../rundownInput'
import { loadCachedIngestSegment, saveSegmentCache, loadCachedRundownData, saveRundownCache } from '../ingestCache'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { Studio } from '../../../../lib/collections/Studios'

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

export function handleMosRundownData (mosRundown: MOS.IMOSRunningOrder, peripheralDevice: PeripheralDevice, createFresh: boolean) {
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
			partId: { $in: partIds }
		}).fetch()

		const partCacheMap: { [id: string]: IngestPart } = {}
		_.each(partCache, p => partCacheMap[p._id] = p.data)

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
	const segmentId = getSegmentExternalId(story.RunningOrderId, ingestPart, cachedSegment.data.rank)

	// Update db with the full story:
	handleUpdatedPart(peripheralDevice, story.RunningOrderId.toString(), segmentId, story.ID.toString(), ingestPart)
}
export function handleMosDeleteStory (peripheralDevice: PeripheralDevice, rundownId: MOS.MosString128, stories: Array<MOS.MosString128>) {
	updateDeviceLastDataReceived(peripheralDevice._id)
	const studio = getStudioFromDevice(peripheralDevice)
	const rundown = getRundown(getMosRundownId(studio, rundownId))

	const ingestRundown = loadCachedRundownData(rundown._id)
	const ingestParts = getAnnotatedIngestParts(ingestRundown)

	const storyIds = _.map(stories, s => s.toString())
	const filteredParts = ingestParts.filter(p => storyIds.indexOf(p.externalId) === -1)

	if (filteredParts.length === ingestParts.length) return // Nothing was removed

	diffAndApplyChanges(studio, rundownId, rundown, ingestRundown, filteredParts, storyIds, [])
}

function getAnnotatedIngestParts (ingestRundown: IngestRundown): AnnotatedIngestPart[] {
	const ingestParts: AnnotatedIngestPart[] = []
	_.each(ingestRundown.segments, s => {
		_.each(s.parts, p => {
			ingestParts.push({
				externalId: p.externalId,
				partId: '', // TODO
				segmentName: s.name,
				ingest: p,
			})
		})
	})
	return ingestParts
}
export function handleInsertParts (peripheralDevice: PeripheralDevice, rundownId: MOS.MosString128, previousPartId: MOS.MosString128, removePrevious: boolean, newStories: MOS.IMOSROStory[]) {
	updateDeviceLastDataReceived(peripheralDevice._id)
	const studio = getStudioFromDevice(peripheralDevice)
	const rundown = getRundown(getMosRundownId(studio, rundownId))

	const ingestRundown = loadCachedRundownData(rundown._id)
	const ingestParts = getAnnotatedIngestParts(ingestRundown)

	const previousPartIdStr = previousPartId.toString()
	const oldIndex = ingestParts.findIndex(p => p.externalId === previousPartIdStr)
	if (oldIndex === -1) throw new Meteor.Error(404, `Failed to find part ${previousPartId}`)

	// Update parts list with the changes
	const newParts = _.compact(storiesToIngestParts(rundown._id, newStories || [], true))
	ingestParts.splice(oldIndex + 1, 0, ...newParts)
	if (removePrevious) {
		ingestParts.splice(oldIndex, 1)
	}

	diffAndApplyChanges(studio, rundownId, rundown, ingestRundown, ingestParts, [previousPartIdStr], _.map(newParts, p => p.externalId))
}
export function handleSwapStories (peripheralDevice: PeripheralDevice, rundownId: MOS.MosString128, story0: MOS.MosString128, story1: MOS.MosString128) {
	updateDeviceLastDataReceived(peripheralDevice._id)
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

	// TODO - is this id usage correct?
	diffAndApplyChanges(studio, rundownId, rundown, ingestRundown, ingestParts, [], [story0.toString(), story1.toString()])
}
export function handleMoveStories (peripheralDevice: PeripheralDevice, rundownId: MOS.MosString128, insertBefore: MOS.MosString128, stories: MOS.MosString128[]) {
	updateDeviceLastDataReceived(peripheralDevice._id)
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

	// TODO - is this id usage correct?
	diffAndApplyChanges(studio, rundownId, rundown, ingestRundown, ingestParts, [], storyIds)
}

function diffAndApplyChanges (studio: Studio, rundownId: MOS.MosString128, rundown: Rundown, ingestRundown: IngestRundown, ingestParts: AnnotatedIngestPart[], removedIds: string[], insertedIds: string[]) {
	// Save the new parts list
	const groupedParts = groupIngestParts(ingestParts)
	const ingestSegments = groupedPartsToSegments(rundownId, groupedParts)

	const oldStructure = compileStructure(ingestRundown.segments)
	const newStructure = compileStructure(ingestSegments)
	const segmentDiff = diffStructure(oldStructure, newStructure, removedIds, insertedIds)

	// Save new cache
	const newIngestRundown = _.clone(ingestRundown)
	newIngestRundown.segments = ingestSegments
	saveRundownCache(rundown._id, newIngestRundown)

	// Update segment ranks
	// TODO

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
}

interface Structure {
	name: string
	parts: string[]
}
function compileStructure (ingestSegments: IngestSegment[]): Structure[] {
	return _.map(ingestSegments, s => ({
		name: s.name,
		parts: _.map(s.parts, p => p.externalId)
	}))
}

// TODO - this really needs some tests...
function diffStructure (oldStructure: Structure[], newStructure: Structure[], removedIds: string[], insertedIds: string[]) {
	const rankChanged: number[] = [] // New index
	const unchanged: number[] = [] // New index
	const removed: number[] = [] // Old index
	const changed: number[] = [] // New index

	let oldIndex = 0
	let newIndex = 0
	while (oldIndex < oldStructure.length && newIndex < newStructure.length) {
		const currentOld = oldStructure[oldIndex]
		const currentNew = newStructure[newIndex]

		if (_.isEqual(currentOld, currentNew)) {
			// They are the same
			if (oldIndex === newIndex) {
				unchanged.push(newIndex)
			} else {
				rankChanged.push(newIndex)
			}
			newIndex++
			oldIndex++
			continue
		}

		// Something is different.
		if (currentNew.name === currentOld.name) {
			// Just the contents
			changed.push(newIndex)
			oldIndex++
			newIndex++
			continue
		}

		// new segment?
		const startsWithInserted = insertedIds.indexOf(_.first(currentNew.parts) as string) !== -1
		const prevEndWithInserted = newIndex > 0 && insertedIds.indexOf(_.last(newStructure[newIndex - 1].parts) as string) !== -1
		if (startsWithInserted || prevEndWithInserted) {
			changed.push(newIndex)
			newIndex++
			continue
		}

		// removed segment?
		// TODO - is this safe to assume?
		removed.push(oldIndex)
		oldIndex++
	}

	for (;newIndex < newStructure.length; newIndex++) {
		changed.push(newIndex)
	}
	for (;oldIndex < oldStructure.length; oldIndex++) {
		removed.push(oldIndex)
	}

	return {
		rankChanged,
		unchanged,
		removed,
		changed
	}
}
