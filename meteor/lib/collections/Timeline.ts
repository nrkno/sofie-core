import { Mongo } from 'meteor/mongo'

import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time } from '../lib'
import { Meteor } from 'meteor/meteor'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'
import { Timeline as TimelineTypes } from 'timeline-state-resolver-types'

export enum TimelineContentTypeOther {
	NOTHING = 'nothing',
	GROUP = 'group',
}

export interface TimelineObjGeneric extends TimelineObjectCoreExt {
	_id: string
	// id: '',

	/** Studio installation Id */
	siId: string
	rundownId?: string

	objectType: TimelineObjType

	trigger: TimelineTypes.TimelineTrigger & {
		setFromNow?: boolean
	}

	inGroup?: string

	metadata?: {
		[key: string]: any
	}
	/** Only set to true for the "magic" statistic objects, used to trigger playout */
	statObject?: boolean

	/** Only set to true when an object is inserted by lookahead */
	isBackground?: boolean
	/** Set when an object is on a virtual layer for lookahead, so that it can be routed correctly */
	originalLLayer?: string | number
}
// export type TimelineObj = TimelineObjRundown | TimelineObjRecording | TimelineObjManual | TimelineObjStat

export enum TimelineObjType {
	/** Objects played in a rundown */
	RUNDOWN = 'rundown',
	/** Objects controlling recording */
	RECORDING = 'record',
	/** Objects controlling manual playback */
	MANUAL = 'manual',
	/** "Magic object", used to calculate a hash of the timeline */
	STAT = 'stat'
}
export interface TimelineObjStat extends TimelineObjGeneric {
	objectType: TimelineObjType.STAT
	/** To be deprecated later, it's enought to identify with TimelineObjType.STAT  */
	statObject: true
	content: {
		type: TimelineContentTypeOther.NOTHING
		modified: Time
		objCount: number
		objHash: string
	}
}
export interface TimelineObjRundown extends TimelineObjGeneric {
	objectType: TimelineObjType.RUNDOWN
	/** Rundown Id */
	rundownId: string
}
export interface TimelineObjRecording extends TimelineObjGeneric {
	objectType: TimelineObjType.RECORDING
}
export interface TimelineObjManual extends TimelineObjGeneric {
	objectType: TimelineObjType.MANUAL
}
export interface TimelineObjGroup extends TimelineObjGeneric {
	content: {
		type: TimelineContentTypeOther.GROUP
		objects: Array<TimelineObjGeneric>
	}
	isGroup: true
}
export type TimelineObjGroupRundown = TimelineObjGroup & TimelineObjRundown

export interface TimelineObjGroupSegmentLine extends TimelineObjGroupRundown {
	isSegmentLineGroup: true
}
export interface TimelineObjSegmentLineAbstract extends TimelineObjRundown { // used for sending callbacks
	slId?: string
}
export interface TimelineObjSegmentLineItemAbstract extends TimelineObjRundown { // used for sending callbacks
	sliId?: string
}

// export const Timeline = new Mongo.Collection<TimelineObj>('timeline')
export const Timeline: TransformedCollection<TimelineObjGeneric, TimelineObjGeneric>
	= new Mongo.Collection<TimelineObjGeneric>('timeline')
registerCollection('Timeline', Timeline)
Meteor.startup(() => {
	if (Meteor.isServer) {
		Timeline._ensureIndex({
			siId: 1,
			rundownId: 1,
		})
	}
})
