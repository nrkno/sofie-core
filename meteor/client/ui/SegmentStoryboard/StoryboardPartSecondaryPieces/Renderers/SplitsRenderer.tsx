import React from 'react'
import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../../../lib/rundown'
import { IDefaultRendererProps } from './DefaultRenderer'
import { SplitsFloatingInspector } from '../../../FloatingInspectors/SplitsFloatingInspector'
import classNames from 'classnames'
import { getSplitPreview, SplitRole } from '../../../../lib/ui/splitPreview'

export function SplitsRenderer({ piece: pieceInstance, hovering, elementOffset, typeClass }: IDefaultRendererProps) {
	const splitsContent = pieceInstance.instance.piece.content as SplitsContent

	const splitItems = getSplitPreview(splitsContent.boxSourceConfiguration)
		.filter((i) => i.role !== SplitRole.ART)
		.map((item, index, array) => {
			return (
				<div
					key={'item-' + item._id}
					className={classNames(
						'segment-storyboard__part__piece__contents__item',
						RundownUtils.getSourceLayerClassName(item.type),
						{
							second: array.length > 1 && index > 0 && item.type === array[index - 1].type,
						}
					)}
				></div>
			)
		})

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
