import * as React from 'react'
import { SourceLayerItem } from './SourceLayerItem'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { ISourceLayerUi, IOutputLayerUi, PartUi, PieceUi } from './SegmentTimelineContainer'
import { withMediaObjectStatus } from './withMediaObjectStatus'
import { Studio } from '../../../lib/collections/Studios'

interface IPropsHeader {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	mediaPreviewUrl: string
	// segment: SegmentUi
	part: PartUi
	partStartsAt: number
	partDuration: number
	piece: PieceUi
	playlist: RundownPlaylist
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	onClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	relative?: boolean
	outputGroupCollapsed: boolean
	followLiveLine: boolean
	autoNextPart: boolean
	liveLineHistorySize: number
	livePosition: number | null
	liveLinePadding: number
	scrollLeft: number
	scrollWidth: number
	studio: Studio
	layerIndex: number
}

export const SourceLayerItemContainer = withMediaObjectStatus<IPropsHeader, {}>()((props: IPropsHeader) => (
	<SourceLayerItem {...props} />
))
