import {
	IActionExecutionContext,
	IDataStoreActionExecutionContext,
	IBlueprintMutatablePart,
	IBlueprintPart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
	IEventContext,
	OmitId,
	SomeContent,
	Time,
	WithTimeline,
	TSR,
	IBlueprintPlayoutDevice,
} from '@sofie-automation/blueprints-integration'
import {
	PartInstanceId,
	PeripheralDeviceId,
	RundownPlaylistActivationId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { assertNever, getRandomId, omit } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../../logging'
import { ReadonlyDeep } from 'type-fest'
import { CacheForPlayout, getRundownIDsFromCache } from '../../playout/cache'
import { UserContextInfo } from './CommonContext'
import { ShowStyleUserContext } from './ShowStyleUserContext'
import { WatchedPackagesHelper } from './watchedPackages'
import { getCurrentTime } from '../../lib'
import {
	protectString,
	protectStringArray,
	unprotectString,
	unprotectStringArray,
} from '@sofie-automation/corelib/dist/protectedString'
import { getResolvedPieces, setupPieceInstanceInfiniteProperties } from '../../playout/pieces'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { IMongoTransaction, MongoQuery } from '../../db'
import { PieceInstance, wrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	innerFindLastPieceOnLayer,
	innerFindLastScriptedPieceOnLayer,
	innerStartAdLibPiece,
	innerStartQueuedAdLib,
	innerStopPieces,
} from '../../playout/adlibUtils'
import {
	Piece,
	PieceTimelineObjectsBlob,
	serializePieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	convertPartInstanceToBlueprints,
	convertPieceInstanceToBlueprints,
	convertPieceToBlueprints,
	convertResolvedPieceInstanceToBlueprints,
	getMediaObjectDuration,
	IBlueprintMutatablePartSampleKeys,
	IBlueprintPieceObjectsSampleKeys,
} from './lib'
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
import { isTooCloseToAutonext } from '../../playout/lib'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { moveNextPart } from '../../playout/moveNextPart'
import _ = require('underscore')
import { ProcessedShowStyleConfig } from '../config'
import { DatastorePersistenceMode } from '@sofie-automation/shared-lib/dist/core/model/TimelineDatastore'
import { getDatastoreId } from '../../playout/datastore'
import { executePeripheralDeviceAction, listPlayoutDevices } from '../../peripheralDevice'

export enum ActionPartChange {
	NONE = 0,
	SAFE_CHANGE = 1,
}

export class DatastoreActionExecutionContext
	extends ShowStyleUserContext
	implements IDataStoreActionExecutionContext, IEventContext
{
	protected readonly _context: JobContext
	protected readonly _transaction: IMongoTransaction | null

	constructor(
		contextInfo: UserContextInfo,
		context: JobContext,
		transaction: IMongoTransaction | null,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, context, showStyle, watchedPackages)
		this._context = context
		this._transaction = transaction
	}

	async setTimelineDatastoreValue(key: string, value: unknown, mode: DatastorePersistenceMode): Promise<void> {
		const studioId = this._context.studioId
		const id = protectString(`${studioId}_${key}`)
		const collection = this._context.directCollections.TimelineDatastores

		await collection.replace(
			{
				_id: id,
				studioId: studioId,

				key,
				value,

				modified: Date.now(),
				mode,
			},
			this._transaction
		)
	}

	async removeTimelineDatastoreValue(key: string): Promise<void> {
		const studioId = this._context.studioId
		const id = getDatastoreId(studioId, key)
		const collection = this._context.directCollections.TimelineDatastores

		await collection.remove({ _id: id }, this._transaction)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}

/** Actions */
export class ActionExecutionContext extends ShowStyleUserContext implements IActionExecutionContext, IEventContext {
	private readonly _context: JobContext
	private readonly _cache: CacheForPlayout
	private readonly rundown: DBRundown
	private readonly playlistActivationId: RundownPlaylistActivationId

	/** To be set by any mutation methods on this context. Indicates to core how extensive the changes are to the current partInstance */
	public currentPartState: ActionPartChange = ActionPartChange.NONE
	/** To be set by any mutation methods on this context. Indicates to core how extensive the changes are to the next partInstance */
	public nextPartState: ActionPartChange = ActionPartChange.NONE
	public takeAfterExecute: boolean
	public queuedPartInstanceId: PartInstanceId | undefined = undefined

	constructor(
		contextInfo: UserContextInfo,
		context: JobContext,
		cache: CacheForPlayout,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		_showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: DBRundown,
		watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, context, showStyle, watchedPackages)
		this._context = context
		this._cache = cache
		this.rundown = rundown
		this.takeAfterExecute = false

		if (!this._cache.Playlist.doc.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
		this.playlistActivationId = this._cache.Playlist.doc.activationId
	}

	private _getPartInstanceId(part: 'current' | 'next'): PartInstanceId | undefined {
		switch (part) {
			case 'current':
				return this._cache.Playlist.doc.currentPartInfo?.partInstanceId
			case 'next':
				return this._cache.Playlist.doc.nextPartInfo?.partInstanceId
			default:
				assertNever(part)
				logger.warn(`Blueprint action requested unknown PartInstance "${part}"`)
				throw new Error(`Unknown part "${part}"`)
		}
	}

	async getPartInstance(part: 'current' | 'next'): Promise<IBlueprintPartInstance | undefined> {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			return undefined
		}

		const partInstance = this._cache.PartInstances.findOne(partInstanceId)
		return partInstance && convertPartInstanceToBlueprints(partInstance)
	}
	async getPieceInstances(part: 'current' | 'next'): Promise<IBlueprintPieceInstance[]> {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			return []
		}

		const pieceInstances = this._cache.PieceInstances.findAll((p) => p.partInstanceId === partInstanceId)
		return pieceInstances.map(convertPieceInstanceToBlueprints)
	}
	async getResolvedPieceInstances(part: 'current' | 'next'): Promise<IBlueprintResolvedPieceInstance[]> {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			return []
		}

		const partInstance = this._cache.PartInstances.findOne(partInstanceId)
		if (!partInstance) {
			return []
		}

		const resolvedInstances = getResolvedPieces(
			this._context,
			this._cache,
			this.showStyleCompound.sourceLayers,
			partInstance
		)
		return resolvedInstances.map(convertResolvedPieceInstanceToBlueprints)
	}

	async findLastPieceOnLayer(
		sourceLayerId0: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			originalOnly?: boolean
			pieceMetaDataFilter?: any
		}
	): Promise<IBlueprintPieceInstance | undefined> {
		const query: MongoQuery<PieceInstance> = {}
		if (options && options.pieceMetaDataFilter) {
			for (const [key, value] of Object.entries<unknown>(options.pieceMetaDataFilter)) {
				// TODO do we need better validation here?
				// It should be pretty safe as we are working with the cache version (for now)
				// @ts-expect-error metaData is `unknown` so no subkeys are known to be valid
				query[`piece.metaData.${key}`] = value
			}
		}

		if (options && options.excludeCurrentPart && this._cache.Playlist.doc.currentPartInfo) {
			query['partInstanceId'] = { $ne: this._cache.Playlist.doc.currentPartInfo.partInstanceId }
		}

		const sourceLayerId = Array.isArray(sourceLayerId0) ? sourceLayerId0 : [sourceLayerId0]

		const lastPieceInstance = await innerFindLastPieceOnLayer(
			this._context,
			this._cache,
			sourceLayerId,
			(options && options.originalOnly) || false,
			query
		)

		return lastPieceInstance && convertPieceInstanceToBlueprints(lastPieceInstance)
	}

	async findLastScriptedPieceOnLayer(
		sourceLayerId0: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			pieceMetaDataFilter?: any
		}
	): Promise<IBlueprintPieceDB | undefined> {
		const query: MongoQuery<Piece> = {}
		if (options && options.pieceMetaDataFilter) {
			for (const [key, value] of Object.entries<unknown>(options.pieceMetaDataFilter)) {
				// TODO do we need better validation here?
				// It should be pretty safe as we are working with the cache version (for now)
				// @ts-expect-error metaData is `unknown` so no subkeys are known to be valid
				query[`metaData.${key}`] = value
			}
		}

		if (options && options.excludeCurrentPart && this._cache.Playlist.doc.currentPartInfo) {
			const currentPartInstance = this._cache.PartInstances.findOne(
				this._cache.Playlist.doc.currentPartInfo.partInstanceId
			)

			if (currentPartInstance) {
				query['startPartId'] = { $ne: currentPartInstance.part._id }
			}
		}

		const sourceLayerId = Array.isArray(sourceLayerId0) ? sourceLayerId0 : [sourceLayerId0]

		const lastPiece = await innerFindLastScriptedPieceOnLayer(this._context, this._cache, sourceLayerId, query)

		return lastPiece && convertPieceToBlueprints(lastPiece)
	}

	async getPartInstanceForPreviousPiece(piece: IBlueprintPieceInstance): Promise<IBlueprintPartInstance> {
		const pieceExt = piece as unknown as Partial<PieceInstance> | undefined
		const partInstanceId = pieceExt?.partInstanceId
		if (!partInstanceId) {
			throw new Error('Cannot find PartInstance from invalid PieceInstance')
		}

		const cached = this._cache.PartInstances.findOne(partInstanceId)
		if (cached) {
			return convertPartInstanceToBlueprints(cached)
		}

		// It might be reset and so not in the cache
		const rundownIds = getRundownIDsFromCache(this._cache)
		const oldInstance = await this._context.directCollections.PartInstances.findOne({
			_id: partInstanceId,
			rundownId: { $in: rundownIds },
		})
		if (oldInstance) {
			return convertPartInstanceToBlueprints(oldInstance)
		} else {
			throw new Error('Cannot find PartInstance for PieceInstance')
		}
	}

	async getPartForPreviousPiece(piece: Partial<Pick<IBlueprintPieceDB, '_id'>>): Promise<IBlueprintPart | undefined> {
		if (!piece?._id) {
			throw new Error('Cannot find Part from invalid Piece')
		}

		const pieceDB = await this._context.directCollections.Pieces.findOne({
			_id: protectString(piece._id),
			startRundownId: { $in: getRundownIDsFromCache(this._cache) },
		})
		if (!pieceDB) throw new Error(`Cannot find Piece ${piece._id}`)

		return this._cache.Parts.findOne(pieceDB.startPartId)
	}

	async insertPiece(part: 'current' | 'next', rawPiece: IBlueprintPiece): Promise<IBlueprintPieceInstance> {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			throw new Error('Cannot insert piece when no active part')
		}

		const partInstance = this._cache.PartInstances.findOne(partInstanceId)
		if (!partInstance) {
			throw new Error('Cannot queue part when no partInstance')
		}

		const rundown = this._cache.Rundowns.findOne(partInstance.rundownId)
		if (!rundown) {
			throw new Error('Failed to find rundown of partInstance')
		}

		const trimmedPiece: IBlueprintPiece = _.pick(rawPiece, IBlueprintPieceObjectsSampleKeys)

		const piece = postProcessPieces(
			this._context,
			[trimmedPiece],
			this.showStyleCompound.blueprintId,
			partInstance.rundownId,
			partInstance.segmentId,
			partInstance.part._id,
			part === 'current'
		)[0]
		piece._id = getRandomId() // Make id random, as postProcessPieces is too predictable (for ingest)
		const newPieceInstance = wrapPieceToInstance(piece, this.playlistActivationId, partInstance._id)

		// Do the work
		innerStartAdLibPiece(this._context, this._cache, rundown, partInstance, newPieceInstance)

		if (part === 'current') {
			this.currentPartState = Math.max(this.currentPartState, ActionPartChange.SAFE_CHANGE)
		} else {
			this.nextPartState = Math.max(this.nextPartState, ActionPartChange.SAFE_CHANGE)
		}

		return convertPieceInstanceToBlueprints(newPieceInstance)
	}
	async updatePieceInstance(
		pieceInstanceId: string,
		piece: Partial<OmitId<IBlueprintPiece>>
	): Promise<IBlueprintPieceInstance> {
		// filter the submission to the allowed ones
		const trimmedPiece: Partial<OmitId<IBlueprintPiece>> = _.pick(piece, IBlueprintPieceObjectsSampleKeys)
		if (Object.keys(trimmedPiece).length === 0) {
			throw new Error('Some valid properties must be defined')
		}

		const pieceInstance = this._cache.PieceInstances.findOne(protectString(pieceInstanceId))
		if (!pieceInstance) {
			throw new Error('PieceInstance could not be found')
		}

		if (pieceInstance.infinite?.fromPreviousPart) {
			throw new Error('Cannot update an infinite piece that is continued from a previous part')
		}

		const updatesCurrentPart: ActionPartChange =
			pieceInstance.partInstanceId === this._cache.Playlist.doc.currentPartInfo?.partInstanceId
				? ActionPartChange.SAFE_CHANGE
				: ActionPartChange.NONE
		const updatesNextPart: ActionPartChange =
			pieceInstance.partInstanceId === this._cache.Playlist.doc.nextPartInfo?.partInstanceId
				? ActionPartChange.SAFE_CHANGE
				: ActionPartChange.NONE
		if (!updatesCurrentPart && !updatesNextPart) {
			throw new Error('Can only update piece instances in current or next part instance')
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

		setupPieceInstanceInfiniteProperties(pieceInstance)

		this._cache.PieceInstances.updateOne(pieceInstance._id, (p) => {
			if (timelineObjectsString !== undefined) p.piece.timelineObjectsString = timelineObjectsString

			return {
				...p,
				piece: {
					...p.piece,
					...(trimmedPiece as any), // TODO: this needs to be more type safe
				},
			}
		})

		this.nextPartState = Math.max(this.nextPartState, updatesNextPart)
		this.currentPartState = Math.max(this.currentPartState, updatesCurrentPart)

		const updatedPieceInstance = this._cache.PieceInstances.findOne(pieceInstance._id)
		if (!updatedPieceInstance) throw new Error('PieceInstance disappeared!')

		return convertPieceInstanceToBlueprints(updatedPieceInstance)
	}
	async queuePart(rawPart: IBlueprintPart, rawPieces: IBlueprintPiece[]): Promise<IBlueprintPartInstance> {
		const currentPartInstance = this._cache.Playlist.doc.currentPartInfo
			? this._cache.PartInstances.findOne(this._cache.Playlist.doc.currentPartInfo.partInstanceId)
			: undefined
		if (!currentPartInstance) {
			throw new Error('Cannot queue part when no current partInstance')
		}

		if (this.nextPartState !== ActionPartChange.NONE) {
			// Ensure we dont insert a piece into a part before replacing it with a queued part, as this will cause some data integrity issues
			// This could be changed if we have a way to abort the pending changes in the nextPart.
			// Future: perhaps this could be dropped as only the instance will have changed, and that will be trashed by the setAsNext?
			throw new Error('Cannot queue part when next part has already been modified')
		}

		if (isTooCloseToAutonext(currentPartInstance, true)) {
			throw new Error('Too close to an autonext to queue a part')
		}

		if (rawPieces.length === 0) {
			throw new Error('New part must contain at least one piece')
		}

		const newPartInstance: DBPartInstance = {
			_id: getRandomId(),
			rundownId: currentPartInstance.rundownId,
			segmentId: currentPartInstance.segmentId,
			playlistActivationId: this.playlistActivationId,
			segmentPlayoutId: currentPartInstance.segmentPlayoutId,
			takeCount: currentPartInstance.takeCount + 1,
			rehearsal: currentPartInstance.rehearsal,
			part: {
				...rawPart,
				_id: getRandomId(),
				rundownId: currentPartInstance.rundownId,
				segmentId: currentPartInstance.segmentId,
				_rank: 99999, // Corrected in innerStartQueuedAdLib
				notes: [],
				invalid: false,
				invalidReason: undefined,
				floated: false,
				expectedDurationWithPreroll: undefined, // Filled in later
			},
		}

		if (!isPartPlayable(newPartInstance.part)) {
			throw new Error('Cannot queue a part which is not playable')
		}

		const pieces = postProcessPieces(
			this._context,
			rawPieces,
			this.showStyleCompound.blueprintId,
			currentPartInstance.rundownId,
			newPartInstance.segmentId,
			newPartInstance.part._id,
			false
		)
		const newPieceInstances = pieces.map((piece) =>
			wrapPieceToInstance(piece, this.playlistActivationId, newPartInstance._id)
		)

		// Do the work
		await innerStartQueuedAdLib(
			this._context,
			this._cache,
			this.rundown,
			currentPartInstance,
			newPartInstance,
			newPieceInstances
		)

		this.nextPartState = ActionPartChange.SAFE_CHANGE
		this.queuedPartInstanceId = newPartInstance._id

		return convertPartInstanceToBlueprints(newPartInstance)
	}
	async moveNextPart(partDelta: number, segmentDelta: number): Promise<void> {
		await moveNextPart(this._context, this._cache, partDelta, segmentDelta)
	}
	async updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart>
	): Promise<IBlueprintPartInstance> {
		// filter the submission to the allowed ones
		const trimmedProps: Partial<IBlueprintMutatablePart> = _.pick(props, IBlueprintMutatablePartSampleKeys)
		if (Object.keys(trimmedProps).length === 0) {
			throw new Error('Some valid properties must be defined')
		}

		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			throw new Error('PartInstance could not be found')
		}

		const partInstance = this._cache.PartInstances.findOne(partInstanceId)
		if (!partInstance) {
			throw new Error('PartInstance could not be found')
		}

		this._cache.PartInstances.updateOne(partInstance._id, (p) => {
			return {
				...p,
				part: {
					...p.part,
					...trimmedProps,
				},
			}
		})

		this.nextPartState = Math.max(
			this.nextPartState,
			part === 'next' ? ActionPartChange.SAFE_CHANGE : ActionPartChange.NONE
		)
		this.currentPartState = Math.max(
			this.currentPartState,
			part === 'current' ? ActionPartChange.SAFE_CHANGE : ActionPartChange.NONE
		)

		const updatedPartInstance = this._cache.PartInstances.findOne(partInstance._id)
		if (!updatedPartInstance) {
			throw new Error('PartInstance could not be found, after applying changes')
		}

		return convertPartInstanceToBlueprints(updatedPartInstance)
	}

	async stopPiecesOnLayers(sourceLayerIds: string[], timeOffset?: number | undefined): Promise<string[]> {
		if (sourceLayerIds.length == 0) {
			return []
		}

		return this._stopPiecesByRule(
			(pieceInstance) => sourceLayerIds.indexOf(pieceInstance.piece.sourceLayerId) !== -1,
			timeOffset
		)
	}
	async stopPieceInstances(pieceInstanceIds: string[], timeOffset?: number | undefined): Promise<string[]> {
		if (pieceInstanceIds.length == 0) {
			return []
		}

		return this._stopPiecesByRule(
			(pieceInstance) => pieceInstanceIds.indexOf(unprotectString(pieceInstance._id)) !== -1,
			timeOffset
		)
	}
	async removePieceInstances(_part: 'next', pieceInstanceIds: string[]): Promise<string[]> {
		const partInstanceId = this._cache.Playlist.doc.nextPartInfo?.partInstanceId // this._getPartInstanceId(part)
		if (!partInstanceId) {
			throw new Error('Cannot remove pieceInstances when no selected partInstance')
		}

		const rawPieceInstanceIdSet = new Set(protectStringArray(pieceInstanceIds))
		const pieceInstances = this._cache.PieceInstances.findAll(
			(p) => p.partInstanceId === partInstanceId && rawPieceInstanceIdSet.has(p._id)
		)

		const pieceInstanceIdsToRemove = pieceInstances.map((p) => p._id)
		const pieceInstanceIdsSet = new Set(pieceInstanceIdsToRemove)
		this._cache.PieceInstances.remove((p) => p.partInstanceId === partInstanceId && pieceInstanceIdsSet.has(p._id))

		this.nextPartState = Math.max(this.nextPartState, ActionPartChange.SAFE_CHANGE)

		return unprotectStringArray(pieceInstanceIdsToRemove)
	}

	async takeAfterExecuteAction(take: boolean): Promise<boolean> {
		this.takeAfterExecute = take

		return this.takeAfterExecute
	}

	async blockTakeUntil(time: Time | null): Promise<void> {
		if (time !== null && (time < getCurrentTime() || typeof time !== 'number'))
			throw new Error('Cannot block taking out of the current part, to a time in the past')

		const partInstanceId = this._cache.Playlist.doc.currentPartInfo?.partInstanceId
		if (!partInstanceId) {
			throw new Error('Cannot block take when there is no part playing')
		}
		this._cache.PartInstances.updateOne(partInstanceId, (doc) => {
			if (time) {
				doc.blockTakeUntil = time
			} else {
				delete doc.blockTakeUntil
			}
			return doc
		})
	}

	private _stopPiecesByRule(filter: (pieceInstance: PieceInstance) => boolean, timeOffset: number | undefined) {
		if (!this._cache.Playlist.doc.currentPartInfo) {
			return []
		}
		const partInstance = this._cache.PartInstances.findOne(this._cache.Playlist.doc.currentPartInfo.partInstanceId)
		if (!partInstance) {
			throw new Error('Cannot stop pieceInstances when no current partInstance')
		}

		const stoppedIds = innerStopPieces(
			this._context,
			this._cache,
			this.showStyleCompound.sourceLayers,
			partInstance,
			filter,
			timeOffset
		)

		if (stoppedIds.length > 0) {
			this.currentPartState = Math.max(this.currentPartState, ActionPartChange.SAFE_CHANGE)
		}

		return unprotectStringArray(stoppedIds)
	}

	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return getMediaObjectDuration(this._context, mediaId)
	}

	async listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]> {
		return listPlayoutDevices(this._context, this._cache)
	}

	async executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>
	): Promise<TSR.ActionExecutionResult> {
		return executePeripheralDeviceAction(this._context, deviceId, null, actionId, payload)
	}

	async setTimelineDatastoreValue(key: string, value: unknown, mode: DatastorePersistenceMode): Promise<void> {
		const studioId = this._context.studioId
		const id = protectString(`${studioId}_${key}`)
		const collection = this._context.directCollections.TimelineDatastores

		this._cache.deferDuringSaveTransaction(async (transaction) => {
			await collection.replace(
				{
					_id: id,
					studioId: studioId,

					key,
					value,

					modified: Date.now(),
					mode,
				},
				transaction
			)
		})
	}

	async removeTimelineDatastoreValue(key: string): Promise<void> {
		const studioId = this._context.studioId
		const id = getDatastoreId(studioId, key)
		const collection = this._context.directCollections.TimelineDatastores

		this._cache.deferDuringSaveTransaction(async (transaction) => {
			await collection.remove({ _id: id }, transaction)
		})
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}
