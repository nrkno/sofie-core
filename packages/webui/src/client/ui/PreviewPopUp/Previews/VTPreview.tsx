import { useEffect, useRef } from 'react'
import { StyledTimecode } from '../../../lib/StyledTimecode'
import classNames from 'classnames'

interface VTPreviewProps {
	content: {
		type: 'video'
		src: string
		seek?: number
		loop?: boolean
		itemDuration?: number
	}
	time: number | null
}
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
	} else if (itemDuration > 0) {
		targetTime = Math.min(timePosition, itemDuration)
	}
	vEl.currentTime = targetTime / 1000
}
export function VTPreviewElement({ content, time }: VTPreviewProps): React.ReactElement {
	const videoElement = useRef<HTMLVideoElement>(null)

	useEffect(() => {
		if (!videoElement.current) return

		setVideoElementPosition(
			videoElement.current,
			time ?? 0,
			content.itemDuration ?? 0,
			content.seek ?? 0,
			content.loop ?? false
		)
	}, [videoElement.current, time])

	const itemDuration = content.itemDuration ?? 0
	const offsetTimePosition = (time ?? 0) + (content.seek ?? 0)
	const showFrameMarker = offsetTimePosition === 0 || (itemDuration > 0 && offsetTimePosition >= itemDuration)

	// todo - add studio settings. I _really_ don't look forward to prop drilling these....
	return (
		<div className="preview-popUp__video">
			{showFrameMarker && (
				<div
					className={classNames('preview-popUp__video-frame-marker', {
						'preview-popUp__video-frame-marker--first-frame': offsetTimePosition === 0,
						'preview-popUp__video-frame-marker--last-frame': offsetTimePosition >= itemDuration,
					})}
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M6 14.5L18.5 14.5V18.5H6H1.5V14V1.5H5.5V14V14.5H6Z" fill="#FFD600" stroke="black" />
					</svg>
				</div>
			)}
			<video src={content.src} ref={videoElement} crossOrigin="anonymous" playsInline={true} muted={true} />
			<div className="time">
				<StyledTimecode studioSettings={undefined} time={Math.round(time ?? 0)} />
			</div>
		</div>
	)
}
