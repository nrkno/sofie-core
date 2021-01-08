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
			/** Locally defined PackageOrigin */
			originMetadata: object
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
			modifiedDate?: string // @todo: should this be a number or a timestamp?
			checksum?: string
			checkSumType?: 'sha' | 'md5' | 'whatever'
		}
		origins: {
			originId: string
			originMetadata:
				| PackageOriginMetadata.LocalFolder
				| PackageOriginMetadata.FileShare
				| PackageOriginMetadata.MappedDrive
				| PackageOriginMetadata.HTTP
		}[]
	}
	export interface ExpectedPackageQuantelClip extends Base {
		type: PackageType.QUANTEL_CLIP
		content: {
			guid: string
		}
		version: {
			// @todo: something here?
		}
		origins: {
			originId: string
			originMetadata: {
				// @todo define this
				zoneId: string
			}
		}[]
	}
}

export namespace PackageOriginMetadata {
	export interface LocalFolder {
		type: Type.LOCAL_FOLDER

		/** Path to the folder
		 * @example 'C:\media\'
		 */
		folderPath?: string

		/** Path to the file (starting from .folderPath) */
		fileName?: string
	}
	export interface FileShare {
		type: Type.FILE_SHARE

		/** Path to a folder on a network-share
		 * @example '\\192.168.0.1\shared\'
		 */
		folderPath?: string

		/** Path to the file (starting from .folderPath) */
		fileName?: string
	}
	export interface MappedDrive {
		type: Type.MAPPED_DRIVE

		/** Path to a folder on a network-share
		 * @example '\\192.168.0.1\shared\'
		 */
		folderPath: string

		/** Path to the file (starting from .folderPath) */
		fileName: string

		/** Drive letter to where the drive is mappedTo */
		mappedDrive?: string

		userName?: string
		password?: string
	}
	export interface HTTP {
		type: Type.HTTP

		/** Base url (url to the host), for example http://myhost.com/fileShare/ */
		baseUrl: string

		/** URL path to resource (combined with .baseUrl gives the full URL), for example: /folder/myFile */
		url: string

		/** Type of request. Defaults to 'get' */
		method?: 'get' | 'post' | string

		/** Any headers to send along with the request */
		headers?: { [name: string]: any }

		/** Body parameters to send along with the request (for POST-requests). */
		requestBody?: any
	}
	export enum Type {
		LOCAL_FOLDER = 'local_folder',
		FILE_SHARE = 'file_share',
		MAPPED_DRIVE = 'mapped_drive',
		HTTP = 'http',
	}
}
