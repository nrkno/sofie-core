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
	Time,
	TSR,
	IBlueprintPlayoutDevice,
} from '@sofie-automation/blueprints-integration'
import { PartInstanceId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutModel } from '../../playout/model/PlayoutModel'
import { UserContextInfo } from './CommonContext'
import { ShowStyleUserContext } from './ShowStyleUserContext'
import { WatchedPackagesHelper } from './watchedPackages'
import { getCurrentTime } from '../../lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { moveNextPart } from '../../playout/moveNextPart'
import { ProcessedShowStyleConfig } from '../config'
import { DatastorePersistenceMode } from '@sofie-automation/shared-lib/dist/core/model/TimelineDatastore'
import { getDatastoreId } from '../../playout/datastore'
import { executePeripheralDeviceAction, listPlayoutDevices } from '../../peripheralDevice'
import { ActionPartChange, PartAndPieceInstanceActionService } from './services/PartAndPieceInstanceActionService'

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
	public takeAfterExecute: boolean

	public get currentPartState(): ActionPartChange {
		return this.partAndPieceInstanceService.currentPartState
	}

	public get nextPartState(): ActionPartChange {
		return this.partAndPieceInstanceService.nextPartState
	}

	public get queuedPartInstanceId(): PartInstanceId | undefined {
		return this.partAndPieceInstanceService.queuedPartInstanceId
	}

	constructor(
		contextInfo: UserContextInfo,
		private readonly _context: JobContext,
		private readonly _playoutModel: PlayoutModel,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		_showStyleBlueprintConfig: ProcessedShowStyleConfig,
		watchedPackages: WatchedPackagesHelper,
		private readonly partAndPieceInstanceService: PartAndPieceInstanceActionService
	) {
		super(contextInfo, _context, showStyle, watchedPackages)
		this.takeAfterExecute = false
	}

	async getPartInstance(part: 'current' | 'next'): Promise<IBlueprintPartInstance | undefined> {
		return this.partAndPieceInstanceService.getPartInstance(part)
	}

	async getPieceInstances(part: 'current' | 'next'): Promise<IBlueprintPieceInstance[]> {
		return this.partAndPieceInstanceService.getPieceInstances(part)
	}

	async getResolvedPieceInstances(part: 'current' | 'next'): Promise<IBlueprintResolvedPieceInstance[]> {
		return this.partAndPieceInstanceService.getResolvedPieceInstances(part)
	}

	async findLastPieceOnLayer(
		sourceLayerId0: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			originalOnly?: boolean
			piecePrivateDataFilter?: any
		}
	): Promise<IBlueprintPieceInstance | undefined> {
		return this.partAndPieceInstanceService.findLastPieceOnLayer(sourceLayerId0, options)
	}

	async findLastScriptedPieceOnLayer(
		sourceLayerId0: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			piecePrivateDataFilter?: any
		}
	): Promise<IBlueprintPieceDB | undefined> {
		return this.partAndPieceInstanceService.findLastScriptedPieceOnLayer(sourceLayerId0, options)
	}

	async getPartInstanceForPreviousPiece(piece: IBlueprintPieceInstance): Promise<IBlueprintPartInstance> {
		return this.partAndPieceInstanceService.getPartInstanceForPreviousPiece(piece)
	}

	async getPartForPreviousPiece(piece: Partial<Pick<IBlueprintPieceDB, '_id'>>): Promise<IBlueprintPart | undefined> {
		return this.partAndPieceInstanceService.getPartForPreviousPiece(piece)
	}

	async insertPiece(part: 'current' | 'next', rawPiece: IBlueprintPiece): Promise<IBlueprintPieceInstance> {
		return this.partAndPieceInstanceService.insertPiece(part, rawPiece)
	}

	async updatePieceInstance(
		pieceInstanceId: string,
		piece: Partial<OmitId<IBlueprintPiece>>
	): Promise<IBlueprintPieceInstance> {
		return this.partAndPieceInstanceService.updatePieceInstance(pieceInstanceId, piece)
	}

	async queuePart(rawPart: IBlueprintPart, rawPieces: IBlueprintPiece[]): Promise<IBlueprintPartInstance> {
		return this.partAndPieceInstanceService.queuePart(rawPart, rawPieces)
	}

	async moveNextPart(partDelta: number, segmentDelta: number): Promise<void> {
		await moveNextPart(this._context, this._playoutModel, partDelta, segmentDelta)
	}

	async updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart>
	): Promise<IBlueprintPartInstance> {
		return this.partAndPieceInstanceService.updatePartInstance(part, props)
	}

	async stopPiecesOnLayers(sourceLayerIds: string[], timeOffset?: number | undefined): Promise<string[]> {
		return this.partAndPieceInstanceService.stopPiecesOnLayers(sourceLayerIds, timeOffset)
	}

	async stopPieceInstances(pieceInstanceIds: string[], timeOffset?: number | undefined): Promise<string[]> {
		return this.partAndPieceInstanceService.stopPieceInstances(pieceInstanceIds, timeOffset)
	}

	async removePieceInstances(part: 'next', pieceInstanceIds: string[]): Promise<string[]> {
		return this.partAndPieceInstanceService.removePieceInstances(part, pieceInstanceIds)
	}

	async takeAfterExecuteAction(take: boolean): Promise<boolean> {
		this.takeAfterExecute = take

		return this.takeAfterExecute
	}

	async blockTakeUntil(time: Time | null): Promise<void> {
		if (time !== null && (time < getCurrentTime() || typeof time !== 'number'))
			throw new Error('Cannot block taking out of the current part, to a time in the past')

		const partInstance = this._playoutModel.currentPartInstance
		if (!partInstance) {
			throw new Error('Cannot block take when there is no part playing')
		}

		partInstance.blockTakeUntil(time)
	}

	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return this.partAndPieceInstanceService.hackGetMediaObjectDuration(mediaId)
	}

	async listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]> {
		return listPlayoutDevices(this._context, this._playoutModel)
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

		this._playoutModel.deferAfterSave(async () => {
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

		this._playoutModel.deferAfterSave(async () => {
			await collection.remove({ _id: id })
		})
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}
