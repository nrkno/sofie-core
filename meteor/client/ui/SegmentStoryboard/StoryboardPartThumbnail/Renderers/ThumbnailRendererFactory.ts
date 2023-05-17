import { ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIStudio } from '../../../../../lib/api/studios'
import { assertNever } from '../../../../../lib/lib'
import { OffsetPosition } from '../../../../utils/positions'
import { PieceUi } from '../../../SegmentContainer/withResolvedSegment'
import { CameraThumbnailRenderer } from './CameraThumbnailRenderer'
import { DefaultThumbnailRenderer } from './DefaultThumbnailRenderer'
import { GraphicsThumbnailRenderer } from './GraphicsThumbnailRenderer'
import { LocalThumbnailRenderer } from './LocalThumbnailRenderer'
import { SplitsThumbnailRenderer } from './SplitsThumbnailRenderer'
import { VTThumbnailRenderer } from './VTThumbnailRenderer'

export interface IProps {
	partId: PartId
	partInstanceId: PartInstanceId
	partAutoNext: boolean
	partPlannedStoppedPlayback: number | undefined
	studio: UIStudio
	pieceInstance: PieceUi
	hoverScrubTimePosition: number
	hovering: boolean
	originPosition: OffsetPosition
	layer: ISourceLayer | undefined
	isLive: boolean
	isNext: boolean
}

export default function renderThumbnail(props: IProps): JSX.Element {
	const type = props.layer?.type
	switch (type) {
		case SourceLayerType.VT:
		case SourceLayerType.LIVE_SPEAK:
			return VTThumbnailRenderer(props)
		case SourceLayerType.CAMERA:
		case SourceLayerType.REMOTE:
			return CameraThumbnailRenderer(props)
		case SourceLayerType.SPLITS:
			return SplitsThumbnailRenderer(props)
		case SourceLayerType.GRAPHICS:
		case SourceLayerType.LOWER_THIRD:
			return GraphicsThumbnailRenderer(props)
		case SourceLayerType.LOCAL:
			return LocalThumbnailRenderer(props)
		case SourceLayerType.AUDIO:
		case SourceLayerType.SCRIPT:
		case SourceLayerType.TRANSITION:
		case SourceLayerType.UNKNOWN:
		case undefined:
			return DefaultThumbnailRenderer(props)
		default:
			assertNever(type)
			return DefaultThumbnailRenderer(props)
	}
}
