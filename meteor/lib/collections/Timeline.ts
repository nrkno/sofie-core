import { Mongo } from 'meteor/mongo'

// import {} from 'superfly-timeline'
import { TimelineObject, ObjectId, TriggerType, TimelineKeyframe } from 'superfly-timeline'

import { ChannelFormat, Transition, Ease, Direction } from '../constants/casparcg'
import { StudioInstallations } from './StudioInstallations'
import { FindOptions, Selector, TransformedCollection } from './typings'

// Note: The data structure is based on what works with the CasparCG-state library

export enum TimelineContentType {
	VIDEO = 'video',
	IP = 'ip',
	INPUT = 'input',
	TEMPLATE = 'template',
	ROUTE = 'route',
	RECORD = 'record',
	AUDIO = 'audio',
	GROUP = 'group',
	LAWO_AUDIO_SOURCE = 'lawo_audio_source',
	ATEM_ME = 'atem_me',
	ATEM_DSK = 'atem_dsk',
	ATEM_AUX = 'atem_aux',
	ATEM_SSRC = 'atem_ssrc'
}
export declare namespace Atem_Enums {
	enum TransitionStyle {
		MIX = 0,
		DIP = 1,
		WIPE = 2,
		DVE = 3,
		STING = 4,
		CUT = 5,
	}

	enum SourceIndex {
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
	deviceId: string

	trigger: {
		type: TriggerType;
		value: number | string;
	}
	duration: number
	LLayer: string | number
	content: {
		// objects?: Array<TimelineObject>
		// keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType
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
}
export interface TimelineObjGroup extends TimelineObj {
	content: {
		type: TimelineContentType.GROUP
		objects: Array<TimelineObject>
	}
	isGroup: true
}
export interface TimelineObjGroupSegmentLine extends TimelineObjGroup {
	isSegmentLineGroup: true
}
export interface TimelineObjCCGVideo extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType.VIDEO
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
// 	}
// }
export interface TimelineObjCCGInput extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType.INPUT
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
	}
}
export interface TimelineObjCCGTemplate extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType.TEMPLATE
		transitions?: {
			inTransition?: TimelineTransition
			outTransition?: TimelineTransition
		}
		attributes: {
			name: string,
			data?: any, // free to do whatever inside the object, so long as the template likes it
			useStopCommand: boolean // whether to use CG stop or CLEAR layer
		}
	}
}
export interface TimelineObjCCGRoute extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType.ROUTE
		transitions?: {
			inTransition?: TimelineTransition
			outTransition?: TimelineTransition
		}
		attributes: {
			channel?: number,
			layer?; number,
			LLayer?: string // uses mappings to route, overrides channel/layer parameters.
		}
	}
}
export interface TimelineObjCCGRecord extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType.ROUTE
		attributes: {
			file?: string,
			encoderOptions: string
		}
	}
}
export interface TimelineObjLawoSource extends TimelineObj {
	content: {
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType.LAWO_AUDIO_SOURCE
		transitions?: {
			inTransition?: TimelineTransition
		}
		attributes: {
			db: number
		}
	}
}
export interface TimelineObjAtemME extends TimelineObj {
	content: {
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType.ATEM_ME
		transitions?: {
			inTransition?: TimelineTransition
		}
		attributes: {
			input: number,
			transition: Atem_Enums.TransitionStyle
		}
	}
}
export interface TimelineObjAtemDSK extends TimelineObj {
	content: {
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType.ATEM_DSK
		transitions?: {
			inTransition?: TimelineTransition
		}
		attributes: {
			onAir: boolean,
			fillSource: number,
			keySource: number
		}
	}
}
export interface TimelineObjAtemAUX extends TimelineObj {
	content: {
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType.ATEM_AUX
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
		type: TimelineContentType.ATEM_SSRC
		transitions?: {
			inTransition?: TimelineTransition
		}
		attributes: {
			boxes: Array<SuperSourceBox>,
			artfillSource: number
		}
	}
}

// export const Timeline = new Mongo.Collection<TimelineObj>('timeline')
export const Timeline: TransformedCollection<TimelineObj, TimelineObj>
	= new Mongo.Collection<TimelineObj>('timeline')
