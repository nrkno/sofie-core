/// <reference path="./reactivearray.d.ts" />

import { ReactiveVar } from 'meteor/reactive-var'
import { Dictionary } from 'underscore'
import * as _ from 'underscore'
import { Tracker } from 'meteor/tracker'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { EventEmitter } from 'events'
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
	CRITICAL = 1,
	WARNING = 2,
	NOTIFICATION = 3,
	TIP = 4
}

export interface NotificationAction {
	label: string
	type: string // for a default, use 'default'
	icon?: any
	action?: Function
}

export type Notifier = () => NotificationList

const notifiers: Dictionary<NotifierObject> = {}

const notifications: Dictionary<Notification> = {}
const notificationsDep: Tracker.Dependency = new Tracker.Dependency()

interface NotificationHandle {
	id: string,
	stop: () => void
}

export class NotificationList extends ReactiveVar<Notification[]> {

}

export class NotifierObject {
	id: string
	source: Notifier
	handle: Tracker.Computation
	result: Array<Notification> = []

	constructor (notifierId: string, source: Notifier) {
		this.id = notifierId
		this.source = source
		this.handle = Tracker.nonreactive(() => {
			return Tracker.autorun(() => {
				this.result = source().get()
				notificationsDep.changed()
			})
		}) as any as Tracker.Computation

		notifiers[notifierId] = this
	}

	stop (): void {
		this.handle.stop()

		delete notifiers[this.id]

		notificationsDep.changed()
	}
}

class NotificationCenter0 {
	private NOTIFICATION_TIMEOUT = 5000
	private highlightedSource: ReactiveVar<string | undefined>
	private highlightedLevel: ReactiveVar<NoticeLevel>

	constructor () {
		this.highlightedSource = new ReactiveVar<string>('')
		this.highlightedLevel = new ReactiveVar<NoticeLevel>(NoticeLevel.TIP)
	}

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
		}, notice.timeout || this.NOTIFICATION_TIMEOUT)
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

	count (): number {
		notificationsDep.depend()

		return _.reduce(_.map(notifiers, (item) => item.result.length), (a, b) => a + b, 0) + _.values(notifications).length
	}

	snoozeAll () {
		const n = this.getNotifications()
		n.forEach((item) => item.snooze())
	}

	highlightSource (source: string | undefined, level: NoticeLevel) {
		this.highlightedSource.set(source)
		this.highlightedLevel.set(level)
	}

	getHighlightedSource () {
		return this.highlightedSource.get()
	}

	getHighlightedLevel () {
		return this.highlightedLevel.get()
	}
}

export const NotificationCenter = new NotificationCenter0()

export class Notification extends EventEmitter {
	id: string | undefined
	status: NoticeLevel
	message: string | React.ReactNode
	source: string
	persistent?: boolean
	timeout?: number
	snoozed?: boolean
	actions?: Array<NotificationAction>
	created: Time
	rank: number

	constructor (
		id: string | undefined,
		status: NoticeLevel,
		message: string | React.ReactNode,
		source: string,
		created?: Time,
		persistent?: boolean,
		actions?: Array<NotificationAction>,
		rank?: number,
		timeout?: number) {
		super()

		this.id = id
		this.status = status
		this.message = message
		this.source = source
		this.persistent = persistent || false
		this.actions = actions || undefined
		this.created = created || Date.now()
		this.rank = rank || 0
		this.timeout = timeout
	}

	static isEqual (a: Notification | undefined, b: Notification | undefined): boolean {
		if (typeof a !== typeof b) return false
		return _.isEqual(_.omit(a, ['created', 'snoozed', 'actions', '_events']), _.omit(b, ['created', 'snoozed', 'actions', '_events']))
	}

	static compare (a: Notification, b: Notification): number {
		return (!!a.persistent === !!b.persistent ? 0 : a.persistent && !b.persistent ? 1 : -1) ||
			   (a.status - b.status) || (a.rank - b.rank) || (a.created - b.created)
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

window['testNotification'] = function () {
	NotificationCenter.push(new Notification(undefined, NoticeLevel.TIP, 'Notification test', 'test'))
}
