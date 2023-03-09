import { GraphicsContent, NoraContent } from '@sofie-automation/blueprints-integration'
import React from 'react'
import { L3rdFloatingInspector } from '../../../FloatingInspectors/L3rdFloatingInspector'
import { usePieceMultistepChevron } from '../../utils/usePieceMultistepChevron'
import { IDefaultRendererProps } from './DefaultRenderer'

export function GraphicsRenderer({ piece: pieceInstance, hovering, elementOffset, typeClass }: IDefaultRendererProps) {
	const content = pieceInstance.instance.piece.content as NoraContent | GraphicsContent | undefined

	const multistepChevron = usePieceMultistepChevron('segment-storyboard__piece__step-chevron', pieceInstance)

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
