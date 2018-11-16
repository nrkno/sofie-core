import * as React from 'react'
import * as CoreIcon from '@nrk/core-icons/jsx'
import * as ClassNames from 'classnames'
import * as VelocityReact from 'velocity-react'

import { translateWithTracker, Translated } from '../ReactMeteorData/ReactMeteorData'
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
	render () {
		const { item } = this.props

		return <div className={ClassNames('notification-pop-up', {
			'critical': item.status === NoticeLevel.CRITICAL,
			'notice': item.status === NoticeLevel.NOTIFICATION,
			'warning': item.status === NoticeLevel.WARNING,
			'tip': item.status === NoticeLevel.TIP
		})}>
			<div className='notification-pop-up__header'>
				<img className='icon' src='/icons/warning_icon.svg' />
			</div>
			<div className='notification-pop-up__contents'>
				{item.message}
			</div>
			{this.props.showDismiss &&
				<div className='notification-pop-up__dismiss'>
					<button className='notification-pop-up__dismiss__button' onClick={this.props.onDismiss}>
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
		const displayList = this.props.notifications.filter(i => this.props.showSnoozed || !i.snoozed).sort((a, b) => (b.created - a.created)).map(item => (
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
						<span className='notification-pop-ups__empty-list'>{t('No notifications')}</span>
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

export class NotificationCenterPanelToggle extends React.Component<IToggleProps> {
	render () {
		return (
			<div className={ClassNames('notifications__toggle-button', {
				'open': this.props.isOpen
			})} role='button' onClick={this.props.onClick} tabIndex={0}>
				<FontAwesomeIcon icon={faChevronLeft} />
			</div>
		)
	}
}
