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
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { ISegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { Segment, Segments } from '../../lib/collections/Segments'
import { saveIntoDb, partialExceptId, getCurrentTime } from '../../lib/lib'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'

// import {ServerPeripheralDeviceAPIMOS as MOS} from './peripheralDeviceMos'

export namespace ServerPeripheralDeviceAPI {
	export function initialize (id: string, token: string, options: PeripheralDeviceAPI.InitOptions): string {
		check(id, String)
		check(token, String)
		check(options, Object)
		check(options.name, String)
		check(options.type, Number)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

		if (!peripheralDevice) {
			// Add a new device

			PeripheralDevices.insert({
				_id: id,
				created: getCurrentTime(),
				status: {
					statusCode: PeripheralDeviceAPI.StatusCode.UNKNOWN
				},
				connected: false, // this is set at another place
				connectionSession: null,
				lastSeen: getCurrentTime(),
				token: token,
				type: options.type,
				name: options.name

			})

		} else {
			// Udate the device:

			PeripheralDevices.update(id, {$set: {
				lastSeen: getCurrentTime()
			}})

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
	// export {P.initialize}
	 // MOS-functions:
	export function mosRoCreate (ro: IMOSRunningOrder) {

		// Save RO into database:
		saveIntoDb(RunningOrders, {
			_id: '' + ro.ID
		}, _.map([ro], (ro) => {
			return partialExceptId<RunningOrder>({
				_id: '' + ro.ID,
				mosId: '' + ro.ID,
				// studioInstallationId: '',
				// showStyleId: '',
				name: '' + ro.Slug
			})
		}), {
			beforeInsert: (o) => {
				o.created = getCurrentTime()
				return o
			}
		})

		// Save Stories (aka Segments) into database:
		let rank = 0
		saveIntoDb(Segments, {
			runningOrderId: '' + ro.ID
		}, _.map(ro.Stories, (story: IMOSStory) => {
			return convertToSegment(story, '' + ro.ID, rank++)
		}),{
			afterInsert (segment) {
				let story: IMOSROStory | undefined = _.findWhere(ro.Stories, {ID: segment._id})
				if (story) {
					afterInsertUpdateSegment (story, '' + ro.ID)
				} else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (segment) {
				let story: IMOSROStory | undefined = _.findWhere(ro.Stories, {ID: segment._id})
				if (story) {
					afterInsertUpdateSegment (story, '' + ro.ID)
				} else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterRemove (segment) {
				afterRemoveSegment(segment._id, segment.runningOrderId)
			}
		})
		/*
		_.each(ro.Stories, (story: IMOSROStory) => {

			// Save Items (aka SegmentLines) into database:
			let rank = 0
			saveIntoDb(SegmentLines, {
				runningOrderId: '' + ro.ID,
				segmentId: '' + story.ID
			}, _.map(story.Items, (item: IMOSItem) => {
				return convertToSegmentLine(item, '' + ro.ID, '' + story.ID, rank++)
			}), {
				afterInsert (o) {
					let item: IMOSItem | undefined = _.findWhere(story.Items, {
						ID: o._id
					})
					if (item) {
						afterInsertSegmentLine(item, '' + ro.ID, '' + story.ID)
					} else throw new Meteor.Error(500, 'Item not found (it should have been)')
				}
			})
		})
		*/

		// let dbRo = RunningOrders.findOne(ro.ID)
	}
	export function mosRoReplace (ro: IMOSRunningOrder) {
		return mosRoCreate(ro) // it's the same
	}
	export function mosRoDelete (runningOrderId: string) {

		RunningOrders.remove('' + runningOrderId)
		Segments.remove({runningOrderId: '' + runningOrderId})
		SegmentLines.remove({runningOrderId: '' + runningOrderId})
		SegmentLineItems.remove({ runningOrderId: '' + runningOrderId})

	}
	export function mosRoMetadata (metadata: IMOSRunningOrderBase) {
		let ro = getRO(metadata.ID)
		if (metadata.MosExternalMetaData) {
			RunningOrders.update(ro._id, {$set: {
				metaData: metadata.MosExternalMetaData
			}})
		}
	}
	export function mosRoStatus (status: IMOSRunningOrderStatus) {
		let ro = getRO(status.ID)
		RunningOrders.update(ro._id, {$set: {
			status: status.Status
		}})
	}
	export function mosRoStoryStatus (status: IMOSStoryStatus) {
		// Save Stories (aka Segments) status into database:
		let segment = Segments.findOne({
			_id: 			status.ID,
			runningOrderId: status.RunningOrderId
		})
		if (segment) {
			Segments.update(segment._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'Segment ' + status.ID + ' in RO ' + status.RunningOrderId + ' not found')
	}
	export function mosRoItemStatus (status: IMOSItemStatus) {
		// Save Items (aka SegmentLines) into database:
		let segmentLine = SegmentLines.findOne({
			_id: 			status.ID,
			segmentId: 		status.StoryId,
			runningOrderId: status.RunningOrderId
		})
		if (segmentLine) {
			SegmentLines.update(segmentLine._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'SegmentLine ' + status.ID + ' in segment ' + status.StoryId + ' in RO ' + status.RunningOrderId + ' not found')
	}
	export function mosRoStoryInsert (Action: IMOSStoryAction, Stories: Array<IMOSROStory>) {
		// insert a story (aka Segment) before another story:
		let ro = getRO(Action.RunningOrderID)
		let segmentAfter = (Action.StoryID ? getSegment(Action.RunningOrderID, Action.StoryID) : null)

		let segmentBeforeOrLast
		let newRankMax
		let newRankMin
		if (segmentAfter) {
			segmentBeforeOrLast = fetchBefore(Segments,
				{ runningOrderId: Action.RunningOrderID },
				segmentAfter._rank
			)
		} else {
			segmentBeforeOrLast = fetchBefore(Segments,
				{ runningOrderId: Action.RunningOrderID },
				null
			)
		}
		_.each(Stories, (story: IMOSROStory, i: number) => {
			let rank = getRank(segmentBeforeOrLast, segmentAfter, i, Stories.length)
			// let rank = newRankMin + ( i / Stories.length ) * (newRankMax - newRankMin)
			insertSegment(story, ro._id, rank)
		})
	}
	export function mosRoItemInsert (Action: IMOSItemAction, Items: Array<IMOSItem>) {
		// insert an item (aka SegmentLine) before another story:
		let ro = getRO(Action.RunningOrderID)
		let segment = getSegment(Action.RunningOrderID, Action.StoryID)
		let segmentLineAfter = (Action.ItemID ? getSegmentLine(Action.RunningOrderID, Action.ItemID) : null)

		let segmentLineBeforeOrLast
		let newRankMax
		let newRankMin
		if (segmentLineAfter) {
			segmentLineBeforeOrLast = fetchBefore(SegmentLines,
				{ runningOrderId: Action.RunningOrderID, segmentId: Action.StoryID },
				segmentLineAfter._rank
			)
		} else {
			segmentLineBeforeOrLast = fetchBefore(SegmentLines,
				{ runningOrderId: Action.RunningOrderID, segmentId: Action.StoryID },
				null
			)
		}
		_.each(Items, (item: IMOSItem, i: number) => {
			let rank = getRank(segmentLineBeforeOrLast, segmentLineAfter, i, Items.length)
			// let rank = newRankMin + ( i / Items.length ) * (newRankMax - newRankMin)
			insertSegmentLine(item, ro._id, segment._id, rank)
		})
	}
	export function mosRoStoryReplace (Action: IMOSStoryAction, Stories: Array<IMOSROStory>) {
		// Replace a Story (aka a Segment) with one or more Stories
		let ro = getRO(Action.RunningOrderID)
		let segmentToReplace = getSegment(Action.RunningOrderID, Action.StoryID)

		let segmentBefore = fetchBefore(Segments, { runningOrderId: Action.RunningOrderID }, segmentToReplace._rank)
		let segmentAfter = fetchAfter(Segments, { runningOrderId: Action.RunningOrderID }, segmentToReplace._rank)

		removeSegment(segmentToReplace._id, segmentToReplace.runningOrderId)

		_.each(Stories, (story: IMOSROStory, i: number) => {
			let rank = getRank(segmentBefore, segmentAfter, i, Stories.length)
			insertSegment(story, '' + Action.RunningOrderID, rank)
		})
	}
	export function mosRoItemReplace (Action: IMOSItemAction, Items: Array<IMOSItem>) {
		// Replace an item (aka SegmentLine) with one or more items
		let ro = getRO(Action.RunningOrderID)
		let segmentLineToReplace = getSegmentLine(Action.RunningOrderID, Action.ItemID)

		let segmentLineBefore = fetchBefore(SegmentLines, { runningOrderId: Action.RunningOrderID, segmentId: Action.StoryID }, segmentLineToReplace._rank)
		let segmentLineAfter = fetchAfter(SegmentLines, { runningOrderId: Action.RunningOrderID, segmentId: Action.StoryID }, segmentLineToReplace._rank)

		removeSegmentLine(segmentLineToReplace._id)

		_.each(Items, (item: IMOSItem, i: number) => {
			let rank = getRank (segmentLineBefore, segmentLineAfter, i, Items.length)
			insertSegmentLine(item, '' + Action.RunningOrderID, '' + Action.StoryID, rank)
		})
	}
	export function mosRoStoryMove (Action: IMOSStoryAction, Stories: Array<MosString128>) {
		// Move Stories (aka Segments) to before a story
		let ro = getRO(Action.RunningOrderID)
		let segmentAfter = getSegment(Action.RunningOrderID, Action.StoryID)
		let segmentBefore = fetchBefore(Segments, { runningOrderId: Action.RunningOrderID }, segmentAfter._rank)

		_.each(Stories, (storyId: MosString128, i: number) => {
			let rank = getRank(segmentBefore, segmentAfter, i, Stories.length)
			Segments.update('' + storyId, {$set: {
				_rank: rank
			}})
		})
	}
	export function mosRoItemMove (Action: IMOSItemAction, Items: Array<MosString128>) {
		// Move Items (aka SegmentLines) to before a story
		let ro = getRO(Action.RunningOrderID)
		let segmentLineAfter = getSegmentLine(Action.RunningOrderID, Action.ItemID)
		let segmentLineBefore = fetchBefore(SegmentLines,
			{ runningOrderId: Action.RunningOrderID, segmentId: Action.StoryID},
			segmentLineAfter._rank)

		_.each(Items, (itemId: MosString128, i: number) => {
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Items.length)
			SegmentLines.update('' + itemId, {$set: {
				_rank: rank
			}})
		})
	}
	export function mosRoStoryDelete (Action: IMOSROAction, Stories: Array<MosString128>) {
		// Delete Stories (aka Segments)
		let ro = getRO(Action.RunningOrderID)
		_.each(Stories, (storyId: MosString128, i: number) => {
			removeSegment('' + storyId, '' + Action.RunningOrderID)
		})
	}
	export function mosRoItemDelete (Action: IMOSStoryAction, Items: Array<MosString128>) {
		// Delete Items (aka SegmentsLines)
		let ro = getRO(Action.RunningOrderID)
		_.each(Items, (itemId: MosString128, i: number) => {
			removeSegmentLine('' + itemId)
		})
	}
	export function mosRoStorySwap (Action: IMOSROAction, StoryID0: MosString128, StoryID1: MosString128) {
		// Swap Stories (aka Segments)
		let ro = getRO(Action.RunningOrderID)

		let segment0 = getSegment(Action.RunningOrderID, StoryID0)
		let segment1 = getSegment(Action.RunningOrderID, StoryID1)

		Segments.update(segment0._id, {$set: {_rank: segment1._rank}})
		Segments.update(segment1._id, {$set: {_rank: segment0._rank}})
	}
	export function mosRoItemSwap (Action: IMOSStoryAction, ItemID0: MosString128, ItemID1: MosString128) {
		// Swap Stories (aka Segments)
		let ro = getRO(Action.RunningOrderID)

		let segmentLine0 = getSegmentLine(Action.RunningOrderID, ItemID0)
		let segmentLine1 = getSegmentLine(Action.RunningOrderID, ItemID1)

		Segments.update(segmentLine0._id, {$set: {_rank: segmentLine1._rank}})
		Segments.update(segmentLine1._id, {$set: {_rank: segmentLine0._rank}})
	}
	export function mosRoReadyToAir (Action: IMOSROReadyToAir) {
		// Set the ready to air status of a Running Order
		let ro = getRO(Action.ID)

		RunningOrders.update(ro._id, {$set: {
			airStatus: Action.Status
		}})

	}
	/*
		export function mosRoFullStory (story: IMOSROFullStory ) {
			return this.core.mosManipulate(P.methods.mosRoReadyToAir, story)
	}*/
}
/**
 * Returns a Running order, throws error if not found
 * @param roId Id of the Running order
 */
function getRO (roId: MosString128): RunningOrder {
	let ro = RunningOrders.findOne(roId.toString())
	if (ro) {
		return ro
	} else throw new Meteor.Error(404, 'RunningOrder ' + roId + ' not found')
}
/**
 * Returns a Segment (aka a Story), throws error if not found
 * @param roId Running order id
 * @param segmentId Segment / Story id
 */
function getSegment (roId: MosString128, segmentId: MosString128): Segment {
	let segments = Segments.findOne({
		runningOrderId: roId.toString(),
		_id: segmentId.toString()
	})
	if (segments) {
		return segments
	} else throw new Meteor.Error(404, 'RunningOrder ' + segmentId + ' not found')
}
/**
 * Returns a SegmentLine (aka an Item), throws error if not found
 * @param roId
 * @param segmentLineId
 */
function getSegmentLine (roId: MosString128, segmentLineId: MosString128): SegmentLine {
	let segmentLines = SegmentLines.findOne({
		runningOrderId: roId.toString(),
		_id: segmentLineId.toString()
	})
	if (segmentLines) {
		return segmentLines
	} else throw new Meteor.Error(404, 'RunningOrder ' + segmentLineId + ' not found')
}
/**
 * Converts a Story into a Segment
 * @param story MOS Sory
 * @param runningOrderId Running order id of the story
 * @param rank Rank of the story
 */
function convertToSegment (story: IMOSStory, runningOrderId: string, rank: number): Segment {
	return {
		_id: '' + story.ID,
		runningOrderId: runningOrderId,
		_rank: rank,
		mosId: '' + story.ID,
		name: '' + story.Slug
	}
}
/**
 * Converts an Item into a SegmentLine
 * @param item MOS Item
 * @param runningOrderId Running order id of the item
 * @param segmentId Segment / Story id of the item
 * @param rank Rank of the story
 */
function convertToSegmentLine (item: IMOSItem, runningOrderId: string, segmentId: string, rank: number): SegmentLine {
	return {
		_id: '' + item.ID,
		runningOrderId: runningOrderId,
		segmentId: segmentId,
		_rank: rank,
		mosId: '' + item.ID
	}
}
/**
 * Insert a Story (aka a Segment) into the database
 * @param story The story to be inserted
 * @param runningOrderId The Running order id to insert into
 * @param rank The rank (position) to insert at
 */
function insertSegment (story: IMOSROStory, runningOrderId: string, rank: number) {
	Segments.insert(convertToSegment(story, runningOrderId, rank))
	afterInsertUpdateSegment(story, runningOrderId)
}
/**
 * Removes a Story (aka a Segment) into the database
 * @param story The story to be inserted
 * @param runningOrderId The Running order id to insert into
 * @param rank The rank (position) to insert at
 */
function removeSegment (segmentId: string, runningOrderId: string) {
	Segments.remove(segmentId)
	afterRemoveSegment(segmentId, runningOrderId)
}
/**
 * After a Story (aka a Segment) has been inserted / updated, handle its contents
 * @param story The Story that was inserted / updated
 * @param runningOrderId Id of the Running Order that contains the story
 */
function afterInsertUpdateSegment (story: IMOSROStory, runningOrderId: string) {
	// Save Items (aka SegmentLines) into database:
	let rank = 0
	saveIntoDb(SegmentLines, {
		runningOrderId: '' + runningOrderId,
		segmentId: '' + story.ID
	}, _.map(story.Items, (item: IMOSItem) => {
		return convertToSegmentLine(item, runningOrderId, '' + story.ID, rank++)
	}), {
		afterInsert (o) {
			let item: IMOSItem | undefined = _.findWhere(story.Items, {ID: o._id})
			if (item) {
				afterInsertUpdateSegmentLine(item, runningOrderId, '' + story.ID)
			} else throw new Meteor.Error(500, 'Item not found (it should have been)')
		},
		afterUpdate (o) {
			let item: IMOSItem | undefined = _.findWhere(story.Items, {ID: o._id})
			if (item) {
				afterInsertUpdateSegmentLine(item, runningOrderId, '' + story.ID)
			} else throw new Meteor.Error(500, 'Item not found (it should have been)')
		},
		afterRemove (o) {
			afterRemoveSegmentLine(o._id)
		}
	})
}
/**
 * After a Segment has beed removed, handle its contents
 * @param segmentId Id of the Segment
 * @param runningOrderId Id of the Running order
 */
function afterRemoveSegment (segmentId: string, runningOrderId: string) {
	// Remove the segment lines:
	saveIntoDb(SegmentLines, {
		runningOrderId: '' + runningOrderId,
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
function insertSegmentLine (item: IMOSItem, runningOrderId: string, segmentId: string, rank: number) {
	SegmentLines.insert(convertToSegmentLine(item, runningOrderId, segmentId, rank))
	afterInsertUpdateSegmentLine(item, runningOrderId, segmentId)
}
function removeSegmentLine (segmentLineId: string) {
	SegmentLines.remove(segmentLineId)
	afterRemoveSegmentLine(segmentLineId)
}
function afterInsertUpdateSegmentLine (item: IMOSItem, runningOrderId: string, segmentId: string) {
	// TODO: create segmentLineItems

	// use the Template-generator to generate the segmentLineItems
	// and put them into the db
}
function afterRemoveSegmentLine (segmentLineId: string) {
	SegmentLineItems.remove({
		segmentLineId: segmentLineId
	})
}
function fetchBefore<T> (collection: Mongo.Collection<T>, selector: Mongo.Selector, rank: number | null): T {
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
function fetchAfter<T> (collection: Mongo.Collection<T>, selector: Mongo.Selector, rank: number | null): T {
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
function getRank (beforeOrLast, after, i: number, count: number): number {
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

	return newRankMin + ( i / count ) * (newRankMax - newRankMin)
}

const methods = {}
methods[PeripheralDeviceAPI.methods.initialize] = (id, token, options) => {
	return ServerPeripheralDeviceAPI.initialize(id, token, options)
}
methods[PeripheralDeviceAPI.methods.unInitialize] = (id, token) => {
	return ServerPeripheralDeviceAPI.unInitialize(id, token)
}
methods[PeripheralDeviceAPI.methods.setStatus] = (id, token, status) => {
	return ServerPeripheralDeviceAPI.setStatus(id, token, status)
}

// Apply methods:
Meteor.methods(methods)
