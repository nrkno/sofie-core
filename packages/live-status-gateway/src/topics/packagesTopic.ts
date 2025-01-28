import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WebSocketTopicBase, WebSocketTopic, PickArr } from '../wsHandler'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { UIPieceContentStatus } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { CollectionHandlers } from '../liveStatusServer'

const THROTTLE_PERIOD_MS = 200

interface PackageStatus {
	packageName: string | null
	statusCode: PieceStatusCode

	rundownId: string
	partId?: string
	segmentId?: string

	pieceId: string

	thumbnailUrl?: string
	previewUrl?: string
}

export interface PackagesStatus {
	event: 'packages'
	rundownPlaylistId: string | null
	packages: PackageStatus[]
}

const PLAYLIST_KEYS = ['_id', 'activationId'] as const
type Playlist = PickArr<DBRundownPlaylist, typeof PLAYLIST_KEYS>

export class PackagesTopic extends WebSocketTopicBase implements WebSocketTopic {
	public observerName = PackagesTopic.name
	private _activePlaylist: Playlist | undefined
	private _pieceContentStatuses: UIPieceContentStatus[] = []

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(PackagesTopic.name, logger, THROTTLE_PERIOD_MS)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.pieceContentStatusesHandler.subscribe(this.onPieceContentStatusUpdate)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const packagesStatus: PackagesStatus = {
			event: 'packages',
			rundownPlaylistId: this._activePlaylist ? unprotectString(this._activePlaylist._id) : null,
			packages: this._pieceContentStatuses.map((contentStatus) => ({
				packageName: contentStatus.status.packageName,
				statusCode: contentStatus.status.status,
				pieceId: unprotectString(contentStatus.pieceId),
				rundownId: unprotectString(contentStatus.rundownId),
				partId: unprotectString(contentStatus.partId),
				segmentId: unprotectString(contentStatus.segmentId),
				previewUrl: contentStatus.status.previewUrl,
				thumbnailUrl: contentStatus.status.thumbnailUrl,
			})),
		}

		for (const subscriber of subscribers) {
			this.sendMessage(subscriber, packagesStatus)
		}
	}

	private onPlaylistUpdate = (rundownPlaylist: Playlist | undefined): void => {
		this.logUpdateReceived(
			'playlist',
			`rundownPlaylistId ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
		)
		const prevPlaylist = this._activePlaylist
		this._activePlaylist = rundownPlaylist

		if (prevPlaylist?._id !== this._activePlaylist?._id) {
			this.throttledSendStatusToAll()
		}
	}

	private onPieceContentStatusUpdate = (data: UIPieceContentStatus[] | undefined): void => {
		this.logUpdateReceived('pieceContentStatuses')
		if (!data) return
		this._pieceContentStatuses = data
		this.throttledSendStatusToAll()
	}
}
