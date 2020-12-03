import { SegmentId } from '../../../lib/collections/Segments'
import { PartId } from '../../../lib/collections/Parts'
import EventEmitter from 'events'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { PieceId } from '../../../lib/collections/Pieces'
import { ShelfTabs } from '../Shelf/Shelf'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { IAdLibListItem } from '../Shelf/AdLibListItem'
import { BucketAdLibItem } from '../Shelf/RundownViewBuckets'
import { RundownId } from '../../../lib/collections/Rundowns'

export enum RundownViewEvents {
	REWIND_SEGMENTS = 'rundownRewindSegments',
	GO_TO_LIVE_SEGMENT = 'goToLiveSegment',
	GO_TO_TOP = 'goToTop',
	SEGMENT_ZOOM_ON = 'segmentZoomOn',
	SEGMENT_ZOOM_OFF = 'segmentZoomOff',
	REVEAL_IN_SHELF = 'revealInShelf',
	SWITCH_SHELF_TAB = 'switchShelfTab',
	GO_TO_PART = 'goToPart',
	GO_TO_PART_INSTANCE = 'goToPartInstance',
	SELECT_PIECE = 'selectPiece',
	HIGHLIGHT = 'highlight',
}

export interface RevealInShelfEvent {
	pieceId: PieceId
}

export interface SwitchToShelfTabEvent {
	tab: ShelfTabs | string
}

export interface GoToPartEvent {
	segmentId: SegmentId
	partId: PartId
}

export interface GoToPartInstanceEvent {
	segmentId: SegmentId
	partInstanceId: PartInstanceId
}

export interface SelectPieceEvent {
	piece: PieceUi | BucketAdLibItem | IAdLibListItem
}

export interface HighlightEvent {
	rundownId?: RundownId
	segmentId?: SegmentId
	partId?: PartId
	pieceId?: PieceId
}

class RundownViewEventBus0 extends EventEmitter {
	emit(event: RundownViewEvents.REWIND_SEGMENTS): boolean
	emit(event: RundownViewEvents.GO_TO_LIVE_SEGMENT): boolean
	emit(event: RundownViewEvents.GO_TO_TOP): boolean
	emit(event: RundownViewEvents.SEGMENT_ZOOM_ON): boolean
	emit(event: RundownViewEvents.SEGMENT_ZOOM_OFF): boolean
	emit(event: RundownViewEvents.REVEAL_IN_SHELF, e: RevealInShelfEvent): boolean
	emit(event: RundownViewEvents.SWITCH_SHELF_TAB, e: SwitchToShelfTabEvent): boolean
	emit(event: RundownViewEvents.GO_TO_PART, e: GoToPartEvent): boolean
	emit(event: RundownViewEvents.GO_TO_PART_INSTANCE, e: GoToPartInstanceEvent): boolean
	emit(event: RundownViewEvents.SELECT_PIECE, e: SelectPieceEvent): boolean
	emit(event: RundownViewEvents.HIGHLIGHT, e: HighlightEvent): boolean
	emit(event: string, ...args: any[]) {
		return super.emit(event, args)
	}

	on(event: RundownViewEvents.REWIND_SEGMENTS, listener: () => void): this
	on(event: RundownViewEvents.GO_TO_LIVE_SEGMENT, listener: () => void): this
	on(event: RundownViewEvents.GO_TO_TOP, listener: () => void): this
	on(event: RundownViewEvents.SEGMENT_ZOOM_ON, listener: () => void): this
	on(event: RundownViewEvents.SEGMENT_ZOOM_OFF, listener: () => void): this
	on(event: RundownViewEvents.REVEAL_IN_SHELF, listener: (e: RevealInShelfEvent) => void): this
	on(event: RundownViewEvents.SWITCH_SHELF_TAB, listener: (e: SwitchToShelfTabEvent) => void): this
	on(event: RundownViewEvents.GO_TO_PART, listener: (e: GoToPartEvent) => void): this
	on(event: RundownViewEvents.GO_TO_PART_INSTANCE, listener: (e: GoToPartInstanceEvent) => void): this
	on(event: RundownViewEvents.SELECT_PIECE, listener: (e: SelectPieceEvent) => void): this
	on(event: RundownViewEvents.HIGHLIGHT, listener: (e: HighlightEvent) => void): this
	on(event: string, listener: (...args: any[]) => void) {
		return super.on(event, listener)
	}
}

const RundownViewEventBus = new RundownViewEventBus0()

export default RundownViewEventBus
