import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	TimelineObjGeneric,
	TimelineObjRundown,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import {
	IBlueprintActionManifest,
	IBlueprintAdLibPiece,
	IBlueprintPiece,
	TimelineObjectCoreExt,
	TSR,
	PieceLifespan,
	IBlueprintPieceType,
} from '@sofie-automation/blueprints-integration'
import { ShowStyleContext } from './context'
import {
	AdLibActionId,
	BlueprintId,
	BucketId,
	PartId,
	PieceId,
	RundownId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../jobs'
import {
	EmptyPieceTimelineObjectsBlob,
	Piece,
	PieceStatusCode,
	serializePieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { getHash, literal, omit } from '@sofie-automation/corelib/dist/lib'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { RundownImportVersions } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import {
	interpollateTranslation,
	processAdLibActionITranslatableMessages,
} from '@sofie-automation/corelib/dist/TranslatableMessage'
import { setDefaultIdOnExpectedPackages } from '../ingest/expectedPackages'
import { logger } from '../logging'

function getIdHash(docType: string, usedIds: Map<string, number>, uniqueId: string): string {
	const count = usedIds.get(uniqueId)
	if (count === undefined) {
		usedIds.set(uniqueId, 0)

		return getHash(uniqueId)
	} else {
		logger.debug(`Duplicate ${docType} uniqueId "${uniqueId}"`)
		usedIds.set(uniqueId, count + 1)
		return getHash(`${uniqueId}_${count}`)
	}
}

/**
 *
 * allowNowForPiece: allows the pieces to use a start of 'now', should be true for adlibs and false for ingest
 * prefixAllTimelineObjects: Add a prefix to the timeline object ids, to ensure duplicate ids don't occur when inserting a copy of a piece
 */
export function postProcessPieces(
	context: JobContext,
	pieces: Array<IBlueprintPiece>,
	blueprintId: BlueprintId,
	rundownId: RundownId,
	segmentId: SegmentId,
	partId: PartId,
	allowNowForPiece: boolean,
	setInvalid?: boolean
): Piece[] {
	const span = context.startSpan('blueprints.postProcess.postProcessPieces')

	const uniqueIds = new Map<string, number>()
	const timelineUniqueIds = new Set<string>()

	const processedPieces = pieces.map((orgPiece: IBlueprintPiece) => {
		if (!orgPiece.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for adlib piece in ${partId}! ("${orgPiece.name}")`
			)

		const docId = getIdHash(
			'Piece',
			uniqueIds,
			`${rundownId}_${blueprintId}_${partId}_piece_${orgPiece.sourceLayerId}_${orgPiece.externalId}`
		)

		const piece: Piece = {
			pieceType: IBlueprintPieceType.Normal,

			...(orgPiece as Omit<IBlueprintPiece, 'continuesRefId'>),
			content: omit(orgPiece.content, 'timelineObjects'),

			_id: protectString(docId),
			continuesRefId: protectString(orgPiece.continuesRefId),
			startRundownId: rundownId,
			startSegmentId: segmentId,
			startPartId: partId,
			status: PieceStatusCode.UNKNOWN,
			invalid: setInvalid ?? false,
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		}

		if (piece.pieceType !== IBlueprintPieceType.Normal) {
			// transition pieces must not be infinite, lets enforce that
			piece.lifespan = PieceLifespan.WithinPart
		}
		if (piece.extendOnHold) {
			// HOLD pieces must not be infinite, as they become that when being held
			piece.lifespan = PieceLifespan.WithinPart
		}

		if (!allowNowForPiece && piece.enable.start === 'now')
			throw new Error(
				`Error in blueprint "${blueprintId}" piece cannot have a start of 'now' in ${partId}! ("${piece.name}")`
			)

		const timelineObjects = postProcessTimelineObjects(
			piece._id,
			blueprintId,
			orgPiece.content.timelineObjects,
			timelineUniqueIds
		)
		piece.timelineObjectsString = serializePieceTimelineObjectsBlob(timelineObjects)

		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(piece.expectedPackages)

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
	pieceId: PieceId,
	blueprintId: BlueprintId,
	timelineObjects: TSR.TSRTimelineObjBase[],
	timelineUniqueIds: Set<string> = new Set<string>()
): TimelineObjRundown[] {
	return timelineObjects.map((o: TimelineObjectCoreExt, i) => {
		const obj: TimelineObjRundown = {
			...o,
			id: o.id,
			objectType: TimelineObjType.RUNDOWN,
		}

		if (!obj.id) obj.id = getHash(pieceId + '_' + i++)
		if (isNow(obj.enable))
			throw new Error(
				`Error in blueprint "${blueprintId}" timelineObjs cannot have a start of 'now'! ("${obj.id}")`
			)

		if (timelineUniqueIds.has(obj.id))
			throw new Error(`Error in blueprint "${blueprintId}": ids of timelineObjs must be unique! ("${obj.id}")`)
		timelineUniqueIds.add(obj.id)

		return obj
	})
}

export function postProcessAdLibPieces(
	context: JobContext,
	blueprintId: BlueprintId,
	rundownId: RundownId,
	partId: PartId | undefined,
	adLibPieces: Array<IBlueprintAdLibPiece>
): AdLibPiece[] {
	const span = context.startSpan('blueprints.postProcess.postProcessAdLibPieces')

	const uniqueIds = new Map<string, number>()
	const timelineUniqueIds = new Set<string>()

	const processedPieces = adLibPieces.map((orgAdlib) => {
		if (!orgAdlib.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for adlib piece in ${partId}! ("${orgAdlib.name}")`
			)

		const docId = getIdHash(
			'AdlibPiece',
			uniqueIds,
			`${rundownId}_${blueprintId}_${partId}_adlib_piece_${orgAdlib.sourceLayerId}_${orgAdlib.externalId}`
		)

		const piece: AdLibPiece = {
			...orgAdlib,
			content: omit(orgAdlib.content, 'timelineObjects'),
			_id: protectString(docId),
			rundownId: rundownId,
			partId: partId,
			status: PieceStatusCode.UNKNOWN,
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		}

		if (!piece.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for piece in ${partId}! ("${piece.name}")`
			)

		const timelineObjects = postProcessTimelineObjects(
			piece._id,
			blueprintId,
			orgAdlib.content.timelineObjects,
			timelineUniqueIds
		)
		piece.timelineObjectsString = serializePieceTimelineObjectsBlob(timelineObjects)

		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(piece.expectedPackages)

		return piece
	})

	span?.end()
	return processedPieces
}

export function postProcessGlobalAdLibActions(
	blueprintId: BlueprintId,
	rundownId: RundownId,
	adlibActions: IBlueprintActionManifest[]
): RundownBaselineAdLibAction[] {
	const uniqueIds = new Map<string, number>()

	return adlibActions.map((action) => {
		if (!action.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for baseline adlib action! ("${
					action.actionId
				}": "${interpollateTranslation(action.display.label.key, action.display.label.args)}")`
			)

		const docId = getIdHash(
			'RundownAdlibAction',
			uniqueIds,
			`${rundownId}_${blueprintId}_global_adlib_action_${action.externalId}`
		)

		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(action.expectedPackages)

		return literal<RundownBaselineAdLibAction>({
			...action,
			actionId: action.actionId,
			_id: protectString(docId),
			rundownId: rundownId,
			partId: undefined,
			...processAdLibActionITranslatableMessages(action, blueprintId),
		})
	})
}

export function postProcessAdLibActions(
	blueprintId: BlueprintId,
	rundownId: RundownId,
	partId: PartId,
	adlibActions: IBlueprintActionManifest[]
): AdLibAction[] {
	const uniqueIds = new Map<string, number>()

	return adlibActions.map((action) => {
		if (!action.externalId)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for adlib action in ${partId}! ("${action.display.label}")`
			)

		const docId = getIdHash(
			'AdlibAction',
			uniqueIds,
			`${rundownId}_${blueprintId}_${partId}_adlib_action_${action.externalId}`
		)

		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(action.expectedPackages)

		return literal<AdLibAction>({
			...action,
			actionId: action.actionId,
			_id: protectString(docId),
			rundownId: rundownId,
			partId: partId,
			...processAdLibActionITranslatableMessages(action, blueprintId),
		})
	})
}

export function postProcessStudioBaselineObjects(
	studio: ReadonlyDeep<DBStudio>,
	objs: TSR.TSRTimelineObjBase[]
): TimelineObjRundown[] {
	return postProcessTimelineObjects(protectString('studio'), studio.blueprintId ?? protectString(''), objs)
}

export function postProcessRundownBaselineItems(
	blueprintId: BlueprintId,
	baselineItems: TSR.TSRTimelineObjBase[]
): TimelineObjGeneric[] {
	return postProcessTimelineObjects(protectString('baseline'), blueprintId, baselineItems)
}

export function postProcessBucketAdLib(
	innerContext: ShowStyleContext,
	itemOrig: IBlueprintAdLibPiece,
	externalId: string,
	blueprintId: BlueprintId,
	bucketId: BucketId,
	rank: number | undefined,
	importVersions: RundownImportVersions
): BucketAdLib {
	const id: PieceId = protectString(
		getHash(
			`${innerContext.showStyleCompound.showStyleVariantId}_${innerContext.studioIdProtected}_${bucketId}_bucket_adlib_${externalId}`
		)
	)
	const piece: BucketAdLib = {
		...itemOrig,
		content: omit(itemOrig.content, 'timelineObjects'),
		_id: id,
		externalId,
		studioId: innerContext.studioIdProtected,
		showStyleBaseId: innerContext.showStyleCompound._id,
		showStyleVariantId: innerContext.showStyleCompound.showStyleVariantId,
		bucketId,
		importVersions,
		_rank: rank || itemOrig._rank,
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(piece.expectedPackages)

	const timelineObjects = postProcessTimelineObjects(piece._id, blueprintId, itemOrig.content.timelineObjects)
	piece.timelineObjectsString = serializePieceTimelineObjectsBlob(timelineObjects)

	return piece
}

export function postProcessBucketAction(
	innerContext: ShowStyleContext,
	itemOrig: IBlueprintActionManifest,
	externalId: string,
	blueprintId: BlueprintId,
	bucketId: BucketId,
	rank: number | undefined,
	importVersions: RundownImportVersions
): BucketAdLibAction {
	const id: AdLibActionId = protectString(
		getHash(
			`${innerContext.showStyleCompound.showStyleVariantId}_${innerContext.studioIdProtected}_${bucketId}_bucket_adlib_${externalId}`
		)
	)
	const action: BucketAdLibAction = {
		...omit(itemOrig, 'partId'),
		_id: id,
		externalId,
		studioId: innerContext.studioIdProtected,
		showStyleBaseId: innerContext.showStyleCompound._id,
		showStyleVariantId: itemOrig.allVariants ? null : innerContext.showStyleCompound.showStyleVariantId,
		bucketId,
		importVersions,
		...processAdLibActionITranslatableMessages(itemOrig, blueprintId, rank),
	}

	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(action.expectedPackages)

	return action
}
