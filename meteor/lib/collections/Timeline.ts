import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time, Omit, ProtectedString, protectString, isProtectedString } from '../lib'
import { Meteor } from 'meteor/meteor'
import { TimelineObjectCoreExt, TSR } from 'tv-automation-sofie-blueprints-integration'
import * as _ from 'underscore'
import { logger } from '../logging'
import { createMongoCollection } from './lib'
import { StudioId, ResultingMappingRoutes } from './Studios'
import { PartInstanceId } from './PartInstances'
import { PieceInstanceId } from './PieceInstances'
import { RundownPlaylistId } from './RundownPlaylists'
import { registerIndex } from '../database'

export enum TimelineContentTypeOther {
	NOTHING = 'nothing',
	GROUP = 'group',
}

/** A string, identifying a TimelineObj */
export type TimelineObjId = ProtectedString<'TimelineObjId'>

export type TimelineEnableExt = TSR.Timeline.TimelineEnable & { setFromNow?: boolean }

export interface TimelineObjGeneric extends TimelineObjectCoreExt {
	/** Unique _id (generally obj.studioId + '_' + obj.id) */
	_id: TimelineObjId
	/** Unique within a timeline (ie within a studio) */
	id: string
	/** Set when the id of the object is prefixed */
	originalId?: string

	/** Studio installation Id */
	studioId: StudioId

	objectType: TimelineObjType

	enable: TimelineEnableExt | TimelineEnableExt[]

	/** The id of the group object this object is in  */
	inGroup?: string
}
// export type TimelineObj = TimelineObjRundown | TimelineObjRecording | TimelineObjManual | TimelineObjStat

export enum TimelineObjType {
	/** Objects played in a rundown */
	RUNDOWN = 'rundown',
	/** Objects controlling recording */
	RECORDING = 'record',
	/** Objects controlling manual playback */
	MANUAL = 'manual',
}
export interface TimelineObjRundown extends TimelineObjGeneric {
	objectType: TimelineObjType.RUNDOWN
}
export interface TimelineObjRecording extends TimelineObjGeneric {
	objectType: TimelineObjType.RECORDING
}
export interface TimelineObjManual extends TimelineObjGeneric {
	objectType: TimelineObjType.MANUAL
}
export interface TimelineObjGroup extends Omit<TimelineObjGeneric, 'content'> {
	enable: TimelineEnableExt
	content: {
		type: TimelineContentTypeOther.GROUP
	}
	children: TimelineObjGeneric[]
	isGroup: true
}
export type TimelineObjGroupRundown = TimelineObjGroup & Omit<TimelineObjRundown, 'enable'>

export interface TimelineObjGroupPart extends TimelineObjGroupRundown {
	isPartGroup: true
}
export interface TimelineObjPartAbstract extends TimelineObjRundown {
	// used for sending callbacks
	content: {
		deviceType: TSR.DeviceType.ABSTRACT
		type: 'callback'
		callBack: 'partPlaybackStarted'
		callBackStopped: 'partPlaybackStopped'
		callBackData: {
			rundownPlaylistId: RundownPlaylistId
			partInstanceId: PartInstanceId
		}
	}
}
export interface TimelineObjPieceAbstract extends TimelineObjRundown {
	// used for sending callbacks
	content: {
		deviceType: TSR.DeviceType.ABSTRACT
		type: 'callback'
		callBack: 'piecePlaybackStarted'
		callBackStopped: 'piecePlaybackStopped'
		callBackData: {
			rundownPlaylistId: RundownPlaylistId
			pieceInstanceId: PieceInstanceId
			dynamicallyInserted?: boolean
		}
	}
}

export function getTimelineId(obj: TimelineObjGeneric): TimelineObjId
export function getTimelineId(studioId: StudioId, id: string): TimelineObjId
export function getTimelineId(objOrStudioId: TimelineObjGeneric | StudioId, id?: string): TimelineObjId {
	if (isProtectedString(objOrStudioId)) {
		if (!objOrStudioId) throw new Meteor.Error(500, `Parameter studioId missing`)
		if (!id) throw new Meteor.Error(500, `Parameter id missing`)
		return protectString(objOrStudioId + '_' + id)
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
		return protectString(obj.studioId + '_' + obj.id)
	}
}
export function setTimelineId<T extends TimelineObjGeneric>(objs: Array<T>): Array<T> {
	return _.map(objs, (obj) => {
		obj._id = getTimelineId(obj)
		return obj
	})
}

export function getRoutedTimeline(
	inputTimelineObjs: TimelineObjGeneric[],
	mappingRoutes: ResultingMappingRoutes
): TimelineObjGeneric[] {
	const outputTimelineObjs: TimelineObjGeneric[] = []

	_.each(inputTimelineObjs, (obj) => {
		const inputLayer = obj.layer + ''
		const routes = mappingRoutes[inputLayer]
		if (routes) {
			_.each(routes, (route, i) => {
				const routedObj: TimelineObjGeneric = {
					...obj,
					layer: route.outputMappedLayer,
				}
				if (i > 0) {
					// If there are multiple routes we must rename the ids, so that they stay unique.
					routedObj.id = `_${i}_${routedObj.id}`
					routedObj._id = getTimelineId(routedObj)
				}
				outputTimelineObjs.push(routedObj)
			})
		} else {
			// If no route is found at all, pass it through (backwards compatibility)
			outputTimelineObjs.push(obj)
		}
	})
	return outputTimelineObjs
}
export interface TimelineComplete {
	_id: StudioId
	timeline: Array<TimelineObjGeneric>
	updated: Time
}

// export const Timeline = createMongoCollection<TimelineObj>('timeline')
export const Timeline: TransformedCollection<TimelineComplete, TimelineComplete> = createMongoCollection<
	TimelineComplete
>('timeline')
registerCollection('Timeline', Timeline)

// Note: this index is always created by default, so it's not needed.
// registerIndex(Timeline, {
// 	_id: 1,
// })
