import React from 'react'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'

interface IProps {
	className?: string
	part: DBPart
	align?: 'start' | 'center' | 'end'
}

export function InvalidPartCover({ className }: Readonly<IProps>): JSX.Element {
	const element = React.createRef<HTMLDivElement>()

	function onMouseEnter() {
		if (!element.current) {
			return
		}
	}

	function onMouseLeave() {
		//
	}

	return (
		<div className={className} ref={element} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
			{/* TODOD - add back hover with warnings */}
		</div>
	)
}
