import React from 'react'
import { Time, formatDurationAsTimecode } from '../../lib/lib'

interface IProps {
	time: Time
}

const FRAMES_INLINE_STYLE: React.CSSProperties = {
	fontSize: '0.8em',
}

export function StyledTimecode({ time: time }: IProps) {
	const timecode = formatDurationAsTimecode(time)
	const hoursMinutesSeconds = timecode.substring(0, 8)
	const frames = timecode.substring(8)
	return (
		<>
			{hoursMinutesSeconds}
			<span style={FRAMES_INLINE_STYLE}>{frames}</span>
		</>
	)
}
