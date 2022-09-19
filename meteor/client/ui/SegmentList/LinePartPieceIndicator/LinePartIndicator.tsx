import classNames from 'classnames'
import React, { useState } from 'react'
import { Studio } from '../../../../lib/collections/Studios'
import { ISourceLayerExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'
import { AdLibPieceUi } from '../../../lib/shelf'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment'
import { withMediaObjectStatus } from '../../SegmentTimeline/withMediaObjectStatus'

interface IProps {
	overlay: (ref: HTMLDivElement | null) => React.ReactNode
	count: number
	hasOriginInPreceedingPart: boolean
	allSourceLayers: ISourceLayerExtended[]
	thisSourceLayer?: ISourceLayerExtended
	label?: string
	piece?: AdLibPieceUi | PieceUi
	studio: Studio
}

export const LinePartIndicator = withMediaObjectStatus<IProps, {}>()(function LinePartIndicator({
	overlay,
	count,
	allSourceLayers,
	thisSourceLayer,
	hasOriginInPreceedingPart,
	label,
}) {
	let typeClass = thisSourceLayer?.type ? RundownUtils.getSourceLayerClassName(thisSourceLayer.type) : undefined
	const [element, setElement] = useState<HTMLDivElement | null>(null)
	const [isOver, setIsOver] = useState(false)

	if ((typeClass === undefined || typeClass === '') && thisSourceLayer?.isGuestInput) {
		typeClass = 'guest'
	}

	function onMouseOver() {
		setIsOver(true)
	}

	function onMouseOut() {
		setIsOver(false)
	}

	return (
		<>
			<div
				className={classNames('segment-opl__piece-indicator-placeholder', {
					multiple: count > 1,
					'multiple--2': count === 2,
					'multiple--3': count > 2,
				})}
				data-source-layer-ids={allSourceLayers.map((sourceLayer) => sourceLayer._id).join(' ')}
				ref={setElement}
				onMouseOver={onMouseOver}
				onMouseOut={onMouseOut}
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
			{isOver && overlay(element)}
		</>
	)
})
