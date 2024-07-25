import { ReactiveVar } from 'meteor/reactive-var'
import { Tracker } from 'meteor/tracker'
import { Meteor } from 'meteor/meteor'
import { assertNever, LocalStorageProperty } from '../lib'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'

let reportNotificationsId: string | null = null

export function getReportNotifications(): string | null {
	return reportNotificationsId
}

export function setReportNotifications(id: string | null): void {
	reportNotificationsId = id
}

Meteor.startup(() => {
	if (!Meteor.isClient) return

	reportNotificationsId = localStorage.getItem(LocalStorageProperty.LOG_NOTIFICATIONS)
})

/**
 * Priority level for Notifications.
 *
 * @export
 * @enum {number}
 */
export enum NoticeLevel {
	/** Highest priority notification. Subject matter will affect operations. */
	CRITICAL = 0b0001, // 1
	/** High priority notification. Operations will not be affected, but non-critical functions may be affected or the result may be undesirable. */
	WARNING = 0b0010, // 2
	/** Confirmation of a successful operation and general informations. */
	NOTIFICATION = 0b0100, // 4
	/** Tips to the user */
	TIP = 0b1000, // 8
}

/**
 * An action object interface defining actions that the user can take on an action
 *
 * @export
 * @interface NotificationAction
 */
export interface NotificationAction {
	/** User-presented string label on the action button */
	label: string
	/** Action type. If set to 'default', will attach this action to a click on the notification. */
	type: string // for a default, use 'default'
	/** Icon shown on the action button. */
	icon?: any
	/** The method that will be called when the user takes the aciton. */
	action?: (e: any) => void
	/** If true, will disable the action (ie the button will show, but not clickable). */
	disabled?: boolean
}

/** A source of notifications */
export type Notifier = () => NotificationList

const notifiers: { [index: string]: NotifierHandle } = {}

const notificationsDep: Tracker.Dependency = new Tracker.Dependency()

/**
 * A reactive list of notifications, produced by a Notifier.
 *
 * @export
 * @class NotificationList
 * @extends {ReactiveVar<Notification[]>}
 */
export class NotificationList extends ReactiveVar<Notification[]> {}

/**
 * A handle object to a registered notifier.
 *
 * @export
 * @class NotifierObject
 */
export class NotifierHandle {
	id: string
	source: Notifier
	handle: Tracker.Computation
	result: Array<Notification> = []

	/**
	 * Creates an instance of NotifierHandle. Used internally by the Notification Center singleton.
	 * @param {string} notifierId
	 * @param {Notifier} source
	 * @memberof NotifierHandle
	 */
	constructor(notifierId: string, source: Notifier) {
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

	/**
	 * Stop notifications from this notifier.
	 *
	 * @memberof NotifierHandle
	 */
	stop(): void {
		this.handle.stop()

		delete notifiers[this.id]

		notificationsDep.changed()
	}
}

export function getNoticeLevelForPieceStatus(statusCode: PieceStatusCode | undefined): NoticeLevel | null {
	switch (statusCode) {
		case PieceStatusCode.OK:
		case PieceStatusCode.UNKNOWN:
		case undefined:
			return null
		case PieceStatusCode.SOURCE_NOT_SET:
			return NoticeLevel.CRITICAL
		case PieceStatusCode.SOURCE_MISSING:
		case PieceStatusCode.SOURCE_BROKEN:
		case PieceStatusCode.SOURCE_UNKNOWN_STATE:
			return NoticeLevel.WARNING
		case PieceStatusCode.SOURCE_HAS_ISSUES:
		case PieceStatusCode.SOURCE_NOT_READY:
			return NoticeLevel.NOTIFICATION
		default:
			assertNever(statusCode)
			return NoticeLevel.WARNING
	}
}
