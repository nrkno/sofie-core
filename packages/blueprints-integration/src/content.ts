import { Time } from './common'
import { TimelineObjectCoreExt } from './timeline'

/** The type of the source layer, used to enable specific functions for special-type layers */
export enum SourceLayerType {
	UNKNOWN = 0,
	CAMERA = 1,
	VT = 2,
	REMOTE = 3,
	SCRIPT = 4,
	GRAPHICS = 5,
	SPLITS = 6,
	AUDIO = 7,
	// CAMERA_MOVEMENT = 8,
	// METADATA = 9,
	LOWER_THIRD = 10,
	LIVE_SPEAK = 11,
	TRANSITION = 13,
	// LIGHTS = 14,
	LOCAL = 15,
}

// export interface MetadataElement {
// 	_id: string
// 	key: string
// 	value: string
// 	source: string
// }

export interface BaseContent {
	timelineObjects: TimelineObjectCoreExt[]
	editable?: BaseEditableParameters

	sourceDuration?: number
	ignoreMediaObjectStatus?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseEditableParameters {
	// [key: string]: number | string | boolean | object | undefined | null
}

export interface VTEditableParameters extends BaseEditableParameters {
	editorialStart: number
	editorialDuration: number
}

export type SomeContent =
	| VTContent
	| CameraContent
	| RemoteContent
	| ScriptContent
	// | GraphicsContent
	| NoraContent
	| SplitsContent
	// | AudioContent
	// | LowerThirdContent
	| LiveSpeakContent
	| TransitionContent

export interface VTContent extends BaseContent {
	fileName: string
	path: string
	// proxyPath?: string
	// thumbnail?: string
	loop?: boolean
	// sourceDuration?: number
	// objectDuration?: number
	// metadata?: MetadataElement[]
	mediaFlowIds?: string[]
	seek?: number
	editable?: VTEditableParameters
	// ignoreMediaObjectStatus?: boolean
}

export interface CameraContent extends BaseContent {
	studioLabel: string
	switcherInput: number | string
	// thumbnail?: string
}

export interface RemoteContent extends BaseContent {
	studioLabel: string
	switcherInput: number | string
	// thumbnail?: string
}

export interface ScriptContent extends BaseContent {
	firstWords: string
	lastWords: string
	fullScript?: string
	// sourceDuration?: number
	lastModified?: Time | null
}

// export interface GraphicsContent extends BaseContent {
// 	fileName: string
// 	path: string
// 	thumbnail?: string
// 	templateData?: object
// 	metadata?: MetadataElement[]
// }

export interface NoraPayload {
	content: { [key: string]: unknown }
	manifest: string
	template: {
		event: string
		layer: string
		name: string
	}
	metadata?: {
		templateName: string | undefined
		templateVariant: string | undefined
	}
	changed?: Time
}

export interface NoraContent extends BaseContent {
	payload: NoraPayload
	externalPayload: any
	previewRenderer: string
}

export interface SplitsContentBoxProperties {
	type: SourceLayerType
	studioLabel: string
	switcherInput: number | string
	/** Geometry information for a given box item in the Split. X,Y are relative to center of Box, Scale is 0...1, where 1 is Full-Screen */
	geometry?: {
		x: number
		y: number
		scale: number
		crop?: {
			left: number
			top: number
			right: number
			bottom: number
		}
	}
}
export type SplitsContentBoxContent = Omit<
	VTContent | CameraContent | RemoteContent | NoraContent, // | GraphicsContent,
	'timelineObjects'
>
export interface SplitsContent extends BaseContent {
	/** Array of contents, 0 is towards the rear */
	boxSourceConfiguration: (SplitsContentBoxContent & SplitsContentBoxProperties)[]
}

export interface AudioContent extends BaseContent {
	fileName: string
	path: string
	// proxyPath?: string
	loop?: boolean
	// sourceDuration: number
	// metadata?: MetadataElement[]
}

// export interface CameraMovementContent extends BaseContent {
// 	cameraConfiguration: any
// }

// export type LowerThirdContent = GraphicsContent
export type LiveSpeakContent = VTContent

export interface TransitionContent extends BaseContent {
	icon?: string
}
