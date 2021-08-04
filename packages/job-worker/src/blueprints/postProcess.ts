import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	TimelineObjGeneric,
	TimelineObjRundown,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import {
	IBlueprintActionManifest,
	IBlueprintAdLibPiece,
	IBlueprintPiece,
	ICommonContext,
	IShowStyleContext,
	TimelineObjectCoreExt,
	TSR,
} from '@sofie-automation/blueprints-integration'
import { CommonContext, ShowStyleContext } from './context'
import { prefixAllObjectIds } from '../playout/lib'
import {
	BlueprintId,
	BucketId,
	PartId,
	PieceId,
	RundownId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../jobs'
import { Piece, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { ArrayElement, ITranslatableMessage, literal, omit } from '@sofie-automation/corelib/dist/lib'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { RundownImportVersions } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'

/**
 *
 * allowNowForPiece: allows the pieces to use a start of 'now', should be true for adlibs and false for ingest
 * prefixAllTimelineObjects: Add a prefix to the timeline object ids, to ensure duplicate ids don't occur when inserting a copy of a piece
 */
export function postProcessPieces(
	context: JobContext,
	innerContext: IShowStyleContext,
	pieces: IBlueprintPiece[],
	blueprintId: BlueprintId,
	rundownId: RundownId,
	segmentId: SegmentId,
	partId: PartId,
	allowNowForPiece?: boolean,
	prefixAllTimelineObjects?: boolean,
	setInvalid?: boolean
): Piece[] {
	const span = context.startSpan('blueprints.postProcess.postProcessPieces')

	const externalIds = new Map<string, number>()
	const timelineUniqueIds = new Set<string>()

	const processedPieces = pieces.map((orgPiece: IBlueprintPiece) => {
		const i = externalIds.get(orgPiece.externalId) ?? 0
		externalIds.set(orgPiece.externalId, i + 1)
		const piece: Piece = {
			...(orgPiece as Omit<IBlueprintPiece, 'continuesRefId'>),
			_id: protectString(innerContext.getHashId(`${blueprintId}_${partId}_piece_${orgPiece.externalId}_${i}`)),
			continuesRefId: protectString(orgPiece.continuesRefId),
			startRundownId: rundownId,
			startSegmentId: segmentId,
			startPartId: partId,
			status: PieceStatusCode.UNKNOWN,
			invalid: setInvalid ?? false,
		}

		if (!piece.externalId && !piece.isTransition)
			throw new Error(
				`Error in blueprint "${blueprintId}" externalId not set for piece in ${partId}! ("${innerContext.unhashId(
					unprotectString(piece._id)
				)}")`
			)
		if (!allowNowForPiece && piece.enable.start === 'now')
			throw new Error(
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
	innerContext: ICommonContext,
	pieceId: PieceId,
	blueprintId: BlueprintId,
	timelineObjects: TSR.TSRTimelineObjBase[],
	prefixAllTimelineObjects: boolean, // TODO: remove, default to true?
	timelineUniqueIds: Set<string> = new Set<string>()
): TimelineObjRundown[] {
	let newObjs = timelineObjects.map((o: TimelineObjectCoreExt, i) => {
		const obj: TimelineObjRundown = {
			...o,
			id: o.id,
			objectType: TimelineObjType.RUNDOWN,
		}

		if (!obj.id) obj.id = innerContext.getHashId(pieceId + '_' + i++)
		if (isNow(obj.enable))
			throw new Error(
				`Error in blueprint "${blueprintId}" timelineObjs cannot have a start of 'now'! ("${innerContext.unhashId(
					unprotectString(pieceId)
				)}")`
			)

		if (timelineUniqueIds.has(obj.id))
			throw new Error(
				`Error in blueprint "${blueprintId}": ids of timelineObjs must be unique! ("${innerContext.unhashId(
					obj.id
				)}")`
			)
		timelineUniqueIds.add(obj.id)

		return obj
	})

	if (prefixAllTimelineObjects) {
		newObjs = prefixAllObjectIds(newObjs, unprotectString(pieceId) + '_')
	}

	return newObjs
}

export function postProcessAdLibPieces(
	context: JobContext,
	innerContext: ICommonContext,
	blueprintId: BlueprintId,
	rundownId: RundownId,
	partId: PartId | undefined,
	adLibPieces: IBlueprintAdLibPiece[]
): AdLibPiece[] {
	const span = context.startSpan('blueprints.postProcess.postProcessAdLibPieces')

	const externalIds = new Map<string, number>()
	const timelineUniqueIds = new Set<string>()

	const processedPieces = adLibPieces.map((orgAdlib) => {
		const i = externalIds.get(orgAdlib.externalId) ?? 0
		externalIds.set(orgAdlib.externalId, i + 1)

		const piece: AdLibPiece = {
			...orgAdlib,
			_id: protectString(
				innerContext.getHashId(`${blueprintId}_${partId}_adlib_piece_${orgAdlib.externalId}_${i}`)
			),
			rundownId: rundownId,
			partId: partId,
			status: PieceStatusCode.UNKNOWN,
		}

		if (!piece.externalId)
			throw new Error(
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
	context: JobContext,
	innerContext: ICommonContext,
	blueprintId: BlueprintId,
	rundownId: RundownId,
	adlibActions: IBlueprintActionManifest[]
): RundownBaselineAdLibAction[] {
	return adlibActions.map((action, i) =>
		literal<RundownBaselineAdLibAction>({
			...action,
			actionId: action.actionId,
			_id: protectString(innerContext.getHashId(`${blueprintId}_global_adlib_action_${i}`)),
			rundownId: rundownId,
			partId: undefined,
			...processAdLibActionITranslatableMessages(action, blueprintId),
		})
	)
}

export function postProcessAdLibActions(
	context: JobContext,
	innerContext: ICommonContext,
	blueprintId: BlueprintId,
	rundownId: RundownId,
	partId: PartId,
	adlibActions: IBlueprintActionManifest[]
): AdLibAction[] {
	return adlibActions.map((action, i) =>
		literal<AdLibAction>({
			...action,
			actionId: action.actionId,
			_id: protectString(innerContext.getHashId(`${blueprintId}_${partId}_adlib_action_${i}`)),
			rundownId: rundownId,
			partId: partId,
			...processAdLibActionITranslatableMessages(action, blueprintId),
		})
	)
}

/**
 * A utility function to add namespaces to ITranslatableMessages found in AdLib Actions
 *
 * @export
 * @template K
 * @template T
 * @param {T} itemOrig
 * @param {BlueprintId} blueprintId
 * @param {number} [rank]
 * @return {*}  {(Pick<K, 'display' | 'triggerModes'>)}
 */
function processAdLibActionITranslatableMessages<
	K extends {
		display: IBlueprintActionManifest['display'] & {
			label: ITranslatableMessage
			triggerLabel?: ITranslatableMessage
			description?: ITranslatableMessage
		}
		triggerModes?: (ArrayElement<IBlueprintActionManifest['triggerModes']> & {
			display: ArrayElement<IBlueprintActionManifest['triggerModes']>['display'] & {
				label: ITranslatableMessage
				description?: ITranslatableMessage
			}
		})[]
	},
	T extends IBlueprintActionManifest
>(itemOrig: T, blueprintId: BlueprintId, rank?: number): Pick<K, 'display' | 'triggerModes'> {
	return {
		display: {
			...itemOrig.display,
			_rank: rank ?? itemOrig.display._rank,
			label: {
				...itemOrig.display.label,
				namespaces: [unprotectString(blueprintId)],
			},
			triggerLabel: itemOrig.display.triggerLabel && {
				...itemOrig.display.triggerLabel,
				namespaces: [unprotectString(blueprintId)],
			},
			description: itemOrig.display.description && {
				...itemOrig.display.description,
				namespaces: [unprotectString(blueprintId)],
			},
		},
		triggerModes:
			itemOrig.triggerModes &&
			itemOrig.triggerModes.map(
				(triggerMode): ArrayElement<AdLibAction['triggerModes']> => ({
					...triggerMode,
					display: {
						...triggerMode.display,
						label: {
							...triggerMode.display.label,
							namespaces: [unprotectString(blueprintId)],
						},
						description: triggerMode.display.description && {
							...triggerMode.display.description,
							namespaces: [unprotectString(blueprintId)],
						},
					},
				})
			),
	}
}

export function postProcessStudioBaselineObjects(
	studio: ReadonlyDeep<DBStudio>,
	objs: TSR.TSRTimelineObjBase[]
): TimelineObjRundown[] {
	const context = new CommonContext({ identifier: 'studio', name: 'studio' })
	return postProcessTimelineObjects(context, protectString('studio'), studio.blueprintId!, objs, false)
}

export function postProcessRundownBaselineItems(
	innerContext: ICommonContext,
	blueprintId: BlueprintId,
	baselineItems: TSR.TSRTimelineObjBase[]
): TimelineObjGeneric[] {
	return postProcessTimelineObjects(innerContext, protectString('baseline'), blueprintId, baselineItems, false)
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
	const piece: BucketAdLib = {
		...itemOrig,
		_id: protectString(
			innerContext.getHashId(
				`${innerContext.showStyleCompound.showStyleVariantId}_${innerContext.studioIdProtected}_${bucketId}_bucket_adlib_${externalId}`
			)
		),
		externalId,
		studioId: innerContext.studioIdProtected,
		showStyleVariantId: innerContext.showStyleCompound.showStyleVariantId,
		bucketId,
		importVersions,
		_rank: rank || itemOrig._rank,
	}

	if (piece.content && piece.content.timelineObjects) {
		piece.content.timelineObjects = postProcessTimelineObjects(
			innerContext,
			piece._id,
			blueprintId,
			piece.content.timelineObjects,
			false
		)
	}

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
	const action: BucketAdLibAction = {
		...omit(itemOrig, 'partId'),
		_id: protectString(
			innerContext.getHashId(
				`${innerContext.showStyleCompound.showStyleVariantId}_${innerContext.studioIdProtected}_${bucketId}_bucket_adlib_${externalId}`
			)
		),
		externalId,
		studioId: innerContext.studioIdProtected,
		showStyleVariantId: innerContext.showStyleCompound.showStyleVariantId,
		bucketId,
		importVersions,
		...processAdLibActionITranslatableMessages(itemOrig, blueprintId, rank),
	}

	return action
}
