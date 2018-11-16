/// <reference path="./reactivearray.d.ts" />

import { ReactiveVar } from 'meteor/reactive-var'
import { StatusCode } from '../../../server/systemStatus'
import { Dictionary } from 'underscore'
import * as _ from 'underscore'
import { Tracker } from 'meteor/tracker'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { EventEmitter } from 'events'
import { faThumbsDown } from '@fortawesome/fontawesome-free-solid'
import { Time } from '../../../lib/lib'

declare class ReactiveArray<T> extends Array<T> {
	constructor (source?: Array<T>)

	/**
	 * Return all elements as a plain Javascript array.
	 */
	array (): Array<T>

	/**
	 * Returns a reactive source of the array.
	 */
	list (): Array<T>

	/**
	 * An alias of list().
	 */
	depend (): Array<T>

	/**
	 * Remove all elements of the array.
	 */
	clear (): void
}

declare class ReactiveDict<T> {
	constructor (id?: string)
	set (key: string, value: T): void
	get (key: string): T
	equals (key: string, compareValue: T): boolean
}

export enum NoticeLevel {
	CRITICAL,
	WARNING,
	NOTIFICATION,
	TIP
}

export interface NotificationAction {
	label: string
	type: string
	icon?: any
}

export class Notification extends EventEmitter {
	id: string | undefined
	status: NoticeLevel
	message: string | React.ReactNode
	source: string
	persistent?: boolean
	snoozed?: boolean
	actions?: Array<NotificationAction>
	created: Time

	constructor (id: string | undefined, status: NoticeLevel, message: string | React.ReactNode, source: string, created?: Time, persistent?: boolean, actions?: Array<NotificationAction>) {
		super()

		this.id = id
		this.status = status
		this.message = message
		this.source = source
		this.persistent = persistent || false
		this.actions = actions || undefined
		this.created = created || Date.now()
	}

	snooze () {
		this.snoozed = true
		notificationsDep.changed()
		this.emit('snoozed', this)
	}

	drop () {
		if (this.id) {
			NotificationCenter.drop(this.id)
		}
	}

	action (type: string, event: any) {
		this.emit('action', this, type, event)
	}
}

interface NotificationHandle {
	id: string,
	stop: () => void
}

export class NotificationList extends ReactiveVar<Notification[]> {

}

export type Notifier = () => NotificationList

const notifiers: Dictionary<NotifierObject> = {}

const notifications: Dictionary<Notification> = {}
const notificationsDep: Tracker.Dependency = new Tracker.Dependency()

export class NotifierObject {
	id: string
	source: Notifier
	handle: Tracker.Computation
	result: Array<Notification> = []

	constructor (notifierId: string, source: Notifier) {
		this.id = notifierId
		this.source = source
		this.handle = Tracker.autorun(() => {
			this.result = source().get()
			notificationsDep.changed()
		})

		notifiers[notifierId] = this
	}

	stop (): void {
		this.handle.stop()

		delete notifiers[this.id]

		notificationsDep.changed()
	}
}

class NotificationCenter0 {
	NOTIFICATION_TIMEOUT = 30000

	registerNotifier (source: Notifier): NotifierObject {
		const notifierId = Random.id()

		return new NotifierObject(notifierId, source)
	}

	push (notice: Notification): NotificationHandle {
		const id = notice.id || Random.id()
		notifications[id] = notice
		notice.id = id
		notificationsDep.changed()

		if (!notice.persistent) {
			this.timeout(notice)
		}

		return {
			id,
			stop: () => {
				this.drop(id)
			}
		}
	}

	timeout (notice: Notification): void {
		Meteor.setTimeout(() => {
			if (notice) {
				const id = notice.id
				if (id && notifications[id]) {
					this.drop(id)
				}
			}
		}, this.NOTIFICATION_TIMEOUT)
	}

	drop (id: string): void {
		if (notifications[id]) {
			notifications[id].emit('dropped')
			delete notifications[id]
			notificationsDep.changed()
		} else {
			throw new Meteor.Error(404, `Notification "${id}" could not be found in the Notification Center`)
		}
	}

	getNotifications (): Array<Notification> {
		notificationsDep.depend()

		return _.flatten(_.map(notifiers, (item, key) => item.result)
						 .concat(_.map(notifications, (item, key) => item)))
	}

	snoozeAll () {
		const n = this.getNotifications()
		n.forEach((item) => item.snooze())
	}
}

export const NotificationCenter = new NotificationCenter0()

window['NotificationCenter'] = NotificationCenter
window['notifiers'] = notifiers
window['testNotify'] = function () {
	NotificationCenter.push(new Notification(Random.id(), NoticeLevel.CRITICAL, 'Raz dwa trzy', 'Test', Date.now(), false))
}
