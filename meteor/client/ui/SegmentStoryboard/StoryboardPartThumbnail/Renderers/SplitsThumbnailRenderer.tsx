import React from 'react'
import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { IProps } from './ThumbnailRendererFactory'
import { SplitRole, SplitSubItem } from '../../../SegmentTimeline/Renderers/SplitsSourceRenderer'
import { literal } from '../../../../../lib/lib'
import { RundownUtils } from '../../../../lib/rundown'
import classNames from 'classnames'

const DEFAULT_POSITIONS = [
	{
		x: 0.25,
		y: 0.5,
		scale: 0.5,
	},
	{
		x: 0.75,
		y: 0.5,
		scale: 0.5,
	},
]

export function SplitsThumbnailRenderer({ pieceInstance }: IProps) {
	const splitsContent = pieceInstance.instance.piece.content as SplitsContent

	const splitItems = splitsContent.boxSourceConfiguration
		.map((item, index) => {
			return literal<SplitSubItem>({
				_id: item.studioLabel + '_' + index,
				type: item.type,
				label: item.studioLabel,
				role: SplitRole.BOX,
				content: item.geometry || DEFAULT_POSITIONS[index],
			})
		})
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
