import { Mongo } from 'meteor/mongo'
import { PeripheralDeviceAPI } from '../api/peripheralDevice'
import { Time, registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { Meteor } from 'meteor/meteor'
import {
	DeviceType as PlayoutDeviceType,
	DeviceOptions as PlayoutDeviceSettingsDevice,
	CasparCGOptions,
	AtemOptions,
	HyperdeckOptions
} from 'timeline-state-resolver-types'

export interface PeripheralDevice {
	_id: string

	name: string
	type: PeripheralDeviceAPI.DeviceType

	/** The studio this device is assigned to. Will be undefined for sub-devices */
	studioInstallationId?: string
	parentDeviceId?: string
	/** Versions reported from the device */
	versions?: {
		[libraryName: string]: string
	}
	/** Expected versions (at least this) */
	expectedVersions?: {
		[libraryName: string]: string
	}

	created: Time
	status: PeripheralDeviceAPI.StatusObject
	lastSeen: Time // Updated continously while connected
	lastConnected: Time // Updated upon connection, not continously

	connected: boolean
	connectionId: string|null // Id of the current ddp-Connection

	token: string

	settings?: MosDeviceSettings | PlayoutDeviceSettings | MediaManagerDeviceSettings
}

export interface MosDevice extends PeripheralDevice {
	type: PeripheralDeviceAPI.DeviceType.MOSDEVICE,

	settings?: MosDeviceSettings

	lastDataReceived?: Time
}

export interface MosDeviceSettings {
	mosId: string,
	devices: {
		[deviceId: string]: MosDeviceSettingsDevice
	}
}
export interface MosDeviceSettingsDevice {
	primary: MosDeviceSettingsDeviceOptions
	secondary?: MosDeviceSettingsDeviceOptions
}
export interface MosDeviceSettingsDeviceOptions {
	id: string
	host: string
}

export interface PlayoutDeviceSettings {
	devices: {
		[deviceId: string]: PlayoutDeviceSettingsDevice
	}
	mediaScanner: {
		host: string
		port: number
	}
}
export interface MediaManagerDeviceSettings {
	/** A list of available storage locations */
	storages: Array<StorageSettings>

	/** A specification of source -> target mappings with workflow generators to be attached to them */
	mediaFlows: Array<MediaFlow>

	/** The amount of workers to be available for file system operations */
	workers: number

	/** How long to wait before removing a file - used by some workflow generators */
	lingerTime: number

	/** Cron job time - how often to check the file system for consistency - do a poll of the filesystem to check that the files are where they are supposed to be, clean out expired files */
	cronJobTime?: number

	/** Connection details for the media scanner */
	mediaScanner: {
		host: string
		port: number
	}
}


export enum MediaFlowType {
	WATCH_FOLDER = 'watch_folder',
	LOCAL_INGEST = 'local_ingest',
	EXPECTED_ITEMS = 'expected_items',
	UNKNOWN = 'unknown'
}

export interface MediaFlow {
	/** Id of the mediaFlow */
	id: string
	/** Id of a Storage */
	sourceId: string
	/** Id of a Storage */
	destinationId?: string
	/** Workflow generator type */
	mediaFlowType: MediaFlowType
}

export enum StorageType {
	LOCAL_FOLDER = 'local_folder',
	FILE_SHARE = 'file_share',
	UNKNOWN = 'unknown'
	// FTP = 'ftp',
	// AWS_S3 = 'aws_s3'
}
export interface StorageSettings {
	id: string
	support: {
		read: boolean
		write: boolean
	}
	type: StorageType
	options: any
}

export interface LocalFolderStorage extends StorageSettings {
	type: StorageType.LOCAL_FOLDER
	options: {
		basePath: string
		mediaPath?: string
	}
}
export interface FileShareStorage extends StorageSettings {
	type: StorageType.FILE_SHARE
	options: {
		/** URI to the network share, eg "\\somehting\share" */
		basePath: string
		/** The playout media folder location */
		mediaPath?: string
		/** A virtual local drive letter, "E", the basePath should be mounted to */
		mappedNetworkedDriveTarget: string
		username?: string
		password?: string
	}
}

export interface PlayoutDeviceSettingsDeviceCasparCG extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.CASPARCG
	options: CasparCGOptions
}
export interface PlayoutDeviceSettingsDeviceAtem extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.ATEM
	options: AtemOptions
}

export interface PanasonicDeviceSettings {
	identifier: string
	url: string
}

export interface PlayoutDeviceSettingsDevicePanasonicPTZ extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.PANASONIC_PTZ
	options: {
		cameraDevices: Array<PanasonicDeviceSettings>
	}
}

export interface PlayoutDeviceSettingsDeviceHyperdeck extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.HYPERDECK
	options: HyperdeckOptions
}
export interface PlayoutDeviceSettingsDevicePharos extends PlayoutDeviceSettingsDevice {
	type: PlayoutDeviceType.PHAROS
	options: {
		host: string,
		ssl?: boolean
	}
}

export const PeripheralDevices: TransformedCollection<PeripheralDevice, PeripheralDevice>
	= new Mongo.Collection<PeripheralDevice>('peripheralDevices')
registerCollection('PeripheralDevices', PeripheralDevices)
Meteor.startup(() => {
	if (Meteor.isServer) {
		PeripheralDevices._ensureIndex({
			studioInstallationId: 1
		})
	}
})
