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

	/** WorkFlow cleanup time */
	workFlowLingerTime?: number

	/** When to warn that the Queue is too long */
	warningWFQueueLength?: number
	/** When to warn that a worker is working too long */
	warningTaskWorkingTime?: number

	/** Connection details for media access via HTTP server */
	httpPort?: number
	/** Connection details for media access via HTTPS server */
	httpsPort?: number

	/** A list of Monitors, which will monitor media statuses */
	monitors?: {
		[monitorId: string]: MonitorSettings
	}

	/** Local path configuration for media manager system */
	paths?: {
		/** Command to execute to run `ffmpeg` */
		ffmpeg?: string
		/** Command to execute to run `ffprobe` */
		ffprobe?: string
		/** Folder to store generated resources. Defaults to where media manager is started */
		resources?: string
	}

	/** Configuration of thumbnail size */
	thumbnails?: {
		/** Width of thumbnail in pixels. Default is `256` */
		width?: number
		/** Height of thumbnail in pixels. Set height to `-1` - the default - to preserve aspect */
		height?: number
		/** Sub-folder of `paths.resources` where thumbnails are stored. Defaults to `.../thumbnails` */
		folder?: string // Not in use yet
	}

	/** Configuration for various kinds of advanced metadata generation */
	metadata?: {
		/** Enable field order detection. An expensive chcek that decodes the start of the video */
		fieldOrder?: boolean
		/** Number of frames to scan to determine files order. Neede sufficient motion, i.e. beyong title card */
		fieldOrderScanDuration?: number

		/** Enable scene change detection */
		scenes?: boolean
		/** Likelihood frame introduces new scene (`0.0` to `1.0`). Defaults to `0.4` */
		sceneThreshold?: number

		/** Enable freeze frame detection */
		freezeDetection?: boolean
		/** Noise tolerance - difference ratio between `0.0` to `1.0`. Default is `0.001` */
		freezeNoise?: number
		/** Duration of freeze before notification. Default is `2s` */
		freezeDuration?: string

		/** Enable black frame detection */
		blackDetection?: boolean
		/** Duration of black until notified. Default `2.0` */
		blackDuration?: string
		/** Ratio of black pixels per frame before frame is black. Value between `0.0` and `1.0` defaulting to `0.98` */
		blackRatio?: number
		/** Luminance threshold for a single pixel to be considered black. Default is `0.1` */
		blackThreshold?: number

		/** Merge black and freeze frame detection results. Default is `true` */
		mergeBlacksAndFreezes?: boolean
	}

	/** Configuration of _hover-scrub_ preview generation */
	previews?: {
		/** Enable preview generation. Default is `false` */
		enable?: boolean
		/** Width of preview video in pixels. Default is `160` */
		width?: number
		/** Height of preview video in pixels. Set height to `-1` - the default - to preserve aspect */
		height?: number
		/** Bitrate for preview video. Default is `40k` */
		bitrate?: string
		/** Sub-folder of `paths.resources` where thumbnails are stored. Defaults to `.../previews` */
		folder?: string
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
	QUANTEL_HTTP = 'quantel_http',
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
export interface QuantelHTTPStorage extends StorageSettings {
	type: StorageType.QUANTEL_HTTP
	options: {
		transformerUrl: string
		gatewayUrl: string
		ISAUrl: string
		zoneId: string | undefined
		serverId: number
		onlySelectedFiles: true
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
export type MonitorSettings = MonitorSettingsNull | MonitorSettingsWatcher | MonitorSettingsMediaScanner | MonitorSettingsQuantel
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
	WATCHER = 'watcher',
	MEDIA_SCANNER = 'mediascanner',
	QUANTEL = 'quantel'
}
export interface WatchOptions { // See https://www.npmjs.com/package/chokidar#api
	persistent?: boolean
	ignored?: any
	ignoreInitial?: boolean
	followSymlinks?: boolean
	cwd?: string
	disableGlobbing?: boolean
	usePolling?: boolean
	useFsEvents?: boolean
	alwaysStat?: boolean
	depth?: number
	interval?: number
	binaryInterval?: number
	ignorePermissionErrors?: boolean
	atomic?: boolean | number
	awaitWriteFinish?: boolean | {
		stabilityThreshold?: number
		pollInterval?: number
	}
}
export interface MonitorSettingsNull extends MonitorSettingsBase {
	type: MonitorSettingsType.NULL
}
/**
 * @deprecated Use [MonitorSettingsWatcher]
 */
export interface MonitorSettingsMediaScanner extends MonitorSettingsBase {
	type: MonitorSettingsType.MEDIA_SCANNER
	/** Host of the media-scanner PouchDB server */
	host: string
	port: number
}

export interface MonitorSettingsWatcher extends MonitorSettingsBase {
	type: MonitorSettingsType.WATCHER

	/** See https://www.npmjs.com/package/chokidar#api */
	scanner: WatchOptions
	/** Maximum number of times to try and scan a file. */
	retryLimit: number
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
