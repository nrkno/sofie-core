import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'

import { ServerPeripheralDeviceAPI } from '../../server/api/peripheralDevice'

import { PeripheralDeviceCommands } from '../collections/PeripheralDeviceCommands'

import { MeteorPromiseCall, getCurrentTime } from '../lib'

namespace PeripheralDeviceAPI {

export enum StatusCode {

	UNKNOWN = 0, 		// Status unknown
	GOOD = 1, 			// All good and green
	WARNING_MINOR = 2,	// Everything is not OK, operation is not affected
	WARNING_MAJOR = 3, 	// Everything is not OK, operation might be affected
	BAD = 4, 			// Operation affected, possible to recover
	FATAL = 5			// Operation affected, not possible to recover without manual interference
}

export interface StatusObject {
	statusCode: StatusCode,
	messages?: Array<string>
}

export enum DeviceType {
	MOSDEVICE = 0,
	PLAYOUT = 1,
	OTHER = 2, // i.e. sub-devices
}
export interface InitOptions {
	type: DeviceType,
	name: string,
	connectionId: string
}
export interface TimelineTriggerTimeResult {
	time: number,
	objectIds: Array<string>
}
export interface SegmentLinePlaybackStartedResult {
	roId: string,
	slId: string,
	time: number
}

export enum methods {
	'functionReply' 	= 'peripheralDevice.functionReply',

	'setStatus' 		= 'peripheralDevice.status',
	'initialize' 		= 'peripheralDevice.initialize',
	'unInitialize' 		= 'peripheralDevice.unInitialize',
	'getPeripheralDevice'= 'peripheralDevice.getPeripheralDevice',

	'timelineTriggerTime'= 'peripheralDevice.timeline.setTimelineTriggerTime',
	'segmentLinePlaybackStarted' = 'peripheralDevice.runningOrder.segmentLinePlaybackStarted',

	'mosRoCreate' 		= 'peripheralDevice.mos.roCreate',
	'mosRoReplace' 		= 'peripheralDevice.mos.roReplace',
	'mosRoDelete' 		= 'peripheralDevice.mos.roDelete',
	'mosRoMetadata' 	= 'peripheralDevice.mos.roMetadata',
	'mosRoStatus' 		= 'peripheralDevice.mos.roStatus',
	'mosRoStoryStatus' 	= 'peripheralDevice.mos.roStoryStatus',
	'mosRoItemStatus' 	= 'peripheralDevice.mos.roItemStatus',
	'mosRoStoryInsert' 	= 'peripheralDevice.mos.roStoryInsert',
	'mosRoStoryReplace' = 'peripheralDevice.mos.roStoryReplace',
	'mosRoStoryMove' 	= 'peripheralDevice.mos.roStoryMove',
	'mosRoStoryDelete' 	= 'peripheralDevice.mos.roStoryDelete',
	'mosRoStorySwap' 	= 'peripheralDevice.mos.roStorySwap',
	'mosRoItemInsert' 	= 'peripheralDevice.mos.roItemInsert',
	'mosRoItemReplace' 	= 'peripheralDevice.mos.roItemReplace',
	'mosRoItemMove' 	= 'peripheralDevice.mos.roItemMove',
	'mosRoItemDelete' 	= 'peripheralDevice.mos.RoItemDelete',
	'mosRoItemSwap' 	= 'peripheralDevice.mos.RoItemSwap',
	'mosRoReadyToAir' 	= 'peripheralDevice.mos.RoReadyToAir',
	'mosRoFullStory' 	= 'peripheralDevice.mos.RoFullStory'
}
export function initialize (id: string, token: string, options: InitOptions): Promise<string> {
	return MeteorPromiseCall(methods.initialize, id, token, options)
}
export function unInitialize (id: string, token: string, status: StatusObject): Promise<StatusObject> {
	return MeteorPromiseCall(methods.unInitialize, id, token)
}
export function setStatus (id: string, token: string, status: StatusObject): Promise<StatusObject> {
	return MeteorPromiseCall(methods.setStatus, id, token, status)
}

export function executeFunction (deviceId: string, cb: (err, result) => void, functionName: string, ...args: any[],) {

	let commandId = Random.id()
	PeripheralDeviceCommands.insert({
		_id: commandId,
		deviceId: deviceId,
		time: getCurrentTime(),
		functionName,
		args: args,
		hasReply: false
	})
	let subscription: Meteor.SubscriptionHandle | null = null
	if (Meteor.isClient) {
		subscription = Meteor.subscribe('peripheralDeviceCommands', deviceId )
	}
	console.log('command created')
	// we've sent the command, let's just wait for the reply
	let checkReply = () => {
		let cmd = PeripheralDeviceCommands.findOne(commandId)
		if (!cmd) throw new Meteor.Error('Command "' + commandId + '" not found')
		console.log('checkReply')
		if (cmd) {
			if (cmd.hasReply) {
				// We've got a reply!
				console.log('got reply')
	
				if (cmd.replyError) {
					cb(cmd.replyError, null)
				} else {
					cb(null, cmd.reply)
				}
				cursor.stop()
				PeripheralDeviceCommands.remove(cmd._id)
				if (subscription) subscription.stop()
			} else if (getCurrentTime() - (cmd.time || 0) > 3000) { // timeout
				console.log('timeout')
				cb('Timeout', null)
				cursor.stop()
				PeripheralDeviceCommands.remove(cmd._id)
				if (subscription) subscription.stop()
			}
		} else {
			console.log('Command "' + commandId + '" not found when looking for reply')
		}
	}

	let cursor = PeripheralDeviceCommands.find({
		_id: commandId
	}).observeChanges({
		added: checkReply,
		changed: checkReply,
	})
}

}

export { PeripheralDeviceAPI }
