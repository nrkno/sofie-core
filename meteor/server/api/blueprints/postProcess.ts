import { PieceId } from '../../../lib/collections/Pieces'
import { protectString, unprotectString, omit } from '../../../lib/lib'
import { TimelineObjRundown, TimelineObjType } from '../../../lib/collections/Timeline'
import { Meteor } from 'meteor/meteor'
import {
	TimelineObjectCoreExt,
	IBlueprintAdLibPiece,
	TSR,
	IBlueprintActionManifest,
	ICommonContext,
} from '@sofie-automation/blueprints-integration'
import { BucketAdLib } from '../../../lib/collections/BucketAdlibs'
import { RundownImportVersions } from '../../../lib/collections/Rundowns'
import { BlueprintId } from '../../../lib/collections/Blueprints'
import { BucketId } from '../../../lib/collections/Buckets'
import { prefixAllObjectIds } from '../playout/lib'
import { BucketAdLibAction } from '../../../lib/collections/BucketAdlibActions'
import { ShowStyleContext } from './context'
import { processAdLibActionITranslatableMessages } from '../../../lib/api/TranslatableMessage'

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

		if (timelineUniqueIds.has(obj.id))
			throw new Meteor.Error(
				400,
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
