import React from 'react'
import ClassNames from 'classnames'
import { Time, formatDurationAsTimecode } from '../../lib/lib'

interface IProps {
	time: Time
}

const FRAMES_INLINE_STYLE: React.CSSProperties = {
	fontSize: '0.8em'
}

export function StyledTimecode({ time: time }: IProps) {
	const timecode = formatDurationAsTimecode(time)
	const hours = timecode.substring(0, 3)
	const minutesSeconds = timecode.substring(3, 8)
	const frames = timecode.substring(8)
	return (
		<>
			<span
				className={ClassNames('styled-timecode__hours', {
					'zero-hours': hours === '00:'
				})}
			>
				{hours}
			</span>
			{minutesSeconds}
			<span className="styled-timecode__frames" style={FRAMES_INLINE_STYLE}>
				{frames}
			</span>
		</>
	)
}
