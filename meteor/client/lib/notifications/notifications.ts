/// <reference path="reactivearray.d.ts" />

import { ReactiveVar } from 'meteor/reactive-var'
import { ReactiveDict, ReactiveArray } from './reactivearray'
import { StatusCode } from '../../../server/systemStatus'
import { Dictionary } from 'underscore'
import * as _ from 'underscore'
import { Tracker } from 'meteor/tracker'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { EventEmitter } from 'events'
import { faThumbsDown } from '@fortawesome/fontawesome-free-solid'

export enum NoticeLevel {
	CRITICAL,
	WARNING,
	NOTIFICATION,
	TIP
}

export interface NotificationAction {
	label: string
	id: string
	icon?: any
}

export class Notification extends EventEmitter {
	status: NoticeLevel
	message: string
	source: string
	persistent?: boolean
	snoozed?: boolean
	actions?: Array<NotificationAction>

	constructor (status: NoticeLevel, message: string, source: string, persistent?: boolean, actions?: Array<NotificationAction>) {
		super()

		this.status = status
		this.message = message
		this.source = source
		this.persistent = persistent || false
		this.actions = actions || undefined
	}
}

interface NotificationHandle {
	id: string,
	stop: () => void
}

export class NotificationList extends ReactiveArray<Notification> {

}

export type Notifier = () => NotificationList

interface NotifierObject {
	handle: Tracker.Computation
	result: Array<Notification>
	stop (): void
}

class NotificationCenter0 {
	private notifiers: Dictionary<NotifierObject>

	private notifications: Dictionary<Notification>
	private notificationsDep: Tracker.Dependency

	constructor () {
		this.notifications = {}
		this.notificationsDep = new Tracker.Dependency()
		this.notifiers = {}
	}

	registerNotifier (source: Notifier): string {
		const notifierId = Random.id()

		const notifierObj: NotifierObject = {
			handle: Tracker.autorun(() => {
				notifierObj.result = source().list()
				this.notificationsDep.changed()
			}),
			result: [],
			stop () {
				notifierObj.handle.stop()
			}
		}

		this.notifiers[notifierId] = notifierObj

		return notifierId
	}

	push (notice: Notification): NotificationHandle {
		const id = Random.id()
		this.notifications[id] = notice
		this.notificationsDep.changed()

		return {
			id,
			stop: () => {
				this.drop(id)
			}
		}
	}

	drop (id: string): void {
		if (this.notifications[id]) {
			this.notifications[id].emit('removed')
			delete this.notifications[id]
			this.notificationsDep.changed()
		} else {
			throw new Meteor.Error(404, `Notification "${id}" could not be found in the Notification Center`)
		}
	}

	getNotifications (): Array<Notification> {
		this.notificationsDep.depend()
		return _.flatten(_.map(this.notifiers, (item, key) => item.result)
						 .concat(_.map(this.notifications, (item, key) => item)))
	}
}

export const NotificationCenter = new NotificationCenter0()
