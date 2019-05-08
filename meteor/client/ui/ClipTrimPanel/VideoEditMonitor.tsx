import * as React from 'react'
import { translate } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
// import * as faStepForward from '@fortawesome/fontawesome-free-solid/faStepForward'
// import * as faStepBackward from '@fortawesome/fontawesome-free-solid/faStepBackward'
// import * as faPlay from '@fortawesome/fontawesome-free-solid/faPlay'
// import * as faFastForward from '@fortawesome/fontawesome-free-solid/faFastForward'
// import * as faFastBackward from '@fortawesome/fontawesome-free-solid/faFastBackward'
// import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as $ from 'jquery'

export interface IProps {
	currentTime?: number
	onCurrentTimeChange?: (currentTime: number) => void
	src: string | undefined
	fps?: number
}

export const VideoEditMonitor = translate()(class VideoEditMonitor extends React.Component<Translated<IProps>> {
	private videoEl: HTMLVideoElement
	private retryCount: number = 0
	private internalTime: number = 0
	private isMouseDown: boolean = false

	constructor (props: Translated<IProps>) {
		super(props)

		this.internalTime = props.currentTime || 0
	}

	videoMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		this.isMouseDown = true
		window.addEventListener('mouseup', this.videoMouseUp)
	}

	videoMouseUp = (e: MouseEvent): void => {
		this.isMouseDown = false
		window.removeEventListener('mouseup', this.videoMouseUp)
	}

	videoMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		const pos = $(this.videoEl).offset()
		if (this.isMouseDown && pos) {
			if (this.videoEl.readyState <= 2) { // we are moving around the video, but the player is stuck
				this.retryCount++
			} else {
				this.retryCount = 0
			}

			if (this.retryCount > 20) { // reset the video playback component if too many tries failed
				this.videoEl.src = this.props.src || ''
				this.retryCount = 0
			}

			const position = (e.pageX - pos.left) / this.videoEl.clientWidth
			const targetTime = Math.max(0, Math.min(this.videoEl.duration * position, this.videoEl.duration - 0.01))
			if (Number.isFinite(targetTime)) {
				this.videoEl.currentTime = targetTime
				this.internalTime = targetTime
				if (this.props.onCurrentTimeChange) {
					this.props.onCurrentTimeChange(this.internalTime)
				}
			}
		}
	}

	videoMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
		this.videoEl.currentTime = this.props.currentTime || 0
		this.internalTime = this.props.currentTime || 0
	}

	handleStepBack = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (this.props.fps) {
			this.internalTime = Math.max(0, this.internalTime - 1 / this.props.fps)
			this.videoEl.currentTime = this.internalTime
			if (this.props.onCurrentTimeChange) {
				this.props.onCurrentTimeChange(this.internalTime)
			}
		}
	}

	handleFastBackward = (e: React.MouseEvent<HTMLButtonElement>) => {
		// TODO
	}

	handlePlay = (e: React.MouseEvent<HTMLButtonElement>) => {
		this.videoEl.play().catch(() => console.error('Could not start playback'))
	}

	handleStepForward = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (this.props.fps) {
			this.internalTime = Math.min(this.videoEl.duration, this.internalTime + 1 / this.props.fps)
			this.videoEl.currentTime = this.internalTime
			if (this.props.onCurrentTimeChange) {
				this.props.onCurrentTimeChange(this.internalTime)
			}
		}
	}

	handleFastForward = (e: React.MouseEvent<HTMLButtonElement>) => {
		// TODO
	}

	componentDidUpdate () {
		if (this.videoEl) {
			if (this.videoEl.src !== this.props.src) {
				this.videoEl.src = this.props.src || ''
			}
			this.videoEl.currentTime = this.props.currentTime || 0
			this.internalTime = this.props.currentTime || 0
		}
	}

	render () {
		return (
			<div className='video-edit-monitor'>
				<div className='video-edit-monitor__monitor' onMouseMove={this.videoMouseMove} onMouseLeave={this.videoMouseLeave}>
					<video className='video-edit-monitor__video' ref={this.setVideo}></video>
				</div>
				<div className='video-edit-monitor__waveform'></div>
				{ /* <div className='video-edit-monitor__buttons'>
					{this.props.fps && <button className='video-edit-monitor__button' onClick={this.handleStepBack}><FontAwesomeIcon icon={faStepBackward} /></button>}
					<button className='video-edit-monitor__button' onClick={this.handleFastBackward}><FontAwesomeIcon icon={faFastBackward} /></button>
					<button className='video-edit-monitor__button' onClick={this.handlePlay}><FontAwesomeIcon icon={faPlay} /> 1s</button>
					{this.props.fps && <button className='video-edit-monitor__button' onClick={this.handleStepForward}><FontAwesomeIcon icon={faStepForward} /></button>}
					<button className='video-edit-monitor__button' onClick={this.handleFastForward}><FontAwesomeIcon icon={faFastForward} /></button>
				</div> */}
			</div>
		)
	}

	private setVideo = (el: HTMLVideoElement) => {
		this.videoEl = el
		if (el) {
			this.videoEl.src = this.props.src || ''
		}
	}
})