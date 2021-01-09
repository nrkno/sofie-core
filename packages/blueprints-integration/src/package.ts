export namespace ExpectedPackage {
	export type Any = ExpectedPackageMediaFile | ExpectedPackageQuantelClip

	export enum PackageType {
		MEDIA_FILE = 'media_file',
		QUANTEL_CLIP = 'quantel_clip',

		// TALLY_LABEL = 'tally_label'

		// VIZ_GFX = 'viz_gfx'
	}

	export interface Base {
		/** Reference to which timeline-layer the Package is going to be used in.
		 * (Used to route the package to the right playout-device)
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

		/** Definition of the origin of the Package
		 * The origin is used by the package manager to be able to be able to do an action on the Package. For a media file about to be copied, think "source file path".
		 * Multiple origins can be defined, in order of preference(?)
		 */
		origins: {
			/** Reference to a PackageOrigin */
			originId: string
			/** Locally defined PackageOrigin, this is combined (deep extended) with the PackageOrigin if it is found */
			originMetadata: PackageOriginOnPackage.Any
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
		origins: {
			originId: string
			originMetadata:
				| PackageOriginOnPackage.LocalFolder
				| PackageOriginOnPackage.FileShare
				| PackageOriginOnPackage.MappedDrive
				| PackageOriginOnPackage.HTTP
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
		origins: {
			originId: string
			originMetadata: PackageOriginOnPackage.Quantel
		}[]
	}
}

// An "Origin" defines a resource that contains Packages, that can be read
// For example; for a Media file transfer, the Origin could be a source-folder
export namespace PackageOrigin {
	export type Any = LocalFolder | FileShare | MappedDrive | HTTP | Quantel

	export enum OriginType {
		LOCAL_FOLDER = 'local_folder',
		FILE_SHARE = 'file_share',
		MAPPED_DRIVE = 'mapped_drive',
		HTTP = 'http',

		QUANTEL = 'quantel',

		CORE_PACKAGE_INFO = 'core_package_info',
	}

	export interface Base {
		type: PackageOrigin.OriginType
	}
	export interface LocalFolder extends PackageOrigin.Base {
		type: PackageOrigin.OriginType.LOCAL_FOLDER

		/** Path to the folder
		 * @example 'C:\media\'
		 */
		folderPath: string
	}
	export interface FileShare extends PackageOrigin.Base {
		type: PackageOrigin.OriginType.FILE_SHARE

		/** Path to a folder on a network-share
		 * @example '\\192.168.0.1\shared\'
		 */
		folderPath: string
	}
	export interface MappedDrive extends PackageOrigin.Base {
		type: PackageOrigin.OriginType.MAPPED_DRIVE

		/** Path to a folder on a network-share
		 * @example '\\192.168.0.1\shared\'
		 */
		folderPath: string

		userName?: string
		password?: string

		/** Drive letter to where the drive is mappedTo */
		mappedDrive?: string
	}
	export interface HTTP extends PackageOrigin.Base {
		type: PackageOrigin.OriginType.HTTP

		/** Base url (url to the host), for example http://myhost.com/fileShare/ */
		baseUrl: string

		/** Type of request. Defaults to 'get' */
		method?: 'get' | 'post' | string

		/** Any headers to send along with the request */
		headers?: { [name: string]: any }

		/** Body parameters to send along with the request (for POST-requests). */
		requestBody?: object
	}
	export interface Quantel extends PackageOrigin.Base {
		type: PackageOrigin.OriginType.QUANTEL

		zoneId: string
	}
}
/**
 * PackageOriginOnPackage contains interfaces for origin defenitions that are put ON the Package.
 * The info is then (optionally) combined with the PackageOrigin data
 */
export namespace PackageOriginOnPackage {
	export type Any = LocalFolder | FileShare | MappedDrive | HTTP | Quantel

	export interface LocalFolder extends Partial<PackageOrigin.LocalFolder> {
		/** Path to the file (starting from .folderPath). If not set, the filePath of the ExpectedPackage will be used */
		filePath: string
	}
	export interface FileShare extends Partial<PackageOrigin.FileShare> {
		/** Path to the file (starting from .folderPath). If not set, the filePath of the ExpectedPackage will be used */
		filePath: string
	}
	export interface MappedDrive extends Partial<PackageOrigin.MappedDrive> {
		/** Path to the file (starting from .folderPath). If not set, the filePath of the ExpectedPackage will be used */
		filePath?: string
	}
	export interface HTTP extends Partial<PackageOrigin.HTTP> {
		/** URL path to resource (combined with .baseUrl gives the full URL), for example: /folder/myFile */
		url: string
	}
	export interface Quantel extends Partial<PackageOrigin.Quantel> {
		guid?: string
		title?: string
	}
}

// A Location is a target that can contain Packages, that can be written to
// For example; for a Media file transfer, the Origin could be a target-folder
export namespace PackageLocation {
	// TODO: Decide how this should be handled...

	export type Any = LocalFolder | FileShare | MappedDrive | HTTP | Quantel | CorePackageCollection

	export type LocalFolder = PackageOrigin.LocalFolder
	export type FileShare = PackageOrigin.FileShare
	export type MappedDrive = PackageOrigin.MappedDrive
	export type HTTP = PackageOrigin.HTTP

	export type Quantel = PackageOrigin.Quantel // todo: extend with serverId?

	export interface CorePackageCollection {
		type: PackageOrigin.OriginType.CORE_PACKAGE_INFO
	}
}
