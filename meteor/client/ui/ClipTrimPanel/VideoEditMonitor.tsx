import * as React from 'react'
import { translate } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import * as faStepForward from '@fortawesome/fontawesome-free-solid/faStepForward'
import * as faStepBackward from '@fortawesome/fontawesome-free-solid/faStepBackward'
import * as faPlay from '@fortawesome/fontawesome-free-solid/faPlay'
import * as faPause from '@fortawesome/fontawesome-free-solid/faPause'
import * as faFastForward from '@fortawesome/fontawesome-free-solid/faFastForward'
import * as faFastBackward from '@fortawesome/fontawesome-free-solid/faFastBackward'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

export interface IProps {
	currentTime?: number
	onCurrentTimeChange?: (e) => void
	src: string | undefined
}

export const VideoEditMonitor = translate()(class VideoEditMonitor extends React.Component<Translated<IProps>> {
	private videoEl: HTMLVideoElement

	videoMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {

	}

	componentDidUpdate () {
		if (this.videoEl) {
			this.videoEl.src = this.props.src || ''
		}
	}

	render () {
		return (
			<div className='video-edit-monitor'>
				<div className='video-edit-monitor__monitor' onMouseMove={this.videoMouseMove}>
					<video className='video-edit-monitor__video' ref={this.setVideo}></video>
				</div>
				<div className='video-edit-monitor__waveform'></div>
				<div className='video-edit-monitor__buttons'>
					<button className='video-edit-monitor__button'><FontAwesomeIcon icon={faStepBackward} /></button>
					<button className='video-edit-monitor__button'><FontAwesomeIcon icon={faFastBackward} /></button>
					<button className='video-edit-monitor__button'><FontAwesomeIcon icon={faPlay} /> 1s</button>
					<button className='video-edit-monitor__button'><FontAwesomeIcon icon={faStepForward} /></button>
					<button className='video-edit-monitor__button'><FontAwesomeIcon icon={faFastForward} /></button>
				</div>
			</div>
		)
	}

	private setVideo (el: HTMLVideoElement) {
		this.videoEl = el
		this.videoEl.src = this.props.src || ''
	}
})
