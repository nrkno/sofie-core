import { Mongo } from 'meteor/mongo'

import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'
import { Timeline as TimelineTypes } from 'timeline-state-resolver-types'

export enum TimelineContentTypeOther {
	NOTHING = 'nothing',
	GROUP = 'group',
}

export interface TimelineObj extends TimelineObjectCoreExt {
	_id: string
	id: '',

	/** Studio installation Id */
	siId: string
	/** Running Order Id */
	roId: string

	trigger: TimelineTypes.TimelineTrigger & {
		setFromNow?: boolean
	}

	inGroup?: string

	metadata?: {
		[key: string]: any
	}
	/** Only set to true for the "magic" statistic objects, used to trigger playout */
	statObject?: boolean
	/** Only set to true for the test recording objects, to persist outside of a rundown */
	recordingObject?: boolean
}

export interface TimelineObjGroup extends TimelineObj {
	content: {
		type: TimelineContentTypeOther.GROUP
		objects: Array<TimelineObj>
	}
	isGroup: true
}
export interface TimelineObjGroupSegmentLine extends TimelineObjGroup {
	isSegmentLineGroup: true
}
export interface TimelineObjSegmentLineAbstract extends TimelineObj { // used for sending callbacks
	slId?: string
}
export interface TimelineObjSegmentLineItemAbstract extends TimelineObj { // used for sending callbacks
	sliId?: string
}

// export const Timeline = new Mongo.Collection<TimelineObj>('timeline')
export const Timeline: TransformedCollection<TimelineObj, TimelineObj>
	= new Mongo.Collection<TimelineObj>('timeline')
registerCollection('Timeline', Timeline)
Meteor.startup(() => {
	if (Meteor.isServer) {
		Timeline._ensureIndex({
			siId: 1,
			roId: 1,
		})
	}
})
