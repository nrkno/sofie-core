import classNames from 'classnames'
import React, { useEffect, useRef, useState } from 'react'
import { Studio } from '../../../../lib/collections/Studios'
import { ISourceLayerExtended } from '../../../../lib/Rundown'
import { TOOLTIP_DEFAULT_DELAY } from '../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'
import { AdLibPieceUi } from '../../../lib/shelf'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment'
import { withMediaObjectStatus } from '../../SegmentTimeline/withMediaObjectStatus'

interface IProps {
	overlay?: (ref: HTMLDivElement | null, setIsOver: (isOver: boolean) => void) => React.ReactNode
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
	const mouseOutTimeOut = useRef<NodeJS.Timeout | undefined>(undefined)
	const [isOver, setIsOver] = useState(false)
	const [isOverlayOver, setIsOverlayOver] = useState(false)

	if ((typeClass === undefined || typeClass === '') && thisSourceLayer?.isGuestInput) {
		typeClass = 'guest'
	}

	function onMouseEnter() {
		clearTimeout(mouseOutTimeOut.current)
		mouseOutTimeOut.current = setTimeout(() => {
			setIsOver(true)
		}, TOOLTIP_DEFAULT_DELAY * 1000)
	}

	function onMouseLeave() {
		clearTimeout(mouseOutTimeOut.current)
		mouseOutTimeOut.current = setTimeout(() => {
			setIsOver(false)
		}, TOOLTIP_DEFAULT_DELAY * 1000)
	}

	useEffect(() => {
		return () => {
			clearTimeout(mouseOutTimeOut.current)
		}
	}, [])

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
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
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
			{(isOver || isOverlayOver) && !!overlay && overlay(element, setIsOverlayOver)}
		</>
	)
})
