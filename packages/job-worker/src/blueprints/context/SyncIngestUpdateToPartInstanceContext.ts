import { PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { normalizeArrayToMapFunc, omit } from '@sofie-automation/corelib/dist/lib'
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
import { PlayoutExpectedPackagesModel } from '../../playout/model/PlayoutExpectedPackagesModel'

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
		private readonly expectedPackages: PlayoutExpectedPackagesModel,
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

		this._proposedPieceInstances = normalizeArrayToMapFunc(proposedPieceInstances, (p) => p._id)
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
		const postProcessed = modifiedPiece
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
					this.partInstance.partInstance.rundownId,
					this.partInstance.partInstance.segmentId,
					this.partInstance.partInstance.part._id,
					this.playStatus === 'current'
			  )
			: null

		if (postProcessed) {
			this.expectedPackages.ensurePackagesExistMap(
				this.partInstance.partInstance.rundownId,
				postProcessed.expectedPackages
			)
		}

		const newPieceInstance: ReadonlyDeep<PieceInstance> = {
			...proposedPieceInstance,
			piece: postProcessed?.docs[0] ?? proposedPieceInstance.piece,
		}
		this.partInstance.mergeOrInsertPieceInstance(newPieceInstance)

		return convertPieceInstanceToBlueprints(
			newPieceInstance,
			this.expectedPackages.getPackagesForPieceInstance(newPieceInstance.rundownId, newPieceInstance._id)
		)
	}

	insertPieceInstance(piece0: IBlueprintPiece): IBlueprintPieceInstance {
		const trimmedPiece: IBlueprintPiece = _.pick(piece0, IBlueprintPieceObjectsSampleKeys)

		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

		const processedPieces = postProcessPieces(
			this._context,
			[trimmedPiece],
			this.showStyleCompound.blueprintId,
			this.partInstance.partInstance.rundownId,
			this.partInstance.partInstance.segmentId,
			this.partInstance.partInstance.part._id,
			this.playStatus === 'current'
		)
		const piece = processedPieces.docs[0]

		this.expectedPackages.ensurePackagesExistMap(
			this.partInstance.partInstance.rundownId,
			processedPieces.expectedPackages
		)

		const newPieceInstance = this.partInstance.insertPlannedPiece(piece)

		return convertPieceInstanceToBlueprints(
			newPieceInstance.pieceInstance,
			this.expectedPackages.getPackagesForPieceInstance(
				newPieceInstance.pieceInstance.rundownId,
				newPieceInstance.pieceInstance._id
			)
		)
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
		if (pieceInstance.pieceInstance.partInstanceId !== this.partInstance.partInstance._id) {
			throw new Error(`PieceInstance "${pieceInstanceId}" does not belong to the current PartInstance`)
		}

		let timelineObjectsString: PieceTimelineObjectsBlob | undefined
		if (trimmedPiece.content?.timelineObjects) {
			timelineObjectsString = serializePieceTimelineObjectsBlob(
				postProcessTimelineObjects(
					pieceInstance.pieceInstance.piece._id,
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
		if (trimmedPiece.expectedPackages) {
			this.expectedPackages.ensurePackagesExist(
				pieceInstance.pieceInstance.rundownId,
				trimmedPiece.expectedPackages
			)

			this.expectedPackages.setPieceInstanceReferenceToPackages(
				pieceInstance.pieceInstance.rundownId,
				pieceInstance.pieceInstance.partInstanceId,
				pieceInstance.pieceInstance._id,
				pieceInstance.pieceInstance.piece.expectedPackages.map((p) => p.expectedPackageId)
			)
		}

		return convertPieceInstanceToBlueprints(
			pieceInstance.pieceInstance,
			this.expectedPackages.getPackagesForPieceInstance(
				pieceInstance.pieceInstance.rundownId,
				pieceInstance.pieceInstance._id
			)
		)
	}
	updatePartInstance(updatePart: Partial<IBlueprintMutatablePart>): IBlueprintPartInstance {
		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

		// for autoNext, the new expectedDuration cannot be shorter than the time a part has been on-air for
		if (updatePart.expectedDuration && (updatePart.autoNext ?? this.partInstance.partInstance.part.autoNext)) {
			const onAir = this.partInstance.partInstance.timings?.reportedStartedPlayback
			const minTime = Date.now() - (onAir ?? 0) + EXPECTED_INGEST_TO_PLAYOUT_TIME
			if (onAir && minTime > updatePart.expectedDuration) {
				updatePart.expectedDuration = minTime
			}
		}

		if (!this.partInstance.updatePartProps(updatePart)) {
			throw new Error(`Cannot update PartInstance. Some valid properties must be defined`)
		}

		return convertPartInstanceToBlueprints(this.partInstance.partInstance)
	}

	removePartInstance(): void {
		if (this.playStatus !== 'next') throw new Error(`Only the 'next' PartInstance can be removed`)

		this.partInstance = null
	}

	removePieceInstances(...pieceInstanceIds: string[]): string[] {
		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

		const rawPieceInstanceIdSet = new Set(protectStringArray(pieceInstanceIds))
		const pieceInstances = this.partInstance.pieceInstances.filter((p) =>
			rawPieceInstanceIdSet.has(p.pieceInstance._id)
		)

		const pieceInstanceIdsToRemove = pieceInstances.map((p) => p.pieceInstance._id)

		for (const id of pieceInstanceIdsToRemove) {
			this.partInstance.removePieceInstance(id)
		}

		return unprotectStringArray(pieceInstanceIdsToRemove)
	}
}
