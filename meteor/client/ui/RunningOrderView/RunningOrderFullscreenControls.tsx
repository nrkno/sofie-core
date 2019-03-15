import * as _ from 'underscore'
import * as React from 'react'
import * as $ from 'jquery'
import * as VelocityReact from 'velocity-react'

import * as faFastBackward from '@fortawesome/fontawesome-free-solid/faFastBackward'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import Lottie from 'react-lottie'
import { NotificationCenterPanelToggle } from '../../lib/notifications/NotificationCenterPanel'

// @ts-ignore Not recognized by Typescript
import * as Fullscreen_MouseOut from './Fullscreen_MouseOut.json'
// @ts-ignore Not recognized by Typescript
import * as Fullscreen_MouseOver from './Fullscreen_MouseOver.json'
// @ts-ignore Not recognized by Typescript
import * as Windowed_MouseOut from './Windowed_MouseOut.json'
// @ts-ignore Not recognized by Typescript
import * as Windowed_MouseOver from './Windowed_MouseOver.json'
// @ts-ignore Not recognized by Typescript
import * as On_Air_MouseOut from './On_Air_MouseOut.json'
// @ts-ignore Not recognized by Typescript
import * as On_Air_MouseOver from './On_Air_MouseOver.json'
import { SupportPopUpToggle } from '../SupportPopUp'

interface IProps {
	isFollowingOnAir: boolean
	onFollowOnAir?: () => void
	onRewindSegments?: () => void
	isNotificationCenterOpen: boolean
	isSupportPanelOpen: boolean
	onToggleNotifications?: (e: React.MouseEvent<HTMLDivElement>) => void
	onToggleSupportPanel?: (e: React.MouseEvent<HTMLDivElement>) => void
}

interface IState {
	isFullscreen: boolean
	fullScreenHover: boolean
	onAirHover: boolean
	rewindHover: boolean
}

export class RunningOrderFullscreenControls extends React.Component<IProps, IState> {

	throttledRefreshFullScreenState: () => void

	fullscreenOut: any
	fullscreenOver: any
	windowedOut: any
	windowedOver: any
	onAirOut: any
	onAirOver: any

	animationTemplate: any = {
		loop: false,
		autoplay: true,
		animationData: {},
		rendererSettings: {
			preserveAspectRatio: 'xMidYMid meet'
		}
	}

	constructor (props) {
		super(props)

		this.state = {
			isFullscreen: this.checkFullScreen(),
			fullScreenHover: false,
			onAirHover: false,
			rewindHover: false
		}

		this.fullscreenOut = _.extend(_.clone(this.animationTemplate), {
			animationData: Fullscreen_MouseOut
		})
		this.fullscreenOver = _.extend(_.clone(this.animationTemplate), {
			animationData: Fullscreen_MouseOver
		})
		this.windowedOut = _.extend(_.clone(this.animationTemplate), {
			animationData: Windowed_MouseOut
		})
		this.windowedOver = _.extend(_.clone(this.animationTemplate), {
			animationData: Windowed_MouseOver
		})
		this.onAirOut = _.extend(_.clone(this.animationTemplate), {
			animationData: On_Air_MouseOut
		})
		this.onAirOver = _.extend(_.clone(this.animationTemplate), {
			animationData: On_Air_MouseOver
		})

		this.throttledRefreshFullScreenState = _.throttle(this.refreshFullScreenState, 500)
	}

	componentDidUpdate (prevProps: IProps, prevState: IState) {
		if (this.props.isFollowingOnAir && this.state.onAirHover) {
			this.setState({
				onAirHover: false
			})
		}
		if (this.state.isFullscreen && this.state.fullScreenHover) {
			this.setState({
				fullScreenHover: false
			})
		}
	}

	componentDidMount () {
		$(window).on('resize', this.throttledRefreshFullScreenState)
	}

	componentWillUnmount () {
		$(window).off('resize', this.throttledRefreshFullScreenState)
	}

	checkFullScreen () {
		// @ts-ignore TypeScript doesn't have vendor-prefixed fullscreen flags
		return document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen ||
				(Math.abs(screen.height - window.innerHeight) < 10) ||
				false // This will return true or false depending on if it's full screen or not.
	}

	refreshFullScreenState = () => {
		if (this.state.isFullscreen !== this.checkFullScreen()) {
			this.setState({
				isFullscreen: this.checkFullScreen()
			})
		}
	}

	onFullscreenMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
		this.setState({
			fullScreenHover: true
		})
	}

	onFullscreenMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
		this.setState({
			fullScreenHover: false
		})
	}

	onOnAirClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (typeof this.props.onFollowOnAir === 'function') {
			this.props.onFollowOnAir()
		}
	}

	onOnAirMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
		this.setState({
			onAirHover: true
		})
	}

	onOnAirMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
		this.setState({
			onAirHover: false
		})
	}

	onRewindEnter = (e: React.MouseEvent<HTMLDivElement>) => {
		this.setState({
			rewindHover: true
		})
	}

	onRewindLeave = (e: React.MouseEvent<HTMLDivElement>) => {
		this.setState({
			rewindHover: false
		})
	}

	onRewindClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (typeof this.props.onRewindSegments === 'function') {
			this.props.onRewindSegments()
		}
	}

	render () {
		return (
			<div className='running-order__fullscreen-controls'>
				<VelocityReact.VelocityTransitionGroup
					enter={{ animation: 'fadeIn', easing: 'ease-out', duration: 250 }}
					leave={{ animation: 'fadeOut', easing: 'ease-in', duration: 500 }}>
					<NotificationCenterPanelToggle onClick={this.props.onToggleNotifications} isOpen={this.props.isNotificationCenterOpen} />
					<div className='running-order__fullscreen-controls__button' role='button' onMouseEnter={this.onRewindEnter} onMouseLeave={this.onRewindLeave} onClick={this.onRewindClick} tabIndex={0}>
						<FontAwesomeIcon icon={faFastBackward} />
					</div>
					{!this.props.isFollowingOnAir &&
						<div className='running-order__fullscreen-controls__button' role='button' onMouseEnter={this.onOnAirMouseEnter} onMouseLeave={this.onOnAirMouseLeave} onClick={this.onOnAirClick} tabIndex={0}>
							{this.state.onAirHover ?
								<Lottie options={this.onAirOver} isStopped={false} isPaused={false} /> :
								<Lottie options={this.onAirOut} isStopped={false} isPaused={false} />}
						</div>
					}
					{!this.state.isFullscreen &&
						<div className='running-order__fullscreen-controls__label'>
							<div className='running-order__fullscreen-controls__button__label'><span className='keyboard_key'>F11</span> Fullscreen</div>
						</div>
					}
					<SupportPopUpToggle onClick={this.props.onToggleSupportPanel} isOpen={this.props.isSupportPanelOpen} />
				</VelocityReact.VelocityTransitionGroup>
			</div>
		)
	}
}
