import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as React from 'react'
import * as VelocityReact from 'velocity-react'
import Moment from 'react-moment'
import * as CoreIcons from '@nrk/core-icons/jsx'
import * as ClassNames from 'classnames'

import { translateWithTracker, Translated } from '../lib/ReactMeteorData/react-meteor-data'
import { literal } from '../../lib/lib'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { MomentFromNow } from '../lib/Moment'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'

import { NotificationCenter, NoticeLevel, Notification, NotificationList, NotifierObject } from '../lib/notifications/notifications'
import { WithManagedTracker } from '../lib/reactiveData/reactiveDataHelper'
import { TranslationFunction, translate } from 'react-i18next'
import { NotificationCenterPopUps } from '../lib/notifications/NotificationCenterPanel'

export class ConnectionStatusNotifier extends WithManagedTracker {
	private _notificationList: NotificationList
	private _notifier: NotifierObject
	private _translater: TranslationFunction

	constructor (t: TranslationFunction) {
		super()

		this._translater = t

		this._notificationList = new NotificationList([])
		this._notifier = NotificationCenter.registerNotifier((): NotificationList => {
			return this._notificationList
		})

		let lastNotificationId: string | undefined = undefined

		this.autorun(() => {
			const connected = Meteor.status().connected
			const status = Meteor.status().status
			const reason = Meteor.status().reason
			const retryTime = Meteor.status().retryTime

			if (lastNotificationId) {
				const buf = lastNotificationId
				lastNotificationId = undefined
				NotificationCenter.drop(buf)
			}

			let newNotification: Notification | undefined = undefined
			newNotification = new Notification(Random.id(), this.getNoticeLevel(status), this.getStatusText(status, reason, retryTime), t('Sofie Automation Server'), Date.now(), !connected, (status === 'failed' || status === 'waiting' || status === 'offline') ? [
				{
					label: 'Show issue',
					type: 'default'
				}
			] : undefined)
			newNotification.on('action', (notification, type, e) => {
				switch (type) {
					case 'default':
						Meteor.reconnect()
				}
			})

			if (newNotification.persistent) {
				this._notificationList.set([newNotification])
			} else {
				this._notificationList.set([])
				NotificationCenter.push(newNotification)
				lastNotificationId = newNotification.id
			}
		})
	}

	stop () {
		super.stop()

		this._notifier.stop()
	}

	private getNoticeLevel (status: string) {
		switch (status) {
			case 'connected':
				return NoticeLevel.NOTIFICATION
			case 'connecting':
				return NoticeLevel.WARNING
			default:
				return NoticeLevel.CRITICAL
		}
	}

	private getStatusText (status: string, reason: string | undefined, retryTime: number | undefined): string | React.ReactChild | null {
		const t = this._translater
		switch (status) {
			case 'connecting':
				return <span>{t('Connecting to the')} {t('Sofie Automation Server')}.</span>
			case 'failed':
				return <span>{t('Cannot connect to the')} {t('Sofie Automation Server:')}) + reason}</span>
			case 'waiting':
				return <span>{t('Reconnecting to the')} {t('Sofie Automation Server')} <MomentFromNow unit='seconds'>{retryTime}</MomentFromNow></span>
			case 'offline':
				return <span>{t('Your machine is offline and cannot connect to the')} {t('Sofie Automation Server')}.</span>
			case 'connected':
				return <span>{t('Connected to the')} {t('Sofie Automation Server')}.</span>
		}
		return null
	}
}

interface IProps {
}
interface IState {
	dismissed: boolean
}
interface ITrackedProps {
	connected: boolean
	status: string
	reason: string
	retryTime: number
}

export const ConnectionStatusNotification = translate()(class extends React.Component<Translated<IProps>, IState> {
	private notifier: ConnectionStatusNotifier

	constructor (props: Translated<IProps>) {
		super(props)

		this.notifier = new ConnectionStatusNotifier(props.t)
	}

	componentWillUnmount () {
		this.notifier.stop()
	}

	render () {
		// this.props.connected
		return <NotificationCenterPopUps />
	}
})
