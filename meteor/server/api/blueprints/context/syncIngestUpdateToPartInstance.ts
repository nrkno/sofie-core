import { clone } from 'underscore'
import { RundownContext, NotesContext } from './context'
import { CacheForRundownPlaylist, ReadOnlyCacheForRundownPlaylist } from '../../../DatabaseCaches'
import {
	IBlueprintPiece,
	IBlueprintPieceInstance,
	OmitId,
	IBlueprintMutatablePart,
	IBlueprintPartInstance,
	SyncIngestUpdateToPartInstanceContext as ISyncIngestUpdateToPartInstanceContext,
	BlueprintSyncIngestNewData,
} from '@sofie-automation/blueprints-integration'
import { PartInstance, DBPartInstance, PartInstances } from '../../../../lib/collections/PartInstances'
import _ from 'underscore'
import { IBlueprintPieceSampleKeys, IBlueprintMutatablePartSampleKeys } from './lib'
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
import {
	wrapPieceToInstance,
	PieceInstance,
	PieceInstances,
	PieceInstanceId,
} from '../../../../lib/collections/PieceInstances'
import {
	unprotectObject,
	protectString,
	protectStringArray,
	unprotectStringArray,
	normalizeArray,
	normalizeArrayToMap,
} from '../../../../lib/lib'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { DbCacheWriteCollection } from '../../../DatabaseCache'

export class SyncIngestUpdateToPartInstanceContext extends RundownContext
	implements ISyncIngestUpdateToPartInstanceContext {
	private readonly _partInstanceCache: DbCacheWriteCollection<PartInstance, DBPartInstance>
	private readonly _pieceInstanceCache: DbCacheWriteCollection<PieceInstance, PieceInstance>
	private readonly _proposedPieceInstances: Map<PieceInstanceId, PieceInstance>

	constructor(
		rundown: Rundown,
		cache: ReadOnlyCacheForRundownPlaylist,
		notesContext: NotesContext,
		private partInstance: PartInstance,
		pieceInstances: PieceInstance[],
		proposedPieceInstances: PieceInstance[],
		private playStatus: 'current' | 'next'
	) {
		super(rundown, cache, notesContext)

		// Create temporary cache databases
		this._pieceInstanceCache = new DbCacheWriteCollection(PieceInstances)
		this._pieceInstanceCache.fillWithDataFromArray(pieceInstances)

		this._partInstanceCache = new DbCacheWriteCollection(PartInstances)
		this._partInstanceCache.fillWithDataFromArray([partInstance])

		this._proposedPieceInstances = normalizeArrayToMap(proposedPieceInstances, '_id')
	}

	applyChangesToCache(cache: CacheForRundownPlaylist) {
		this._pieceInstanceCache.updateOtherCacheWithData(cache.PieceInstances)
		this._partInstanceCache.updateOtherCacheWithData(cache.PartInstances)
	}

	syncPieceInstance(
		pieceInstanceId: string,
		modifiedPiece: Omit<IBlueprintPiece, 'lifespan'>
	): IBlueprintPieceInstance {
		const proposedPieceInstance = this._proposedPieceInstances.get(protectString(pieceInstanceId))
		if (!proposedPieceInstance) {
			throw new Error('PieceInstance could not be found')
		}

		// filter the submission to the allowed ones
		const piece = postProcessPieces(
			this,
			[
				{
					...modifiedPiece,
					// Some properties arent allowed to be changed
					lifespan: proposedPieceInstance.piece.lifespan,
				},
			],
			this.getShowStyleBase().blueprintId,
			this.partInstance.rundownId,
			this.partInstance.segmentId,
			this.partInstance.part._id,
			this.playStatus === 'current',
			true
		)[0]

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

		// TODO - this wont work because infinite properties...
		// What about a method called 'syncInfinitePieceInstance(id: PieceInstanceId)'? Infinites should then be put back into their own array, as they have different update mechanics. (except infinites starting in this part?)
		// Perhaps it will want a second parameter of the piece properties? so that they can be mutated? but changes to the infinitemode should be rejected

		const piece = postProcessPieces(
			this,
			[trimmedPiece],
			this.getShowStyleBase().blueprintId,
			this.partInstance.rundownId,
			this.partInstance.segmentId,
			this.partInstance.part._id,
			this.playStatus === 'current',
			true
		)[0]
		const newPieceInstance = wrapPieceToInstance(piece, this.partInstance._id)

		this._pieceInstanceCache.insert(newPieceInstance)

		return clone(unprotectObject(newPieceInstance))
	}
	updatePieceInstance(pieceInstanceId: string, updatedPiece: Partial<IBlueprintPiece>): IBlueprintPieceInstance {
		// filter the submission to the allowed ones
		const trimmedPiece: Partial<OmitId<IBlueprintPiece>> = _.pick(updatedPiece, IBlueprintPieceSampleKeys)
		if (Object.keys(trimmedPiece).length === 0) {
			throw new Error('Some valid properties must be defined')
		}

		const pieceInstance = this._pieceInstanceCache.findOne(protectString(pieceInstanceId))
		if (!pieceInstance) {
			throw new Error('PieceInstance could not be found')
		}
		if (pieceInstance.partInstanceId !== this.partInstance._id) {
			throw new Error('PieceInstance is not in the right partInstance')
		}
		// TODO - is this safe?
		// if (pieceInstance.infinite?.fromPreviousPart) {
		// 	throw new Error('Cannot update an infinite piece that is continued from a previous part')
		// }

		if (updatedPiece.content && updatedPiece.content.timelineObjects) {
			updatedPiece.content.timelineObjects = postProcessTimelineObjects(
				this,
				pieceInstance.piece._id,
				this.getShowStyleBase().blueprintId,
				updatedPiece.content.timelineObjects,
				false
			)
		}

		const update = {
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
			throw new Error('Some valid properties must be defined')
		}

		const update = {
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
