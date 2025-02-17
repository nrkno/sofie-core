import { GraphicsContent, NoraContent } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../../../lib/rundown.js'
import { L3rdFloatingInspector } from '../../../FloatingInspectors/L3rdFloatingInspector.js'
import { PieceMultistepChevron } from '../../../SegmentContainer/PieceMultistepChevron.js'
import { IProps } from './ThumbnailRendererFactory.js'
import { LoopingPieceIcon } from '../../../../lib/ui/icons/looping.js'

export function GraphicsThumbnailRenderer({
	pieceInstance,
	hovering,
	layer,
	originPosition,
	height,
}: Readonly<IProps>): JSX.Element {
	const content = pieceInstance.instance.piece.content as NoraContent | GraphicsContent | undefined

	return (
		<>
			<L3rdFloatingInspector
				showMiniInspector={hovering}
				content={content}
				position={{
					top: originPosition.top,
					left: originPosition.left,
					height,
					anchor: 'start',
					position: 'top-start',
				}}
				typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
				itemElement={null}
				piece={pieceInstance.instance.piece}
				pieceRenderedDuration={pieceInstance.renderedDuration}
				pieceRenderedIn={pieceInstance.renderedInPoint}
				displayOn="document"
			/>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--sm">
				<PieceMultistepChevron className="segment-storyboard__piece__step-chevron" piece={pieceInstance} />
				{pieceInstance.instance.piece.content?.loop && (
					<LoopingPieceIcon className="segment-storyboard__thumbnail__label-icon" playing={hovering} />
				)}
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
