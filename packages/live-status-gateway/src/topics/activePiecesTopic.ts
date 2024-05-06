import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WebSocketTopicBase, WebSocketTopic, CollectionObserver } from '../wsHandler'
import { PlaylistHandler } from '../collections/playlistHandler'
import { ShowStyleBaseExt, ShowStyleBaseHandler } from '../collections/showStyleBaseHandler'
import _ = require('underscore')
import { SelectedPieceInstances, PieceInstancesHandler, PieceInstanceMin } from '../collections/pieceInstancesHandler'
import { PieceStatus, toPieceStatus } from './helpers/pieceStatus'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

const THROTTLE_PERIOD_MS = 100

export interface ActivePiecesStatus {
	event: 'activePieces'
	rundownPlaylistId: string | null
	activePieces: PieceStatus[]
}

export class ActivePiecesTopic
	extends WebSocketTopicBase
	implements
		WebSocketTopic,
		CollectionObserver<DBRundownPlaylist>,
		CollectionObserver<ShowStyleBaseExt>,
		CollectionObserver<SelectedPieceInstances>
{
	public observerName = ActivePiecesTopic.name
	private _activePlaylistId: RundownPlaylistId | undefined
	private _activePieceInstances: PieceInstanceMin[] | undefined
	private _showStyleBaseExt: ShowStyleBaseExt | undefined
	private throttledSendStatusToAll: () => void

	constructor(logger: Logger) {
		super(ActivePiecesTopic.name, logger)
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
		const message = this._activePlaylistId
			? literal<ActivePiecesStatus>({
					event: 'activePieces',
					rundownPlaylistId: unprotectString(this._activePlaylistId),
					activePieces:
						this._activePieceInstances?.map((piece) => toPieceStatus(piece, this._showStyleBaseExt)) ?? [],
			  })
			: literal<ActivePiecesStatus>({
					event: 'activePieces',
					rundownPlaylistId: null,
					activePieces: [],
			  })

		for (const subscriber of subscribers) {
			this.sendMessage(subscriber, message)
		}
	}

	async update(
		source: string,
		data: DBRundownPlaylist | ShowStyleBaseExt | SelectedPieceInstances | undefined
	): Promise<void> {
		let hasAnythingChanged = false
		switch (source) {
			case PlaylistHandler.name: {
				const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
				this._logger.info(
					`${this._name} received playlist update ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
				)
				const previousActivePlaylistId = this._activePlaylistId
				this._activePlaylistId = unprotectString(rundownPlaylist?.activationId)
					? rundownPlaylist?._id
					: undefined

				if (previousActivePlaylistId !== this._activePlaylistId) {
					hasAnythingChanged = true
				}
				break
			}
			case ShowStyleBaseHandler.name: {
				const showStyleBaseExt = data ? (data as ShowStyleBaseExt) : undefined
				this._logger.info(`${this._name} received showStyleBase update from ${source}`)
				this._showStyleBaseExt = showStyleBaseExt
				hasAnythingChanged = true
				break
			}
			case PieceInstancesHandler.name: {
				const pieceInstances = data as SelectedPieceInstances
				this._logger.info(`${this._name} received pieceInstances update from ${source}`)
				if (pieceInstances.active !== this._activePieceInstances) {
					hasAnythingChanged = true
				}
				this._activePieceInstances = pieceInstances.active
				break
			}
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		if (hasAnythingChanged) {
			this.throttledSendStatusToAll()
		}
	}

	private sendStatusToAll() {
		this.sendStatus(this._subscribers)
	}
}
