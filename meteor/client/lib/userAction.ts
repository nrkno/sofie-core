import * as i18next from 'i18next'
import {
	NotificationCenter,
	Notification,
	NoticeLevel
} from './notifications/notifications'
import { ClientAPI } from '../../lib/api/client'
import { Meteor } from 'meteor/meteor'
import { eventContextForLog } from './clientAPI'

export function doUserAction<Result> (
	t: i18next.TFunction,
	userEvent: any,
	actionName0: string,
	fcn: (event: any) => Promise<ClientAPI.ClientResponse<Result>>,
	callback?: (err: any, res?: Result) => void | boolean,
	okMessage?: string
) {
	const actionName = t(actionName0)

	// Display a progress message, if the method takes a long time to execute:
	let timeoutMessage: Notification | null = null
	let timeout = Meteor.setTimeout(() => {
		timeoutMessage = new Notification(undefined, NoticeLevel.NOTIFICATION, t('Waiting for action: {{actionName}}...', { actionName: actionName }), 'userAction')
		NotificationCenter.push(timeoutMessage)
	}, 2000)

	const clearMethodTimeout = () => {
		if (!timeoutMessage) {
			// cancel progress message:
			Meteor.clearTimeout(timeout)
		} else {
			try {
				timeoutMessage.drop()
			} catch (e) {
				// message was already dropped, that's fine
			}
		}
	}

	fcn(eventContextForLog(userEvent)).then((res: ClientAPI.ClientResponseSuccess<Result>) => {
		clearMethodTimeout()

		if (ClientAPI.isClientResponseError(res)) {
			let doDefault: boolean | void = true
			if (callback) {
				doDefault = callback(res)
			}
			if (doDefault !== false) {
				NotificationCenter.push(
					new Notification(undefined, NoticeLevel.CRITICAL,
						t('Action {{actionName}} failed: {{error}}', { error: res.message || res.error, actionName: actionName })
					, 'userAction')
				)
				navigator.vibrate([400, 300, 400, 300, 400])
			}
		} else {
			let doDefault: boolean | void = true
			// all good
			if (callback) {
				doDefault = callback(undefined, res.result)
			}
			if (timeoutMessage && doDefault !== false) {
				NotificationCenter.push(
					new Notification(undefined, NoticeLevel.NOTIFICATION,
						okMessage || t('Action {{actionName}} done!', { actionName: actionName })
					, 'userAction', undefined, false, undefined, undefined, 2000)
				)
			}
		}

	}).catch((err) => {
		clearMethodTimeout()
		// console.error(err) - this is a result of an error server-side. Will be logged, no reason to print it out to console
		let doDefault: boolean | void = true
		if (callback) {
			doDefault = callback(err)
		}
		if (doDefault !== false) {
			NotificationCenter.push(
				new Notification(undefined, NoticeLevel.CRITICAL, t('{{actionName}} failed! More information can be found in the system log.', { actionName: actionName }), 'userAction')
			)
			navigator.vibrate([400, 300, 400, 300, 400])
		}
	})
}
