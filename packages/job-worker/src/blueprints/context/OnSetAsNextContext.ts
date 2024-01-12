import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { UserContextInfo } from './CommonContext'
import { ShowStyleUserContext } from './ShowStyleUserContext'
import {
	IBlueprintMutatablePart,
	IBlueprintPart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
	IEventContext,
	IOnSetAsNextContext,
} from '@sofie-automation/blueprints-integration'
import {
	ActionPartChange,
	IPartAndPieceInstanceActionContext,
	PartAndPieceInstanceActionService,
} from './services/PartAndPieceInstanceActionService'
import { WatchedPackagesHelper } from './watchedPackages'
import { PlayoutModel } from '../../playout/model/PlayoutModel'
import { ReadonlyDeep } from 'type-fest'
import { getCurrentTime } from '../../lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

export class OnSetAsNextContext
	extends ShowStyleUserContext
	implements IOnSetAsNextContext, IEventContext, IPartAndPieceInstanceActionContext
{
	constructor(
		contextInfo: UserContextInfo,
		context: JobContext,
		private playoutModel: PlayoutModel,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		watchedPackages: WatchedPackagesHelper,
		private partAndPieceInstanceService: PartAndPieceInstanceActionService
	) {
		super(contextInfo, context, showStyle, watchedPackages)
	}

	public get nextPartState(): ActionPartChange {
		return this.partAndPieceInstanceService.nextPartState
	}

	public get currentPartState(): ActionPartChange {
		return this.partAndPieceInstanceService.nextPartState
	}

	async getPartInstance(part: 'current' | 'next'): Promise<IBlueprintPartInstance<unknown> | undefined> {
		return this.partAndPieceInstanceService.getPartInstance(part)
	}

	async getPieceInstances(part: 'current' | 'next'): Promise<IBlueprintPieceInstance<unknown>[]> {
		return this.partAndPieceInstanceService.getPieceInstances(part)
	}

	async getResolvedPieceInstances(part: 'current' | 'next'): Promise<IBlueprintResolvedPieceInstance<unknown>[]> {
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

	async insertPiece(_part: 'next', piece: IBlueprintPiece<unknown>): Promise<IBlueprintPieceInstance<unknown>> {
		return this.partAndPieceInstanceService.insertPiece('next', piece)
	}

	async updatePieceInstance(
		pieceInstanceId: string,
		piece: Partial<IBlueprintPiece<unknown>>
	): Promise<IBlueprintPieceInstance<unknown>> {
		if (protectString(pieceInstanceId) === this.playoutModel.playlist.currentPartInfo?.partInstanceId) {
			throw new Error('Cannot update a Piece Instance from the current Part Instance')
		}
		return this.partAndPieceInstanceService.updatePieceInstance(pieceInstanceId, piece)
	}

	async updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart<unknown>>
	): Promise<IBlueprintPartInstance<unknown>> {
		return this.partAndPieceInstanceService.updatePartInstance(part, props)
	}

	async removePieceInstances(_part: 'next', pieceInstanceIds: string[]): Promise<string[]> {
		return this.partAndPieceInstanceService.removePieceInstances('next', pieceInstanceIds)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}
