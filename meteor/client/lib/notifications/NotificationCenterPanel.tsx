import * as React from 'react'
import CoreIcon from '@nrk/core-icons/jsx'
import ClassNames from 'classnames'
import * as VelocityReact from 'velocity-react'
import * as Velocity from 'velocity-animate'
import { translateWithTracker, Translated, withTracker } from '../ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../MeteorReactComponent'
import { NotificationCenter, Notification, NoticeLevel, NotificationAction } from './notifications'
import { sofieWarningIcon as WarningIcon } from './warningIcon'
import { ContextMenuTrigger, ContextMenu, MenuItem } from 'react-contextmenu'
import * as _ from 'underscore'
import { SegmentId } from '../../../lib/collections/Segments'

interface IPopUpProps {
	item: Notification
	showDismiss?: boolean
	isHighlighted?: boolean
	onDismiss?: (e: any) => void
}

/**
 * The component that is used for both elements within the Notification Center as well as the Notification pop-ups as well
 * @class NotificationPopUp
 * @extends React.Component<IPopUpProps>
 */
class NotificationPopUp extends React.Component<IPopUpProps> {
	triggerEvent = (action: NotificationAction, e) => {

		if (action.action) {
			action.action()
		} else {
			if (this.props.item.actions && this.props.item.actions.find(i => i.type === action.type)) {
				this.props.item.action(action.type, e)
			}
		}
	}

	render () {
		const { item } = this.props

		const defaultActions: NotificationAction[] = _.filter(item.actions || [], i => i.type === 'default')
		const allActions: NotificationAction[] = item.actions || []

		const defaultAction: NotificationAction | undefined = (
			defaultActions.length === 1 && allActions.length === 1 ?
				defaultActions[0] :
				undefined
		)

		return <div className={ClassNames('notification-pop-up', {
			'critical': item.status === NoticeLevel.CRITICAL,
			'notice': item.status === NoticeLevel.NOTIFICATION,
			'warning': item.status === NoticeLevel.WARNING,
			'tip': item.status === NoticeLevel.TIP,

			'has-default-action': !!defaultAction,

			'persistent': item.persistent,

			'is-highlighted': this.props.isHighlighted
		})}
			onClick={defaultAction ? (e) => this.triggerEvent(defaultAction, e) : undefined}
		>
			<div className='notification-pop-up__header'>
				<WarningIcon />
			</div>
			<div className='notification-pop-up__contents'>
				{item.message}
				{(
					!defaultAction && allActions.length ?
						<div className='notification-pop-up__actions'>
							{_.map(allActions, (action: NotificationAction, i: number) => {
								return (
									<button key={i} className={ClassNames('btn', (
										['default', 'primary'].indexOf(action.type) ? 'btn-primary' : 'btn-default'
									))} onClick={e => this.triggerEvent(action, e)}>
										{action.label}
									</button>
								)
							})}
						</div>
						: null
				)}
			</div>
			{this.props.showDismiss &&
				<ContextMenuTrigger id='context-menu-dissmiss-all' attributes={{ className: 'notification-pop-up__dismiss' }}>
					{/* <div className='notification-pop-up__dismiss'> */}
					<button
						className='notification-pop-up__dismiss__button'
						onClick={(e) => {
							e.stopPropagation()
							if (typeof this.props.onDismiss === 'function') this.props.onDismiss(e)
						}}
					>
						<CoreIcon id='nrk-close' />
					</button>
					{/* </div> */}
				</ContextMenuTrigger>
			}
		</div>
	}
}

/**
 * NotificationCenterPopUps props.
 */
interface IProps {
	/** Should the list show a 'List empty' label, if the notification list is empty? Defaults to false */
	showEmptyListLabel?: boolean
	/** Should snoozed notifications be shown? Defaults to false */
	showSnoozed?: boolean
	/** Limit the amount of shown notifications */
	limitCount?: number
}

interface IState {

}

interface ITrackedProps {
	notifications: Array<Notification>,
	highlightedSource: SegmentId | string | undefined
	highlightedLevel: NoticeLevel
}

/**
 * Presentational component that displays a list of notifications from the Notification Center.
 * @class NotificationCenterPopUps
 * @extends React.Component<IProps>
 */
export const NotificationCenterPopUps = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state: IState) => {
	return {
		notifications: NotificationCenter.getNotifications(),
		highlightedSource: NotificationCenter.getHighlightedSource(),
		highlightedLevel: NotificationCenter.getHighlightedLevel()
	}
})(class NotificationCenterPopUps extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	dismissNotification (item: Notification) {
		if (item.persistent) {
			item.snooze()
		} else {
			item.drop()
		}
	}

	dismissAll () {
		for (const notification of this.props.notifications) {
			this.dismissNotification(notification)
		}
	}

	UNSAFE_componentWillUpdate () {
		Array.from(document.querySelectorAll('.notification-pop-up.is-highlighted')).forEach((element: HTMLElement) => {
			element.style.animationName = ''
		})
	}

	componentDidUpdate (prevProps, prevState, snapshot) {
		if (super.componentDidUpdate) super.componentDidUpdate(prevProps, prevState, snapshot)

		if (this.props.highlightedSource && this.props.highlightedLevel &&
			(prevProps.highlightedSource !== this.props.highlightedSource ||
				prevProps.highlightedLevel !== this.props.highlightedLevel)) {
			const items: NodeListOf<HTMLElement> = document.querySelectorAll('.notification-pop-up.is-highlighted')
			if (items.length > 0) {
				// scroll to highlighted items
				const currentAnimationName = getComputedStyle(items[0]).getPropertyValue('animation-name')

				const container = document.querySelector('.notification-center-panel .notification-pop-ups')
				if (container) {
					const offsetTop = items[0].offsetTop || 0

					container.scrollTo({
						left: 0,
						top: offsetTop - 10,
						behavior: 'smooth'
					})
				}

				Array.from(items).forEach(item => {
					item.style.animationName = 'none'
				})

				if (currentAnimationName !== 'none') {
					window.requestAnimationFrame(function () {
						Array.from(items).forEach(item => {
							item.style.animationName = currentAnimationName
						})
					})
				}
			}
		}
	}

	render () {
		const { t, highlightedSource, highlightedLevel } = this.props

		let notifications
		if (this.props.limitCount !== undefined) {
			notifications = this.props.notifications
				.filter(i => this.props.showSnoozed || !i.snoozed)
				.sort((a, b) => Notification.compare(a, b))
				.slice(0, this.props.limitCount)
		} else {
			notifications = this.props.notifications
				.filter(i => this.props.showSnoozed || !i.snoozed)
				.sort((a, b) => Notification.compare(a, b))
		}

		const displayList = notifications
			.map(item => (
			<NotificationPopUp key={item.created + (item.message || 'undefined').toString() + (item.id || '')}
				item={item} onDismiss={() => this.dismissNotification(item)}
				showDismiss={!item.persistent || !this.props.showSnoozed}
				isHighlighted={item.source === highlightedSource && item.status === highlightedLevel} />
		))

		return ((this.props.showEmptyListLabel || displayList.length > 0) &&
			<div className='notification-pop-ups'>
				<VelocityReact.VelocityTransitionGroup enter={{
					animation: 'fadeIn', easing: 'ease-out', duration: 300, display: 'flex'
				}} leave={{
					animation: 'fadeOut', easing: 'ease-in', duration: 150, display: 'flex'
				}}>
					{displayList}
					{this.props.showEmptyListLabel && displayList.length === 0 &&
						<div className='notification-pop-ups__empty-list'>{t('No notifications')}</div>
					}
				</VelocityReact.VelocityTransitionGroup>

				<ContextMenu id='context-menu-dissmiss-all'>
					<MenuItem onClick={() => this.dismissAll()}>{t('Dismiss all notifications')}</MenuItem>
				</ContextMenu>
			</div>
		)
	}
})

/**
 * Presentational component that displays a panel containing the NotificationCenterPopUps list containing
 * the snoozed items and an 'Empty' label if no notifications are present.
 * @export
 * @class NotificationCenterPanel
 * @extends React.Component
 */
export class NotificationCenterPanel extends React.Component<{limitCount?: number}> {
	render () {
		return (
			<div className='notification-center-panel'>
				<NotificationCenterPopUps showEmptyListLabel={true} showSnoozed={true} limitCount={this.props.limitCount} />
			</div>
		)
	}
}

/**
 * NotificationCenterPanelToggle props
 * @interface IToggleProps
 */
interface IToggleProps {
	/** Click event handler */
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
	/** Use 'open' class for the button to signify that the notification center is open */
	isOpen?: boolean
}

interface ITrackedCountProps {
	count: number
}

/**
 * A button for with a count of notifications in the Notification Center
 * @export
 * @class NotificationCenterPanelToggle
 * @extends React.Component<IToggleProps>
 */
export const NotificationCenterPanelToggle = withTracker<IToggleProps, {}, ITrackedCountProps>(() => {
	return {
		count: NotificationCenter.count()
	}
})(class NotificationCenterPanelToggle extends MeteorReactComponent<IToggleProps & ITrackedCountProps> {
	render () {
		return (
			<button className={ClassNames('status-bar__controls__button', 'notifications__toggle-button', {
				'status-bar__controls__button--open': this.props.isOpen,
				'has-items': this.props.count > 0
			})} role='button' onClick={this.props.onClick} tabIndex={0}>
				<WarningIcon />
				{this.props.count > 0 &&
					<span className='notifications__toggle-button__count'>{this.props.count > 99 ? '99+' : this.props.count}</span>
				}
			</button>
		)
	}
})
