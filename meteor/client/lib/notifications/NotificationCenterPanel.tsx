import * as React from 'react'
import * as CoreIcon from '@nrk/core-icons/jsx'
import * as ClassNames from 'classnames'
import * as VelocityReact from 'velocity-react'

import { translateWithTracker, Translated, withTracker } from '../ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../MeteorReactComponent'
import { NotificationCenter, Notification, NoticeLevel } from './notifications'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { faChevronLeft } from '@fortawesome/fontawesome-free-solid'

interface IPopUpProps {
	item: Notification
	showDismiss?: boolean
	onDismiss?: (e: any) => void
}

class NotificationPopUp extends React.Component<IPopUpProps> {
	triggerEvent = (eventName, e) => {
		if (this.props.item.actions && this.props.item.actions.find(i => i.type === eventName)) {
			this.props.item.action(eventName, e)
		}
	}

	render () {
		const { item } = this.props

		const hasDefaultAction = item.actions && !!item.actions.find(i => i.type === 'default')

		return <div className={ClassNames('notification-pop-up', {
			'critical': item.status === NoticeLevel.CRITICAL,
			'notice': item.status === NoticeLevel.NOTIFICATION,
			'warning': item.status === NoticeLevel.WARNING,
			'tip': item.status === NoticeLevel.TIP,

			'has-default-action': hasDefaultAction
		})}
		onClick={(e) => this.triggerEvent('default', e)}
		>
			<div className='notification-pop-up__header'>
				<svg height='16' viewBox='0 0 17 16' width='17' xmlns='http://www.w3.org/2000/svg'><path d='m14.8185992 4.55137109 3.200058 10.98449001c.3089457 1.060484-.3002966 2.1706261-1.3607806 2.4795717-.3653366.1064318-.7534545.1064318-1.1187911 0l-10.98449006-3.200058c-1.06048403-.3089456-1.66972626-1.4190877-1.36078061-2.4795717.09408471-.3229543.26810614-.6169615.50596262-.854818l7.78443205-7.784432c.7810486-.78104858 2.0473785-.78104858 2.8284271 0 .2378565.23785649.4118779.53186368.5059626.85481799z' fill='none' stroke='#ff0' transform='matrix(-.70710678 -.70710678 .70710678 -.70710678 8.608516 25.600215)' /></svg>
			</div>
			<div className='notification-pop-up__contents'>
				{item.message}
			</div>
			{this.props.showDismiss &&
				<div className='notification-pop-up__dismiss'>
					<button className='notification-pop-up__dismiss__button' onClick={(e) => e.stopPropagation() || (typeof this.props.onDismiss === 'function' && this.props.onDismiss(e))}>
						<CoreIcon id='nrk-close' />
					</button>
				</div>
			}
		</div>
	}
}

interface IProps {
	showEmptyListLabel?: boolean
	showSnoozed?: boolean
}

interface IState {

}

interface ITrackedProps {
	notifications: Array<Notification>
}

export const NotificationCenterPopUps = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps, state: IState) => {
	return {
		notifications: NotificationCenter.getNotifications()
	}
})(class NotificationCenterPopUps extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	dismissNotification (item: Notification) {
		if (item.persistent) {
			item.snooze()
		} else {
			item.drop()
		}
	}

	render () {
		const { t } = this.props
		const displayList = this.props.notifications.filter(i => this.props.showSnoozed || !i.snoozed).sort((a, b) => Notification.compare(a, b)).map(item => (
			<NotificationPopUp key={item.created + (item.message || 'undefined').toString() + (item.id || '')}
				item={item} onDismiss={() => this.dismissNotification(item)}
				showDismiss={!item.persistent || !this.props.showSnoozed} />
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
			</div>
		)
	}
})

export class NotificationCenterPanel extends React.Component {
	render () {
		return (
			<div className='notification-center-panel'>
				<NotificationCenterPopUps showEmptyListLabel={true} showSnoozed={true} />
			</div>
		)
	}
}

interface IToggleProps {
	onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
	isOpen?: boolean
}

interface ITrackedCountProps {
	count: number
}

export const NotificationCenterPanelToggle = withTracker<IToggleProps, {}, ITrackedCountProps>(() => {
	return {
		count: NotificationCenter.count()
	}
})(class NotificationCenterPanelToggle extends MeteorReactComponent<IToggleProps & ITrackedCountProps> {
	render () {
		return (
			<div className={ClassNames('notifications__toggle-button', {
				'open': this.props.isOpen
			})} role='button' onClick={this.props.onClick} tabIndex={0}>
				<FontAwesomeIcon icon={faChevronLeft} />
				{ this.props.count > 0 &&
					<span className='notifications__toggle-button__count'>{this.props.count}</span>
				}
			</div>
		)
	}
})
