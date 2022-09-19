import { DeviceConfigManifest } from '../core/deviceConfigManifest'
import { PeripheralDeviceId, RundownPlaylistId, PartInstanceId, PieceInstanceId } from '../core/model/Ids'
import { StatusCode } from '../lib/status'

export type StatusObject = PeripheralDeviceStatusObject

export interface PartPlaybackCallbackData {
	rundownPlaylistId: RundownPlaylistId
	partInstanceId: PartInstanceId
}
export interface PiecePlaybackCallbackData {
	rundownPlaylistId: RundownPlaylistId
	partInstanceId: PartInstanceId
	pieceInstanceId: PieceInstanceId
	dynamicallyInserted?: boolean
}

export type TimelineTriggerTimeResult = Array<{ id: string; time: number }>

export interface PartPlaybackStartedResult extends PartPlaybackCallbackData {
	time: number
}
export type PartPlaybackStoppedResult = PartPlaybackStartedResult
export interface PiecePlaybackStartedResult extends PiecePlaybackCallbackData {
	time: number
}
export type PiecePlaybackStoppedResult = PiecePlaybackStartedResult

export type PlayoutChangedResults = {
	rundownPlaylistId: RundownPlaylistId
	changes: PlayoutChangedResult[]
}
export enum PlayoutChangedType {
	PART_PLAYBACK_STARTED = 'partPlaybackStarted',
	PART_PLAYBACK_STOPPED = 'partPlaybackStopped',
	PIECE_PLAYBACK_STARTED = 'piecePlaybackStarted',
	PIECE_PLAYBACK_STOPPED = 'piecePlaybackStopped',
}
export type PlayoutChangedResult = {
	objId: string
	type:
		| PlayoutChangedType.PART_PLAYBACK_STARTED
		| PlayoutChangedType.PART_PLAYBACK_STOPPED
		| PlayoutChangedType.PIECE_PLAYBACK_STARTED
		| PlayoutChangedType.PIECE_PLAYBACK_STOPPED
} & (
	| {
			type: PlayoutChangedType.PART_PLAYBACK_STARTED
			data: Omit<PartPlaybackStartedResult, 'rundownPlaylistId'>
	  }
	| {
			type: PlayoutChangedType.PART_PLAYBACK_STOPPED
			data: Omit<PartPlaybackStoppedResult, 'rundownPlaylistId'>
	  }
	| {
			type: PlayoutChangedType.PIECE_PLAYBACK_STARTED
			data: Omit<PiecePlaybackStartedResult, 'rundownPlaylistId'>
	  }
	| {
			type: PlayoutChangedType.PIECE_PLAYBACK_STOPPED
			data: Omit<PiecePlaybackStoppedResult, 'rundownPlaylistId'>
	  }
)

// Note The actual type of a device is determined by the Category, Type and SubType

export interface PeripheralDeviceStatusObject {
	statusCode: StatusCode
	messages?: Array<string>
}
// Note The actual type of a device is determined by the Category, Type and SubType
export enum PeripheralDeviceCategory {
	INGEST = 'ingest',
	PLAYOUT = 'playout',
	MEDIA_MANAGER = 'media_manager',
	PACKAGE_MANAGER = 'package_manager',
}
export enum PeripheralDeviceType {
	// Ingest devices:
	MOS = 'mos',
	SPREADSHEET = 'spreadsheet',
	INEWS = 'inews',
	// Playout devices:
	PLAYOUT = 'playout',
	// Media-manager devices:
	MEDIA_MANAGER = 'media_manager',
	// Package_manager devices:
	PACKAGE_MANAGER = 'package_manager',
}
// TODO: PeripheralDeviceSubType should be removed altogether at some point..
export type PeripheralDeviceSubType = any
// | PERIPHERAL_SUBTYPE_PROCESS
// | TSR.DeviceType
// | MOS_DeviceType
// | Spreadsheet_DeviceType

/** SUBTYPE_PROCESS means that the device is NOT a sub-device, but a (parent) process. */
export type PERIPHERAL_SUBTYPE_PROCESS = '_process'
export const PERIPHERAL_SUBTYPE_PROCESS: PERIPHERAL_SUBTYPE_PROCESS = '_process'
export type MOS_DeviceType = 'mos_connection'
export type Spreadsheet_DeviceType = 'spreadsheet_connection'

export interface InitOptions {
	category: PeripheralDeviceCategory
	type: PeripheralDeviceType
	subType: PeripheralDeviceSubType

	name: string
	connectionId: string
	parentDeviceId?: PeripheralDeviceId
	versions?: {
		[libraryName: string]: string
	}
	configManifest?: DeviceConfigManifest
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
