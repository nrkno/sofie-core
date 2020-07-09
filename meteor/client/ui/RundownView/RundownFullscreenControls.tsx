import * as _ from 'underscore'
import * as React from 'react'
import * as VelocityReact from 'velocity-react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFastBackward } from '@fortawesome/free-solid-svg-icons'

import { Lottie } from '@crello/react-lottie'
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
	onAirHover: boolean
	rewindHover: boolean
}

export class RundownFullscreenControls extends React.Component<IProps, IState> {
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
			onAirHover: false,
			rewindHover: false,
		}

		this.fullscreenOut = {
			...this.animationTemplate,
			animationData: Fullscreen_MouseOut,
		}
		this.fullscreenOver = {
			...this.animationTemplate,
			animationData: Fullscreen_MouseOver,
		}
		this.windowedOut = {
			...this.animationTemplate,
			animationData: Windowed_MouseOut,
		}
		this.windowedOver = {
			...this.animationTemplate,
			animationData: Windowed_MouseOver,
		}
		this.onAirOut = {
			...this.animationTemplate,
			animationData: On_Air_MouseOut,
		}
		this.onAirOver = {
			...this.animationTemplate,
			animationData: On_Air_MouseOver,
		}
	}

	componentDidUpdate(prevProps: IProps, prevState: IState) {
		if (this.props.isFollowingOnAir && this.state.onAirHover) {
			this.setState({
				onAirHover: false,
			})
		}
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
							{this.state.onAirHover ? <Lottie config={this.onAirOver} /> : <Lottie config={this.onAirOut} />}
						</button>
					)}
				</VelocityReact.VelocityTransitionGroup>
				<div className="status-bar__controls__label status-bar__controls__label--fullscreen">
					<div className="status-bar__controls__button__label">
						<span className="keyboard_key">F11</span> Fullscreen
					</div>
				</div>
				<VelocityReact.VelocityTransitionGroup
					enter={{ animation: 'fadeIn', easing: 'ease-out', duration: 250 }}
					leave={{ animation: 'fadeOut', easing: 'ease-in', duration: 500 }}>
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
