import { PieceInstanceId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance, wrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { normalizeArrayToMap, omit } from '@sofie-automation/corelib/dist/lib'
import { protectString, protectStringArray, unprotectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { DbCacheWriteCollection } from '../../cache/CacheCollection'
import { CacheForPlayout } from '../../playout/cache'
import { setupPieceInstanceInfiniteProperties } from '../../playout/pieces'
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
import { logChanges } from '../../cache/lib'
import {
	PieceTimelineObjectsBlob,
	serializePieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'

export class SyncIngestUpdateToPartInstanceContext
	extends RundownUserContext
	implements ISyncIngestUpdateToPartInstanceContext
{
	private readonly _partInstanceCache: DbCacheWriteCollection<DBPartInstance>
	private readonly _pieceInstanceCache: DbCacheWriteCollection<PieceInstance>
	private readonly _proposedPieceInstances: Map<PieceInstanceId, PieceInstance>

	private partInstance: DBPartInstance | undefined

	constructor(
		private readonly _context: JobContext,
		contextInfo: ContextInfo,
		private readonly playlistActivationId: RundownPlaylistActivationId,
		studio: ReadonlyDeep<DBStudio>,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>,
		partInstance: DBPartInstance,
		pieceInstances: PieceInstance[],
		proposedPieceInstances: PieceInstance[],
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
		return convertPieceInstanceToBlueprints(newPieceInstance)
	}

	insertPieceInstance(piece0: IBlueprintPiece): IBlueprintPieceInstance {
		const trimmedPiece: IBlueprintPiece = _.pick(piece0, IBlueprintPieceObjectsSampleKeys)

		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

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

		return convertPieceInstanceToBlueprints(newPieceInstance)
	}
	updatePieceInstance(pieceInstanceId: string, updatedPiece: Partial<IBlueprintPiece>): IBlueprintPieceInstance {
		// filter the submission to the allowed ones
		const trimmedPiece: Partial<OmitId<IBlueprintPiece>> = _.pick(updatedPiece, IBlueprintPieceObjectsSampleKeys)
		if (Object.keys(trimmedPiece).length === 0) {
			throw new Error(`Cannot update PieceInstance "${pieceInstanceId}". Some valid properties must be defined`)
		}

		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

		const pieceInstance = this._pieceInstanceCache.findOne(protectString(pieceInstanceId))
		if (!pieceInstance) {
			throw new Error(`PieceInstance "${pieceInstanceId}" could not be found`)
		}
		if (pieceInstance.partInstanceId !== this.partInstance._id) {
			throw new Error(`PieceInstance "${pieceInstanceId}" does not belong to the current PartInstance`)
		}

		let timelineObjectsString: PieceTimelineObjectsBlob | undefined
		if (trimmedPiece.content?.timelineObjects) {
			timelineObjectsString = serializePieceTimelineObjectsBlob(
				postProcessTimelineObjects(
					pieceInstance.piece._id,
					this.showStyleCompound.blueprintId,
					trimmedPiece.content.timelineObjects
				)
			)
			// This has been processed
			trimmedPiece.content = omit(trimmedPiece.content, 'timelineObjects') as WithTimeline<SomeContent>
		}

		this._pieceInstanceCache.updateOne(pieceInstance._id, (p) => {
			if (timelineObjectsString !== undefined) p.piece.timelineObjectsString = timelineObjectsString

			return {
				...p,
				piece: {
					...p.piece,
					...(trimmedPiece as any), // TODO: this needs to be more type safe
				},
			}
		})

		const updatedPieceInstance = this._pieceInstanceCache.findOne(pieceInstance._id)
		if (!updatedPieceInstance) {
			throw new Error(`PieceInstance "${pieceInstanceId}" could not be found, after applying changes`)
		}

		return convertPieceInstanceToBlueprints(updatedPieceInstance)
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

		this._partInstanceCache.updateOne(this.partInstance._id, (p) => {
			return {
				...p,
				part: {
					...p.part,
					...trimmedProps,
				},
			}
		})

		const updatedPartInstance = this._partInstanceCache.findOne(this.partInstance._id)
		if (!updatedPartInstance) {
			throw new Error(`PartInstance could not be found, after applying changes`)
		}

		return convertPartInstanceToBlueprints(updatedPartInstance)
	}

	removePartInstance(): void {
		if (this.playStatus !== 'next') throw new Error(`Only the 'next' PartInstance can be removed`)

		if (this.partInstance) {
			const partInstanceId = this.partInstance._id

			this._partInstanceCache.remove(partInstanceId)
			this._pieceInstanceCache.remove((piece) => piece.partInstanceId === partInstanceId)
		}
	}

	removePieceInstances(...pieceInstanceIds: string[]): string[] {
		if (!this.partInstance) throw new Error(`PartInstance has been removed`)

		const partInstanceId = this.partInstance._id
		const rawPieceInstanceIdSet = new Set(protectStringArray(pieceInstanceIds))
		const pieceInstances = this._pieceInstanceCache.findAll(
			(p) => p.partInstanceId === partInstanceId && rawPieceInstanceIdSet.has(p._id)
		)

		const pieceInstanceIdsToRemove = pieceInstances.map((p) => p._id)

		const pieceInstanceIdsSet = new Set(pieceInstanceIdsToRemove)
		this._pieceInstanceCache.remove((p) => pieceInstanceIdsSet.has(p._id))

		return unprotectStringArray(pieceInstanceIdsToRemove)
	}
}
