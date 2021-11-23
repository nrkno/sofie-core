import classNames from 'classnames'
import React, { useEffect, useRef } from 'react'
import { StyledTimecode } from './StyledTimecode'

function setVideoElementPosition(
	vEl: HTMLVideoElement,
	timePosition: number,
	itemDuration: number,
	seek: number,
	loop: boolean
) {
	let targetTime = timePosition + seek
	if (loop && vEl.duration > 0) {
		targetTime =
			targetTime % ((itemDuration > 0 ? Math.min(vEl.duration * 1000, itemDuration) : vEl.duration * 1000) * 1000)
	} else {
		targetTime = Math.min(timePosition, itemDuration)
	}
	vEl.currentTime = targetTime / 1000
}

interface IProps {
	previewUrl: string
	timePosition: number
	itemDuration: number
	seek: number
	loop: boolean
}

export function VideoPreviewPlayer({ previewUrl, timePosition, itemDuration, seek, loop }: IProps) {
	const videoElement = useRef<HTMLVideoElement>(null)

	useEffect(() => {
		if (!videoElement.current) return

		setVideoElementPosition(videoElement.current, timePosition, itemDuration, seek, loop)
	}, [videoElement.current, timePosition, itemDuration, seek, loop])

	const offsetTimePosition = timePosition + seek
	const showFrameMarker = offsetTimePosition === 0 || offsetTimePosition >= itemDuration

	return (
		<>
			<video src={previewUrl} ref={videoElement} crossOrigin="anonymous" playsInline={true} muted={true} />
			{showFrameMarker && (
				<div
					className={classNames('segment-timeline__mini-inspector__frame-marker', {
						'segment-timeline__mini-inspector__frame-marker--first-frame': offsetTimePosition === 0,
						'segment-timeline__mini-inspector__frame-marker--last-frame': offsetTimePosition >= itemDuration,
					})}
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M6 14.5L18.5 14.5V18.5H6H1.5V14V1.5H5.5V14V14.5H6Z" fill="#FFD600" stroke="black" />
					</svg>
				</div>
			)}
			<span className="segment-timeline__mini-inspector__timecode">
				<StyledTimecode time={offsetTimePosition} />
			</span>
		</>
	)
}
