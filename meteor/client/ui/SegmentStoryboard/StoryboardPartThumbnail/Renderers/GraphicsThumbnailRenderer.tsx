import { GraphicsContent, NoraContent } from '@sofie-automation/blueprints-integration'
import React from 'react'
import { RundownUtils } from '../../../../lib/rundown'
import { L3rdFloatingInspector } from '../../../FloatingInspectors/L3rdFloatingInspector'
import { PieceMultistepChevron } from '../../utils/PieceMultistepChevron'
import { IProps } from './ThumbnailRendererFactory'

export function GraphicsThumbnailRenderer({ pieceInstance, hovering, layer, originPosition }: IProps) {
	const content = pieceInstance.instance.piece.content as NoraContent | GraphicsContent | undefined

	const multistepChevron = PieceMultistepChevron({
		className: 'segment-storyboard__piece__step-chevron',
		piece: pieceInstance,
	})

	return (
		<>
			<L3rdFloatingInspector
				showMiniInspector={hovering}
				content={content}
				floatingInspectorStyle={{
					top: originPosition.top + 'px',
					left: originPosition.left + 'px',
					transform: 'translate(0, -100%)',
				}}
				typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
				itemElement={null}
				piece={pieceInstance.instance.piece}
				pieceRenderedDuration={pieceInstance.renderedDuration}
				pieceRenderedIn={pieceInstance.renderedInPoint}
				displayOn="document"
			/>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--sm">
				{multistepChevron}
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
