import React from 'react'
import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { IDefaultRendererProps } from './DefaultRenderer'
import { SplitsFloatingInspector } from '../../../FloatingInspectors/SplitsFloatingInspector'
import { getSplitItems } from '../../utils/getSplitItems'

export function SplitsRenderer({
	piece: pieceInstance,
	hovering,
	elementOffset,
	typeClass,
}: IDefaultRendererProps): JSX.Element {
	const splitItems = getSplitItems(pieceInstance, 'segment-storyboard__part__piece__contents__item')

	return (
		<>
			<div className="segment-storyboard__part__piece__contents">{splitItems}</div>
			<SplitsFloatingInspector
				floatingInspectorStyle={
					elementOffset
						? {
								top: elementOffset.top + 'px',
								left: elementOffset.left + 'px',
								transform: 'translate(0, -100%)',
						  }
						: {}
				}
				itemElement={null}
				content={pieceInstance.instance.piece.content as Partial<SplitsContent>}
				showMiniInspector={!!hovering}
				typeClass={typeClass}
			/>
			{pieceInstance.instance.piece.name}
		</>
	)
}
