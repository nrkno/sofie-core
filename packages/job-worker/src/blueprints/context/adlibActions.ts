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
import { PartInstanceId, PeripheralDeviceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { assertNever, getRandomId, omit } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../../logging'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutModel } from '../../playout/model/PlayoutModel'
import { PlayoutPartInstanceModel } from '../../playout/model/PlayoutPartInstanceModel'
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
import { getResolvedPiecesForCurrentPartInstance } from '../../playout/resolvedPieces'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { MongoQuery } from '../../db'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	innerFindLastPieceOnLayer,
	innerFindLastScriptedPieceOnLayer,
	innerStartQueuedAdLib,
	innerStopPieces,
} from '../../playout/adlibUtils'
import {
	Piece,
	PieceTimelineObjectsBlob,
	serializePieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	convertPartInstanceToBlueprints,
	convertPartToBlueprints,
	convertPieceInstanceToBlueprints,
	convertPieceToBlueprints,
	convertResolvedPieceInstanceToBlueprints,
	getMediaObjectDuration,
	IBlueprintMutatablePartSampleKeys,
	IBlueprintPieceObjectsSampleKeys,
} from './lib'
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
import { isTooCloseToAutonext } from '../../playout/lib'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { moveNextPart } from '../../playout/moveNextPart'
import _ = require('underscore')
import { ProcessedShowStyleConfig } from '../config'
import { DatastorePersistenceMode } from '@sofie-automation/shared-lib/dist/core/model/TimelineDatastore'
import { getDatastoreId } from '../../playout/datastore'
import { executePeripheralDeviceAction, listPlayoutDevices } from '../../peripheralDevice'
import { PlayoutRundownModel } from '../../playout/model/PlayoutRundownModel'

export enum ActionPartChange {
	NONE = 0,
	SAFE_CHANGE = 1,
}

export class DatastoreActionExecutionContext
	extends ShowStyleUserContext
	implements IDataStoreActionExecutionContext, IEventContext
{
	protected readonly _context: JobContext

	constructor(
		contextInfo: UserContextInfo,
		context: JobContext,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, context, showStyle, watchedPackages)
		this._context = context
	}

	async setTimelineDatastoreValue(key: string, value: unknown, mode: DatastorePersistenceMode): Promise<void> {
		const studioId = this._context.studioId
		const id = protectString(`${studioId}_${key}`)
		const collection = this._context.directCollections.TimelineDatastores

		await collection.replace({
			_id: id,
			studioId: studioId,

			key,
			value,

			modified: Date.now(),
			mode,
		})
	}

	async removeTimelineDatastoreValue(key: string): Promise<void> {
		const studioId = this._context.studioId
		const id = getDatastoreId(studioId, key)
		const collection = this._context.directCollections.TimelineDatastores

		await collection.remove({ _id: id })
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}

/** Actions */
export class ActionExecutionContext extends ShowStyleUserContext implements IActionExecutionContext, IEventContext {
	private readonly _context: JobContext
	private readonly _cache: PlayoutModel
	private readonly rundown: PlayoutRundownModel

	/** To be set by any mutation methods on this context. Indicates to core how extensive the changes are to the current partInstance */
	public currentPartState: ActionPartChange = ActionPartChange.NONE
	/** To be set by any mutation methods on this context. Indicates to core how extensive the changes are to the next partInstance */
	public nextPartState: ActionPartChange = ActionPartChange.NONE
	public takeAfterExecute: boolean
	public queuedPartInstanceId: PartInstanceId | undefined = undefined

	constructor(
		contextInfo: UserContextInfo,
		context: JobContext,
		cache: PlayoutModel,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		_showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: PlayoutRundownModel,
		watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, context, showStyle, watchedPackages)
		this._context = context
		this._cache = cache
		this.rundown = rundown
		this.takeAfterExecute = false
	}

	private _getPartInstance(part: 'current' | 'next'): PlayoutPartInstanceModel | null {
		switch (part) {
			case 'current':
				return this._cache.CurrentPartInstance
			case 'next':
				return this._cache.NextPartInstance
			default:
				assertNever(part)
				logger.warn(`Blueprint action requested unknown PartInstance "${part}"`)
				throw new Error(`Unknown part "${part}"`)
		}
	}

	async getPartInstance(part: 'current' | 'next'): Promise<IBlueprintPartInstance | undefined> {
		const partInstance = this._getPartInstance(part)

		return partInstance ? convertPartInstanceToBlueprints(partInstance.PartInstance) : undefined
	}
	async getPieceInstances(part: 'current' | 'next'): Promise<IBlueprintPieceInstance[]> {
		const partInstance = this._getPartInstance(part)
		return partInstance?.PieceInstances?.map((p) => convertPieceInstanceToBlueprints(p.PieceInstance)) ?? []
	}
	async getResolvedPieceInstances(part: 'current' | 'next'): Promise<IBlueprintResolvedPieceInstance[]> {
		const partInstance = this._getPartInstance(part)
		if (!partInstance) {
			return []
		}

		const resolvedInstances = getResolvedPiecesForCurrentPartInstance(
			this._context,
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
		if (options?.pieceMetaDataFilter) {
			for (const [key, value] of Object.entries<unknown>(options.pieceMetaDataFilter)) {
				// TODO do we need better validation here?
				// It should be pretty safe as we are working with the cache version (for now)
				query[`piece.metaData.${key}`] = value
			}
		}

		if (options?.excludeCurrentPart && this._cache.Playlist.currentPartInfo) {
			query['partInstanceId'] = { $ne: this._cache.Playlist.currentPartInfo.partInstanceId }
		}

		const sourceLayerId = Array.isArray(sourceLayerId0) ? sourceLayerId0 : [sourceLayerId0]

		const lastPieceInstance = await innerFindLastPieceOnLayer(
			this._context,
			this._cache,
			sourceLayerId,
			options?.originalOnly || false,
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
		if (options?.pieceMetaDataFilter) {
			for (const [key, value] of Object.entries<unknown>(options.pieceMetaDataFilter)) {
				// TODO do we need better validation here?
				// It should be pretty safe as we are working with the cache version (for now)
				query[`metaData.${key}`] = value
			}
		}

		if (options?.excludeCurrentPart && this._cache.CurrentPartInstance) {
			query['startPartId'] = { $ne: this._cache.CurrentPartInstance.PartInstance.part._id }
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

		const cached = this._cache.getPartInstance(partInstanceId)
		if (cached) {
			return convertPartInstanceToBlueprints(cached.PartInstance)
		}

		// It might be reset and so not in the cache
		const rundownIds = this._cache.getRundownIds()
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
			startRundownId: { $in: this._cache.getRundownIds() },
		})
		if (!pieceDB) throw new Error(`Cannot find Piece ${piece._id}`)

		const rundown = this._cache.getRundown(pieceDB.startRundownId)
		const segment = rundown?.getSegment(pieceDB.startSegmentId)
		const part = segment?.getPart(pieceDB.startPartId)
		return part ? convertPartToBlueprints(part) : undefined
	}

	async insertPiece(part: 'current' | 'next', rawPiece: IBlueprintPiece): Promise<IBlueprintPieceInstance> {
		const partInstance = this._getPartInstance(part)
		if (!partInstance) {
			throw new Error('Cannot insert piece when no active part')
		}

		const rundown = this._cache.getRundown(partInstance.PartInstance.rundownId)
		if (!rundown) {
			throw new Error('Failed to find rundown of partInstance')
		}

		const trimmedPiece: IBlueprintPiece = _.pick(rawPiece, IBlueprintPieceObjectsSampleKeys)

		const piece = postProcessPieces(
			this._context,
			[trimmedPiece],
			this.showStyleCompound.blueprintId,
			partInstance.PartInstance.rundownId,
			partInstance.PartInstance.segmentId,
			partInstance.PartInstance.part._id,
			part === 'current'
		)[0]
		piece._id = getRandomId() // Make id random, as postProcessPieces is too predictable (for ingest)

		// Do the work
		const newPieceInstance = partInstance.insertAdlibbedPiece(piece, undefined)

		if (part === 'current') {
			this.currentPartState = Math.max(this.currentPartState, ActionPartChange.SAFE_CHANGE)
		} else {
			this.nextPartState = Math.max(this.nextPartState, ActionPartChange.SAFE_CHANGE)
		}

		return convertPieceInstanceToBlueprints(newPieceInstance.PieceInstance)
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

		const foundPieceInstance = this._cache.findPieceInstance(protectString(pieceInstanceId))
		if (!foundPieceInstance) {
			throw new Error('PieceInstance could not be found')
		}

		const { pieceInstance } = foundPieceInstance

		if (pieceInstance.PieceInstance.infinite?.fromPreviousPart) {
			throw new Error('Cannot update an infinite piece that is continued from a previous part')
		}

		const updatesCurrentPart: ActionPartChange =
			pieceInstance.PieceInstance.partInstanceId === this._cache.Playlist.currentPartInfo?.partInstanceId
				? ActionPartChange.SAFE_CHANGE
				: ActionPartChange.NONE
		const updatesNextPart: ActionPartChange =
			pieceInstance.PieceInstance.partInstanceId === this._cache.Playlist.nextPartInfo?.partInstanceId
				? ActionPartChange.SAFE_CHANGE
				: ActionPartChange.NONE
		if (!updatesCurrentPart && !updatesNextPart) {
			throw new Error('Can only update piece instances in current or next part instance')
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
		if (timelineObjectsString !== undefined) pieceInstance.updatePieceProps({ timelineObjectsString })

		// setupPieceInstanceInfiniteProperties(pieceInstance)

		this.nextPartState = Math.max(this.nextPartState, updatesNextPart)
		this.currentPartState = Math.max(this.currentPartState, updatesCurrentPart)

		return convertPieceInstanceToBlueprints(pieceInstance.PieceInstance)
	}
	async queuePart(rawPart: IBlueprintPart, rawPieces: IBlueprintPiece[]): Promise<IBlueprintPartInstance> {
		const currentPartInstance = this._cache.CurrentPartInstance
		if (!currentPartInstance) {
			throw new Error('Cannot queue part when no current partInstance')
		}

		if (this.nextPartState !== ActionPartChange.NONE) {
			// Ensure we dont insert a piece into a part before replacing it with a queued part, as this will cause some data integrity issues
			// This could be changed if we have a way to abort the pending changes in the nextPart.
			// Future: perhaps this could be dropped as only the instance will have changed, and that will be trashed by the setAsNext?
			throw new Error('Cannot queue part when next part has already been modified')
		}

		if (isTooCloseToAutonext(currentPartInstance.PartInstance, true)) {
			throw new Error('Too close to an autonext to queue a part')
		}

		if (rawPieces.length === 0) {
			throw new Error('New part must contain at least one piece')
		}

		const newPart: Omit<DBPart, 'segmentId' | 'rundownId'> = {
			...rawPart,
			_id: getRandomId(),
			_rank: 99999, // Corrected in innerStartQueuedAdLib
			notes: [],
			invalid: false,
			invalidReason: undefined,
			floated: false,
			expectedDurationWithPreroll: undefined, // Filled in later
		}

		const pieces = postProcessPieces(
			this._context,
			rawPieces,
			this.showStyleCompound.blueprintId,
			currentPartInstance.PartInstance.rundownId,
			currentPartInstance.PartInstance.segmentId,
			newPart._id,
			false
		)

		if (!isPartPlayable(newPart)) {
			throw new Error('Cannot queue a part which is not playable')
		}

		const newPartInstance = this._cache.insertAdlibbedPartInstance(newPart)
		for (const piece of pieces) {
			newPartInstance.insertAdlibbedPiece(piece, undefined)
		}

		// Do the work
		await innerStartQueuedAdLib(this._context, this._cache, this.rundown, currentPartInstance, newPartInstance)

		this.nextPartState = ActionPartChange.SAFE_CHANGE
		this.queuedPartInstanceId = newPartInstance.PartInstance._id

		return convertPartInstanceToBlueprints(newPartInstance.PartInstance)
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

		const partInstance = this._getPartInstance(part)
		if (!partInstance) {
			throw new Error('PartInstance could not be found')
		}

		partInstance.updatePartProps(trimmedProps)

		this.nextPartState = Math.max(
			this.nextPartState,
			part === 'next' ? ActionPartChange.SAFE_CHANGE : ActionPartChange.NONE
		)
		this.currentPartState = Math.max(
			this.currentPartState,
			part === 'current' ? ActionPartChange.SAFE_CHANGE : ActionPartChange.NONE
		)

		return convertPartInstanceToBlueprints(partInstance.PartInstance)
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
		const partInstance = this._getPartInstance('next')
		if (!partInstance) {
			throw new Error('Cannot remove pieceInstances when no selected partInstance')
		}

		const rawPieceInstanceIds = protectStringArray<PieceInstanceId>(pieceInstanceIds)

		const removedPieceInstanceIds: PieceInstanceId[] = []

		for (const id of rawPieceInstanceIds) {
			if (partInstance.removePieceInstance(id)) {
				removedPieceInstanceIds.push(id)
			}
		}

		this.nextPartState = Math.max(this.nextPartState, ActionPartChange.SAFE_CHANGE)

		return unprotectStringArray(removedPieceInstanceIds)
	}

	async takeAfterExecuteAction(take: boolean): Promise<boolean> {
		this.takeAfterExecute = take

		return this.takeAfterExecute
	}

	async blockTakeUntil(time: Time | null): Promise<void> {
		if (time !== null && (time < getCurrentTime() || typeof time !== 'number'))
			throw new Error('Cannot block taking out of the current part, to a time in the past')

		const partInstance = this._cache.CurrentPartInstance
		if (!partInstance) {
			throw new Error('Cannot block take when there is no part playing')
		}

		partInstance.blockTakeUntil(time)
	}

	private _stopPiecesByRule(
		filter: (pieceInstance: ReadonlyDeep<PieceInstance>) => boolean,
		timeOffset: number | undefined
	) {
		if (!this._cache.Playlist.currentPartInfo) {
			return []
		}
		const partInstance = this._cache.CurrentPartInstance
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

		this._cache.deferAfterSave(async () => {
			await collection.replace({
				_id: id,
				studioId: studioId,

				key,
				value,

				modified: Date.now(),
				mode,
			})
		})
	}

	async removeTimelineDatastoreValue(key: string): Promise<void> {
		const studioId = this._context.studioId
		const id = getDatastoreId(studioId, key)
		const collection = this._context.directCollections.TimelineDatastores

		this._cache.deferAfterSave(async () => {
			await collection.remove({ _id: id })
		})
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}
