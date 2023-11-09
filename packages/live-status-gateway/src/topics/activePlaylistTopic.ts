import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBShowStyleBase, OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { IOutputLayer, ISourceLayer } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WebSocketTopicBase, WebSocketTopic, CollectionObserver } from '../wsHandler'
import { SelectedPartInstances, PartInstancesHandler } from '../collections/partInstancesHandler'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { PlaylistHandler } from '../collections/playlistHandler'
import { ShowStyleBaseHandler } from '../collections/showStyleBaseHandler'
import { CurrentSegmentTiming, calculateCurrentSegmentTiming } from './helpers/segmentTiming'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartsHandler } from '../collections/partsHandler'
import _ = require('underscore')
import { PartTiming, calculateCurrentPartTiming } from './helpers/partTiming'
import { SelectedPieceInstances } from '../collections/pieceInstancesHandler'
import { PieceInstancesHandler } from '../collections/pieceInstancesHandler'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

const THROTTLE_PERIOD_MS = 100

interface PieceStatus {
	id: string
	name: string
	sourceLayer: string
	outputLayer: string
	tags?: string[]
}

interface PartStatus {
	id: string
	segmentId: string
	name: string
	autoNext?: boolean
	pieces: PieceStatus[]
}

interface CurrentPartStatus extends PartStatus {
	timing: PartTiming
}

interface CurrentSegmentStatus {
	id: string
	timing: CurrentSegmentTiming
}

export interface ActivePlaylistStatus {
	event: string
	id: string | null
	name: string
	rundownIds: string[]
	currentPart: CurrentPartStatus | null
	currentSegment: CurrentSegmentStatus | null
	nextPart: PartStatus | null
	activePieces: PieceStatus[]
}

export class ActivePlaylistTopic
	extends WebSocketTopicBase
	implements
		WebSocketTopic,
		CollectionObserver<DBRundownPlaylist>,
		CollectionObserver<SelectedPartInstances>,
		CollectionObserver<DBPart[]>,
		CollectionObserver<SelectedPieceInstances>
{
	public observerName = ActivePlaylistTopic.name
	private _sourceLayersMap: Map<string, string> = new Map()
	private _outputLayersMap: Map<string, string> = new Map()
	private _activePlaylist: DBRundownPlaylist | undefined
	private _currentPartInstance: DBPartInstance | undefined
	private _nextPartInstance: DBPartInstance | undefined
	private _firstInstanceInSegmentPlayout: DBPartInstance | undefined
	private _partInstancesInCurrentSegment: DBPartInstance[] = []
	private _partsBySegmentId: Record<string, DBPart[]> = {}
	private _pieceInstances: SelectedPieceInstances | undefined
	private throttledSendStatusToAll: () => void

	constructor(logger: Logger) {
		super(ActivePlaylistTopic.name, logger)
		this.throttledSendStatusToAll = _.throttle(this.sendStatusToAll.bind(this), THROTTLE_PERIOD_MS, {
			leading: false,
			trailing: true,
		})
	}

	addSubscriber(ws: WebSocket): void {
		super.addSubscriber(ws)
		this.sendStatus([ws])
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		if (
			this._currentPartInstance?._id !== this._activePlaylist?.currentPartInfo?.partInstanceId ||
			this._nextPartInstance?._id !== this._activePlaylist?.nextPartInfo?.partInstanceId ||
			(this._pieceInstances?.currentPartInstance[0] &&
				this._pieceInstances.currentPartInstance[0].partInstanceId !== this._currentPartInstance?._id) ||
			(this._pieceInstances?.nextPartInstance[0] &&
				this._pieceInstances.nextPartInstance[0].partInstanceId !== this._nextPartInstance?._id)
		) {
			// data is inconsistent, let's wait
			return
		}

		const currentPart = this._currentPartInstance ? this._currentPartInstance.part : null
		const nextPart = this._nextPartInstance ? this._nextPartInstance.part : null

		const message = this._activePlaylist
			? literal<ActivePlaylistStatus>({
					event: 'activePlaylist',
					id: unprotectString(this._activePlaylist._id),
					name: this._activePlaylist.name,
					rundownIds: this._activePlaylist.rundownIdsInOrder.map((r) => unprotectString(r)),
					currentPart:
						this._currentPartInstance && currentPart
							? literal<CurrentPartStatus>({
									id: unprotectString(currentPart._id),
									name: currentPart.title,
									autoNext: currentPart.autoNext,
									segmentId: unprotectString(currentPart.segmentId),
									timing: calculateCurrentPartTiming(
										this._currentPartInstance,
										this._partInstancesInCurrentSegment
									),
									pieces:
										this._pieceInstances?.currentPartInstance.map((piece) =>
											this.toPieceStatus(piece)
										) ?? [],
							  })
							: null,
					currentSegment:
						this._currentPartInstance && currentPart
							? literal<CurrentSegmentStatus>({
									id: unprotectString(currentPart.segmentId),
									timing: calculateCurrentSegmentTiming(
										this._currentPartInstance,
										this._firstInstanceInSegmentPlayout,
										this._partInstancesInCurrentSegment,
										this._partsBySegmentId[unprotectString(currentPart.segmentId)] ?? []
									),
							  })
							: null,
					nextPart: nextPart
						? literal<PartStatus>({
								id: unprotectString(nextPart._id),
								name: nextPart.title,
								autoNext: nextPart.autoNext,
								segmentId: unprotectString(nextPart.segmentId),
								pieces:
									this._pieceInstances?.nextPartInstance.map((piece) => this.toPieceStatus(piece)) ??
									[],
						  })
						: null,
					activePieces: this._pieceInstances?.active.map((piece) => this.toPieceStatus(piece)) ?? [],
			  })
			: literal<ActivePlaylistStatus>({
					event: 'activePlaylist',
					id: null,
					name: '',
					rundownIds: [],
					currentPart: null,
					currentSegment: null,
					nextPart: null,
					activePieces: [],
			  })

		for (const subscriber of subscribers) {
			this.sendMessage(subscriber, message)
		}
	}

	async update(
		source: string,
		data:
			| DBRundownPlaylist
			| DBShowStyleBase
			| SelectedPartInstances
			| DBPart[]
			| SelectedPieceInstances
			| undefined
	): Promise<void> {
		switch (source) {
			case PlaylistHandler.name: {
				const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
				this._logger.info(
					`${this._name} received playlist update ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
				)
				this._activePlaylist = unprotectString(rundownPlaylist?.activationId) ? rundownPlaylist : undefined
				break
			}
			case ShowStyleBaseHandler.name: {
				const sourceLayers: SourceLayers = data
					? applyAndValidateOverrides((data as DBShowStyleBase).sourceLayersWithOverrides).obj
					: {}
				const outputLayers: OutputLayers = data
					? applyAndValidateOverrides((data as DBShowStyleBase).outputLayersWithOverrides).obj
					: {}
				this._logger.info(
					`${this._name} received showStyleBase update with sourceLayers [${Object.values<
						ISourceLayer | undefined
					>(sourceLayers).map(
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						(s) => s!.name
					)}]`
				)
				this._logger.info(
					`${this._name} received showStyleBase update with outputLayers [${Object.values<
						IOutputLayer | undefined
					>(outputLayers).map(
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						(s) => s!.name
					)}]`
				)
				this._sourceLayersMap.clear()
				this._outputLayersMap.clear()
				for (const [layerId, sourceLayer] of Object.entries<ISourceLayer | undefined>(sourceLayers)) {
					if (sourceLayer === undefined || sourceLayer === null) continue
					this._sourceLayersMap.set(layerId, sourceLayer.name)
				}
				for (const [layerId, outputLayer] of Object.entries<IOutputLayer | undefined>(outputLayers)) {
					if (outputLayer === undefined || outputLayer === null) continue
					this._outputLayersMap.set(layerId, outputLayer.name)
				}
				break
			}
			case PartInstancesHandler.name: {
				const partInstances = data as SelectedPartInstances
				this._logger.info(
					`${this._name} received partInstances update from ${source} with ${partInstances.inCurrentSegment.length} instances in segment`
				)
				this._currentPartInstance = partInstances.current
				this._nextPartInstance = partInstances.next
				this._firstInstanceInSegmentPlayout = partInstances.firstInSegmentPlayout
				this._partInstancesInCurrentSegment = partInstances.inCurrentSegment
				break
			}
			case PartsHandler.name: {
				this._partsBySegmentId = _.groupBy(data as DBPart[], 'segmentId')
				this._logger.info(`${this._name} received parts update from ${source}`)
				break
			}
			case PieceInstancesHandler.name: {
				const pieceInstances = data as SelectedPieceInstances
				this._logger.info(`${this._name} received pieceInstances update from ${source}`)
				this._pieceInstances = pieceInstances
				break
			}
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		this.throttledSendStatusToAll()
	}

	private sendStatusToAll() {
		this.sendStatus(this._subscribers)
	}

	private toPieceStatus(pieceInstance: PieceInstance): PieceStatus {
		const sourceLayerName = this._sourceLayersMap.get(pieceInstance.piece.sourceLayerId)
		const outputLayerName = this._outputLayersMap.get(pieceInstance.piece.outputLayerId)
		return {
			id: unprotectString(pieceInstance._id),
			name: pieceInstance.piece.name,
			sourceLayer: sourceLayerName ?? 'invalid',
			outputLayer: outputLayerName ?? 'invalid',
			tags: pieceInstance.piece.tags,
		}
	}
}
