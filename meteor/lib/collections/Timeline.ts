import { Mongo } from 'meteor/mongo'

// import {} from 'superfly-timeline'
import { TimelineObject, ObjectId, TriggerType, TimelineKeyframe } from 'superfly-timeline'

import { ChannelFormat, Transition, Ease, Direction } from '../constants/casparcg'

// Note: The data structure is based on what works with the CasparCG-state library

export enum TimelineContentType {
	VIDEO = 'video',
	IP = 'ip',
	INPUT = 'input',
	TEMPLATE = 'template',
	ROUTE = 'route',
	RECORD = 'record',

	GROUP = 'group'
}

export interface TimelineTransition {
	type: Transition
	duration: number,
	easing: Ease,
	direction: Direction
}

export interface TimelineObj {
	_id: string
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
export interface TimelineObjCCGIP extends TimelineObj {
	content: {
		objects?: Array<TimelineObject>
		keyframes?: Array<TimelineKeyframe>
		type: TimelineContentType.IP
		transitions?: {
			inTransition?: TimelineTransition
			outTransition?: TimelineTransition
		}
		attributes: {
			uri: string
			videoFilter?: string
			audioFilter?: string
		}
	}
}
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

export const Timeline = new Mongo.Collection<TimelineObj>('timeline')
