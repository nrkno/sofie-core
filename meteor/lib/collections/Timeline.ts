import { Mongo } from 'meteor/mongo'

// import {} from 'superfly-timeline'
import { TimelineObject, ObjectId, TriggerType, TimelineKeyframe } from 'superfly-timeline'

import { ChannelFormat, Transition, Ease, Direction } from '../constants/casparcg'
import { StudioInstallations } from './StudioInstallations'
import { FindOptions, Selector, TransformedCollection } from '../typings/meteor'
import { Mixer } from '../typings/casparcg-state'

// Note: The data structure is based on what works with the state libraries, such as

export type TimelineContentTypeAny =
	TimelineContentTypeOther |
	TimelineContentTypeCasparCg |
	TimelineContentTypeLawo |
	TimelineContentTypeAtem |
	TimelineContentTypeHttp

export enum TimelineContentTypeOther {
	NOTHING = 'nothing',
	GROUP = 'group',
}
export enum TimelineContentTypeCasparCg { //  CasparCG-state/TSR
	VIDEO = 'video', // later to be deprecated & replaced by MEDIA
	AUDIO = 'audio', // later to be deprecated & replaced by MEDIA
	MEDIA = 'media',
	IP = 'ip',
	INPUT = 'input',
	TEMPLATE = 'template',
	HTMLPAGE = 'htmlpage',
	ROUTE = 'route',
	RECORD = 'record'
}
export enum TimelineContentTypeLawo { // lawo-state
	LAWO = 'lawo'
}
export enum TimelineContentTypeAtem { //  Atem-state
	ME = 'me',
	DSK = 'dsk',
	AUX = 'aux',
	SSRC = 'ssrc',
	MEDIAPLAYER = 'mp'
}
export enum TimelineContentTypeHttp {
	POST = 'post'
}
export namespace Atem_Enums {
	export enum TransitionStyle {
		MIX = 0,
		DIP = 1,
		WIPE = 2,
		DVE = 3,
		STING = 4,
		CUT = 5,
	}

	export enum SourceIndex {
		Blk = 0,
		Bars = 1000,
		Col1 = 2001,
		Col2 = 2002,
		MP1 = 3010,
		MP1K = 3011,
		MP2 = 3020,
		MP2K = 3021,
		SSrc = 6000,
		Cfd1 = 7001,
		Cfd2 = 7002,
		Aux1 = 8001,
		Aux2 = 8002,
		Aux3 = 8003,
		Aux4 = 8004,
		Aux5 = 8005,
		Aux6 = 8006,
		Prg1 = 10010,
		Prv1 = 10011,
		Prg2 = 10020,
		Prv2 = 10021
	}
}

export interface TimelineTransition {
	type: Transition
	duration: number,
	easing: Ease,
	direction: Direction
}

export type SuperSourceBox = {
	enabled: boolean,
	source?: number,
	x?: number,
	y?: number,
	size?: number,
	cropped?: boolean,
	cropTop?: number,
	cropBottom?: number,
	cropLeft?: number,
	cropRight?: number
}

export interface TimelineObj {
	_id: string
	/** Studio installation Id */
	siId: string
	/** Running Order Id */
	roId: string
	/** Id of the Device */
	deviceId: Array<string>

	trigger: {
		type: TriggerType;
		value: number | string;
		setFromNow?: boolean;
	}
	duration: number
	LLayer: string | number
	content: {
		// objects?: Array<TimelineObject>
		// keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeAny
		// transitions?: {
		// 	inTransition?: TimelineTransition
		// 	outTransition?: TimelineTransition
		// }
	}
	classes?: Array<string>
	disabled?: boolean
	isGroup?: boolean
	inGroup?: string
	repeating?: boolean
	priority?: number
	externalFunction?: string
	metadata?: {
		[key: string]: any
	}
}
export interface TimelineObjGroup extends TimelineObj {
	content: {
		type: TimelineContentTypeOther.GROUP
		objects: Array<TimelineObject>
	}
	isGroup: true
}
export interface TimelineObjGroupSegmentLine extends TimelineObjGroup {
	isSegmentLineGroup: true
}
export interface TimelineObjAbstract extends TimelineObj { // used for sending callbacks
	slId?: string
}
export interface TimelineObjCCGVideo extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeCasparCg.VIDEO
		transitions?: {
			inTransition?: TimelineTransition
			outTransition?: TimelineTransition
		}
		attributes: {
			file: string
			loop?: boolean
			seek?: number  // note that seeking while looping is not supported by cg-state currently.
			videoFilter?: string
			audioFilter?: string
		}
		mixer?: Mixer
	}
}
// export interface TimelineObjCCGIP extends TimelineObj {
// 	content: {
// 		objects?: Array<TimelineObject>
// 		keyframes?: Array<TimelineKeyframe>
// 		type: TimelineContentType.IP
// 		transitions?: {
// 			inTransition?: TimelineTransition
// 			outTransition?: TimelineTransition
// 		}
// 		attributes: {
// 			uri: string
// 			videoFilter?: string
// 			audioFilter?: string
// 		}
// 		mixer?: Mixer
// 	}
// }
export interface TimelineObjCCGInput extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeCasparCg.INPUT
		transitions?: {
			inTransition?: TimelineTransition
			outTransition?: TimelineTransition
		}
		attributes: {
			type: string // 'decklink',
			device: number,
			deviceFormat: ChannelFormat // '1080i5000',
			videoFilter?: string
			audioFilter?: string
		}
		mixer?: Mixer
	}
}
export interface TimelineObjCCGHTMLPage extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeCasparCg.HTMLPAGE
		transitions?: {
			inTransition?: TimelineTransition
			outTransition?: TimelineTransition
		}
		attributes: {
			url: string,
		}
		mixer?: Mixer
	}
}
export interface TimelineObjCCGTemplate extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeCasparCg.TEMPLATE
		transitions?: {
			inTransition?: TimelineTransition
			outTransition?: TimelineTransition
		}
		attributes: {
			type?: 'html' | 'flash'
			name: string,
			data?: any, // free to do whatever inside the object, so long as the template likes it
			useStopCommand: boolean // whether to use CG stop or CLEAR layer
		}
		mixer?: Mixer
	}
}
export interface TimelineObjCCGRoute extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeCasparCg.ROUTE
		transitions?: {
			inTransition?: TimelineTransition
			outTransition?: TimelineTransition
		}
		attributes: {
			channel?: number,
			layer?; number,
			LLayer?: string // uses mappings to route, overrides channel/layer parameters.
		}
		mixer?: Mixer
	}
}
export interface TimelineObjCCGRecord extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeCasparCg.ROUTE
		attributes: {
			file?: string,
			encoderOptions: string
		}
	}
}
export enum EmberPlusValueType {
	REAL 	= 'real',
	INT 	= 'int',
	BOOLEAN = 'boolean',
	STRING 	= 'string'
}
export type EmberPlusValueBase = boolean | number | string
export interface EmberPlusValue {
	type: EmberPlusValueType,
	value: EmberPlusValueBase
}
export interface EmberPlusValueReal extends EmberPlusValue {
	type: EmberPlusValueType.REAL,
	value: number
}
export interface EmberPlusValueInt extends EmberPlusValue {
	type: EmberPlusValueType.INT,
	value: number
}
export interface EmberPlusValueBoolean extends EmberPlusValue {
	type: EmberPlusValueType.BOOLEAN,
	value: boolean
}
export interface EmberPlusValueString extends EmberPlusValue {
	type: EmberPlusValueType.STRING,
	value: string
}
export type LawoStateNodeAttr = EmberPlusValue | LawoStateNodeAttrTransition
export interface LawoStateNodeAttrTransition {
	value: EmberPlusValue
	transitionDuration?: number
}
export interface TimelineObjLawo extends TimelineObj {
	content: {
		type: TimelineContentTypeLawo,
		value: LawoStateNodeAttr
	}
}
export interface TimelineObjAtemME extends TimelineObj {
	content: {
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeAtem.ME
		transitions?: {
			inTransition?: TimelineTransition
		}
		attributes: { // Casparcg-state
			input?: number,
			transition?: Atem_Enums.TransitionStyle,

			// programInput?: number; // programInput exists, bu I don't think we should use it /Nyman
			previewInput?: number;
			inTransition?: boolean;
			transitionPreview?: boolean;
			transitionPosition?: number;
			// transitionFramesLeft?: number;
			// fadeToBlack?: boolean;
			// numberOfKeyers?: number;
			// transitionProperties?: AtemTransitionProperties;

			transitionSettings?: {
				// dip
				// DVE
				// mix
				// stinger
				wipe: {
					rate?: number,
					pattern?: number,
					borderWidth?: number,
					borderInput?: number,
					symmetry?: number,
					borderSoftness?: number,
					xPosition?: number,
					yPosition?: number,
					reverseDirection?: boolean,
					flipFlop?: boolean,
				}
			}
		}
	}
}
export interface TimelineObjAtemDSK extends TimelineObj {
	content: {
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeAtem.DSK
		transitions?: {
			inTransition?: TimelineTransition
		}
		attributes: {
			onAir: boolean,
			sources?: {
				fillSource: number,
				cutSource: number
			},
			properties?: {
				tie?: boolean,
				rate?: number,
				preMultiply?: boolean,
				clip?: number,
				gain?: number,
				invert?: boolean,
				mask?: {
					enabled: boolean,
					top?: number,
					bottom?: number,
					left?: number,
					right?: number
				}
			}
		}
	}
}
export interface TimelineObjAtemAUX extends TimelineObj {
	content: {
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeAtem.AUX
		transitions?: {
			inTransition?: TimelineTransition
		}
		attributes: {
			input: number,
		}
	}
}
export interface TimelineObjAtemSsrc extends TimelineObj {
	content: {
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeAtem.SSRC
		transitions?: {
			inTransition?: TimelineTransition
		}
		attributes: {
			boxes: Array<SuperSourceBox>,
			// artfillSource: number @todo not supported by atem-connection yet
		}
	}
}
export interface TimelineObjHTTPPost extends TimelineObj {
	content: {
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentTypeHttp.POST
		url: string
		params: {[key: string]: number | string}
	}
}

// export const Timeline = new Mongo.Collection<TimelineObj>('timeline')
export const Timeline: TransformedCollection<TimelineObj, TimelineObj>
	= new Mongo.Collection<TimelineObj>('timeline')
