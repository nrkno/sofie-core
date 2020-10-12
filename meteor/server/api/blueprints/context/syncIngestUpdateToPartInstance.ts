import { clone } from 'underscore'
import { RundownContext, NotesContext } from './context'
import { CacheForRundownPlaylist } from '../../../DatabaseCaches'
import {
	IBlueprintPiece,
	IBlueprintPieceInstance,
	OmitId,
	IBlueprintMutatablePart,
	IBlueprintPartInstance,
	SyncIngestUpdateToPartInstanceContext as ISyncIngestUpdateToPartInstanceContext,
} from 'tv-automation-sofie-blueprints-integration'
import { PartInstance } from '../../../../lib/collections/PartInstances'
import _ from 'underscore'
import { IBlueprintPieceSampleKeys, IBlueprintMutatablePartSampleKeys } from './lib'
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
import { wrapPieceToInstance } from '../../../../lib/collections/PieceInstances'
import { unprotectObject, protectString, protectStringArray, unprotectStringArray } from '../../../../lib/lib'
import { Rundown } from '../../../../lib/collections/Rundowns'

export class SyncIngestUpdateToPartInstanceContext extends RundownContext
	implements ISyncIngestUpdateToPartInstanceContext {
	private readonly _cache: CacheForRundownPlaylist

	// private readonly _pieceInstanceCache: DbWriteCacheCollection<PieceInstance, PieceInstance>

	constructor(
		rundown: Rundown,
		cache: CacheForRundownPlaylist,
		notesContext: NotesContext,
		private partInstance: PartInstance,
		private playStatus: 'current' | 'next'
	) {
		super(rundown, cache, notesContext)
		this._cache = cache
	}

	insertPieceInstance(piece0: IBlueprintPiece): IBlueprintPieceInstance {
		const trimmedPiece: IBlueprintPiece = _.pick(piece0, IBlueprintPieceSampleKeys)

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

		this._cache.PieceInstances.insert(newPieceInstance)

		return clone(unprotectObject(newPieceInstance))
	}
	updatePieceInstance(
		pieceInstanceId: string,
		updatedPiece: Partial<OmitId<IBlueprintPiece>>
	): IBlueprintPieceInstance {
		// filter the submission to the allowed ones
		const trimmedPiece: Partial<OmitId<IBlueprintPiece>> = _.pick(updatedPiece, IBlueprintPieceSampleKeys)
		if (Object.keys(trimmedPiece).length === 0) {
			throw new Error('Some valid properties must be defined')
		}

		const pieceInstance = this._cache.PieceInstances.findOne(protectString(pieceInstanceId))
		if (!pieceInstance) {
			throw new Error('PieceInstance could not be found')
		}
		if (pieceInstance.partInstanceId !== this.partInstance._id) {
			throw new Error('PieceInstance is not in the right partInstance')
		}
		if (pieceInstance.infinite?.fromPreviousPart) {
			throw new Error('Cannot update an infinite piece that is continued from a previous part')
		}

		if (updatedPiece.content && updatedPiece.content.timelineObjects) {
			updatedPiece.content.timelineObjects = postProcessTimelineObjects(
				this,
				pieceInstance.piece._id,
				this.getShowStyleBase().blueprintId,
				updatedPiece.content.timelineObjects,
				false,
				{}
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

		this._cache.PieceInstances.update(pieceInstance._id, update)

		return clone(unprotectObject(this._cache.PieceInstances.findOne(pieceInstance._id)!))
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

		this._cache.PartInstances.update(this.partInstance._id, update)
		return clone(unprotectObject(this._cache.PartInstances.findOne(this.partInstance._id)!))
	}
	removePieceInstances(...pieceInstanceIds: string[]): string[] {
		const pieceInstances = this._cache.PieceInstances.findFetch({
			partInstanceId: this.partInstance._id,
			_id: { $in: protectStringArray(pieceInstanceIds) },
		})

		this._cache.PieceInstances.remove({
			_id: { $in: pieceInstances.map((p) => p._id) },
		})

		return unprotectStringArray(pieceInstances.map((p) => p._id))
	}
}
