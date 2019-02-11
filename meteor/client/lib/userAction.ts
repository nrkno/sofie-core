import * as i18next from 'i18next'
import { callMethod } from './clientAPI'
import {
	NotificationCenter,
	Notification,
	NoticeLevel
} from './notifications/notifications'
import { ClientAPI } from '../../lib/api/client'
import { Meteor } from 'meteor/meteor'
import { UserActionAPI } from '../../lib/api/userActions'

export function doUserAction (
	t: i18next.TranslationFunction<any, object, string>,
	event: any,
	method: UserActionAPI.methods,
	params: Array<any>,
	callback?: (err: any, res?: ClientAPI.ClientResponseSuccess) => void,
	okMessage?: string
) {

	// Display a progress message, if the method takes a long time to execute:
	let timeoutMessage: Notification | null = null
	let timeout = Meteor.setTimeout(() => {
		timeoutMessage = new Notification(undefined, NoticeLevel.NOTIFICATION, t('Waiting for action: {{actionName}}...', {actionName: userActionMethodName(t, method)}), 'userAction')
		NotificationCenter.push(timeoutMessage)
	}, 500)

	callMethod(event, method, ...params, (err, res) => {

		if (!timeoutMessage) {
			// cancel progress message:
			Meteor.clearTimeout(timeout)
		} else {
			timeoutMessage.drop()
		}

		if (err) {
			console.error(err)
			NotificationCenter.push(
				new Notification(undefined, NoticeLevel.CRITICAL, t('{{actionName}} failed! More information can be found in the system log.', {actionName: userActionMethodName(t, method)}), 'userAction')
			)
			if (callback) callback(err)
		} else if (ClientAPI.isClientResponseError(res)) {
			NotificationCenter.push(
				new Notification(undefined, NoticeLevel.CRITICAL,
					t('Action {{actionName}} failed: {{error}}', { error: res.message || res.error, actionName: userActionMethodName(t, method) })
				, 'userAction')
			)
			if (callback) callback(res)
		} else {
			// all good
			if (timeoutMessage) {
				NotificationCenter.push(
					new Notification(undefined, NoticeLevel.NOTIFICATION,
						okMessage || t('Action {{actionName}} done!', {actionName: userActionMethodName(t, method)})
					, 'userAction', undefined, false, undefined, undefined, 2000)
				)
			}
			if (callback) callback(undefined, res)
		}
	})
}
function userActionMethodName (
	t: i18next.TranslationFunction<any, object, string>,
	method: UserActionAPI.methods
) {
	switch (method) {
		// @todo: go through these and set better names:
		case UserActionAPI.methods.take: return 'Take'
		case UserActionAPI.methods.setNext: return 'Setting Next'
		case UserActionAPI.methods.moveNext: return 'Moving Next'

		case UserActionAPI.methods.prepareForBroadcast: return 'Preparing for broadcast'
		case UserActionAPI.methods.resetRunningOrder: return 'Resetting Runningorder'
		case UserActionAPI.methods.resetAndActivate: return 'Resetting and activating Runningorder'
		case UserActionAPI.methods.activate: return 'Activating Runningorder'
		case UserActionAPI.methods.deactivate: return 'Deactivating Runningorder'
		case UserActionAPI.methods.reloadData: return 'Reloading runningOrder data'

		case UserActionAPI.methods.disableNextSegmentLineItem: return 'Disabling next segmentLineItem'
		case UserActionAPI.methods.toggleSegmentLineArgument: return 'Toggling SegmentLine-Argument'
		case UserActionAPI.methods.segmentLineItemTakeNow: return 'Taking SegmentLineItem'

		case UserActionAPI.methods.segmentAdLibLineItemStart: return 'Starting AdLib Item'
		case UserActionAPI.methods.baselineAdLibItemStart: return 'Starting AdLib Item'
		case UserActionAPI.methods.segmentAdLibLineItemStop: return 'Stopping AdLib Item'

		case UserActionAPI.methods.sourceLayerStickyItemStart: return 'Starting sticky-item'

		case UserActionAPI.methods.activateHold: return 'Activating Hold'

		case UserActionAPI.methods.saveEvaluation: return 'Saving Evaluation'

		case UserActionAPI.methods.storeRunningOrderSnapshot: return 'Creating Snapshot for debugging'
	}

}
