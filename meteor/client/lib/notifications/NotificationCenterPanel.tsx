import * as React from 'react'
import * as CoreIcon from '@nrk/core-icons/jsx'
import * as ClassNames from 'classnames'
import * as VelocityReact from 'velocity-react'

import { translateWithTracker, Translated } from '../ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../MeteorReactComponent'
import { NotificationCenter, Notification, NoticeLevel } from './notifications'

interface IPopUpProps {
	item: Notification
	onDismiss?: (e: any) => void
}

class NotificationPopUp extends React.Component<IPopUpProps> {
	render () {
		const { item } = this.props

		return <div className={ClassNames('notification-pop-up', {
			'critical': item.status === NoticeLevel.CRITICAL,
			'notification': item.status === NoticeLevel.NOTIFICATION,
			'warning': item.status === NoticeLevel.WARNING,
			'tip': item.status === NoticeLevel.TIP
		})} key={item.created + item.message}>
			<div className='notification-pop-up__header'>
				<img className='icon' src='/icons/warning_icon.svg' />
			</div>
			<div className='notification-pop-up__contents' dangerouslySetInnerHTML={{ __html: item.message }}></div>
			<div className='notification-pop-up__dismiss'>
				<button className='notification-pop-up__dismiss__button' onClick={this.props.onDismiss}>
					<CoreIcon id='nrk-close' />
				</button>
			</div>
		</div>
	}
}

interface IProps {

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
		return (
			<div className='notification-pop-ups'>
				<VelocityReact.VelocityTransitionGroup enter={{
					animation: 'fadeIn', easing: 'ease-out', duration: 300, display: 'flex'
				}} leave={{
					animation: 'fadeOut', easing: 'ease-in', duration: 500, display: 'flex'
				}}>
					{this.props.notifications.filter(i => !i.snoozed).sort((a, b) => (b.created - a.created)).map(item => (
						<NotificationPopUp key={item.created + item.message + (item.id || '')} item={item} onDismiss={() => this.dismissNotification(item)} />
					))}
				</VelocityReact.VelocityTransitionGroup>
			</div>
		)
	}
})
