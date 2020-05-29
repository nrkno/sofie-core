import * as _ from 'underscore'
import * as React from 'react'
import * as VelocityReact from 'velocity-react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFastBackward } from '@fortawesome/free-solid-svg-icons'

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
	isStudioMode: boolean
	onToggleNotifications?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onToggleSupportPanel?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onTake?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

interface IState {
	isFullscreen: boolean
	fullScreenHover: boolean
	onAirHover: boolean
	rewindHover: boolean
}

export class RundownFullscreenControls extends React.Component<IProps, IState> {
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
			preserveAspectRatio: 'xMidYMid meet',
		},
	}

	constructor(props) {
		super(props)

		this.state = {
			isFullscreen: this.checkFullScreen(),
			fullScreenHover: false,
			onAirHover: false,
			rewindHover: false,
		}

		this.fullscreenOut = _.extend(_.clone(this.animationTemplate), {
			animationData: Fullscreen_MouseOut,
		})
		this.fullscreenOver = _.extend(_.clone(this.animationTemplate), {
			animationData: Fullscreen_MouseOver,
		})
		this.windowedOut = _.extend(_.clone(this.animationTemplate), {
			animationData: Windowed_MouseOut,
		})
		this.windowedOver = _.extend(_.clone(this.animationTemplate), {
			animationData: Windowed_MouseOver,
		})
		this.onAirOut = _.extend(_.clone(this.animationTemplate), {
			animationData: On_Air_MouseOut,
		})
		this.onAirOver = _.extend(_.clone(this.animationTemplate), {
			animationData: On_Air_MouseOver,
		})

		this.throttledRefreshFullScreenState = _.throttle(this.refreshFullScreenState, 500)
	}

	componentDidUpdate(prevProps: IProps, prevState: IState) {
		if (this.props.isFollowingOnAir && this.state.onAirHover) {
			this.setState({
				onAirHover: false,
			})
		}
		if (this.state.isFullscreen && this.state.fullScreenHover) {
			this.setState({
				fullScreenHover: false,
			})
		}
	}

	componentDidMount() {
		window.addEventListener('resize', this.throttledRefreshFullScreenState)
	}

	componentWillUnmount() {
		window.removeEventListener('resize', this.throttledRefreshFullScreenState)
	}

	checkFullScreen() {
		// @ts-ignore TypeScript doesn't have vendor-prefixed fullscreen flags
		return (
			document.fullScreen ||
			document.mozFullScreen ||
			document.webkitIsFullScreen ||
			Math.abs(screen.height - window.innerHeight) < 10 ||
			false
		) // This will return true or false depending on if it's full screen or not.
	}

	refreshFullScreenState = () => {
		if (this.state.isFullscreen !== this.checkFullScreen()) {
			this.setState({
				isFullscreen: this.checkFullScreen(),
			})
		}
	}

	onFullscreenMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
		this.setState({
			fullScreenHover: true,
		})
	}

	onFullscreenMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
		this.setState({
			fullScreenHover: false,
		})
	}

	onOnAirClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (typeof this.props.onFollowOnAir === 'function') {
			this.props.onFollowOnAir()
		}
	}

	onOnAirMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
		this.setState({
			onAirHover: true,
		})
	}

	onOnAirMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
		this.setState({
			onAirHover: false,
		})
	}

	onRewindEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
		this.setState({
			rewindHover: true,
		})
	}

	onRewindLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
		this.setState({
			rewindHover: false,
		})
	}

	onRewindClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (typeof this.props.onRewindSegments === 'function') {
			this.props.onRewindSegments()
		}
	}

	onTakeClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (typeof this.props.onTake === 'function') {
			this.props.onTake(e)
		}
	}

	render() {
		return (
			<div className="status-bar">
				<VelocityReact.VelocityTransitionGroup
					enter={{ animation: 'fadeIn', easing: 'ease-out', duration: 250 }}
					leave={{ animation: 'fadeOut', easing: 'ease-in', duration: 500 }}>
					<NotificationCenterPanelToggle
						onClick={this.props.onToggleNotifications}
						isOpen={this.props.isNotificationCenterOpen}
					/>
					<button
						className="status-bar__controls__button"
						role="button"
						onMouseEnter={this.onRewindEnter}
						onMouseLeave={this.onRewindLeave}
						onClick={this.onRewindClick}
						tabIndex={0}>
						<FontAwesomeIcon icon={faFastBackward} />
					</button>
					{!this.props.isFollowingOnAir && (
						<button
							className="status-bar__controls__button"
							role="button"
							onMouseEnter={this.onOnAirMouseEnter}
							onMouseLeave={this.onOnAirMouseLeave}
							onClick={this.onOnAirClick}
							tabIndex={0}>
							{this.state.onAirHover ? (
								<Lottie options={this.onAirOver} isStopped={false} isPaused={false} />
							) : (
								<Lottie options={this.onAirOut} isStopped={false} isPaused={false} />
							)}
						</button>
					)}
					{!this.state.isFullscreen && (
						<div className="status-bar__controls__label">
							<div className="status-bar__controls__button__label">
								<span className="keyboard_key">F11</span> Fullscreen
							</div>
						</div>
					)}
					{this.props.isStudioMode && (
						<button
							className="status-bar__controls__button status-bar__controls__button--take"
							role="button"
							onClick={this.onTakeClick}
							tabIndex={0}>
							Take
						</button>
					)}
					<SupportPopUpToggle onClick={this.props.onToggleSupportPanel} isOpen={this.props.isSupportPanelOpen} />
				</VelocityReact.VelocityTransitionGroup>
			</div>
		)
	}
}
