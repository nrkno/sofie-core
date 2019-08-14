import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as React from 'react'
import * as _ from 'underscore'

import { Translated } from '../lib/ReactMeteorData/react-meteor-data'
import { MomentFromNow } from '../lib/Moment'

import { NotificationCenter, NoticeLevel, Notification, NotificationList, NotifierHandle } from '../lib/notifications/notifications'
import { WithManagedTracker } from '../lib/reactiveData/reactiveDataHelper'
import { TranslationFunction, translate } from 'react-i18next'
import { NotificationCenterPopUps } from '../lib/notifications/NotificationCenterPanel'
import { PubSub } from '../../lib/api/pubsub'
import { CoreSystem, ICoreSystem, ServiceMessage, Criticality } from '../../lib/collections/CoreSystem'
import { notDeepEqual } from 'assert';

export class ConnectionStatusNotifier extends WithManagedTracker {
	private _notificationList: NotificationList
	private _notifier: NotifierHandle
	private _translator: TranslationFunction
	private _serviceMessageRegistry: {[index: string]: ServiceMessage}

	constructor (t: TranslationFunction) {
		super()

		this.subscribe(PubSub.coreSystem, null)

		this._translator = t

		this._notificationList = new NotificationList([])
		this._notifier = NotificationCenter.registerNotifier((): NotificationList => {
			return this._notificationList
		})

		// internal registry for service messages
		this._serviceMessageRegistry = {}

		let lastNotificationId: string | undefined = undefined
		let lastStatus: any = undefined

		this.autorun(() => {
			const meteorStatus = Meteor.status()
			const cs = CoreSystem.findOne()

			if (lastNotificationId) {
				const buf = lastNotificationId
				lastNotificationId = undefined
				try {
					NotificationCenter.drop(buf)
				} catch (e) {
					// if the last notification can't be dropped, ignore
				}
			}

			document.title = 'Sofie' + (cs && cs.name ? ' - ' + cs.name : '')
			
			let systemNotification: Notification | undefined = createSystemNotification(cs)
			let newNotification =  this.createNewNotification(meteorStatus)

			if (newNotification.persistent) {
				this._notificationList.set(_.compact([newNotification, systemNotification]))
			} else {
				this._notificationList.set(_.compact([systemNotification]))
				if (lastStatus !== status) {
					NotificationCenter.push(newNotification)
					lastNotificationId = newNotification.id
				}
			}

			if (cs) {
				this.updateServiceMessages(cs.serviceMessages)
			}

			lastStatus = status
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

	private getNoticeLevelForCriticality(criticality:Criticality) {
		switch(criticality) {
			case Criticality.CRITICAL:
				return NoticeLevel.CRITICAL
			case Criticality.WARNING:
				return NoticeLevel.WARNING
			case Criticality.NOTIFICATION:
				return NoticeLevel.NOTIFICATION
		}
	}

	private getStatusText (
		status: string,
		reason: string | undefined,
		retryTime: number | undefined
	): string | React.ReactElement<HTMLElement> | null {
		const t = this._translator
		switch (status) {
			case 'connecting':
				return <span>{t('Connecting to the')} {t('Sofie Automation Server')}.</span>
			case 'failed':
				return <span>{t('Cannot connect to the')} {t('Sofie Automation Server:')} + reason}</span>
			case 'waiting':
				return <span>{t('Reconnecting to the')} {t('Sofie Automation Server')} <MomentFromNow unit='seconds'>{retryTime}</MomentFromNow></span>
			case 'offline':
				return <span>{t('Your machine is offline and cannot connect to the')} {t('Sofie Automation Server')}.</span>
			case 'connected':
				return <span>{t('Connected to the')} {t('Sofie Automation Server')}.</span>
		}
		return null
	}

	private createNewNotification(meteorStatus:DDP.DDPStatus):Notification {
		const {status, reason, retryTime, connected} = meteorStatus
		const notification = new Notification(
			Random.id(),
			this.getNoticeLevel(status),
			this.getStatusText(status, reason, retryTime),
			this._translator('Sofie Automation Server'),
			Date.now(),
			!connected,
			(status === 'failed' || status === 'waiting' || status === 'offline')
			? [
				{
					label: 'Show issue',
					type: 'default'
				}
			] : undefined,
			-100)
	
		notification.on('action', (notification, type, e) => {
			switch (type) {
				case 'default':
					Meteor.reconnect()
			}
		})
	
		return notification
	}

	private updateServiceMessages(serviceMessages: {[index: string]: ServiceMessage}):void {
		const systemMessageIds = Object.keys(serviceMessages)
		
		// remove from internal list where ids not in active list
		Object.keys(this._serviceMessageRegistry).filter(id => systemMessageIds.indexOf(id) < 0)
			.forEach(idToRemove => {
				delete this._serviceMessageRegistry[idToRemove]
				
			})
		
		const localMessagesId = Object.keys(this._serviceMessageRegistry)
		// add ids not found in internal list
		systemMessageIds.filter(id => localMessagesId.indexOf(id) < 0)
			.forEach(id => {
				const newMessage = serviceMessages[id]
				const notification = new Notification(
					id,
					this.getNoticeLevelForCriticality(newMessage.criticality),
					newMessage.message,
					newMessage.sender || '(service message)',
					newMessage.timestamp.getMilliseconds()
					)
					
				this._serviceMessageRegistry[id] = newMessage
				NotificationCenter.push(notification)
			})

		// compare and update where ids are in both lists
		systemMessageIds.filter(id => localMessagesId.indexOf(id) > -1)
			.forEach(id => {
				const current = serviceMessages[id]
				// Nope, can't use that, throws error. Probably something in _ that's useful :)
				if (notDeepEqual(current, this._serviceMessageRegistry[id])) {
					this._serviceMessageRegistry[id] = current
					// replace exisiting notification
				}
			})

	}
}

function createSystemNotification(cs:ICoreSystem|undefined):Notification | undefined {
	if (cs && cs.systemInfo && cs.systemInfo.enabled) {
		return new Notification(
			Random.id(),
			NoticeLevel.CRITICAL,
			cs.systemInfo.message,
			'SystemMessage',
			undefined,
			true,
			undefined,
			1000)
	}

	return undefined
}


interface IProps {
}
interface IState {
	dismissed: boolean
}

export const ConnectionStatusNotification = translate()(class extends React.Component<Translated<IProps>, IState> {
	private notifier: ConnectionStatusNotifier

	constructor (props: Translated<IProps>) {
		super(props)

	}

	componentDidMount () {
		this.notifier = new ConnectionStatusNotifier(this.props.t)
	}

	componentWillUnmount () {
		this.notifier.stop()
	}

	render () {
		// this.props.connected
		return <NotificationCenterPopUps />
	}
})
