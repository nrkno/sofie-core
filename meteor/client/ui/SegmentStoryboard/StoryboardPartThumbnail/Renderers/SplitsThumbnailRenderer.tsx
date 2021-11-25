import React from 'react'
import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { IProps } from './ThumbnailRendererFactory'
import { RundownUtils } from '../../../../lib/rundown'
import classNames from 'classnames'
import { getSplitPreview, SplitRole } from '../../../../lib/ui/splitPreview'

export function SplitsThumbnailRenderer({ pieceInstance }: IProps) {
	const splitsContent = pieceInstance.instance.piece.content as SplitsContent

	const splitItems = getSplitPreview(splitsContent.boxSourceConfiguration)
		.filter((i) => i.role !== SplitRole.ART)
		.map((item, index, array) => {
			return (
				<div
					key={'item-' + item._id}
					className={classNames(
						'segment-storyboard__thumbnail__item',
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
			<div className="segment-storyboard__thumbnail__contents">{splitItems}</div>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--lg">
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
