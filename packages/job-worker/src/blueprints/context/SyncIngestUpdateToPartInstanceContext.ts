import { PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { normalizeArrayToMap, omit } from '@sofie-automation/corelib/dist/lib'
import { protectString, protectStringArray, unprotectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { PlayoutPartInstanceModel } from '../../playout/model/PlayoutPartInstanceModel'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { ContextInfo } from './CommonContext'
import { RundownUserContext } from './RundownUserContext'
import {
	ISyncIngestUpdateToPartInstanceContext,
	IBlueprintPiece,
	IBlueprintPieceInstance,
	OmitId,
	IBlueprintMutatablePart,
	IBlueprintPartInstance,
	SomeContent,
	WithTimeline,
} from '@sofie-automation/blueprints-integration'
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
import {
	IBlueprintPieceObjectsSampleKeys,
	IBlueprintMutatablePartSampleKeys,
	convertPieceInstanceToBlueprints,
	convertPartInstanceToBlueprints,
} from './lib'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import {
	PieceTimelineObjectsBlob,
	serializePieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'
import { EXPECTED_INGEST_TO_PLAYOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'

export class SyncIngestUpdateToPartInstanceContext
	extends RundownUserContext
	implements ISyncIngestUpdateToPartInstanceContext
{
	private readonly _proposedPieceInstances: Map<PieceInstanceId, ReadonlyDeep<PieceInstance>>

	private partInstance: PlayoutPartInstanceModel | null

	constructor(
		private readonly _context: JobContext,
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>,
		partInstance: PlayoutPartInstanceModel,
		proposedPieceInstances: ReadonlyDeep<PieceInstance[]>,
		private playStatus: 'previous' | 'current' | 'next'
	) {
		super(
			contextInfo,
			studio,
			_context.getStudioBlueprintConfig(),
			showStyleCompound,
			_context.getShowStyleBlueprintConfig(showStyleCompound),
			rundown
		)

		this.partInstance = partInstance

		this._proposedPieceInstances = normalizeArrayToMap(proposedPieceInstances, '_id')
	}

	syncPieceInstance(
		pieceInstanceId: string,
		modifiedPiece?: Omit<IBlueprintPiece, 'lifespan'>
	): IBlueprintPieceInstance {
		const proposedPieceInstance = this._proposedPieceInstances.get(protectString(pieceInstanceId))
		if (!proposedPieceInstance) {
			throw new Error(`PieceInstance "${pieceInstanceId}" could not be found`)
		}

		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

		// filter the submission to the allowed ones
		const piece = modifiedPiece
			? postProcessPieces(
					this._context,
					[
						{
							...modifiedPiece,
							// Some properties arent allowed to be changed
							lifespan: proposedPieceInstance.piece.lifespan,
						},
					],
					this.showStyleCompound.blueprintId,
					this.partInstance.PartInstance.rundownId,
					this.partInstance.PartInstance.segmentId,
					this.partInstance.PartInstance.part._id,
					this.playStatus === 'current'
			  )[0]
			: proposedPieceInstance.piece

		const newPieceInstance: ReadonlyDeep<PieceInstance> = {
			...proposedPieceInstance,
			piece: piece,
		}
		this.partInstance.replacePieceInstance(newPieceInstance)

		return convertPieceInstanceToBlueprints(newPieceInstance)
	}

	insertPieceInstance(piece0: IBlueprintPiece): IBlueprintPieceInstance {
		const trimmedPiece: IBlueprintPiece = _.pick(piece0, IBlueprintPieceObjectsSampleKeys)

		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

		const piece = postProcessPieces(
			this._context,
			[trimmedPiece],
			this.showStyleCompound.blueprintId,
			this.partInstance.PartInstance.rundownId,
			this.partInstance.PartInstance.segmentId,
			this.partInstance.PartInstance.part._id,
			this.playStatus === 'current'
		)[0]

		const newPieceInstance = this.partInstance.insertPlannedPiece(piece)

		return convertPieceInstanceToBlueprints(newPieceInstance.PieceInstance)
	}
	updatePieceInstance(pieceInstanceId: string, updatedPiece: Partial<IBlueprintPiece>): IBlueprintPieceInstance {
		// filter the submission to the allowed ones
		const trimmedPiece: Partial<OmitId<IBlueprintPiece>> = _.pick(updatedPiece, IBlueprintPieceObjectsSampleKeys)
		if (Object.keys(trimmedPiece).length === 0) {
			throw new Error(`Cannot update PieceInstance "${pieceInstanceId}". Some valid properties must be defined`)
		}

		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

		const pieceInstance = this.partInstance.getPieceInstance(protectString(pieceInstanceId))
		if (!pieceInstance) {
			throw new Error(`PieceInstance "${pieceInstanceId}" could not be found`)
		}
		if (pieceInstance.PieceInstance.partInstanceId !== this.partInstance.PartInstance._id) {
			throw new Error(`PieceInstance "${pieceInstanceId}" does not belong to the current PartInstance`)
		}

		let timelineObjectsString: PieceTimelineObjectsBlob | undefined
		if (trimmedPiece.content?.timelineObjects) {
			timelineObjectsString = serializePieceTimelineObjectsBlob(
				postProcessTimelineObjects(
					pieceInstance.PieceInstance.piece._id,
					this.showStyleCompound.blueprintId,
					trimmedPiece.content.timelineObjects
				)
			)
			// This has been processed
			trimmedPiece.content = omit(trimmedPiece.content, 'timelineObjects') as WithTimeline<SomeContent>
		}

		pieceInstance.updatePieceProps(trimmedPiece as any) // TODO: this needs to be more type safe
		if (timelineObjectsString !== undefined) {
			pieceInstance.updatePieceProps({
				timelineObjectsString,
			})
		}

		return convertPieceInstanceToBlueprints(pieceInstance.PieceInstance)
	}
	updatePartInstance(updatePart: Partial<IBlueprintMutatablePart>): IBlueprintPartInstance {
		// filter the submission to the allowed ones
		const trimmedProps: Partial<IBlueprintMutatablePart> = _.pick(updatePart, [
			...IBlueprintMutatablePartSampleKeys,
		])
		if (Object.keys(trimmedProps).length === 0) {
			throw new Error(`Cannot update PartInstance. Some valid properties must be defined`)
		}

		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

		// for autoNext, the new expectedDuration cannot be shorter than the time a part has been on-air for
		if (trimmedProps.expectedDuration && (trimmedProps.autoNext ?? this.partInstance.PartInstance.part.autoNext)) {
			const onAir = this.partInstance.PartInstance.timings?.reportedStartedPlayback
			const minTime = Date.now() - (onAir ?? 0) + EXPECTED_INGEST_TO_PLAYOUT_TIME
			if (onAir && minTime > trimmedProps.expectedDuration) {
				trimmedProps.expectedDuration = minTime
			}
		}

		this.partInstance.updatePartProps(trimmedProps)

		return convertPartInstanceToBlueprints(this.partInstance.PartInstance)
	}

	removePartInstance(): void {
		if (this.playStatus !== 'next') throw new Error(`Only the 'next' PartInstance can be removed`)

		this.partInstance = null
	}

	removePieceInstances(...pieceInstanceIds: string[]): string[] {
		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

		const rawPieceInstanceIdSet = new Set(protectStringArray(pieceInstanceIds))
		const pieceInstances = this.partInstance.PieceInstances.filter((p) =>
			rawPieceInstanceIdSet.has(p.PieceInstance._id)
		)

		const pieceInstanceIdsToRemove = pieceInstances.map((p) => p.PieceInstance._id)

		for (const id of pieceInstanceIdsToRemove) {
			this.partInstance.removePieceInstance(id)
		}

		return unprotectStringArray(pieceInstanceIdsToRemove)
	}
}
