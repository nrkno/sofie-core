import { Meteor } from 'meteor/meteor'
import { getCurrentTime, getRandomId } from '../lib'
import { PeripheralDeviceCommands, PeripheralDeviceCommandId } from '../collections/PeripheralDeviceCommands'
import { PubSub, meteorSubscribe } from './pubsub'
import { DeviceConfigManifest } from './deviceConfig'
import { TSR } from 'tv-automation-sofie-blueprints-integration'
import { RundownId } from '../collections/Rundowns'
import { PartInstanceId } from '../collections/PartInstances'
import { PeripheralDeviceId, PeripheralDevice } from '../collections/PeripheralDevices'
import { PieceInstanceId } from '../collections/PieceInstances'
import { MediaWorkFlowId, MediaWorkFlow } from '../collections/MediaWorkFlows'
import { MediaObject } from '../collections/MediaObjects'
import { MediaWorkFlowStepId, MediaWorkFlowStep } from '../collections/MediaWorkFlowSteps'
import { RundownPlaylistId } from '../collections/RundownPlaylists'

// Note: When making changes to this file, remember to also update the copy in core-integration library

// Faking the MOS interface for now, so we don't have to expose mos-connection to the client
namespace FakeMOS {
	export type IMOSItem = any
	export type IMOSItemAction = any
	export type IMOSItemStatus = any
	export type IMOSROAction = any
	export type IMOSROFullStory = any
	export type IMOSROReadyToAir = any
	export type IMOSROStory = any
	export type IMOSRunningOrder = any
	export type IMOSRunningOrderBase = any
	export type IMOSRunningOrderStatus = any
	export type IMOSStoryAction = any
	export type IMOSStoryStatus = any
	export type MosString128 = any
}
// Fakin these, so we don't have to expose this to the client
type IngestRundown = any
type IngestSegment = any
type IngestPart = any

export interface NewPeripheralDeviceAPI {
	initialize(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		options: PeripheralDeviceAPI.InitOptions
	): Promise<PeripheralDeviceId>
	unInitialize(deviceId: PeripheralDeviceId, deviceToken: string): Promise<PeripheralDeviceId>
	setStatus(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		status: PeripheralDeviceAPI.StatusObject
	): Promise<PeripheralDeviceAPI.StatusObject>
	ping(deviceId: PeripheralDeviceId, deviceToken: string): Promise<void>
	getPeripheralDevice(deviceId: PeripheralDeviceId, deviceToken: string): Promise<PeripheralDevice>
	partPlaybackStarted(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PartPlaybackStartedResult
	): Promise<void>
	partPlaybackStopped(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PartPlaybackStartedResult
	): Promise<void>
	piecePlaybackStopped(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PiecePlaybackStartedResult
	): Promise<void>
	piecePlaybackStarted(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.PiecePlaybackStartedResult
	): Promise<void>
	pingWithCommand(deviceId: PeripheralDeviceId, deviceToken: string, message: string, cb?: Function): Promise<void>
	killProcess(deviceId: PeripheralDeviceId, deviceToken: string, really: boolean): Promise<boolean>
	testMethod(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		returnValue: string,
		throwError?: boolean
	): Promise<string>
	timelineTriggerTime(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		r: PeripheralDeviceAPI.TimelineTriggerTimeResult
	): Promise<void>
	requestUserAuthToken(deviceId: PeripheralDeviceId, deviceToken: string, authUrl: string): Promise<void>
	storeAccessToken(deviceId: PeripheralDeviceId, deviceToken: string, authToken: any): Promise<void>
	removePeripheralDevice(deviceId: PeripheralDeviceId): Promise<void>

	dataRundownList(deviceId: PeripheralDeviceId, deviceToken: string): Promise<string[]>
	dataRundownGet(deviceId: PeripheralDeviceId, deviceToken: string, rundownExternalId: string): Promise<IngestRundown>
	dataRundownDelete(deviceId: PeripheralDeviceId, deviceToken: string, rundownExternalId: string): Promise<void>
	dataRundownCreate(deviceId: PeripheralDeviceId, deviceToken: string, ingestRundown: IngestRundown): Promise<void>
	dataRundownUpdate(deviceId: PeripheralDeviceId, deviceToken: string, ingestRundown: IngestRundown): Promise<void>
	dataSegmentDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	): Promise<void>
	dataSegmentCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	): Promise<void>
	dataSegmentUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	): Promise<void>
	dataPartDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		partExternalId: string
	): Promise<void>
	dataPartCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	): Promise<void>
	dataPartUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	): Promise<void>

	mosRoCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		mosRunningOrder: FakeMOS.IMOSRunningOrder
	): Promise<void>
	mosRoReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		mosRunningOrder: FakeMOS.IMOSRunningOrder
	): Promise<void>
	mosRoDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		mosRunningOrderId: FakeMOS.MosString128,
		force?: boolean
	): Promise<void>
	mosRoMetadata(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		metadata: FakeMOS.IMOSRunningOrderBase
	): Promise<void>
	mosRoStatus(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		status: FakeMOS.IMOSRunningOrderStatus
	): Promise<void>
	mosRoStoryStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: FakeMOS.IMOSStoryStatus): Promise<void>
	mosRoItemStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: FakeMOS.IMOSItemStatus): Promise<void>
	mosRoStoryInsert(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: FakeMOS.IMOSStoryAction,
		Stories: Array<FakeMOS.IMOSROStory>
	): Promise<void>
	mosRoItemInsert(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: FakeMOS.IMOSItemAction,
		Items: Array<FakeMOS.IMOSItem>
	): Promise<void>
	mosRoStoryReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: FakeMOS.IMOSStoryAction,
		Stories: Array<FakeMOS.IMOSROStory>
	): Promise<void>
	mosRoItemReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: FakeMOS.IMOSItemAction,
		Items: Array<FakeMOS.IMOSItem>
	): Promise<void>
	mosRoStoryMove(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: FakeMOS.IMOSStoryAction,
		Stories: Array<FakeMOS.MosString128>
	): Promise<void>
	mosRoItemMove(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: FakeMOS.IMOSItemAction,
		Items: Array<FakeMOS.MosString128>
	): Promise<void>
	mosRoStoryDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: FakeMOS.IMOSROAction,
		Stories: Array<FakeMOS.MosString128>
	): Promise<void>
	mosRoItemDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: FakeMOS.IMOSStoryAction,
		Items: Array<FakeMOS.MosString128>
	): Promise<void>
	mosRoStorySwap(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: FakeMOS.IMOSROAction,
		StoryID0: FakeMOS.MosString128,
		StoryID1: FakeMOS.MosString128
	): Promise<void>
	mosRoItemSwap(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: FakeMOS.IMOSStoryAction,
		ItemID0: FakeMOS.MosString128,
		ItemID1: FakeMOS.MosString128
	): Promise<void>
	mosRoReadyToAir(deviceId: PeripheralDeviceId, deviceToken: string, Action: FakeMOS.IMOSROReadyToAir): Promise<void>
	mosRoFullStory(deviceId: PeripheralDeviceId, deviceToken: string, story: FakeMOS.IMOSROFullStory): Promise<void>

	getMediaObjectRevisions(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		collectionId: string
	): Promise<MediaObjectRevision[]>
	updateMediaObject(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		collectionId: string,
		id: string,
		doc: MediaObject | null
	): Promise<void>

	getMediaWorkFlowRevisions(deviceId: PeripheralDeviceId, deviceToken: string): Promise<MediaWorkFlowRevision[]>
	getMediaWorkFlowStepRevisions(
		deviceId: PeripheralDeviceId,
		deviceToken: string
	): Promise<MediaWorkFlowStepRevision[]>
	updateMediaWorkFlow(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		workFlowId: MediaWorkFlowId,
		obj: MediaWorkFlow | null
	): Promise<void>
	updateMediaWorkFlowStep(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		docId: MediaWorkFlowStepId,
		obj: MediaWorkFlowStep | null
	): Promise<void>

	determineDiffTime(): Promise<DiffTimeResult>
	getTimeDiff(): Promise<TimeDiff>
	getTime(): Promise<number>
}

export enum PeripheralDeviceAPIMethods {
	'functionReply' = 'peripheralDevice.functionReply',

	'testMethod' = 'peripheralDevice.testMethod',
	'setStatus' = 'peripheralDevice.status',
	'ping' = 'peripheralDevice.ping',
	'initialize' = 'peripheralDevice.initialize',
	'unInitialize' = 'peripheralDevice.unInitialize',
	'getPeripheralDevice' = 'peripheralDevice.getPeripheralDevice',
	'pingWithCommand' = 'peripheralDevice.pingWithCommand',
	'killProcess' = 'peripheralDevice.killProcess',
	'removePeripheralDevice' = 'peripheralDevice.removePeripheralDevice',

	'determineDiffTime' = 'systemTime.determineDiffTime',
	'getTimeDiff' = 'systemTime.getTimeDiff',
	'getTime' = 'systemTime.getTime',

	'timelineTriggerTime' = 'peripheralDevice.timeline.setTimelineTriggerTime',
	'partPlaybackStarted' = 'peripheralDevice.rundown.partPlaybackStarted',
	'partPlaybackStopped' = 'peripheralDevice.rundown.partPlaybackStopped',
	'piecePlaybackStarted' = 'peripheralDevice.rundown.piecePlaybackStarted',
	'piecePlaybackStopped' = 'peripheralDevice.rundown.piecePlaybackStopped',

	'mosRoCreate' = 'peripheralDevice.mos.roCreate',
	'mosRoReplace' = 'peripheralDevice.mos.roReplace',
	'mosRoDelete' = 'peripheralDevice.mos.roDelete',
	'mosRoDeleteForce' = 'peripheralDevice.mos.roDeleteForce',
	'mosRoMetadata' = 'peripheralDevice.mos.roMetadata',
	'mosRoStatus' = 'peripheralDevice.mos.roStatus',
	'mosRoStoryStatus' = 'peripheralDevice.mos.roStoryStatus',
	'mosRoItemStatus' = 'peripheralDevice.mos.roItemStatus',
	'mosRoStoryInsert' = 'peripheralDevice.mos.roStoryInsert',
	'mosRoStoryReplace' = 'peripheralDevice.mos.roStoryReplace',
	'mosRoStoryMove' = 'peripheralDevice.mos.roStoryMove',
	'mosRoStoryDelete' = 'peripheralDevice.mos.roStoryDelete',
	'mosRoStorySwap' = 'peripheralDevice.mos.roStorySwap',
	'mosRoItemInsert' = 'peripheralDevice.mos.roItemInsert',
	'mosRoItemReplace' = 'peripheralDevice.mos.roItemReplace',
	'mosRoItemMove' = 'peripheralDevice.mos.roItemMove',
	'mosRoItemDelete' = 'peripheralDevice.mos.roItemDelete',
	'mosRoItemSwap' = 'peripheralDevice.mos.roItemSwap',
	'mosRoReadyToAir' = 'peripheralDevice.mos.roReadyToAir',
	'mosRoFullStory' = 'peripheralDevice.mos.roFullStory',

	'dataRundownList' = 'peripheralDevice.rundown.rundownList',
	'dataRundownGet' = 'peripheralDevice.rundown.rundownGet',
	'dataRundownDelete' = 'peripheralDevice.rundown.rundownDelete',
	'dataRundownCreate' = 'peripheralDevice.rundown.rundownCreate',
	'dataRundownUpdate' = 'peripheralDevice.rundown.rundownUpdate',
	'dataSegmentDelete' = 'peripheralDevice.rundown.segmentDelete',
	'dataSegmentCreate' = 'peripheralDevice.rundown.segmentCreate',
	'dataSegmentUpdate' = 'peripheralDevice.rundown.segmentUpdate',
	'dataPartDelete' = 'peripheralDevice.rundown.partDelete',
	'dataPartCreate' = 'peripheralDevice.rundown.partCreate',
	'dataPartUpdate' = 'peripheralDevice.rundown.partUpdate',

	'resyncRundown' = 'peripheralDevice.mos.roResync',
	'resyncSegment' = 'peripheralDevice.mos.segmentResync',

	'getMediaObjectRevisions' = 'peripheralDevice.mediaScanner.getMediaObjectRevisions',
	'updateMediaObject' = 'peripheralDevice.mediaScanner.updateMediaObject',

	'getMediaWorkFlowRevisions' = 'peripheralDevice.mediaManager.getMediaWorkFlowRevisions',
	'updateMediaWorkFlow' = 'peripheralDevice.mediaManager.updateMediaWorkFlow',
	'getMediaWorkFlowStepRevisions' = 'peripheralDevice.mediaManager.getMediaWorkFlowStepRevisions',
	'updateMediaWorkFlowStep' = 'peripheralDevice.mediaManager.updateMediaWorkFlowStep',

	'requestUserAuthToken' = 'peripheralDevice.spreadsheet.requestUserAuthToken',
	'storeAccessToken' = 'peripheralDevice.spreadsheet.storeAccessToken',
}
export interface TimeDiff {
	currentTime: number
	systemRawTime: number
	diff: number
	stdDev: number
	good: boolean
}
export interface DiffTimeResult {
	mean: number
	stdDev: number
}
export interface MediaObjectRevision {
	id: string
	rev: string
}
export interface MediaWorkFlowRevision {
	_id: MediaWorkFlowId
	_rev: string
}
export interface MediaWorkFlowStepRevision {
	_id: MediaWorkFlowStepId
	_rev: string
}
export namespace PeripheralDeviceAPI {
	export enum StatusCode {
		UNKNOWN = 0, // Status unknown
		GOOD = 1, // All good and green
		WARNING_MINOR = 2, // Everything is not OK, operation is not affected
		WARNING_MAJOR = 3, // Everything is not OK, operation might be affected
		BAD = 4, // Operation affected, possible to recover
		FATAL = 5, // Operation affected, not possible to recover without manual interference
	}

	// Note The actual type of a device is determined by the Category, Type and SubType

	export interface StatusObject {
		statusCode: StatusCode
		messages?: Array<string>
	}
	// Note The actual type of a device is determined by the Category, Type and SubType
	export enum DeviceCategory {
		INGEST = 'ingest',
		PLAYOUT = 'playout',
		MEDIA_MANAGER = 'media_manager',
	}
	export enum DeviceType {
		// Ingest devices:
		MOS = 'mos',
		SPREADSHEET = 'spreadsheet',
		INEWS = 'inews',
		// Playout devices:
		PLAYOUT = 'playout',
		// Media-manager devices:
		MEDIA_MANAGER = 'media_manager',
	}
	export type DeviceSubType = SUBTYPE_PROCESS | TSR.DeviceType | MOS_DeviceType | Spreadsheet_DeviceType

	/** SUBTYPE_PROCESS means that the device is NOT a sub-device, but a (parent) process. */
	export type SUBTYPE_PROCESS = '_process'
	export const SUBTYPE_PROCESS: SUBTYPE_PROCESS = '_process'
	export type MOS_DeviceType = 'mos_connection'
	export type Spreadsheet_DeviceType = 'spreadsheet_connection'

	export interface InitOptions {
		category: DeviceCategory
		type: DeviceType
		subType: DeviceSubType

		name: string
		connectionId: string
		parentDeviceId?: PeripheralDeviceId
		versions?: {
			[libraryName: string]: string
		}
		configManifest: DeviceConfigManifest
	}
	export type TimelineTriggerTimeResult = Array<{ id: string; time: number }>

	export interface PartPlaybackStartedResult {
		rundownPlaylistId: RundownPlaylistId
		partInstanceId: PartInstanceId
		time: number
	}
	export type PartPlaybackStoppedResult = PartPlaybackStartedResult
	export interface PiecePlaybackStartedResult {
		rundownPlaylistId: RundownPlaylistId
		pieceInstanceId: PieceInstanceId
		dynamicallyInserted?: boolean
		time: number
	}
	export type PiecePlaybackStoppedResult = PiecePlaybackStartedResult

	export function executeFunctionWithCustomTimeout(
		deviceId: PeripheralDeviceId,
		cb: (err, result) => void,
		timeoutTime: number,
		functionName: string,
		...args: any[]
	) {
		let commandId: PeripheralDeviceCommandId = getRandomId()
		PeripheralDeviceCommands.insert({
			_id: commandId,
			deviceId: deviceId,
			time: getCurrentTime(),
			functionName,
			args: args,
			hasReply: false,
		})
		let subscription: Meteor.SubscriptionHandle | null = null
		if (Meteor.isClient) {
			subscription = meteorSubscribe(PubSub.peripheralDeviceCommands, deviceId)
		}
		// logger.debug('command created: ' + functionName)
		const cursor = PeripheralDeviceCommands.find({
			_id: commandId,
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

					// Cleanup before the callback to ensure it doesnt get a timeout during the callback
					if (observer) observer.stop()
					PeripheralDeviceCommands.remove(cmd._id)
					if (subscription) subscription.stop()
					if (timeoutCheck) {
						Meteor.clearTimeout(timeoutCheck)
						timeoutCheck = 0
					}

					// Handle result
					if (cmd.replyError) {
						cb(cmd.replyError, null)
					} else {
						cb(null, cmd.reply)
					}
				} else if (getCurrentTime() - (cmd.time || 0) >= timeoutTime) {
					// timeout
					cb(
						`Timeout after ${timeoutTime} ms when executing the function "${cmd.functionName}" on device "${cmd.deviceId}"`,
						null
					)
					if (observer) observer.stop()
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

	export function executeFunction(
		deviceId: PeripheralDeviceId,
		cb: (err, result) => void,
		functionName: string,
		...args: any[]
	) {
		const timeoutTime = 3000
		return executeFunctionWithCustomTimeout(deviceId, cb, timeoutTime, functionName, ...args)
	}
}
