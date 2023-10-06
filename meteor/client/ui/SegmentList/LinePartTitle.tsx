import React, { useRef, useLayoutEffect, useState } from 'react'
import Tooltip from 'rc-tooltip'
import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib'

const TOOLTIP_ALIGN = { points: ['tl', 'tl'], offset: [-8, 0] }

const NO_TRIGGER: RCTooltip.Trigger[] = []
const HOVER_TRIGGER: RCTooltip.Trigger[] = ['hover']

export function LinePartTitle({ title }: { title: string }): JSX.Element {
	const elRef = useRef<HTMLHeadingElement>(null)
	const [isTooltipEnabled, setTooltipEnabled] = useState(true)

	useLayoutEffect(() => {
		if (!elRef.current) return

		// scrollHeight can be larger than offsetHight by 2 pixel on HighDPI screens
		if (elRef.current.scrollHeight > elRef.current.offsetHeight + 2) {
			setTooltipEnabled(true)
		} else {
			setTooltipEnabled(false)
		}
	}, [title])

	return (
		<Tooltip
			overlay={title}
			placement="topLeft"
			align={TOOLTIP_ALIGN}
			overlayClassName="segment-opl__title__label-tooltip"
			mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
			destroyTooltipOnHide
			trigger={!isTooltipEnabled ? NO_TRIGGER : HOVER_TRIGGER}
		>
			<h3 className="segment-opl__part-title">
				<span ref={elRef}>{title}</span>
			</h3>
		</Tooltip>
	)
}
