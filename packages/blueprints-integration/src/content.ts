import { Time } from './common'
import { TSR, TimelineObjectCoreExt } from './timeline'
import { SourceLayerType } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'

export type WithTimeline<T extends BaseContent> = T & {
	timelineObjects: TimelineObjectCoreExt<TSR.TSRTimelineContent>[]
}

export interface BaseContent {
	editable?: BaseEditableParameters

	sourceDuration?: number
	ignoreMediaObjectStatus?: boolean
	ignoreBlackFrames?: boolean
	ignoreFreezeFrame?: boolean
	ignoreAudioFormat?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseEditableParameters {}

export interface VTEditableParameters extends BaseEditableParameters {
	editorialStart: number
	editorialDuration: number
}

/** @todo Should all this be deprecated and replaced by expectedPackages altogether? */
export type SomeContent =
	| VTContent
	| CameraContent
	| RemoteContent
	| ScriptContent
	| NoraContent
	| SplitsContent
	| LiveSpeakContent
	| TransitionContent
	| GraphicsContent
	| UnknownContent
	| EvsContent

export type UnknownContent = BaseContent

export interface VTContent extends BaseContent {
	fileName: string
	path: string
	loop?: boolean
	/** Frame that media manager should grab for thumbnail preview */
	previewFrame?: number
	mediaFlowIds?: string[]
	seek?: number
	/** Duration of extra content past sourceDuration. Not planned to play back but present on the media and playable. */
	postrollDuration?: number
	editable?: VTEditableParameters
}

export interface GraphicsContent extends BaseContent {
	fileName: string
	path: string
	mediaFlowIds?: string[]
	thumbnail?: string
	templateData?: Record<string, any>
}

export interface CameraContent extends BaseContent {
	studioLabel: string
	switcherInput: number | string
}

export interface RemoteContent extends BaseContent {
	studioLabel: string
	switcherInput: number | string
}

/** Content description for the EVS variant of a LOCAL source */
export interface EvsContent extends BaseContent {
	studioLabel: string
	/** Switcher input for the EVS channel */
	switcherInput: number | string
	/** Name of the EVS channel as used in the studio */
	channelName: string
	/** Color code used to represent the EVS channel in 24 bit hex format (fx ff0000) */
	color?: string
}

export interface ScriptContent extends BaseContent {
	firstWords: string
	lastWords: string
	fullScript?: string
	comment?: string
	lastModified?: Time | null
}

/** Data describing a Nora template's step attributes */
export interface NoraPayloadStepData {
	/** the step to move to - used when sending commands to nora */
	to?: number | 'next'
	/** the current step (which you are moving from) - provided by nora */
	from?: number
	/** Enable/disable step. This is usually provided by the template it self, but can be overwritten by providing the value. */
	enabled?: boolean
	/** -1 means unknown/infinite value of steps available, positive values are literal - provided by nora */
	total?: number
	/** if true only forward linear advances are allowed, if false you can jump around */
	orderLocked?: boolean
	/** if true the graphics will start at the first step again if given a next command when on the last. If false it will stay on the last step */
	repeat?: boolean
}

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
	step?: NoraPayloadStepData
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
export type SplitsContentBoxContent = VTContent | CameraContent | RemoteContent | NoraContent | GraphicsContent
export interface SplitsContent extends BaseContent {
	/** Array of contents, 0 is towards the rear */
	boxSourceConfiguration: (SplitsContentBoxContent & SplitsContentBoxProperties)[]
}

export interface AudioContent extends BaseContent {
	fileName: string
	path: string
	loop?: boolean
}

// export type LowerThirdContent = GraphicsContent
export type LiveSpeakContent = VTContent

export interface TransitionContent extends BaseContent {
	icon?: string
	preview?: string
}

export type SomeTransitionContent = VTContent | TransitionContent

export { SourceLayerType }
