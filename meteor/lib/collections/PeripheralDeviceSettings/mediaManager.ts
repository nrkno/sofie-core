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

	/** A list of Monitors, which will monitor media statuses */
	monitors?: {
		[monitorId: string]: MonitorSettings
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
	options: {
		/** Only subscribed files can be listened to for changes */
		onlySelectedFiles?: boolean
		[key: string]: any
	}
}
export interface LocalFolderStorage extends StorageSettings {
	type: StorageType.LOCAL_FOLDER
	options: {
		basePath: string
		mediaPath?: string
		usePolling?: boolean
		onlySelectedFiles?: boolean
	}
}
export interface FileShareStorage extends StorageSettings {
	type: StorageType.FILE_SHARE
	options: {
		/** URI to the network share, eg "\\somehting\share" */
		basePath: string
		/** A folder prefix relative to the Playout media folder */
		mediaPath?: string
		/** A virtual local drive letter, "E", the basePath should be mounted to */
		mappedNetworkedDriveTarget: string
		username?: string // wip?
		password?: string // wip?
		onlySelectedFiles?: boolean
	}
}
export type MonitorSettings = MonitorSettingsNull | MonitorSettingsMediaScanner | MonitorSettingsQuantel
export interface MonitorSettingsBase {
	type: MonitorSettingsType

	/** The storageId is defining the storage/server on which the media is on.
	 * (in the media-scanner, this is equivalent to the collectionId)
	 */
	storageId: string
	disable?: boolean
}
export enum MonitorSettingsType {
	NULL = '',
	MEDIA_SCANNER = 'mediascanner',
	QUANTEL = 'quantel'
}
export interface MonitorSettingsNull extends MonitorSettingsBase {
	type: MonitorSettingsType.NULL
}
export interface MonitorSettingsMediaScanner extends MonitorSettingsBase {
	type: MonitorSettingsType.MEDIA_SCANNER
	/** Host of the media-scanner PouchDB server */
	host: string
	port: number
}
export interface MonitorSettingsQuantel extends MonitorSettingsBase {
	type: MonitorSettingsType.QUANTEL

	/** Url to the quantel gateway  */
	gatewayUrl: string
	/** Address to the ISA, for the gateway to connect to */
	ISAUrl: string
	/** The ID of the zone to use. If omitted, will be using "default" */
	zoneId?: string
	/** The id of the server to control. An Ingeter */
	serverId: number
}
