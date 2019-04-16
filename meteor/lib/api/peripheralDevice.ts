import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { MeteorPromiseCall, getCurrentTime } from '../lib'
import { PeripheralDeviceCommands } from '../collections/PeripheralDeviceCommands'
import { PubSub, meteorSubscribe } from './pubsub'

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
/*
// TODO: Refactor into this?
export enum DeviceCategory {
	SUBDEVICE = 'subdevice',
	INGEST = 'ingest',
	PLAYOUT = 'playout',
	MEDIA_MANAGER = 'media_manager'
}
export enum DeviceType {
	// Main devices:
	MOS_GATEWAY = 'mos_gateway',
	SPREADSHEET_GATEWAY = 'spreadsheet_gateway',

	PLAYOUT_GATEWAY = 'playout_gateway',

	MEDIA_MANAGER = 'media_manager',

	// Sub-devices:
	MOS_CONNECTION = 'mos_connection',

	TSR_CASPARCG = 'tsr_casparcg',
	TSR_ATEM = 'tsr_atem',
	TSR_HTTPSEND = 'tsr_httpsend',
	//etc..
}
*/
export enum DeviceType {
	MOSDEVICE = 0,
	PLAYOUT = 1,
	OTHER = 2, // i.e. sub-devices
	MEDIA_MANAGER = 3,
	SPREADSHEET = 4,
}
export interface InitOptions {
	type: DeviceType
	name: string
	connectionId: string
	parentDeviceId?: string
	versions?: {
		[libraryName: string]: string
	}
}
export type TimelineTriggerTimeResult = Array<{id: string, time: number}>

export interface PartPlaybackStartedResult {
	rundownId: string,
	partId: string,
	time: number
}
export type PartPlaybackStoppedResult = PartPlaybackStartedResult
export interface PiecePlaybackStartedResult {
	rundownId: string,
	pieceId: string,
	time: number
}
export type PiecePlaybackStoppedResult = PiecePlaybackStartedResult

export enum methods {
	'functionReply' 	= 'peripheralDevice.functionReply',

	'testMethod' 		= 'peripheralDevice.testMethod',
	'setStatus' 		= 'peripheralDevice.status',
	'ping' 				= 'peripheralDevice.ping',
	'initialize' 		= 'peripheralDevice.initialize',
	'unInitialize' 		= 'peripheralDevice.unInitialize',
	'getPeripheralDevice'= 'peripheralDevice.getPeripheralDevice',
	'pingWithCommand' 	= 'peripheralDevice.pingWithCommand',
	'killProcess' 		= 'peripheralDevice.killProcess',

	'determineDiffTime'		= 'systemTime.determineDiffTime',
	'getTimeDiff'			= 'systemTime.getTimeDiff',
	'getTime'				= 'systemTime.getTime',

	'timelineTriggerTime'			= 'peripheralDevice.timeline.setTimelineTriggerTime',
	'partPlaybackStarted' 	= 'peripheralDevice.rundown.partPlaybackStarted',
	'partPlaybackStopped' 	= 'peripheralDevice.rundown.partPlaybackStopped',
	'piecePlaybackStarted'= 'peripheralDevice.rundown.piecePlaybackStarted',
	'piecePlaybackStopped'= 'peripheralDevice.rundown.piecePlaybackStopped',

	'mosRoCreate' 		= 'peripheralDevice.mos.roCreate',
	'mosRoReplace' 		= 'peripheralDevice.mos.roReplace',
	'mosRoDelete' 		= 'peripheralDevice.mos.roDelete',
	'mosRoDeleteForce'	= 'peripheralDevice.mos.roDeleteForce',
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
	'mosRoFullStory' 	= 'peripheralDevice.mos.RoFullStory',

	'dataRundownDelete'	= 'peripheralDevice.rundown.rundownDelete',
	'dataRundownCreate'	= 'peripheralDevice.rundown.rundownCreate',
	'dataRundownUpdate'	= 'peripheralDevice.rundown.rundownUpdate',
	'dataSegmentDelete'			= 'peripheralDevice.rundown.segmentDelete',
	'dataSegmentCreate'			= 'peripheralDevice.rundown.segmentCreate',
	'dataSegmentUpdate'			= 'peripheralDevice.rundown.segmentUpdate',
	'dataPieceDelete'	= 'peripheralDevice.rundown.pieceDelete',
	'dataPieceCreate'	= 'peripheralDevice.rundown.pieceCreate',
	'dataPieceUpdate'	= 'peripheralDevice.rundown.pieceUpdate',

	'resyncRundown'			= 'peripheralDevice.mos.roResync',

	'getMediaObjectRevisions' 	= 'peripheralDevice.mediaScanner.getMediaObjectRevisions',
	'updateMediaObject' 		= 'peripheralDevice.mediaScanner.updateMediaObject',

	'getMediaWorkFlowRevisions' = 'peripheralDevice.mediaManager.getMediaWorkFlowRevisions',
	'updateMediaWorkFlow' = 'peripheralDevice.mediaManager.updateMediaWorkFlow',
	'getMediaWorkFlowStepRevisions' = 'peripheralDevice.mediaManager.getMediaWorkFlowStepRevisions',
	'updateMediaWorkFlowStep' = 'peripheralDevice.mediaManager.updateMediaWorkFlowStep',

	'requestUserAuthToken' 	= 'peripheralDevice.spreadsheet.requestUserAuthToken',
	'storeAccessToken' 	= 'peripheralDevice.spreadsheet.storeAccessToken',

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

export function executeFunction (deviceId: string, cb: (err, result) => void, functionName: string, ...args: any[]) {

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
		subscription = meteorSubscribe(PubSub.peripheralDeviceCommands, deviceId )
	}
	const timeoutTime = 3000
	// logger.debug('command created: ' + functionName)
	const cursor = PeripheralDeviceCommands.find({
		_id: commandId
	})
	let observer: Meteor.LiveQueryHandle
	let timeoutCheck: number = 0
	// we've sent the command, let's just wait for the reply
	const checkReply = () => {
		let cmd = PeripheralDeviceCommands.findOne(commandId)
		// if (!cmd) throw new Meteor.Error('Command "' + commandId + '" not found')
		// logger.debug('checkReply')
		if (cmd) {
			if (cmd.hasReply) {
				// We've got a reply!
				// logger.debug('got reply ' + commandId)

				if (cmd.replyError) {
					cb(cmd.replyError, null)
				} else {
					cb(null, cmd.reply)
				}
				observer.stop()
				PeripheralDeviceCommands.remove(cmd._id)
				if (subscription) subscription.stop()
				if (timeoutCheck) {
					Meteor.clearTimeout(timeoutCheck)
					timeoutCheck = 0
				}
			} else if (getCurrentTime() - (cmd.time || 0) >= timeoutTime) { // timeout
				cb('Timeout when executing the function "' + cmd.functionName + '" on device "' + cmd.deviceId + '" ', null)
				observer.stop()
				PeripheralDeviceCommands.remove(cmd._id)
				if (subscription) subscription.stop()
			}
		} else {
			// logger.debug('Command "' + commandId + '" not found when looking for reply')
		}
	}

	observer = cursor.observeChanges({
		added: checkReply,
		changed: checkReply,
	})
	timeoutCheck = Meteor.setTimeout(checkReply, timeoutTime)
}

}

export { PeripheralDeviceAPI }
