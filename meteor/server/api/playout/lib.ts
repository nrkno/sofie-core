import * as _ from 'underscore'
import { DBRundown } from '../../../lib/collections/Rundowns'
import { Part, DBPart } from '../../../lib/collections/Parts'
import { clone, applyToArray } from '../../../lib/lib'
import { TimelineObjGeneric } from '../../../lib/collections/Timeline'
import { Segment, DBSegment } from '../../../lib/collections/Segments'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { TSR } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DbCacheReadCollection } from '../../cache/CacheCollection'

export const LOW_PRIO_DEFER_TIME = 40 // ms

export interface SelectNextPartResult {
	part: DBPart
	index: number
	consumesNextSegmentId?: boolean
}
export interface PartsAndSegments {
	segments: DBSegment[]
	parts: DBPart[]
}

function substituteObjectIds(
	rawEnable: TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[],
	idMap: { [oldId: string]: string | undefined }
) {
	const replaceIds = (str: string) => {
		return str.replace(/#([a-zA-Z0-9_]+)/g, (m) => {
			const id = m.substr(1, m.length - 1)
			return `#${idMap[id] || id}`
		})
	}

	const enable = clone<TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[]>(rawEnable)
	applyToArray(enable, (enable0) => {
		for (const key of _.keys(enable0)) {
			if (typeof enable0[key] === 'string') {
				enable0[key] = replaceIds(enable0[key])
			}
		}
	})

	return enable
}
export function prefixAllObjectIds<T extends TimelineObjGeneric>(
	objList: T[],
	prefix: string,
	ignoreOriginal?: boolean
): T[] {
	const getUpdatePrefixedId = (o: T) => {
		let id = o.id
		if (!ignoreOriginal) {
			if (!o.originalId) {
				o.originalId = o.id
			}
			id = o.originalId
		}
		return prefix + id
	}

	const idMap: { [oldId: string]: string | undefined } = {}
	_.each(objList, (o) => {
		idMap[o.id] = getUpdatePrefixedId(o)
	})

	return objList.map((rawObj) => {
		const obj = clone(rawObj)

		obj.id = getUpdatePrefixedId(obj)
		obj.enable = substituteObjectIds(obj.enable, idMap)

		if (typeof obj.inGroup === 'string') {
			obj.inGroup = idMap[obj.inGroup] || obj.inGroup
		}

		return obj
	})
}
