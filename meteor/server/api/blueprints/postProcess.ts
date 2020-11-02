import { Piece, PieceId } from '../../../lib/collections/Pieces'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { protectString, unprotectString, Omit, literal } from '../../../lib/lib'
import {
	TimelineObjGeneric,
	TimelineObjRundown,
	TimelineObjType,
	TimelineEnableExt,
} from '../../../lib/collections/Timeline'
import { Studio } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import {
	TimelineObjectCoreExt,
	IBlueprintPiece,
	IBlueprintAdLibPiece,
	RundownContext,
	TSR,
	IBlueprintActionManifest,
	NotesContext as INotesContext,
} from 'tv-automation-sofie-blueprints-integration'
import { RundownAPI } from '../../../lib/api/rundown'
import { BucketAdLib } from '../../../lib/collections/BucketAdlibs'
import { ShowStyleContext, NotesContext } from './context'
import { RundownImportVersions } from '../../../lib/collections/Rundowns'
import { BlueprintId } from '../../../lib/collections/Blueprints'
import { PartId } from '../../../lib/collections/Parts'
import { BucketId } from '../../../lib/collections/Buckets'
import { AdLibAction } from '../../../lib/collections/AdLibActions'
import { RundownBaselineAdLibAction } from '../../../lib/collections/RundownBaselineAdLibActions'
import { RundownId } from '../../../lib/collections/Rundowns'
import { prefixAllObjectIds } from '../playout/lib'
import { SegmentId } from '../../../lib/collections/Segments'
import { profiler } from '../profiler'

export function postProcessPieces(
	innerContext: ShowStyleContext,
	pieces: IBlueprintPiece[],
	blueprintId: BlueprintId,
	rundownId: RundownId,
	segmentId: SegmentId,
	partId: PartId,
	allowNowForPiece?: boolean,
	prefixAllTimelineObjects?: boolean,
	setInvalid?: boolean
): Piece[] {
	const span = profiler.startSpan('blueprints.postProcess.postProcessPieces')

	let i = 0
	let timelineUniqueIds: { [id: string]: true } = {}
	const processedPieces = pieces.map((itemOrig: IBlueprintPiece) => {
		let piece: Piece = {
			...(itemOrig as Omit<IBlueprintPiece, 'continuesRefId'>),
			_id: protectString(innerContext.getHashId(`${blueprintId}_${partId}_piece_${i++}`)),
			continuesRefId: protectString(itemOrig.continuesRefId),
			startRundownId: rundownId,
			startSegmentId: segmentId,
			startPartId: partId,
			status: RundownAPI.PieceStatusCode.UNKNOWN,
			invalid: setInvalid ?? false,
		}

		if (!piece.externalId && !piece.isTransition)
			throw new Meteor.Error(
				400,
				`Error in blueprint "${blueprintId}" externalId not set for piece in ${partId}! ("${innerContext.unhashId(
					unprotectString(piece._id)
				)}")`
			)
		if (!allowNowForPiece && piece.enable.start === 'now')
			throw new Meteor.Error(
				400,
				`Error in blueprint "${blueprintId}" piece cannot have a start of 'now' in ${partId}! ("${innerContext.unhashId(
					unprotectString(piece._id)
				)}")`
			)

		if (piece.content?.timelineObjects) {
			piece.content.timelineObjects = postProcessTimelineObjects(
				innerContext,
				piece._id,
				blueprintId,
				piece.content.timelineObjects,
				prefixAllTimelineObjects || false,
				timelineUniqueIds
			)
		}

		return piece
	})

	span?.end()
	return processedPieces
}

function isNow(enable: TSR.TSRTimelineObjBase['enable']): boolean {
	if (Array.isArray(enable)) {
		return !!enable.find((e) => e.start === 'now')
	} else {
		return enable.start === 'now'
	}
}

export function postProcessTimelineObjects(
	innerContext: INotesContext,
	pieceId: PieceId,
	blueprintId: BlueprintId,
	timelineObjects: TSR.TSRTimelineObjBase[],
	prefixAllTimelineObjects: boolean,
	timelineUniqueIds: { [key: string]: boolean }
) {
	let newObjs = timelineObjects.map((o: TimelineObjectCoreExt, i) => {
		const obj: TimelineObjRundown = {
			...o,
			id: o.id,
			objectType: TimelineObjType.RUNDOWN,
		}

		if (!obj.id) obj.id = innerContext.getHashId(pieceId + '_' + i++)
		if (isNow(obj.enable))
			throw new Meteor.Error(
				400,
				`Error in blueprint "${blueprintId}" timelineObjs cannot have a start of 'now'! ("${innerContext.unhashId(
					unprotectString(pieceId)
				)}")`
			)

		if (timelineUniqueIds[obj.id])
			throw new Meteor.Error(
				400,
				`Error in blueprint "${blueprintId}": ids of timelineObjs must be unique! ("${innerContext.unhashId(
					obj.id
				)}")`
			)
		timelineUniqueIds[obj.id] = true

		return obj
	})

	if (prefixAllTimelineObjects) {
		newObjs = prefixAllObjectIds(newObjs, unprotectString(pieceId) + '_')
	}

	return newObjs
}

export function postProcessAdLibPieces(
	innerContext: RundownContext,
	adLibPieces: IBlueprintAdLibPiece[],
	blueprintId: BlueprintId,
	partId?: PartId
): AdLibPiece[] {
	const span = profiler.startSpan('blueprints.postProcess.postProcessAdLibPieces')

	let i = 0
	let timelineUniqueIds: { [id: string]: true } = {}

	const processedPieces = adLibPieces.map((itemOrig) => {
		const piece: AdLibPiece = {
			...itemOrig,
			_id: protectString(innerContext.getHashId(`${blueprintId}_${partId}_adlib_piece_${i++}`)),
			rundownId: protectString(innerContext.rundown._id),
			partId: partId,
			status: RundownAPI.PieceStatusCode.UNKNOWN,
		}

		if (!piece.externalId)
			throw new Meteor.Error(
				400,
				`Error in blueprint "${blueprintId}" externalId not set for piece in ' + partId + '! ("${innerContext.unhashId(
					unprotectString(piece._id)
				)}")`
			)

		if (piece.content && piece.content.timelineObjects) {
			piece.content.timelineObjects = postProcessTimelineObjects(
				innerContext,
				piece._id,
				blueprintId,
				piece.content.timelineObjects,
				false,
				timelineUniqueIds
			)
		}

		return piece
	})

	span?.end()
	return processedPieces
}

export function postProcessGlobalAdLibActions(
	innerContext: RundownContext,
	adlibActions: IBlueprintActionManifest[],
	blueprintId: BlueprintId
): RundownBaselineAdLibAction[] {
	return adlibActions.map((action, i) =>
		literal<RundownBaselineAdLibAction>({
			...action,
			actionId: action.actionId,
			_id: protectString(innerContext.getHashId(`${blueprintId}_global_adlib_action_${i}`)),
			rundownId: protectString(innerContext.rundownId),
			partId: undefined,
		})
	)
}

export function postProcessAdLibActions(
	innerContext: RundownContext,
	adlibActions: IBlueprintActionManifest[],
	blueprintId: BlueprintId,
	partId: PartId
): AdLibAction[] {
	return adlibActions.map((action, i) =>
		literal<AdLibAction>({
			...action,
			actionId: action.actionId,
			_id: protectString(innerContext.getHashId(`${blueprintId}_${partId}_adlib_action_${i}`)),
			rundownId: protectString(innerContext.rundownId),
			partId: partId,
		})
	)
}

export function postProcessStudioBaselineObjects(studio: Studio, objs: TSR.TSRTimelineObjBase[]): TimelineObjRundown[] {
	const timelineUniqueIds: { [id: string]: true } = {}
	const context = new NotesContext('studio', 'studio', false)
	return postProcessTimelineObjects(
		context,
		protectString('studio'),
		studio.blueprintId!,
		objs,
		false,
		timelineUniqueIds
	)
}

export function postProcessRundownBaselineItems(
	innerContext: RundownContext,
	blueprintId: BlueprintId,
	baselineItems: TSR.TSRTimelineObjBase[]
): TimelineObjGeneric[] {
	const timelineUniqueIds: { [id: string]: true } = {}
	return postProcessTimelineObjects(
		innerContext,
		protectString('baseline'),
		blueprintId,
		baselineItems,
		false,
		timelineUniqueIds
	)
}

export function postProcessBucketAdLib(
	innerContext: ShowStyleContext,
	itemOrig: IBlueprintAdLibPiece,
	blueprintId: BlueprintId,
	bucketId: BucketId,
	rank: number | undefined,
	importVersions: RundownImportVersions
): BucketAdLib {
	let i = 0
	let partsUniqueIds: { [id: string]: true } = {}
	let timelineUniqueIds: { [id: string]: true } = {}
	let piece: BucketAdLib = {
		...itemOrig,
		_id: protectString(
			innerContext.getHashId(
				`${innerContext.showStyleVariantId}_${innerContext.studioId}_${bucketId}_bucket_adlib_${itemOrig.externalId}`
			)
		),
		studioId: innerContext.studioId,
		showStyleVariantId: innerContext.showStyleVariantId,
		bucketId,
		importVersions,
		_rank: rank || itemOrig._rank,
	}

	if (!piece.externalId)
		throw new Meteor.Error(
			400,
			`Error in blueprint "${blueprintId}" externalId not set for piece in ' + partId + '! ("${innerContext.unhashId(
				unprotectString(piece._id)
			)}")`
		)

	if (partsUniqueIds[unprotectString(piece._id)])
		throw new Meteor.Error(
			400,
			`Error in blueprint "${blueprintId}" ids of pieces must be unique! ("${innerContext.unhashId(
				unprotectString(piece._id)
			)}")`
		)
	partsUniqueIds[unprotectString(piece._id)] = true

	if (piece.content && piece.content.timelineObjects) {
		piece.content.timelineObjects = postProcessTimelineObjects(
			innerContext,
			piece._id,
			blueprintId,
			piece.content.timelineObjects,
			false,
			timelineUniqueIds
		)
	}

	return piece
}
