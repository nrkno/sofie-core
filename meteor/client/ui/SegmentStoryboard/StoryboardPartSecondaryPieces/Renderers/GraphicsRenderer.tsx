import { GraphicsContent, NoraContent } from '@sofie-automation/blueprints-integration'
import React from 'react'
import { L3rdFloatingInspector } from '../../../FloatingInspectors/L3rdFloatingInspector'
import { PieceMultistepChevron } from '../../utils/PieceMultistepChevron'
import { IDefaultRendererProps } from './DefaultRenderer'

export function GraphicsRenderer({ piece: pieceInstance, hovering, elementOffset, typeClass }: IDefaultRendererProps) {
	const content = pieceInstance.instance.piece.content as NoraContent | GraphicsContent | undefined

	const multistepChevron = PieceMultistepChevron({
		className: 'segment-storyboard__piece__step-chevron',
		piece: pieceInstance,
	})

	return (
		<>
			<L3rdFloatingInspector
				showMiniInspector={!!hovering}
				content={content}
				floatingInspectorStyle={
					elementOffset
						? {
								top: elementOffset.top + 'px',
								left: elementOffset.left + 'px',
								transform: 'translate(0, -100%)',
						  }
						: {}
				}
				typeClass={typeClass}
				itemElement={null}
				piece={pieceInstance.instance.piece}
				pieceRenderedDuration={pieceInstance.renderedDuration}
				pieceRenderedIn={pieceInstance.renderedInPoint}
				displayOn="document"
			/>
			{multistepChevron}
			{pieceInstance.instance.piece.name}
		</>
	)
}
