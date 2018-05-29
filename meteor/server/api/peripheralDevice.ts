import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import {
	IMOSConnectionStatus,
	IMOSDevice,
	IMOSListMachInfo,
	MosString128,
	MosTime,
	MosDuration,
	IMOSRunningOrder,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSROAction,
	IMOSItemAction,
	IMOSItem,
	IMOSROReadyToAir,
	IMOSROFullStory,
	IMOSStory,
	IMOSExternalMetaData
} from 'mos-connection'

import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { RunningOrder, RunningOrders, DBRunningOrder } from '../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines, DBSegmentLine } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { Segment, Segments, DBSegment } from '../../lib/collections/Segments'

import { saveIntoDb, partialExceptId, getCurrentTime, literal } from '../../lib/lib'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { logger } from './../logging'
import { runTemplate, TemplateContext, getHash } from './templates/templates'
import { Timeline } from '../../lib/collections/Timeline'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import { MediaObject, MediaObjects } from '../../lib/collections/MediaObjects'
import { SegmentLineAdLibItem, SegmentLineAdLibItems } from '../../lib/collections/SegmentLineAdLibItems'

// import {ServerPeripheralDeviceAPIMOS as MOS} from './peripheralDeviceMos'
export namespace ServerPeripheralDeviceAPI {
	export function initialize (id: string, token: string, options: PeripheralDeviceAPI.InitOptions): string {
		check(id, String)
		check(token, String)
		check(options, Object)
		check(options.name, String)
		check(options.type, Number)

		console.log('initialize', options)

		let peripheralDevice
		try {
			peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

			PeripheralDevices.update(id, {
				$set: {
					lastSeen: getCurrentTime(),
					connected: true,
					connectionId: options.connectionId,
					type: options.type,
					name: options.name
				}
			})
		} catch (e) {
			if ((e as Meteor.Error).error === 404) {
				PeripheralDevices.insert({
					_id: id,
					created: getCurrentTime(),
					status: {
						statusCode: PeripheralDeviceAPI.StatusCode.UNKNOWN
					},
					studioInstallationId: '',
					connected: true,
					connectionId: options.connectionId,
					lastSeen: getCurrentTime(),
					token: token,
					type: options.type,
					name: options.name,
					// settings: {}
				})
			} else {
				throw e
			}
		}
		return id
	}
	export function unInitialize (id: string, token: string): string {

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// TODO: Add an authorization for this?

		PeripheralDevices.remove(id)
		return id
	}
	export function setStatus (id: string, token: string, status: PeripheralDeviceAPI.StatusObject): PeripheralDeviceAPI.StatusObject {
		check(id, String)
		check(token, String)
		check(status, Object)
		check(status.statusCode, Number)
		console.log('setStatus', status.statusCode)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// check if we have to update something:
		if (!_.isEqual(status, peripheralDevice.status)) {
			// perform the update:
			PeripheralDevices.update(id, {$set: {
				status: status
			}})
		}
		return status
	}
	export function getPeripheralDevice (id: string, token: string) {
		return PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
	}
	export function timelineTriggerTime (id: string, token: string, r: PeripheralDeviceAPI.TimelineTriggerTimeResult) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.objectIds, [String])
		logger.info('Timeline: Setting time ' + r.time + ' to ids [' + r.objectIds.join(',') + ']')

		Timeline.update({
			_id: {$in: r.objectIds}
		}, {$set: {
			'trigger.value': r.time
		}},{
			multi: true
		})
	}
	export function segmentLinePlaybackStarted (id: string, token: string, r: PeripheralDeviceAPI.SegmentLinePlaybackStartedResult) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.roId, String)
		check(r.slId, String)
		logger.info('RunningOrder: Setting playback started ' + r.time + ' to id ' + r.slId)

		Meteor.call('playout_segmentLinePlaybackStart', r.roId, r.slId, r.time)
	}

	// export {P.initialize}
	// ----------------------------------------------------------------------------
// Mos-functions:
	export function mosRoCreate (id, token, ro: IMOSRunningOrder) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		// console.log('mosRoCreate', ro)
		logger.info('mosRoCreate')

		logger.debug(ro)

		if (!peripheralDevice.studioInstallationId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no StudioInstallation')
		let studioInstallation = StudioInstallations.findOne(peripheralDevice.studioInstallationId) as StudioInstallation
		if (!studioInstallation) throw new Meteor.Error(404, 'StudioInstallation "' + peripheralDevice.studioInstallationId + '" not found')

		// Save RO into database:
		saveIntoDb(RunningOrders, {
			_id: roId(ro.ID)
		}, _.map([ro], (ro) => {
			return partialExceptId<DBRunningOrder>({
				_id: roId(ro.ID),
				mosId: ro.ID.toString(),
				studioInstallationId: studioInstallation._id,
				mosDeviceId: id,
				// showStyleId: '',
				name: ro.Slug.toString(),
				expectedStart: ro.EditorialStart ? new MosTime(ro.EditorialStart.toString()).getTime() : undefined,
				expectedDuration: ro.EditorialDuration ? new MosDuration(ro.EditorialDuration.toString()).valueOf() * 1000 : undefined
			})
		}), {
			beforeInsert: (o) => {
				o.created = getCurrentTime()
				o.modified = getCurrentTime()
				return o
			},
			beforeUpdate: (o) => {
				o.modified = getCurrentTime()
				return o
			}
		})

		let dbRo = RunningOrders.findOne(roId(ro.ID))
		if (!dbRo) throw new Meteor.Error(500, 'Running order not found (it should have been)')

		// Save Stories into database:
		// Note: a number of X stories will result in (<=X) Segments and X SegmentLines
		let segments: DBSegment[] = []
		let segmentLines: DBSegmentLine[] = []
		let rankSegment = 0
		let rankSegmentLine = 0
		let prevSlugParts: string[] = []
		let segment: DBSegment
		_.each(ro.Stories, (story: IMOSStory) => {
			// divide into
			let slugParts = (story.Slug || '').toString().split(';')

			// if (slugParts[0] !== prevSlugParts[0]) {
				// segment = convertToSegment(story, roId(ro.ID), rankSegment++)
				// segments.push(segment)
			// }
			if (dbRo) {
				let segmentLine = convertToSegmentLine(story, dbRo._id, rankSegmentLine++)
				segmentLines.push(segmentLine)
			} else throw new Meteor.Error(500, 'Running order not found (it should have been)')

			prevSlugParts = slugParts
		})
		// console.log('segmentLines', segmentLines)
		// console.log('---------------')
		// console.log(SegmentLines.find({runningOrderId: dbRo._id}).fetch())
		saveIntoDb<SegmentLine, DBSegmentLine>(SegmentLines, {
			runningOrderId: dbRo._id
		}, segmentLines, {
			beforeDiff (obj, oldObj) {
				let o = _.extend({}, obj, {
					segmentId: oldObj.segmentId
				})
				return o
			},
			afterInsert (segmentLine) {
				// console.log('inserted segmentLine ' + segmentLine._id)
				// @todo: have something here?
				// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
					// afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (segmentLine) {
				// console.log('updated segmentLine ' + segmentLine._id)
				// @todo: have something here?
				// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// 	afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterRemove (segmentLine) {
				afterRemoveSegmentLine(segmentLine._id)
			}
		})
		updateSegments(roId(ro.ID))
	}
	export function mosRoReplace (id, token, ro: IMOSRunningOrder) {
		// let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReplace')
		// @ts-ignore
		logger.debug(ro)
		return mosRoCreate(id, token, ro) // it's the same
	}
	export function mosRoDelete (id, token, runningOrderId: MosString128) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoDelete')
		// @ts-ignore
		// logger.debug(runningOrderId)
		console.info('Removing RO ' + roId(runningOrderId))
		let ro = RunningOrders.findOne(roId(runningOrderId))
		if (ro) {
			ro.remove()
		}
	}
	export function mosRoMetadata (id, token, metadata: IMOSRunningOrderBase) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoMetadata')
		// @ts-ignore
		logger.debug(metadata)
		let ro = getRO(metadata.ID)
		if (metadata.MosExternalMetaData) {
			RunningOrders.update(ro._id, {$set: {
				metaData: metadata.MosExternalMetaData
			}})
		}
	}
	export function mosRoStatus (id, token, status: IMOSRunningOrderStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStatus')
		// @ts-ignore
		logger.debug(status)
		let ro = getRO(status.ID)
		RunningOrders.update(ro._id, {$set: {
			status: status.Status
		}})
	}
	export function mosRoStoryStatus (id, token, status: IMOSStoryStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryStatus')
		// @ts-ignore
		logger.debug(status)
		// Save Stories (aka SegmentLine ) status into database:
		let segmentLine = SegmentLines.findOne({
			_id: 			segmentLineId(roId(status.RunningOrderId), status.ID, true),
			runningOrderId: roId(status.RunningOrderId)
		})
		if (segmentLine) {
			SegmentLines.update(segmentLine._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'Segment ' + status.ID + ' in RO ' + status.RunningOrderId + ' not found')
	}
	export function mosRoItemStatus (id, token, status: IMOSItemStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warning('mosRoItemStatus NOT IMPLEMENTED YET')
		// @ts-ignore
		logger.debug(status)
		/*
		// Save status of Item database:
		let segmentID = segmentId(roId(status.RunningOrderId), status.StoryId)
		let segmentLine = SegmentLineIte.findOne({
			_id: 			segmentLineId(segmentID, status.ID),
			segmentId: 		segmentID,
			runningOrderId: roId(status.RunningOrderId)
		})
		if (segmentLine) {
			SegmentLines.update(segmentLine._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'SegmentLine ' + status.ID + ' in segment ' + status.StoryId + ' in RO ' + status.RunningOrderId + ' not found')
		*/
	}
	export function mosRoStoryInsert (id, token, Action: IMOSStoryAction, Stories: Array<IMOSROStory>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryInsert')

		// @ts-ignore		logger.debug(
		logger.debug(Action, Stories)
		// insert a story (aka SegmentLine) before another story:
		let ro = getRO(Action.RunningOrderID)
		let segmentLineAfter = (Action.StoryID ? getSegmentLine(Action.RunningOrderID, Action.StoryID) : null)

		let segmentBeforeOrLast
		let newRankMax
		let newRankMin
		if (segmentLineAfter) {
			segmentBeforeOrLast = fetchBefore(SegmentLines,
				{ runningOrderId: ro._id },
				segmentLineAfter._rank
			)
		} else {
			segmentBeforeOrLast = fetchBefore(SegmentLines,
				{ runningOrderId: ro._id },
				null
			)
		}
		_.each(Stories, (story: IMOSROStory, i: number) => {
			let rank = getRank(segmentBeforeOrLast, segmentLineAfter, i, Stories.length)
			// let rank = newRankMin + ( i / Stories.length ) * (newRankMax - newRankMin)
			insertSegmentLine(story, ro._id, rank)
		})

		updateSegments(ro._id)
	}
	export function mosRoItemInsert (id, token, Action: IMOSItemAction, Items: Array<IMOSItem>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warning('mosRoItemInsert NOT SUPPORTED')
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// insert an item (aka SegmentLine ## TODO ##Line) before another story:
		let ro = getRO(Action.RunningOrderID)
		let segment = getSegment(Action.RunningOrderID, Action.StoryID)
		let segmentLineAfter = (Action.ItemID ? getSegmentLine(Action.RunningOrderID, Action.StoryID, Action.ItemID) : null)

		let segmentLineBeforeOrLast
		let newRankMax
		let newRankMin
		if (segmentLineAfter) {
			segmentLineBeforeOrLast = fetchBefore(SegmentLines,
				{ runningOrderId: ro._id, segmentId: segment._id },
				segmentLineAfter._rank
			)
		} else {
			segmentLineBeforeOrLast = fetchBefore(SegmentLines,
				{ runningOrderId: ro._id, segmentId: segment._id },
				null
			)
		}
		_.each(Items, (item: IMOSItem, i: number) => {
			let rank = getRank(segmentLineBeforeOrLast, segmentLineAfter, i, Items.length)
			// let rank = newRankMin + ( i / Items.length ) * (newRankMax - newRankMin)
			insertSegmentLine(item, ro._id, segment._id, rank)
		})
		*/
	}
	export function mosRoStoryReplace (id, token, Action: IMOSStoryAction, Stories: Array<IMOSROStory>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryReplace')
		// @ts-ignore
		logger.debug(Action, Stories)
		// Replace a Story (aka a SegmentLine) with one or more Stories
		let ro = getRO(Action.RunningOrderID)
		let segmentLineToReplace = getSegmentLine(Action.RunningOrderID, Action.StoryID)

		let segmentLineBefore = fetchBefore(SegmentLines, { runningOrderId: ro._id }, segmentLineToReplace._rank)
		let segmentLineAfter = fetchAfter(SegmentLines, { runningOrderId: ro._id }, segmentLineToReplace._rank)

		removeSegment(segmentLineToReplace._id, segmentLineToReplace.runningOrderId)

		_.each(Stories, (story: IMOSROStory, i: number) => {
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Stories.length)
			insertSegmentLine(story, ro._id, rank)
		})

		updateSegments(ro._id)
	}
	export function mosRoItemReplace (id, token, Action: IMOSItemAction, Items: Array<IMOSItem>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warning('mosRoItemReplace NOT IMPLEMENTED YET')
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// Replace an item (aka SegmentLine ## TODO ##Line) with one or more items
		let ro = getRO(Action.RunningOrderID)
		let segmentLineToReplace = getSegmentLine(Action.RunningOrderID, Action.StoryID, Action.ItemID)

		let segmentLineBefore = fetchBefore(SegmentLines, { runningOrderId: ro._id, segmentId: segmentLineToReplace.segmentId }, segmentLineToReplace._rank)
		let segmentLineAfter = fetchAfter(SegmentLines, { runningOrderId: ro._id, segmentId: segmentLineToReplace.segmentId }, segmentLineToReplace._rank)

		removeSegmentLine(segmentLineToReplace._id)

		_.each(Items, (item: IMOSItem, i: number) => {
			let rank = getRank (segmentLineBefore, segmentLineAfter, i, Items.length)
			insertSegmentLine(item, ro._id, rank)
		})
		*/
	}
	export function mosRoStoryMove (id, token, Action: IMOSStoryAction, Stories: Array<MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warning ('mosRoStoryMove')
		// @ts-ignore
		logger.debug(Action, Stories)

		// Move Stories (aka SegmentLine ## TODO ##Lines) to before a story
		let ro = getRO(Action.RunningOrderID)
		let segmentLineAfter = getSegmentLine(Action.RunningOrderID, Action.StoryID)
		let segmentLineBefore = fetchBefore(SegmentLines, { runningOrderId: ro._id }, segmentLineAfter._rank)

		_.each(Stories, (storyId: MosString128, i: number) => {
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Stories.length)
			SegmentLines.update(segmentLineId(ro._id, storyId, true), {$set: {
				_rank: rank
			}})
		})

		updateSegments(ro._id)
	}
	export function mosRoItemMove (id, token, Action: IMOSItemAction, Items: Array<MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warning('mosRoItemMove NOT IMPLEMENTED YET')
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// Move Items (#####) to before a story
		let ro = getRO(Action.RunningOrderID)
		let segmentLineAfter = getSegmentLine(Action.RunningOrderID, Action.StoryID, Action.ItemID)
		let segmentLineBefore = fetchBefore(SegmentLines,
			{ runningOrderId: ro._id, segmentId: segmentLineAfter.segmentId},
			segmentLineAfter._rank)

		_.each(Items, (itemId: MosString128, i: number) => {
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Items.length)
			SegmentLines.update(segmentLineId(segmentId, itemId), {$set: {
				_rank: rank
			}})
		})
		*/
	}
	export function mosRoStoryDelete (id, token, Action: IMOSROAction, Stories: Array<MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryDelete')
		// @ts-ignore
		logger.debug(Action, Stories)
		// Delete Stories (aka SegmentLine)
		let ro = getRO(Action.RunningOrderID)
		ro.touch()
		_.each(Stories, (storyId: MosString128, i: number) => {
			removeSegmentLine(segmentLineId(ro._id, storyId, true))
		})
		updateSegments(ro._id)
	}
	export function mosRoItemDelete (id, token, Action: IMOSStoryAction, Items: Array<MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warning('mosRoItemDelete NOT IMPLEMENTED YET')
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// Delete Items (aka SegmentLine ## TODO ##LinesLines)
		let ro = getRO(Action.RunningOrderID)
		_.each(Items, (itemId: MosString128, i: number) => {
			removeSegmentLine( segmentLineId(segmentId(ro._id, Action.StoryID), itemId))
		})
		*/
	}
	export function mosRoStorySwap (id, token, Action: IMOSROAction, StoryID0: MosString128, StoryID1: MosString128) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStorySwap')
		// @ts-ignore
		logger.debug(Action, StoryID0, StoryID1)
		// Swap Stories (aka SegmentLine)
		let ro = getRO(Action.RunningOrderID)

		let segmentLine0 = getSegmentLine(Action.RunningOrderID, StoryID0)
		let segmentLine1 = getSegmentLine(Action.RunningOrderID, StoryID1)

		SegmentLines.update(segmentLine0._id, {$set: {_rank: segmentLine1._rank}})
		SegmentLines.update(segmentLine1._id, {$set: {_rank: segmentLine0._rank}})

		updateSegments(ro._id)
	}
	export function mosRoItemSwap (id, token, Action: IMOSStoryAction, ItemID0: MosString128, ItemID1: MosString128) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warning('mosRoItemSwap NOT IMPLEMENTED YET')
		// @ts-ignore
		logger.debug(Action, ItemID0, ItemID1)
		/*
		// Swap Stories (aka SegmentLine ## TODO ##Lines)
		let ro = getRO(Action.RunningOrderID)

		let segmentLine0 = getSegmentLine(Action.RunningOrderID, Action.StoryID, ItemID0)
		let segmentLine1 = getSegmentLine(Action.RunningOrderID, Action.StoryID, ItemID1)

		Segments.update(segmentLine0._id, {$set: {_rank: segmentLine1._rank}})
		Segments.update(segmentLine1._id, {$set: {_rank: segmentLine0._rank}})
		*/
	}
	export function mosRoReadyToAir (id, token, Action: IMOSROReadyToAir) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReadyToAir')
		// @ts-ignore
		logger.debug(Action)
		// Set the ready to air status of a Running Order
		let ro = getRO(Action.ID)

		RunningOrders.update(ro._id, {$set: {
			airStatus: Action.Status
		}})

	}
	export function mosRoFullStory (id, token, story: IMOSROFullStory ) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoFullStory')
		// @ts-ignore
		logger.debug(story)
		// Update db with the full story:
		let ro = getRO(story.RunningOrderId)
		// let segment = getSegment(story.RunningOrderId, story.ID)
		let segmentLine = getSegmentLine(story.RunningOrderId, story.ID)
		// TODO: Do something

		// TODO: Find good MosExternalMetaData for durations
		const durationMosMetaData = findDurationInfoMOSExternalMetaData(story)
		if (durationMosMetaData && durationMosMetaData.MosPayload && (durationMosMetaData.MosPayload.Actual || durationMosMetaData.MosPayload.Estimated || durationMosMetaData.MosPayload.ReadTime)) {

			const duration = durationMosMetaData.MosPayload.Actual && parseFloat(durationMosMetaData.MosPayload.Actual) ||
							 durationMosMetaData.MosPayload.Estimated && parseFloat(durationMosMetaData.MosPayload.Estimated) ||
							 durationMosMetaData.MosPayload.ReadTime && parseFloat(durationMosMetaData.MosPayload.ReadTime)

			// console.log('updating segment line duration: ' + segmentLine._id + ' ' + duration)
			segmentLine.expectedDuration = duration * 1000
			SegmentLines.update(segmentLine._id, {$set: {
				expectedDuration: segmentLine.expectedDuration
			}})
		} else {
			logger.warn('Could not find duration information for segment line: ' + segmentLine._id)
		}

		let context: TemplateContext = {
			runningOrderId: ro._id,
			// segment: Segment,
			segmentLine: segmentLine
		}
		let result = runTemplate(context, story)

		saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
			runningOrderId: ro._id,
			segmentLineId: segmentLine._id,
		}, result.segmentLineItems, {
			afterInsert (segmentLineItem) {
				console.log('inserted segmentLineItem ' + segmentLineItem._id)
				console.log(segmentLineItem)
				// @todo: have something here?
				// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
					// afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (segmentLineItem) {
				console.log('updated segmentLineItem ' + segmentLineItem._id)
				// @todo: have something here?
				// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// 	afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterRemove (segmentLineItem) {
				console.log('deleted segmentLineItem ' + segmentLineItem._id)
				// @todo: handle this:
				// afterRemoveSegmentLineItem(segmentLine._id)
			}
		})

		saveIntoDb<SegmentLineAdLibItem, SegmentLineAdLibItem>(SegmentLineAdLibItems, {
			runningOrderId: ro._id,
			segmentLineId: segmentLine._id
		}, result.segmentLineAdLibItems || [], {
			afterInsert (segmentLineAdLibItem) {
				console.log('inserted segmentLineAdLibItem ' + segmentLineAdLibItem._id)
				console.log(segmentLineAdLibItem)
				// @todo: have something here?
				// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (segmentLineAdLibItem) {
				console.log('updated segmentLineItem ' + segmentLineAdLibItem._id)
				// @todo: have something here?
				// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// 	afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterRemove (segmentLineAdLibItem) {
				console.log('deleted segmentLineItem ' + segmentLineAdLibItem._id)
				// @todo: handle this:
				// afterRemoveSegmentLineItem(segmentLine._id)
			}
		})

		// return this.core.mosManipulate(P.methods.mosRoReadyToAir, story)
	}
// Media scanner functions:
	export function getMediaObjectRevisions (id, token, collectionId: string) {
		console.log('getMediaObjectRevisions')
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

		if (peripheralDevice.studioInstallationId) {
			return _.map(MediaObjects.find({
				studioId: peripheralDevice.studioInstallationId,
				collectionId: collectionId
			}).fetch(), (mo: MediaObject) => {
				return {
					id: 	mo.objId,
					rev: 	mo._rev
				}
			})
		} else {
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studioInstallation')
		}
	}
	export function updateMediaObject (id, token, collectionId: string, objId, doc: MediaObject | null) {
		console.log('updateMediaObject')
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

		let _id = collectionId + '_' + objId
		if (_.isNull(doc)) {
			MediaObjects.remove(_id)
		} else if (doc) {
			let doc2 = _.extend(doc, {
				studioId: peripheralDevice.studioInstallationId,
				collectionId: collectionId,
				objId: objId,
				_id: _id
			})
			// console.log(doc2)
			MediaObjects.upsert(_id, {$set: doc2})
		} else {
			throw new Meteor.Error(400, 'missing doc argument')
		}
	}
}
export function roId (roId: MosString128, original?: boolean): string {
	// console.log('roId', roId)
	let id = 'ro_' + (roId['_str'] || roId.toString())
	return (original ? id : getHash(id))
}
export function segmentId (roId: string, storySlug: string, rank: number, original?: boolean): string {
	let slugParts = storySlug.split(';')
	let id = roId + '_' + slugParts[0] + '_' + rank
	return (original ? id : getHash(id))
}
export function segmentLineId (runningOrderId: string, storyId: MosString128, tmp: boolean, original?: boolean): string {
	let id = runningOrderId + '_' + storyId.toString()
	return (original ? id : getHash(id))
}
/**
 * Returns a Running order, throws error if not found
 * @param roId Id of the Running order
 */
export function getRO (roID: MosString128): RunningOrder {
	let id = roId(roID)
	let ro = RunningOrders.findOne(id)
	if (ro) {
		ro.touch()
		return ro
	} else throw new Meteor.Error(404, 'RunningOrder ' + id + ' not found')
}
/**
 * Returns a Segment (aka a Story), throws error if not found
 * @param roId Running order id
 * @param segmentId Segment / Story id
 */
// export function getSegment (roID: MosString128, storyID: MosString128, rank: number): Segment {
// 	let id = segmentId(roId(roID), storyID, rank)
// 	let segments = Segments.findOne({
// 		runningOrderId: roId(roID),
// 		_id: id
// 	})
// 	if (segments) {
// 		return segments
// 	} else throw new Meteor.Error(404, 'Segment ' + id + ' not found')
// }
/**
 * Returns a SegmentLine (aka an Item), throws error if not found
 * @param roId
 * @param segmentLineId
 */
export function getSegmentLine (roID: MosString128, storyID: MosString128): SegmentLine {
	let id = segmentLineId(roId(roID), storyID, true)
	let segmentLine = SegmentLines.findOne({
		runningOrderId: roId( roID ),
		_id: id
	})
	if (segmentLine) {
		return segmentLine
	} else throw new Meteor.Error(404, 'SegmentLine ' + id + ' not found')
}
/**
 * Converts a Story into a Segment
 * @param story MOS Sory
 * @param runningOrderId Running order id of the story
 * @param rank Rank of the story
 */
export function convertToSegment (segmentLine: SegmentLine, rank: number): DBSegment {
	// let slugParts = (story.Slug || '').toString().split(';')
	let slugParts = segmentLine.slug.split(';')

	return {
		_id: segmentId(segmentLine.runningOrderId, segmentLine.slug, rank),
		runningOrderId: segmentLine.runningOrderId,
		_rank: rank,
		mosId: 'N/A', // to be removed?
		name: slugParts[0],
		number: 'N/A' // @todo: to be removed from data structure
		// number: (story.Number ? story.Number.toString() : '')
	}
	// console.log('story.Number', story.Number)
}
/**
 * Converts an Item into a SegmentLine
 * @param item MOS Item
 * @param runningOrderId Running order id of the item
 * @param segmentId Segment / Story id of the item
 * @param rank Rank of the story
 */
export function convertToSegmentLine (story: IMOSStory, runningOrderId: string, rank: number): DBSegmentLine {

// item: IMOSItem, runningOrderId: string, segmentId: string, rank: number): SegmentLine {
	return {
		_id: segmentLineId(runningOrderId, story.ID, true),
		runningOrderId: runningOrderId,
		segmentId: '', // to be coupled later
		_rank: rank,
		mosId: story.ID.toString(),
		slug: (story.Slug || '').toString()
		// expectedDuration: item.EditorialDuration,
		// autoNext: item.Trigger === ??
	}
}
/**
 * Insert a Story (aka a Segment) into the database
 * @param story The story to be inserted
 * @param runningOrderId The Running order id to insert into
 * @param rank The rank (position) to insert at
 */
// export function insertSegment (story: IMOSROStory, runningOrderId: string, rank: number) {
// 	let segment = convertToSegment(story, rank)
// 	Segments.upsert(segment._id, {$set: _.omit(segment,['_id']) })
// 	afterInsertUpdateSegment(story, runningOrderId)
// }
/**
 * Removes a Story (aka a Segment) into the database
 * @param story The story to be inserted
 * @param runningOrderId The Running order id to insert into
 * @param rank The rank (position) to insert at
 */
export function removeSegment (segmentId: string, runningOrderId: string) {
	Segments.remove(segmentId)
	afterRemoveSegment(segmentId, runningOrderId)
}
/**
 * After a Story (aka a Segment) has been inserted / updated, handle its contents
 * @param story The Story that was inserted / updated
 * @param runningOrderId Id of the Running Order that contains the story
 */
export function afterInsertUpdateSegment (story: IMOSROStory, runningOrderId: string) {
	// Save Items (#####) into database:

	/*
	let segment = convertToSegment(story, runningOrderId, 0)
	let rank = 0
	saveIntoDb(SegmentLines, {
		runningOrderId: runningOrderId,
		segmentId: segment._id
	}, _.map(story.Items, (item: IMOSItem) => {
		return convertToSegmentLine(item, runningOrderId, segment._id, rank++)
	}), {
		afterInsert (o) {
			let item: IMOSItem | undefined = _.find(story.Items, (s) => { return s.ID.toString() === o.mosId } )
			if (item) {
				afterInsertUpdateSegmentLine(item, runningOrderId, segment._id)
			} else throw new Meteor.Error(500, 'Item not found (it should have been)')
		},
		afterUpdate (o) {
			let item: IMOSItem | undefined = _.find(story.Items, (s) => { return s.ID.toString() === o.mosId } )
			if (item) {
				afterInsertUpdateSegmentLine(item, runningOrderId, segment._id)
			} else throw new Meteor.Error(500, 'Item not found (it should have been)')
		},
		afterRemove (o) {
			afterRemoveSegmentLine(o._id)
		}
	})
	*/
}
/**
 * After a Segment has beed removed, handle its contents
 * @param segmentId Id of the Segment
 * @param runningOrderId Id of the Running order
 */
export function afterRemoveSegment (segmentId: string, runningOrderId: string) {
	// Remove the segment lines:
	saveIntoDb(SegmentLines, {
		runningOrderId: runningOrderId,
		segmentId: segmentId
	},[],{
		remove (segment) {
			removeSegmentLine(segment._id)
		}
	})
}
/**
 * Insert a new SegmentLine (aka an Item)
 * @param item The item to be inserted
 * @param runningOrderId The id of the Running order
 * @param segmentId The id of the Segment / Story
 * @param rank The new rank of the SegmentLine
 */
export function insertSegmentLine (story: IMOSStory, runningOrderId: string, rank: number) {
	SegmentLines.insert(convertToSegmentLine(story, runningOrderId, rank))
	afterInsertUpdateSegmentLine(story, runningOrderId)
}
export function removeSegmentLine (segmentLineId: string) {
	SegmentLines.remove(segmentLineId)
	afterRemoveSegmentLine(segmentLineId)
}
export function afterInsertUpdateSegmentLine (story: IMOSStory, runningOrderId: string) {
	// TODO: create segmentLineItems

	// use the Template-generator to generate the segmentLineItems
	// and put them into the db
}
export function afterRemoveSegmentLine (segmentLineId: string) {
	SegmentLineItems.remove({
		segmentLineId: segmentLineId
	})
}
export function fetchBefore<T> (collection: Mongo.Collection<T>, selector: Mongo.Selector, rank: number | null): T {
	if (_.isNull(rank)) rank = Number.POSITIVE_INFINITY
	return collection.find(_.extend(selector, {
		_rank: {$lt: rank}
	}), {
		sort: {
			_rank: -1,
			_id: -1
		},
		limit: 1
	}).fetch()[0]
}
export function fetchAfter<T> (collection: Mongo.Collection<T>, selector: Mongo.Selector, rank: number | null): T {
	if (_.isNull(rank)) rank = Number.NEGATIVE_INFINITY
	return collection.find(_.extend(selector, {
		_rank: {$gt: rank}
	}), {
		sort: {
			_rank: 1,
			_id: 1
		},
		limit: 1
	}).fetch()[0]
}
export function getRank (beforeOrLast, after, i: number, count: number): number {
	let newRankMax
	let newRankMin

	if (after) {
		if (beforeOrLast) {
			newRankMin = beforeOrLast._rank
			newRankMax = after._rank
		} else {
			// First
			newRankMin = after._rank - 1
			newRankMax = after._rank
		}
	} else {
		if (beforeOrLast) {
			// Last
			newRankMin = beforeOrLast._rank
			newRankMax = beforeOrLast._rank + 1
		} else {
			// Empty list
			newRankMin = 0
			newRankMax = 1
		}
	}
	return newRankMin + ( (i + 1) / (count + 1) ) * (newRankMax - newRankMin)
}

function findDurationInfoMOSExternalMetaData (story: IMOSROFullStory): any | undefined {
	if (story.MosExternalMetaData) {
		let matchingMetaData = story.MosExternalMetaData.find((metaData) => {
			if (metaData.MosSchema.match(/http(s)?:\/\/[\d\w\.\:]+\/schema\/enps.dtd$/)) {
				return true
			}
			return false
		})
		if (matchingMetaData) {
			return matchingMetaData
		}
	}
	return undefined
}

function updateSegments (runningOrderId: string) {
	// using SegmentLines, determine which segments are to be created
	let segmentLines = SegmentLines.find({runningOrderId: runningOrderId}, {sort: {_rank: 1}}).fetch()

	let prevSlugParts: string[] = []
	let segment: DBSegment
	let segments: Array<DBSegment> = []
	let rankSegment = 0
	let segmentLineUpdates = {}
	_.each(segmentLines, (segmentLine: SegmentLine) => {
		let slugParts = segmentLine.slug.split(';')

		if (slugParts[0] !== prevSlugParts[0]) {
			segment = convertToSegment(segmentLine, rankSegment++)
			segments.push(segment)
		}
		if (segmentLine.segmentId !== segment._id) {
			console.log(segmentLine)
			console.log(segmentLine._id + ' old segmentId: ' + segmentLine.segmentId + ', new: ' + segment._id )
			segmentLineUpdates[segmentLine._id] = { segmentId: segment._id }
		}

		prevSlugParts = slugParts
	})

	// Update SegmentLines:
	_.each(segmentLineUpdates, (modifier, id) => {
		logger.info('added SegmentLine to segment ' + modifier['segmentId'])
		SegmentLines.update(id, {$set: modifier})
	})
	// Update Segments:
	saveIntoDb(Segments, {
		runningOrderId: runningOrderId
	}, segments, {
		afterInsert (segment) {
			logger.info('inserted segment ' + segment._id)
		},
		afterUpdate (segment) {
			logger.info('updated segment ' + segment._id)
		},
		afterRemove (segment) {
			logger.info('removed segment ' + segment._id)
			afterRemoveSegment(segment._id, segment.runningOrderId)
		}
	})
}

let methods = {}
methods[PeripheralDeviceAPI.methods.initialize] = (deviceId, deviceToken, options) => {
	return ServerPeripheralDeviceAPI.initialize(deviceId, deviceToken, options)
}
methods[PeripheralDeviceAPI.methods.unInitialize] = (deviceId, deviceToken) => {
	return ServerPeripheralDeviceAPI.unInitialize(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.setStatus] = (deviceId, deviceToken, status) => {
	return ServerPeripheralDeviceAPI.setStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.getPeripheralDevice ] = (deviceId, deviceToken) => {
	return ServerPeripheralDeviceAPI.getPeripheralDevice(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.segmentLinePlaybackStarted] = (deviceId, deviceToken, r: PeripheralDeviceAPI.SegmentLinePlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.segmentLinePlaybackStarted(deviceId, deviceToken, r)
}
// ----------------------------------------------------------------------------
// Mos-functions:
methods[PeripheralDeviceAPI.methods.mosRoCreate] = (deviceId, deviceToken, ro: IMOSRunningOrder) => {
	return ServerPeripheralDeviceAPI.mosRoCreate(deviceId, deviceToken, ro)
}
methods[PeripheralDeviceAPI.methods.mosRoReplace] = (deviceId, deviceToken, ro: IMOSRunningOrder) => {
	return ServerPeripheralDeviceAPI.mosRoReplace(deviceId, deviceToken, ro)
}
methods[PeripheralDeviceAPI.methods.mosRoDelete] = (deviceId, deviceToken, runningOrderId: MosString128) => {
	return ServerPeripheralDeviceAPI.mosRoDelete(deviceId, deviceToken, runningOrderId)
}
methods[PeripheralDeviceAPI.methods.mosRoMetadata] = (deviceId, deviceToken, metadata: IMOSRunningOrderBase) => {
	return ServerPeripheralDeviceAPI.mosRoMetadata(deviceId, deviceToken, metadata)
}
methods[PeripheralDeviceAPI.methods.mosRoStatus] = (deviceId, deviceToken, status: IMOSRunningOrderStatus) => {
	return ServerPeripheralDeviceAPI.mosRoStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryStatus] = (deviceId, deviceToken, status: IMOSStoryStatus) => {
	return ServerPeripheralDeviceAPI.mosRoStoryStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoItemStatus] = (deviceId, deviceToken, status: IMOSItemStatus) => {
	return ServerPeripheralDeviceAPI.mosRoItemStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryInsert] = (deviceId, deviceToken, Action: IMOSStoryAction, Stories: Array<IMOSROStory>) => {
	return ServerPeripheralDeviceAPI.mosRoStoryInsert(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemInsert] = (deviceId, deviceToken, Action: IMOSItemAction, Items: Array<IMOSItem>) => {
	return ServerPeripheralDeviceAPI.mosRoItemInsert(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryReplace] = (deviceId, deviceToken, Action: IMOSStoryAction, Stories: Array<IMOSROStory>) => {
	return ServerPeripheralDeviceAPI.mosRoStoryReplace(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemReplace] = (deviceId, deviceToken, Action: IMOSItemAction, Items: Array<IMOSItem>) => {
	return ServerPeripheralDeviceAPI.mosRoItemReplace(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryMove] = (deviceId, deviceToken, Action: IMOSStoryAction, Stories: Array<MosString128>) => {
	return ServerPeripheralDeviceAPI.mosRoStoryMove(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemMove] = (deviceId, deviceToken, Action: IMOSItemAction, Items: Array<MosString128>) => {
	return ServerPeripheralDeviceAPI.mosRoItemMove(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryDelete] = (deviceId, deviceToken, Action: IMOSROAction, Stories: Array<MosString128>) => {
	return ServerPeripheralDeviceAPI.mosRoStoryDelete(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemDelete] = (deviceId, deviceToken, Action: IMOSStoryAction, Items: Array<MosString128>) => {
	return ServerPeripheralDeviceAPI.mosRoItemDelete(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStorySwap] = (deviceId, deviceToken, Action: IMOSROAction, StoryID0: MosString128, StoryID1: MosString128) => {
	return ServerPeripheralDeviceAPI.mosRoStorySwap(deviceId, deviceToken, Action, StoryID0, StoryID1)
}
methods[PeripheralDeviceAPI.methods.mosRoItemSwap] = (deviceId, deviceToken, Action: IMOSStoryAction, ItemID0: MosString128, ItemID1: MosString128) => {
	return ServerPeripheralDeviceAPI.mosRoItemSwap(deviceId, deviceToken, Action, ItemID0, ItemID1)
}
methods[PeripheralDeviceAPI.methods.mosRoReadyToAir] = (deviceId, deviceToken, Action: IMOSROReadyToAir) => {
	return ServerPeripheralDeviceAPI.mosRoReadyToAir(deviceId, deviceToken, Action)
}
methods[PeripheralDeviceAPI.methods.mosRoFullStory] = (deviceId, deviceToken, story: IMOSROFullStory) => {
	return ServerPeripheralDeviceAPI.mosRoFullStory(deviceId, deviceToken, story)
}
methods[PeripheralDeviceAPI.methods.timelineTriggerTime] = (deviceId, deviceToken, r: PeripheralDeviceAPI.TimelineTriggerTimeResult) => {
	return ServerPeripheralDeviceAPI.timelineTriggerTime(deviceId, deviceToken, r)
}

methods[PeripheralDeviceAPI.methods.getMediaObjectRevisions] = (deviceId, deviceToken, collectionId: string,) => {
	return ServerPeripheralDeviceAPI.getMediaObjectRevisions(deviceId, deviceToken, collectionId)
}
methods[PeripheralDeviceAPI.methods.updateMediaObject] = (deviceId, deviceToken, collectionId: string, id: string, doc: MediaObject | null) => {
	return ServerPeripheralDeviceAPI.updateMediaObject(deviceId, deviceToken, collectionId, id, doc)
}

// --------------------
methods[PeripheralDeviceAPI.methods.functionReply] = (deviceId, deviceToken, commandId, err: any, result: any) => {
	console.log('functionReply', err, result)
	PeripheralDeviceCommands.update(commandId, {
		$set: {
			hasReply: true,
			reply: result,
			replyError: err
		}
	})
}

// Transform methods:
_.each(methods, (fcn: Function, key) => {
	methods[key] = (...args: any[]) => {
		// logger.info('------- Method call -------')
		// logger.info(key)
		// logger.info(args)
		// logger.info('---------------------------')
		try {
			return fcn.apply(null, args)
		} catch (e) {
			logger.error(e.message || e.reason || (e.toString ? e.toString() : null) || e)
			throw e
		}
	}
})

// Apply methods:
Meteor.methods(methods)
