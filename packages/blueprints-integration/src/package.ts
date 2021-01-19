export namespace ExpectedPackage {
	export type Any = ExpectedPackageMediaFile | ExpectedPackageQuantelClip

	export enum PackageType {
		MEDIA_FILE = 'media_file',
		QUANTEL_CLIP = 'quantel_clip',

		// TALLY_LABEL = 'tally_label'

		// VIZ_GFX = 'viz_gfx'
	}

	export interface Base {
		/** Unique id of the expectedPackage */
		_id: string
		/** Reference to which timeline-layer the Package is going to be used in.
		 * (Used to route the package to the right playout-device (targets))
		 */
		layer: string

		/** What type of package it is */
		type: PackageType

		/** Definition of the content of the Package.
		 * With "content", we mean what's the basic definition of a package. For a media file, think "filename".
		 */
		content: object
		/** Definition of the version of the Package
		 * A "version" is used to differ between different "modifications" for the same content. For a media file, think "modified date".
		 */
		version: object

		/** Hash that changes whenever the content or version changes. */
		contentVersionHash: string

		/** Definition of the source-PackageContainers of the Package
		 * The source is used by the package manager to be able to be able to do an action on the Package. For a media file about to be copied, think "source file path".
		 * Multiple sources can be defined, in order of preference(?)
		 */
		sources: {
			/** Reference to a PackageContainer */
			containerId: string
			/** Locally defined Accessors, these are combined (deep extended) with the PackageContainer (if it is found) Accessors */
			accessors: { [accessorId: string]: AccessorOnPackage.Any }
		}[]
	}

	export interface ExpectedPackageMediaFile extends Base {
		type: PackageType.MEDIA_FILE
		content: {
			/** Local file path on the playout device */
			filePath: string
		}
		version: {
			fileSize?: number // in bytes
			modifiedDate?: number // timestamp (ms)
			checksum?: string
			checkSumType?: 'sha' | 'md5' | 'whatever'
		}
		sources: {
			containerId: string
			accessors: {
				[accessorId: string]:
					| AccessorOnPackage.LocalFolder
					| AccessorOnPackage.FileShare
					| AccessorOnPackage.MappedDrive
					| AccessorOnPackage.HTTP
			}
		}[]
	}
	export interface ExpectedPackageQuantelClip extends Base {
		type: PackageType.QUANTEL_CLIP
		content: {
			guid?: string
			title?: string
		}
		version: {
			// @todo: something here?
		}
		sources: {
			containerId: string
			accessors: { [accessorId: string]: AccessorOnPackage.Quantel }
		}[]
	}
}

/** A PackageContainer defines a place that contains Packages, that can be read or written to.
 * For example:
 *   A PackageContainer could be a folder on a computer that contains media files.
 *   That folder could be accessed locally (Accessor.LocalFolder)
 *   and if the folder is shared, by a Accessor.FileShare over the network
 */
export interface PackageContainer {
	/** Short name, for displaying to user */
	label: string

	/** A list of ways to access the PackageContainer. Note: The accessors are different ways to access THE SAME PackageContainer. */
	accessors: { [accessorId: string]: Accessor.Any }
}

/** Defines different ways of accessing a PackageContainer.
 * For example, a local folder on a computer might be accessed through a LocalFolder and a FileShare
 */
export namespace Accessor {
	export type Any = LocalFolder | FileShare | MappedDrive | HTTP | Quantel

	export enum AccessType {
		LOCAL_FOLDER = 'local_folder',
		FILE_SHARE = 'file_share',
		MAPPED_DRIVE = 'mapped_drive',
		HTTP = 'http',

		QUANTEL = 'quantel',

		CORE_PACKAGE_INFO = 'core_package_info',
	}

	export interface Base {
		type: AccessType
		label: string
		allowRead: boolean
		allowWrite: boolean
	}
	/** Defines acess to a local folder */
	export interface LocalFolder extends Base {
		type: AccessType.LOCAL_FOLDER

		/** Name/id of the resource, this could for example be the computer name. */
		resourceId?: string // todo: rename?

		/** Path to the folder
		 * @example 'C:\media\'
		 */
		folderPath: string
	}
	export interface FileShare extends Base {
		type: AccessType.FILE_SHARE

		/** Name/Id of the network the share exists on. Used to differ between different local networks. */
		networkId?: string

		/** Path to a folder on a network-share
		 * @example '\\192.168.0.1\shared\'
		 */
		folderPath: string
	}
	export interface MappedDrive extends Base {
		type: AccessType.MAPPED_DRIVE

		/** Name/Id of the network the share exists on. Used to differ between different local networks. */
		networkId?: string

		/** Path to a folder on a network-share
		 * @example '\\192.168.0.1\shared\'
		 */
		folderPath: string

		userName?: string
		password?: string

		/** Drive letter to where the drive is (to be) mapped to */
		mappedDrive?: string
	}
	export interface HTTP extends Base {
		type: AccessType.HTTP

		/** Base url (url to the host), for example http://myhost.com/fileShare/ */
		baseUrl: string

		/** Type of request. Defaults to 'get' */
		method?: 'get' | 'post' | string

		/** Any headers to send along with the request */
		headers?: { [name: string]: any }

		/** Body parameters to send along with the request (for POST-requests). */
		requestBody?: object
	}
	export interface Quantel extends Base {
		type: AccessType.QUANTEL

		zoneId: string
	}
	/** Virtual PackageContainer used for piping data into core */
	export interface CorePackageCollection {
		type: Accessor.AccessType.CORE_PACKAGE_INFO
		// TODO
	}
}
/**
 * AccessorOnPackage contains interfaces for Accessor definitions that are put ON the Package.
 * The info is then (optionally) combined with the Accessor data
 */
export namespace AccessorOnPackage {
	export type Any = LocalFolder | FileShare | MappedDrive | HTTP | Quantel | CorePackageCollection

	export interface LocalFolder extends Partial<Accessor.LocalFolder> {
		/** Path to the file (starting from .folderPath). If not set, the filePath of the ExpectedPackage will be used */
		filePath: string
	}
	export interface FileShare extends Partial<Accessor.FileShare> {
		/** Path to the file (starting from .folderPath). If not set, the filePath of the ExpectedPackage will be used */
		filePath: string
	}
	export interface MappedDrive extends Partial<Accessor.MappedDrive> {
		/** Path to the file (starting from .folderPath). If not set, the filePath of the ExpectedPackage will be used */
		filePath?: string
	}
	export interface HTTP extends Partial<Accessor.HTTP> {
		/** URL path to resource (combined with .baseUrl gives the full URL), for example: /folder/myFile */
		url: string
	}
	export interface Quantel extends Partial<Accessor.Quantel> {
		guid?: string
		title?: string
	}
	export interface CorePackageCollection extends Partial<Accessor.CorePackageCollection> {
		// todo
	}
}

export interface PackageContainerOnPackage extends Omit<PackageContainer, 'accessors'> {
	/** Short name, for displaying to user */
	label: string

	accessors: { [accessorId: string]: AccessorOnPackage.Any }
}

// todo: should this be moved into core-integration?
export namespace ExpectedPackageStatusAPI {
	/** Information about the status of some work being performed with regards to an Expected Package */
	export interface WorkStatus extends WorkBaseInfo, WorkStatusInfo {}
	export interface WorkBaseInfo {
		/** Which packages the WorkStatus belongs to */
		fromPackages: {
			/** Reference to the id of the Package */
			id: string
			/** Reference to the contentVersionHash of the ExpectedPackage, used to reference the expected content+version of the Package */
			expectedContentVersionHash: string

			/** Referring to the actual contentVersionHash of the Package, used to reference the exact content+version of the Package */
			actualContentVersionHash: string
		}[]

		/** Short Display label */
		label: string
		/** Longer expanation on what the Expectation does */
		description: string
		/** Used in status GUI to order the Expecations within the same packageId. */
		displayRank?: number
		/** If the expectation is required to be fullfilled for playout */
		requiredForPlayout?: boolean
	}
	export interface WorkStatusInfo {
		/** Short description on what the current status is. Example "working", "fulfilled" */
		status: string
		/** Longer reason as to why the status is what it is */
		statusReason: string

		/** Progress, 0-1 */
		progress?: number
		/** Calculated time left of this step */
		expectedLeft?: number
	}
}
