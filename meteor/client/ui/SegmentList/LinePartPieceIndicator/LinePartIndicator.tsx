import classNames from 'classnames'
import Tooltip from 'rc-tooltip'
import React from 'react'
import { ISourceLayerExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'

interface IProps {
	overlay?: React.ReactNode
	count: number
	hasOriginInPreceedingPart: boolean
	allSourceLayers: ISourceLayerExtended[]
	thisSourceLayer?: ISourceLayerExtended
	label?: string
}

export const LinePartIndicator: React.FC<IProps> = function LinePartIndicator({
	overlay,
	count,
	allSourceLayers,
	thisSourceLayer,
	hasOriginInPreceedingPart,
	label,
}) {
	const typeClass = thisSourceLayer?.type ? RundownUtils.getSourceLayerClassName(thisSourceLayer.type) : undefined

	return (
		<Tooltip overlay={overlay} placement="top">
			<div
				className={classNames('segment-opl__piece-indicator-placeholder', {
					multiple: count > 1,
					'multiple--2': count === 2,
					'multiple--3': count > 2,
				})}
				data-source-layer-ids={allSourceLayers.map((sourceLayer) => sourceLayer._id).join(' ')}
			>
				{count === 0 && (
					<div className={classNames('segment-opl__piece-indicator', 'segment-opl__piece-indicator--no-piece')}></div>
				)}
				{count > 1 && <div className={classNames('segment-opl__piece-indicator', typeClass)}></div>}
				{count > 0 && (
					<div
						className={classNames('segment-opl__piece-indicator', typeClass, {
							continuation: hasOriginInPreceedingPart,
						})}
					>
						{label}
					</div>
				)}
			</div>
		</Tooltip>
	)
}
