import { PieceInstanceId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
import { ReadonlyDeep, SetRequired } from 'type-fest'
import _ = require('underscore')
import { ContextInfo, RundownUserContext } from './context'
import {
	ISyncIngestUpdateToPartInstanceContext,
	IBlueprintPiece,
	IBlueprintPieceInstance,
	OmitId,
	IBlueprintMutatablePart,
	IBlueprintPartInstance,
	WithTimelineObjects,
	WithPieceTimelineObjects,
} from '@sofie-automation/blueprints-integration'
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
import {
	IBlueprintPieceWithTimelineObjectsSampleKeys,
	IBlueprintMutatablePartSampleKeys,
	convertPieceInstanceToBlueprintsWithTimelineObjects,
} from './lib'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { JobContext } from '../../jobs'
import { logChanges } from '../../cache/lib'
import { MongoModifier } from '../../db'
import { serializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'

export class SyncIngestUpdateToPartInstanceContext
	extends RundownUserContext
	implements ISyncIngestUpdateToPartInstanceContext
{
	private readonly _partInstanceCache: DbCacheWriteCollection<DBPartInstance>
	private readonly _pieceInstanceCache: DbCacheWriteCollection<PieceInstance>
	private readonly _proposedPieceInstances: Map<PieceInstanceId, PieceInstance>

	constructor(
		private readonly _context: JobContext,
		contextInfo: ContextInfo,
		private readonly playlistActivationId: RundownPlaylistActivationId,
		studio: ReadonlyDeep<DBStudio>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>,
		private partInstance: DBPartInstance,
		pieceInstances: PieceInstance[],
		proposedPieceInstances: PieceInstance[],
		private playStatus: 'current' | 'next'
	) {
		super(
			contextInfo,
			studio,
			_context.getStudioBlueprintConfig(),
			showStyleCompound,
			_context.getShowStyleBlueprintConfig(showStyleCompound),
			rundown
		)

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

	applyChangesToCache(cache: CacheForPlayout): void {
		if (this._partInstanceCache.isModified() || this._pieceInstanceCache.isModified()) {
			this.logInfo(`Found ingest changes to apply to PartInstance`)
		} else {
			this.logInfo(`No ingest changes to apply to PartInstance`)
		}

		const pieceChanges = this._pieceInstanceCache.updateOtherCacheWithData(cache.PieceInstances)
		const partChanges = this._partInstanceCache.updateOtherCacheWithData(cache.PartInstances)

		logChanges('PartInstances', partChanges)
		logChanges('PieceInstances', pieceChanges)
	}

	syncPieceInstance(
		pieceInstanceId: string,
		modifiedPiece?: Omit<WithTimelineObjects<IBlueprintPiece>, 'lifespan'>
	): IBlueprintPieceInstance {
		const proposedPieceInstance = this._proposedPieceInstances.get(protectString(pieceInstanceId))
		if (!proposedPieceInstance) {
			throw new Error(`PieceInstance "${pieceInstanceId}" could not be found`)
		}

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
					this.partInstance.rundownId,
					this.partInstance.segmentId,
					this.partInstance.part._id,
					this.playStatus === 'current'
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

	insertPieceInstance(
		piece0: WithTimelineObjects<IBlueprintPiece>
	): WithPieceTimelineObjects<IBlueprintPieceInstance> {
		const trimmedPiece: WithTimelineObjects<IBlueprintPiece> = _.pick(
			piece0,
			IBlueprintPieceWithTimelineObjectsSampleKeys
		)

		const piece = postProcessPieces(
			this._context,
			[trimmedPiece],
			this.showStyleCompound.blueprintId,
			this.partInstance.rundownId,
			this.partInstance.segmentId,
			this.partInstance.part._id,
			this.playStatus === 'current'
		)[0]
		const newPieceInstance = wrapPieceToInstance(piece, this.playlistActivationId, this.partInstance._id)

		// Ensure the infinite-ness is setup correctly. We assume any piece inserted starts in the current part
		setupPieceInstanceInfiniteProperties(newPieceInstance)

		this._pieceInstanceCache.insert(newPieceInstance)

		return convertPieceInstanceToBlueprintsWithTimelineObjects(newPieceInstance)
	}
	updatePieceInstance(
		pieceInstanceId: string,
		updatedPiece: Partial<WithTimelineObjects<IBlueprintPiece>>
	): WithPieceTimelineObjects<IBlueprintPieceInstance> {
		// filter the submission to the allowed ones
		const trimmedPiece: Partial<OmitId<WithTimelineObjects<IBlueprintPiece>>> = _.pick(
			updatedPiece,
			IBlueprintPieceWithTimelineObjectsSampleKeys
		)
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

		const update: SetRequired<MongoModifier<PieceInstance>, '$set' | '$unset'> = {
			$set: {},
			$unset: {},
		}

		if (updatedPiece.timelineObjects) {
			update.$set['piece.timelineObjectsString'] = serializePieceTimelineObjectsBlob(
				postProcessTimelineObjects(
					pieceInstance.piece._id,
					this.showStyleCompound.blueprintId,
					updatedPiece.timelineObjects
				)
			)
			// This has been processed
			delete updatedPiece.timelineObjects
		}

		for (const [k, val] of Object.entries(trimmedPiece)) {
			if (val === undefined) {
				update.$unset[`piece.${k}`] = 1
			} else {
				update.$set[`piece.${k}`] = val
			}
		}

		this._pieceInstanceCache.update(pieceInstance._id, update)

		const updatedPieceInstance = this._pieceInstanceCache.findOne(pieceInstance._id)
		if (!updatedPieceInstance) {
			throw new Error(`PieceInstance "${pieceInstanceId}" could not be found, after applying changes`)
		}

		return convertPieceInstanceToBlueprintsWithTimelineObjects(updatedPieceInstance)
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

		const updatedPartInstance = this._partInstanceCache.findOne(this.partInstance._id)
		if (!updatedPartInstance) {
			throw new Error(`PartInstance could not be found, after applying changes`)
		}

		return clone(unprotectObject(updatedPartInstance))
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
