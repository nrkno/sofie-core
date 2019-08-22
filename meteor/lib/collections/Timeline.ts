import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time, Omit } from '../lib'
import { Meteor } from 'meteor/meteor'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'
import { Timeline as TimelineTypes, TSRTimelineObj, DeviceType } from 'timeline-state-resolver-types'
import * as _ from 'underscore'
import { logger } from '../logging'
import { createMongoCollection } from './lib'


export enum TimelineContentTypeOther {
	NOTHING = 'nothing',
	GROUP = 'group',
}

export interface TimelineObjGeneric extends TimelineObjectCoreExt {
	/** Unique _id (generally obj.studioId + '_' + obj.id) */
	_id: string
	/** Unique within a timeline (ie within a studio) */
	id: string
	/** Set when the id of the object is prefixed */
	originalId?: string

	/** Studio installation Id */
	studioId: string
	rundownId?: string

	objectType: TimelineObjType

	enable: TimelineTypes.TimelineEnable & { setFromNow?: boolean }

	/** The id of the group object this object is in  */
	inGroup?: string

	metadata?: {
		[key: string]: any
	}
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
	content: {
		deviceType: DeviceType.ABSTRACT
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
export interface TimelineObjGroup extends Omit<TimelineObjGeneric, 'content'> {
	content: {
		type: TimelineContentTypeOther.GROUP
	}
	children: TimelineObjGeneric[]
	isGroup: true
}
export type TimelineObjGroupRundown = TimelineObjGroup & TimelineObjRundown

export interface TimelineObjGroupPart extends TimelineObjGroupRundown {
	isPartGroup: true
}
export interface TimelineObjPartAbstract extends TimelineObjRundown { // used for sending callbacks
	content: {
		deviceType: DeviceType.ABSTRACT
		type: 'callback'
		callBack: 'partPlaybackStarted'
		callBackStopped: 'partPlaybackStopped'
		callBackData: {
			rundownId: string
			partId: string
		}
	}
}
export interface TimelineObjPieceAbstract extends TimelineObjRundown { // used for sending callbacks
	content: {
		deviceType: DeviceType.ABSTRACT
		type: 'callback'
		callBack: 'piecePlaybackStarted'
		callBackStopped: 'piecePlaybackStopped'
		callBackData: {
			rundownId: string,
			pieceId: string
		}
	}
}

export function getTimelineId (obj: TimelineObjGeneric): string
export function getTimelineId (studioId: string, id: string): string
export function getTimelineId (objOrStudioId: TimelineObjGeneric | string, id?: string): string {
	if (typeof objOrStudioId === 'string') {
		if (!objOrStudioId) throw new Meteor.Error(500, `Parameter studioId missing`)
		if (!id) throw new Meteor.Error(500, `Parameter id missing`)
		return objOrStudioId + '_' + id
	} else {
		const obj: TimelineObjGeneric = objOrStudioId
		if (!obj.id) {
			logger.debug(obj)
			throw new Meteor.Error(500, `TimelineObj missing id attribute`)
		}
		if (!obj.studioId) {
			logger.debug(obj)
			throw new Meteor.Error(500, `TimelineObj missing studioId attribute, id: "${obj.id}")`)
		}
		return obj.studioId + '_' + obj.id
	}
}
export function setTimelineId<T extends TimelineObjGeneric> (objs: Array<T>): Array<T> {
	return _.map(objs, obj => {
		obj._id = getTimelineId(obj)
		return obj
	})
}
export function fixTimelineId (obj: TimelineObjectCoreExt) {
	// Temporary workaround, to handle old _id:s in the db. We might want to add a warning in this, and later remove it.

	const o: any = obj
	if (o._id && !o.id) {
		logger.warn(`Fixed id of timelineObject with _id ${o._id}`)
		o.id = o._id
		delete o._id
	}
}

// export const Timeline = createMongoCollection<TimelineObj>('timeline')
export const Timeline: TransformedCollection<TimelineObjGeneric, TimelineObjGeneric>
	= createMongoCollection<TimelineObjGeneric>('timeline')
registerCollection('Timeline', Timeline)
Meteor.startup(() => {
	if (Meteor.isServer) {
		Timeline._ensureIndex({
			studioId: 1,
			rundownId: 1,
		})
	}
})
