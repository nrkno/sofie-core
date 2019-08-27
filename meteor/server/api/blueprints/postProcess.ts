import * as _ from 'underscore'
import { Piece } from '../../../lib/collections/Pieces'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { extendMandadory, getHash } from '../../../lib/lib'
import {
	TimelineObjGeneric,
	TimelineObjRundown,
	TimelineObjType
} from '../../../lib/collections/Timeline'
import { Studio } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import {
	TimelineObjectCoreExt,
	IBlueprintPiece,
	IBlueprintAdLibPiece,
	RundownContext as IRundownContext,
	RundownContext,
} from 'tv-automation-sofie-blueprints-integration'
import { RundownAPI } from '../../../lib/api/rundown'
import { Timeline, TSRTimelineObjBase } from 'timeline-state-resolver-types'

export function postProcessPieces (playlistId: string, innerContext: IRundownContext, pieces: IBlueprintPiece[], blueprintId: string, partId: string): Piece[] {
	let i = 0
	let partsUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(pieces), (itemOrig: IBlueprintPiece) => {
		let piece: Piece = {
			rundownId: innerContext.rundown._id,
			partId: partId,
			status: RundownAPI.PieceStatusCode.UNKNOWN,
			...itemOrig
		}

		if (!piece._id) piece._id = innerContext.getHashId(`${blueprintId}_${partId}_piece_${i++}`)
		if (!piece.externalId && !piece.isTransition) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": externalId not set for piece in ' + partId + '! ("' + innerContext.unhashId(piece._id) + '")')

		if (partsUniqueIds[piece._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of pieces must be unique! ("' + innerContext.unhashId(piece._id) + '")')
		partsUniqueIds[piece._id] = true

		if (piece.content && piece.content.timelineObjects) {
			let timelineUniqueIds: { [id: string]: true } = {}
			piece.content.timelineObjects = _.map(_.compact(piece.content.timelineObjects), (o: TimelineObjectCoreExt) => {
				const obj = convertTimelineObject(playlistId, innerContext.rundown._id, o)

				if (!obj.id) obj.id = innerContext.getHashId(piece._id + '_' + (i++))

				if (timelineUniqueIds[obj.id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(obj.id) + '")')
				timelineUniqueIds[obj.id] = true

				return obj
			})
		}

		return piece
	})
}

export function postProcessAdLibPieces (playlistId: string, innerContext: IRundownContext, adLibPieces: IBlueprintAdLibPiece[], blueprintId: string, partId?: string): AdLibPiece[] {
	let i = 0
	let partsUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(adLibPieces), (itemOrig: IBlueprintAdLibPiece) => {
		let piece: AdLibPiece = {
			_id: innerContext.getHashId(`${blueprintId}_${partId}_adlib_piece_${i++}`),
			rundownId: innerContext.rundown._id,
			partId: partId,
			status: RundownAPI.PieceStatusCode.UNKNOWN,
			// trigger: undefined,
			disabled: false,
			...itemOrig
		}

		if (!piece.externalId) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": externalId not set for piece in ' + partId + '! ("' + innerContext.unhashId(piece._id) + '")')

		if (partsUniqueIds[piece._id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of pieces must be unique! ("' + innerContext.unhashId(piece._id) + '")')
		partsUniqueIds[piece._id] = true

		if (piece.content && piece.content.timelineObjects) {
			let timelineUniqueIds: { [id: string]: true } = {}
			piece.content.timelineObjects = _.map(_.compact(piece.content.timelineObjects), (o: TimelineObjectCoreExt) => {
				const obj = convertTimelineObject(playlistId, innerContext.rundown._id, o)

				if (!obj.id) obj.id = innerContext.getHashId(piece._id + '_adlib_' + (i++))

				if (timelineUniqueIds[obj.id]) throw new Meteor.Error(400, 'Error in blueprint "' + blueprintId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(obj.id) + '")')
				timelineUniqueIds[obj.id] = true

				return obj
			})
		}

		return piece
	})
}

export function postProcessStudioBaselineObjects (studio: Studio, objs: TSRTimelineObjBase[]): TimelineObjRundown[] {
	let timelineUniqueIds: { [id: string]: true } = {}
	return _.map(objs, (o, i) => {
		const obj = convertTimelineObject('', '', o)

		if (!obj.id) obj.id = getHash('baseline_' + (i++))

		if (timelineUniqueIds[obj.id]) throw new Meteor.Error(400, 'Error in blueprint "' + studio.blueprintId + '": ids of timelineObjs must be unique! ("' + obj.id + '")')
		timelineUniqueIds[obj.id] = true

		return obj
	})
}

function convertTimelineObject (playlistId: string, rundownId: string, o: TimelineObjectCoreExt): TimelineObjRundown {
	let rundown: TimelineObjRundown = extendMandadory<TimelineObjectCoreExt, TimelineObjRundown>(o, {
		id: o.id,
		_id: '', // set later
		studioId: '', // set later
		playlistId,
		rundownId,
		objectType: TimelineObjType.RUNDOWN,
	})

	return rundown
}

export function postProcessPartBaselineItems (playlistId: string, innerContext: RundownContext, baselineItems: Timeline.TimelineObject[]): TimelineObjGeneric[] {
	let i = 0
	let timelineUniqueIds: { [id: string]: true } = {}

	return _.map(_.compact(baselineItems), (o: TimelineObjGeneric): TimelineObjGeneric => {
		const obj: TimelineObjGeneric = convertTimelineObject(playlistId, innerContext.rundown._id, o)

		if (!obj.id) obj.id = innerContext.getHashId('baseline_' + (i++))

		if (timelineUniqueIds[obj.id]) throw new Meteor.Error(400, 'Error in baseline blueprint: ids of timelineObjs must be unique! ("' + innerContext.unhashId(obj.id) + '")')
		timelineUniqueIds[obj.id] = true
		return obj
	})
}
