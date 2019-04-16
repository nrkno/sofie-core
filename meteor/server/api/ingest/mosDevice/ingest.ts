import * as _ from 'underscore'
import * as MOS from 'mos-connection'
import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { getStudioFromDevice } from '../lib'
import { getMosRundownId, getMosPartId, getSegmentExternalId, fixIllegalObject } from './lib'
import { literal } from '../../../../lib/lib'
import { IngestPart, IngestSegment, IngestRundown } from 'tv-automation-sofie-blueprints-integration'
import { IngestDataCache, IngestCacheType } from '../../../../lib/collections/IngestDataCache'
import { handleUpdatedRundown, handleUpdatedPart, handleRemovedPart } from '../rundownInput'

export function handleMosRundownData (mosRundown: MOS.IMOSRunningOrder, peripheralDevice: PeripheralDevice, createFresh: boolean) {
	const studio = getStudioFromDevice(peripheralDevice)

	// Create or update a rundown (ie from rundownCreate or rundownList)

	const rundownId = getMosRundownId(studio, mosRundown.ID)

	const stories = _.compact(_.map(mosRundown.Stories || [], (s, i) => {
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
				payload: createFresh ? {} : undefined,
			})
		}
	}))
	const groupedStories: { name: string, parts: IngestPart[]}[] = []
	_.each(stories, s => {
		const lastStory = _.last(groupedStories)
		if (lastStory && lastStory.name === s.segmentName) {
			lastStory.parts.push(s.ingest)
		} else {
			groupedStories.push({ name: s.segmentName, parts: [s.ingest]})
		}
	})

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

	const ingestSegments = _.map(groupedStories, (grp, i) => literal<IngestSegment>({
		externalId: getSegmentExternalId(mosRundown.ID, grp.parts[0]),
		name: grp.name,
		rank: i,
		parts: grp.parts,
	}))

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

	const rundownId = getMosRundownId(studio, story.RunningOrderId)
	const partId = getMosPartId(rundownId, story.ID)
	console.log('search ', rundownId, partId)
	const cachedPart = IngestDataCache.findOne({
		rundownId: rundownId,
		partId: partId,
		type: IngestCacheType.PART,
	})
	if (!cachedPart || !cachedPart.segmentId) {
		throw new Meteor.Error(500, 'Got MOSFullStory for an unknown Part')
	}

	const ingestPart = cachedPart.data as IngestPart
	ingestPart.name = story.Slug ? story.Slug.toString() : ''
	ingestPart.payload = story

	const segmentId = getSegmentExternalId(story.RunningOrderId, ingestPart)

	// Update db with the full story:
	handleUpdatedPart(peripheralDevice, story.RunningOrderId.toString(), segmentId, story.ID.toString(), ingestPart)
}
export function handleMosDeleteStory (peripheralDevice: PeripheralDevice, roExternalId: MOS.MosString128, stories: Array<MOS.MosString128>) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getMosRundownId(studio, roExternalId)
	const partIds = _.map(stories, s => getMosPartId(rundownId, s))

	const cachedParts = IngestDataCache.find({
		rundownId: rundownId,
		partId: { $in: partIds },
		type: IngestCacheType.PART,
	}).fetch()

	// const affectedSegments = []
	_.each(cachedParts, p => {
		const ingestPart = p.data as IngestPart
		const segmentId = getSegmentExternalId(roExternalId, ingestPart)
		handleRemovedPart(peripheralDevice, roExternalId.toString(), segmentId, ingestPart.externalId)
		// affectedSegments.push(segmentId)
		// TODO - performance could be improved by batching this better?
	})

	// TODO - update segments. eg, remove/combine
}
