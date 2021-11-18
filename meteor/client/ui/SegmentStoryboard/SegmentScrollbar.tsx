import React, { useRef } from 'react'
import { LeftArrow, RightArrow } from '../../lib/ui/icons/segment'

interface IProps {
	scrollLeft: number
	maxScrollLeft: number
}

export function SegmentScrollbar({ scrollLeft, maxScrollLeft }: IProps) {
	const ref = useRef<HTMLDivElement>(null)

	return (
		<div className="segment-timeline__zoom-area__controls" ref={ref}>
			<div
				className="segment-timeline__zoom-area__controls__selected-area"
				style={{
					left: Math.max((scrollLeft / maxScrollLeft) * 100, 0).toString() + '%',
				}}
			>
				<LeftArrow className="segment-timeline__zoom-area__controls__selected-area__left-arrow" />
				<div className="segment-timeline__zoom-area__controls__selected-area__center-handle"></div>
				<RightArrow className="segment-timeline__zoom-area__controls__selected-area__right-arrow" />
			</div>
		</div>
	)
}
