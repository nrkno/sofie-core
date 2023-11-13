import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WebSocketTopicBase, WebSocketTopic, CollectionObserver } from '../wsHandler'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlaylistHandler } from '../collections/playlist'
import { groupByToMap } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { SegmentsHandler } from '../collections/segmentsHandler'
import isShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'

interface SegmentStatus {
	id: string
	identifier?: string
	rundownId: string
	name: string
}

export interface SegmentsStatus {
	event: 'segments'
	rundownPlaylistId: string | null
	segments: SegmentStatus[]
}

export class SegmentsTopic
	extends WebSocketTopicBase
	implements WebSocketTopic, CollectionObserver<DBSegment[]>, CollectionObserver<DBRundownPlaylist>
{
	public observerName = SegmentsTopic.name
	private _activePlaylist: DBRundownPlaylist | undefined
	private _segments: DBSegment[] = []
	private _orderedSegments: DBSegment[] = []

	constructor(logger: Logger) {
		super(SegmentsTopic.name, logger)
	}

	addSubscriber(ws: WebSocket): void {
		super.addSubscriber(ws)
		this.sendStatus([ws])
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const segmentsStatus: SegmentsStatus = {
			event: 'segments',
			rundownPlaylistId: this._activePlaylist ? unprotectString(this._activePlaylist._id) : null,
			segments: this._orderedSegments.map((segment) => ({
				id: unprotectString(segment._id),
				rundownId: unprotectString(segment.rundownId),
				name: segment.name,
				identifier: segment.identifier,
			})),
		}

		for (const subscriber of subscribers) {
			this.sendMessage(subscriber, segmentsStatus)
		}
	}

	async update(source: string, data: DBRundownPlaylist | DBSegment[] | undefined): Promise<void> {
		const prevSegments = this._segments
		const prevRundownOrder = this._activePlaylist?.rundownIdsInOrder ?? []
		const prevPlaylistId = this._activePlaylist?._id
		switch (source) {
			case PlaylistHandler.name: {
				this._activePlaylist = data as DBRundownPlaylist | undefined
				this._logger.info(`${this._name} received playlist update from ${source}`)
				break
			}
			case SegmentsHandler.name: {
				this._segments = data as DBSegment[]
				this._logger.info(`${this._name} received segments update from ${source}`)
				break
			}
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		if (this._activePlaylist) {
			if (
				this._activePlaylist._id !== prevPlaylistId ||
				prevSegments !== this._segments ||
				!isShallowEqual(prevRundownOrder, this._activePlaylist.rundownIdsInOrder)
			) {
				const segmentsByRundownId = groupByToMap(this._segments, 'rundownId')
				this._orderedSegments = this._activePlaylist.rundownIdsInOrder.flatMap((rundownId) => {
					return segmentsByRundownId.get(rundownId)?.sort((a, b) => a._rank - b._rank) ?? []
				})
				this.sendStatus(this._subscribers)
			}
		} else {
			this._orderedSegments = []
			this.sendStatus(this._subscribers)
		}
	}
}
