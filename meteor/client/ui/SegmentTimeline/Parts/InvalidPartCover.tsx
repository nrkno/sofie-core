import React, { useState } from 'react'
import { DBPart } from '../../../../lib/collections/Parts'
import { InvalidFloatingInspector } from '../../FloatingInspectors/InvalidFloatingInspector'

interface IProps {
	className?: string
	part: DBPart
}

export function InvalidPartCover({ className, part }: IProps) {
	const element = React.createRef<HTMLDivElement>()
	const [hover, setHover] = useState(false)
	const [position, setPosition] = useState({ left: 0, top: 0, width: 0 })

	function onMouseEnter() {
		if (!element.current) {
			return
		}

		setHover(true)
		const rect = element.current.getBoundingClientRect()
		setPosition({
			top: rect.top + window.scrollY,
			left: rect.left + window.scrollX,
			width: rect.width,
		})
	}

	function onMouseLeave() {
		setHover(false)
	}

	return (
		<div className={className} ref={element} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
			<InvalidFloatingInspector
				part={part}
				showMiniInspector={hover}
				itemElement={element.current}
				floatingInspectorStyle={{
					top: `${position.top}px`,
					left: `${position.left + position.width / 2}px`,
				}}
			/>
		</div>
	)
}
