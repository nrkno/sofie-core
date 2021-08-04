import { PieceInstanceId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { INoteBase, NoteType } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance, wrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { clone, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import {
	protectString,
	unprotectObject,
	protectStringArray,
	unprotectStringArray,
} from '@sofie-automation/corelib/dist/protectedString'
import { DbCacheWriteCollection } from '../../cache/CacheCollection'
import { CacheForPlayout } from '../../playout/cache'
import { setupPieceInstanceInfiniteProperties } from '../../playout/pieces'
import { ReadonlyDeep } from 'type-fest'
import _ = require('underscore')
import { RundownContext, ContextInfo } from '.'
import {
	ISyncIngestUpdateToPartInstanceContext,
	IBlueprintPiece,
	IBlueprintPieceInstance,
	OmitId,
	IBlueprintMutatablePart,
	IBlueprintPartInstance,
} from '@sofie-automation/blueprints-integration'
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
import { IBlueprintPieceSampleKeys, IBlueprintMutatablePartSampleKeys } from './lib'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { JobContext } from '../../jobs'
import { WrappedShowStyleBlueprint } from '../cache'

export class SyncIngestUpdateToPartInstanceContext
	extends RundownContext
	implements ISyncIngestUpdateToPartInstanceContext
{
	private readonly _partInstanceCache: DbCacheWriteCollection<DBPartInstance>
	private readonly _pieceInstanceCache: DbCacheWriteCollection<PieceInstance>
	private readonly _proposedPieceInstances: Map<PieceInstanceId, PieceInstance>
	public readonly notes: INoteBase[] = []

	constructor(
		private readonly _context: JobContext,
		contextInfo: ContextInfo,
		private readonly playlistActivationId: RundownPlaylistActivationId,
		studio: ReadonlyDeep<DBStudio>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		showStyleBlueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
		rundown: ReadonlyDeep<DBRundown>,
		private partInstance: DBPartInstance,
		pieceInstances: PieceInstance[],
		proposedPieceInstances: PieceInstance[],
		private playStatus: 'current' | 'next'
	) {
		super(contextInfo, studio, _context.getStudioBlueprintConfig(), showStyleCompound, showStyleBlueprint, rundown)

		// Create temporary cache databases
		this._pieceInstanceCache = DbCacheWriteCollection.createFromArray(
			this._context,
			this._context.directCollections.PieceInstances,
			pieceInstances
		)
		this._partInstanceCache = DbCacheWriteCollection.createFromArray(
			this._context,
			this._context.directCollections.PartInstances,
			[partInstance]
		)

		this._proposedPieceInstances = normalizeArrayToMap(proposedPieceInstances, '_id')
	}

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		this.notes.push({
			type: NoteType.ERROR,
			message: {
				key: message,
				args: params,
			},
		})
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }): void {
		this.notes.push({
			type: NoteType.WARNING,
			message: {
				key: message,
				args: params,
			},
		})
	}

	applyChangesToCache(cache: CacheForPlayout): void {
		if (this._partInstanceCache.isModified() || this._pieceInstanceCache.isModified()) {
			this.logInfo(`Found ingest changes to apply to PartInstance`)
		} else {
			this.logInfo(`No ingest changes to apply to PartInstance`)
		}

		this._pieceInstanceCache.updateOtherCacheWithData(cache.PieceInstances)
		this._partInstanceCache.updateOtherCacheWithData(cache.PartInstances)
	}

	syncPieceInstance(
		pieceInstanceId: string,
		modifiedPiece?: Omit<IBlueprintPiece, 'lifespan'>
	): IBlueprintPieceInstance {
		const proposedPieceInstance = this._proposedPieceInstances.get(protectString(pieceInstanceId))
		if (!proposedPieceInstance) {
			throw new Error(`PieceInstance "${pieceInstanceId}" could not be found`)
		}

		// filter the submission to the allowed ones
		const piece = modifiedPiece
			? postProcessPieces(
					this._context,
					this,
					[
						{
							...modifiedPiece,
							// Some properties arent allowed to be changed
							lifespan: proposedPieceInstance.piece.lifespan,
						},
					],
					this.showStyleCompound.blueprintId,
					this.partInstance.rundownId,
					this.partInstance.segmentId,
					this.partInstance.part._id,
					this.playStatus === 'current',
					true
			  )[0]
			: proposedPieceInstance.piece

		const existingPieceInstance = this._pieceInstanceCache.findOne(proposedPieceInstance._id)
		const newPieceInstance: PieceInstance = {
			...existingPieceInstance,
			...proposedPieceInstance,
			piece: piece,
		}
		this._pieceInstanceCache.replace(newPieceInstance)
		return clone(unprotectObject(newPieceInstance))
	}

	insertPieceInstance(piece0: IBlueprintPiece): IBlueprintPieceInstance {
		const trimmedPiece: IBlueprintPiece = _.pick(piece0, IBlueprintPieceSampleKeys)

		const piece = postProcessPieces(
			this._context,
			this,
			[trimmedPiece],
			this.showStyleCompound.blueprintId,
			this.partInstance.rundownId,
			this.partInstance.segmentId,
			this.partInstance.part._id,
			this.playStatus === 'current',
			true
		)[0]
		const newPieceInstance = wrapPieceToInstance(piece, this.playlistActivationId, this.partInstance._id)

		// Ensure the infinite-ness is setup correctly. We assume any piece inserted starts in the current part
		setupPieceInstanceInfiniteProperties(newPieceInstance)

		this._pieceInstanceCache.insert(newPieceInstance)

		return clone(unprotectObject(newPieceInstance))
	}
	updatePieceInstance(pieceInstanceId: string, updatedPiece: Partial<IBlueprintPiece>): IBlueprintPieceInstance {
		// filter the submission to the allowed ones
		const trimmedPiece: Partial<OmitId<IBlueprintPiece>> = _.pick(updatedPiece, IBlueprintPieceSampleKeys)
		if (Object.keys(trimmedPiece).length === 0) {
			throw new Error(`Cannot update PieceInstance "${pieceInstanceId}". Some valid properties must be defined`)
		}

		const pieceInstance = this._pieceInstanceCache.findOne(protectString(pieceInstanceId))
		if (!pieceInstance) {
			throw new Error(`PieceInstance "${pieceInstanceId}" could not be found`)
		}
		if (pieceInstance.partInstanceId !== this.partInstance._id) {
			throw new Error(`PieceInstance "${pieceInstanceId}" does not belong to the current PartInstance`)
		}

		if (updatedPiece.content && updatedPiece.content.timelineObjects) {
			updatedPiece.content.timelineObjects = postProcessTimelineObjects(
				this,
				pieceInstance.piece._id,
				this.showStyleCompound.blueprintId,
				updatedPiece.content.timelineObjects,
				false
			)
		}

		const update: any = {
			$set: {},
			$unset: {},
		}

		for (const [k, val] of Object.entries(trimmedPiece)) {
			if (val === undefined) {
				update.$unset[`piece.${k}`] = val
			} else {
				update.$set[`piece.${k}`] = val
			}
		}

		this._pieceInstanceCache.update(pieceInstance._id, update)

		return clone(unprotectObject(this._pieceInstanceCache.findOne(pieceInstance._id)!))
	}
	updatePartInstance(updatePart: Partial<IBlueprintMutatablePart>): IBlueprintPartInstance {
		// filter the submission to the allowed ones
		const trimmedProps: Partial<IBlueprintMutatablePart> = _.pick(updatePart, IBlueprintMutatablePartSampleKeys)
		if (Object.keys(trimmedProps).length === 0) {
			throw new Error(`Cannot update PartInstance. Some valid properties must be defined`)
		}

		const update: any = {
			$set: {},
			$unset: {},
		}

		for (const [k, val] of Object.entries(trimmedProps)) {
			if (val === undefined) {
				update.$unset[`part.${k}`] = val
			} else {
				update.$set[`part.${k}`] = val
			}
		}

		this._partInstanceCache.update(this.partInstance._id, update)
		return clone(unprotectObject(this._partInstanceCache.findOne(this.partInstance._id)!))
	}
	removePieceInstances(...pieceInstanceIds: string[]): string[] {
		const pieceInstances = this._pieceInstanceCache.findFetch({
			partInstanceId: this.partInstance._id,
			_id: { $in: protectStringArray(pieceInstanceIds) },
		})

		this._pieceInstanceCache.remove({
			_id: { $in: pieceInstances.map((p) => p._id) },
		})

		return unprotectStringArray(pieceInstances.map((p) => p._id))
	}
}
