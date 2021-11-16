import { ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { Studio } from '../../../../../lib/collections/Studios'
import { OffsetPosition } from '../../../../utils/positions'
import { PieceUi } from '../../../SegmentContainer/withResolvedSegment'
import { CameraThumbnailRenderer } from './CameraThumbnailRenderer'
import { DefaultThumbnailRenderer } from './DefaultThumbnailRenderer'
import { SplitsThumbnailRenderer } from './SplitsThumbnailRenderer'
import { VTThumbnailRenderer } from './VTThumbnailRenderer'

export interface IProps {
	studio: Studio
	pieceInstance: PieceUi
	hoverScrubTimePosition: number
	hovering: boolean
	originPosition: OffsetPosition
	layer: ISourceLayer | undefined
}

export default function renderThumbnail(props: IProps) {
	switch (props.layer?.type) {
		case SourceLayerType.VT:
		case SourceLayerType.LIVE_SPEAK:
			return VTThumbnailRenderer(props)
		case SourceLayerType.CAMERA:
		case SourceLayerType.REMOTE:
			return CameraThumbnailRenderer(props)
		case SourceLayerType.SPLITS:
			return SplitsThumbnailRenderer(props)
		default:
			return DefaultThumbnailRenderer(props)
	}
}
