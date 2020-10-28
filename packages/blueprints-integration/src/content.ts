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
	CAMERA_MOVEMENT = 8,
	METADATA = 9,
	LOWER_THIRD = 10,
	LIVE_SPEAK = 11,
	MIC = 12,
	TRANSITION = 13,
	LIGHTS = 14,
}

export interface MetadataElement {
	_id: string
	key: string
	value: string
	source: string
}

export interface BaseContent {
	[key: string]: TimelineObjectCoreExt[] | number | string | boolean | object | undefined | null
	timelineObjects?: TimelineObjectCoreExt[]
	// We leave it up to the blueprints to ensure that each all of their types implement this interface but more strongly typed
	// If we were to enforce it here then this lib and core would need to be aware of every type
	editable?: BaseEditableParameters
}

export interface BaseEditableParameters {
	[key: string]: number | string | boolean | object | undefined | null
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
	| GraphicsContent
	| NoraContent
	| SplitsContent
	| AudioContent
	| CameraMovementContent
	| LowerThirdContent
	| LiveSpeakContent
	| MicContent
	| TransitionContent

export interface VTContent extends BaseContent {
	fileName: string
	path: string
	firstWords: string
	lastWords: string
	proxyPath?: string
	thumbnail?: string
	loop?: boolean
	sourceDuration?: number
	objectDuration?: number
	metadata?: MetadataElement[]
	timelineObjects: TimelineObjectCoreExt[]
	mediaFlowIds?: string[]
	seek?: number
	editable?: VTEditableParameters
	ignoreMediaObjectStatus?: boolean
}

export interface CameraContent extends BaseContent {
	studioLabel: string
	switcherInput: number | string
	thumbnail?: string
	timelineObjects: TimelineObjectCoreExt[]
}

export interface RemoteContent extends BaseContent {
	studioLabel: string
	switcherInput: number | string
	thumbnail?: string
	timelineObjects: TimelineObjectCoreExt[]
}

export interface ScriptContent extends BaseContent {
	firstWords: string
	lastWords: string
	fullScript?: string
	sourceDuration?: number
	lastModified?: Time | null
}

export interface GraphicsContent extends BaseContent {
	fileName: string
	path: string
	thumbnail?: string
	templateData?: object
	metadata?: MetadataElement[]
	timelineObjects: TimelineObjectCoreExt[]
}

export interface NoraPayload {
	content: { [key: string]: string | number | object }
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
	timelineObjects: TimelineObjectCoreExt[]
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
	VTContent | CameraContent | RemoteContent | GraphicsContent,
	'timelineObjects'
>
export interface SplitsContent extends BaseContent {
	/** Array of contents, 0 is towards the rear */
	boxSourceConfiguration: (SplitsContentBoxContent & SplitsContentBoxProperties)[]
	timelineObjects: TimelineObjectCoreExt[]
}

export interface AudioContent extends BaseContent {
	fileName: string
	path: string
	proxyPath?: string
	loop?: boolean
	sourceDuration: number
	metadata?: MetadataElement[]
	timelineObjects: TimelineObjectCoreExt[]
}

export interface CameraMovementContent extends BaseContent {
	cameraConfiguration: any
	timelineObjects: TimelineObjectCoreExt[]
}

// tslint:disable-next-line: no-empty-interface
export interface LowerThirdContent extends GraphicsContent {}

// tslint:disable-next-line: no-empty-interface
export interface LiveSpeakContent extends VTContent {}

export interface MicContent extends ScriptContent {
	mixConfiguration: any
	timelineObjects: any
}

export interface TransitionContent extends BaseContent {
	icon?: string
}
