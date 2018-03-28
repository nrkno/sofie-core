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
	IMOSStory
} from 'mos-connection'

import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { getCurrentTime, saveIntoDb, literal, DBObj, partialExceptId } from '../../lib/lib'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { ISegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { Segment, Segments } from '../../lib/collections/Segments'

// ---------------------------------------------------------------
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
			return partialExceptId<Segment>({
				_id: '' + story.ID,
				runningOrderId: '' + ro.ID,
				_rank: rank++,
				mosId: '' + story.ID,
				name: '' + story.Slug
			})
		}))
		_.each(ro.Stories, (story: IMOSROStory) => {

			// Save Items (aka SegmentLines) into database:
			let rank = 0
			saveIntoDb(SegmentLines, {
				runningOrderId: '' + ro.ID,
				segmentId: '' + story.ID
			}, _.map(story.Items, (item: IMOSItem) => {
				return partialExceptId<SegmentLine>({
					_id: '' + item.ID,
					runningOrderId: '' + ro.ID,
					segmentId: '' + story.ID,
					_rank: rank++,
					mosId: '' + item.ID
				})
			}))
		})

		let dbRo = RunningOrders.findOne(ro.ID)
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
	/*
	export function mosRoMetadata (metadata: IMOSRunningOrderBase) {
		return this.core.mosManipulate(P.methods.mosRoMetadata, metadata)
	}
	export function mosRoStatus (status: IMOSRunningOrderStatus) {
		return this.core.mosManipulate(P.methods.mosRoStatus, status)
	}
	export function mosRoStoryStatus (status: IMOSStoryStatus) {
		return this.core.mosManipulate(P.methods.mosRoStoryStatus, status)
	}
	export function mosRoItemStatus (status: IMOSItemStatus) {
		return this.core.mosManipulate(P.methods.mosRoItemStatus, status)
	}
	export function mosRoStoryInsert (Action: IMOSStoryAction, Stories: Array<IMOSROStory>) {
		return this.core.mosManipulate(P.methods.mosRoStoryInsert, Action, Stories)
	}
	export function mosRoStoryReplace (Action: IMOSStoryAction, Stories: Array<IMOSROStory>) {
		return this.core.mosManipulate(P.methods.mosRoStoryReplace, Action, Stories)
	}
	export function mosRoStoryMove (Action: IMOSStoryAction, Stories: Array<MosString128>) {
		return this.core.mosManipulate(P.methods.mosRoStoryMove, Action, Stories)
	}
	export function mosRoStoryDelete (Action: IMOSROAction, Stories: Array<MosString128>) {
		return this.core.mosManipulate(P.methods.mosRoStoryDelete, Action, Stories)
	}
	export function mosRoStorySwap (Action: IMOSROAction, StoryID0: MosString128, StoryID1: MosString128) {
		return this.core.mosManipulate(P.methods.mosRoStorySwap, Action, StoryID0, StoryID1)
	}
	export function mosRoItemInsert (Action: IMOSItemAction, Items: Array<IMOSItem>) {
		return this.core.mosManipulate(P.methods.mosRoItemInsert, Action, Items)
	}
	export function mosRoItemReplace (Action: IMOSItemAction, Items: Array<IMOSItem>) {
		return this.core.mosManipulate(P.methods.mosRoItemReplace, Action, Items)
	}
	export function mosRoItemMove (Action: IMOSItemAction, Items: Array<MosString128>) {
		return this.core.mosManipulate(P.methods.mosRoItemMove, Action, Items)
	}
	export function mosRoItemDelete (Action: IMOSStoryAction, Items: Array<MosString128>) {
		return this.core.mosManipulate(P.methods.mosRoItemDelete, Action, Items)
	}
	export function mosRoItemSwap (Action: IMOSStoryAction, ItemID0: MosString128, ItemID1: MosString128) {
		return this.core.mosManipulate(P.methods.mosRoItemSwap, Action, ItemID0, ItemID1)
	}
	export function mosRoReadyToAir (Action: IMOSROReadyToAir) {
		return this.core.mosManipulate(P.methods.mosRoReadyToAir, Action)
	}

	export function mosRoFullStory (story: IMOSROFullStory ) {
		return this.core.mosManipulate(P.methods.mosRoReadyToAir, story)
	}*/

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
