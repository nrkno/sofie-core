import * as _ from 'underscore'
import * as React from 'react'
import * as VelocityReact from 'velocity-react'

import { StudioRouteSet, StudioRouteBehavior } from '../../../lib/collections/Studios'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFastBackward, faRandom } from '@fortawesome/free-solid-svg-icons'

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
import classNames from 'classnames'
import { NoticeLevel } from '../../lib/notifications/notifications'

interface IProps {
	studioRouteSets: {
		[id: string]: StudioRouteSet
	}
	isFollowingOnAir: boolean
	onFollowOnAir?: () => void
	onRewindSegments?: () => void
	isNotificationCenterOpen: NoticeLevel | undefined
	isSupportPanelOpen: boolean
	isStudioMode: boolean
	onToggleNotifications?: (e: React.MouseEvent<HTMLButtonElement>, filter: NoticeLevel) => void
	onToggleSupportPanel?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onTake?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onStudioRouteSetSwitch?: (
		e: React.MouseEvent<HTMLButtonElement>,
		routeSetId: string,
		routeSet: StudioRouteSet,
		state: boolean
	) => void
}

interface IState {
	onAirHover: boolean
	rewindHover: boolean
	isRouteSetsOpen: boolean
}

export class RundownRightHandControls extends React.Component<IProps, IState> {
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
			isRouteSetsOpen: false,
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

	onRouteSetsToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
		this.setState({
			isRouteSetsOpen: !this.state.isRouteSetsOpen,
		})
	}

	render() {
		const availableRouteSets = Object.entries(this.props.studioRouteSets).filter(
			([_id, routeSet]) => routeSet.behavior !== StudioRouteBehavior.HIDDEN
		)
		const activeRoutes = availableRouteSets.filter(([id, routeSet]) => routeSet.active).length
		const exclusivityGroups: {
			[id: string]: Array<[string, StudioRouteSet]>
		} = {}
		for (let [id, routeSet] of availableRouteSets) {
			const group = routeSet.exclusivityGroup || '__noGroup'
			if (exclusivityGroups[group] === undefined) exclusivityGroups[group] = []
			exclusivityGroups[group].push([id, routeSet])
		}
		return (
			<div className="status-bar">
				<VelocityReact.VelocityTransitionGroup
					enter={{ animation: 'fadeIn', easing: 'ease-out', duration: 250 }}
					leave={{ animation: 'fadeOut', easing: 'ease-in', duration: 500 }}>
					<NotificationCenterPanelToggle
						onClick={(e) =>
							this.props.onToggleNotifications && this.props.onToggleNotifications(e, NoticeLevel.CRITICAL)
						}
						isOpen={this.props.isNotificationCenterOpen === NoticeLevel.CRITICAL}
						filter={NoticeLevel.CRITICAL}
						className="type-critical"
					/>
					<NotificationCenterPanelToggle
						onClick={(e) =>
							this.props.onToggleNotifications && this.props.onToggleNotifications(e, NoticeLevel.WARNING)
						}
						isOpen={this.props.isNotificationCenterOpen === NoticeLevel.WARNING}
						filter={NoticeLevel.WARNING}
						className="type-warning"
					/>
					<NotificationCenterPanelToggle
						onClick={(e) =>
							this.props.onToggleNotifications &&
							this.props.onToggleNotifications(e, NoticeLevel.NOTIFICATION | NoticeLevel.TIP)
						}
						isOpen={this.props.isNotificationCenterOpen === (NoticeLevel.NOTIFICATION | NoticeLevel.TIP)}
						filter={NoticeLevel.NOTIFICATION | NoticeLevel.TIP}
						className="type-notification"
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
					{this.props.isStudioMode &&
						this.props.studioRouteSets &&
						this.props.onStudioRouteSetSwitch &&
						availableRouteSets.length > 0 &&
						(availableRouteSets.length < 3 ? (
							availableRouteSets.map(([id, routeSet]) => (
								<button
									className={classNames('status-bar__controls__button', 'status-bar__controls__button--route-set', {
										active: routeSet.active,
										'status-bar__controls__button--inactive':
											routeSet.active && routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY,
									})}
									role="button"
									onClick={(e) =>
										!(routeSet.active && routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY) &&
										this.props.onStudioRouteSetSwitch &&
										this.props.onStudioRouteSetSwitch(e, id, routeSet, !routeSet.active)
									}
									tabIndex={0}
									key={id}>
									{routeSet.name}
								</button>
							))
						) : (
							<>
								<button
									className={classNames(
										'status-bar__controls__button',
										'status-bar__controls__button--route-set-panel',
										'notifications-s notifications-text',
										{
											'status-bar__controls__button--open': this.state.isRouteSetsOpen,
										}
									)}
									role="button"
									onClick={this.onRouteSetsToggle}
									tabIndex={0}>
									<FontAwesomeIcon icon={faRandom} />
									{activeRoutes > 0 && <span className="notification">{activeRoutes}</span>}
								</button>
								<VelocityReact.VelocityTransitionGroup
									enter={{
										animation: {
											width: ['21.875rem', '0rem'],
										},
										easing: 'ease-out',
										duration: 300,
									}}
									leave={{
										animation: {
											width: ['0rem'],
										},
										easing: 'ease-in',
										duration: 500,
									}}>
									{this.state.isRouteSetsOpen && (
										<div className="route-set-pop-up-panel">
											{Object.entries(exclusivityGroups).map(([key, routeSets]) => (
												<div className="route-set-pop-up-panel__group" key={key}>
													{routeSets.map(([id, routeSet]) => (
														<button
															className={classNames(
																'status-bar__controls__button',
																'status-bar__controls__button--route-set',
																{
																	active: routeSet.active,
																	'status-bar__controls__button--inactive':
																		routeSet.active && routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY,
																}
															)}
															role="button"
															onClick={(e) =>
																!(routeSet.active && routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY) &&
																this.props.onStudioRouteSetSwitch &&
																this.props.onStudioRouteSetSwitch(e, id, routeSet, !routeSet.active)
															}
															tabIndex={0}
															key={id}>
															{routeSet.name}
														</button>
													))}
												</div>
											))}
										</div>
									)}
								</VelocityReact.VelocityTransitionGroup>
							</>
						))}
					<SupportPopUpToggle onClick={this.props.onToggleSupportPanel} isOpen={this.props.isSupportPanelOpen} />
				</VelocityReact.VelocityTransitionGroup>
			</div>
		)
	}
}
