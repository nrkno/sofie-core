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
	callback?: (err: any, res?: ClientAPI.ClientResponseSuccess) => void | boolean,
	okMessage?: string
) {

	// Display a progress message, if the method takes a long time to execute:
	let timeoutMessage: Notification | null = null
	let timeout = Meteor.setTimeout(() => {
		timeoutMessage = new Notification(undefined, NoticeLevel.NOTIFICATION, t('Waiting for action: {{actionName}}...', { actionName: userActionMethodName(t, method) }), 'userAction')
		NotificationCenter.push(timeoutMessage)
	}, 2000)

	callMethod(event, method, ...params, (err, res) => {

		if (!timeoutMessage) {
			// cancel progress message:
			Meteor.clearTimeout(timeout)
		} else {
			timeoutMessage.drop()
		}

		if (err) {
			// console.error(err) - this is a result of an error server-side. Will be logged, no reason to print it out to console
			let doDefault: boolean | void = true
			if (callback) {
				doDefault = callback(err)
			}
			if (doDefault !== false) {
				NotificationCenter.push(
					new Notification(undefined, NoticeLevel.CRITICAL, t('{{actionName}} failed! More information can be found in the system log.', { actionName: userActionMethodName(t, method) }), 'userAction')
				)
				navigator.vibrate([400, 300, 400, 300, 400])
			}
		} else if (ClientAPI.isClientResponseError(res)) {
			let doDefault: boolean | void = true
			if (callback) {
				doDefault = callback(res)
			}
			if (doDefault !== false) {
				NotificationCenter.push(
					new Notification(undefined, NoticeLevel.CRITICAL,
						t('Action {{actionName}} failed: {{error}}', { error: res.message || res.error, actionName: userActionMethodName(t, method) })
					, 'userAction')
				)
				navigator.vibrate([400, 300, 400, 300, 400])
			}
		} else {
			let doDefault: boolean | void = true
			// all good
			if (callback) {
				doDefault = callback(undefined, res)
			}
			if (timeoutMessage && doDefault !== false) {
				NotificationCenter.push(
					new Notification(undefined, NoticeLevel.NOTIFICATION,
						okMessage || t('Action {{actionName}} done!', { actionName: userActionMethodName(t, method) })
					, 'userAction', undefined, false, undefined, undefined, 2000)
				)
			}
		}
	})
}
function userActionMethodName (
	t: i18next.TranslationFunction<any, object, string>,
	method: UserActionAPI.methods
) {
	switch (method) {
		// @todo: go through these and set better names:
		case UserActionAPI.methods.take: return t('Take')
		case UserActionAPI.methods.setNext: return t('Setting Next')
		case UserActionAPI.methods.moveNext: return t('Moving Next')

		case UserActionAPI.methods.prepareForBroadcast: return t('Preparing for broadcast')
		case UserActionAPI.methods.resetRundown: return t('Resetting Rundown')
		case UserActionAPI.methods.resetAndActivate: return t('Resetting and activating Rundown')
		case UserActionAPI.methods.activate: return t('Activating Rundown')
		case UserActionAPI.methods.deactivate: return t('Deactivating Rundown')
		case UserActionAPI.methods.reloadData: return t('Reloading rundown data')

		case UserActionAPI.methods.disableNextPiece: return t('Disabling next piece')
		case UserActionAPI.methods.togglePartArgument: return t('Toggling Part-Argument')
		case UserActionAPI.methods.pieceTakeNow: return t('Taking Piece')

		case UserActionAPI.methods.segmentAdLibPieceStart: return t('Starting AdLib-piece')
		case UserActionAPI.methods.baselineAdLibPieceStart: return t('Starting AdLib-piece')
		case UserActionAPI.methods.segmentAdLibPieceStop: return t('Stopping AdLib-piece')

		case UserActionAPI.methods.sourceLayerStickyPieceStart: return t('Starting sticky-pice')

		case UserActionAPI.methods.activateHold: return t('Activating Hold')

		case UserActionAPI.methods.saveEvaluation: return t('Saving Evaluation')

		case UserActionAPI.methods.storeRundownSnapshot: return t('Creating Snapshot for debugging')

		case UserActionAPI.methods.sourceLayerOnPartStop: return t('Stopping source layer')

		case UserActionAPI.methods.removeRundown: return t('Removing Rundown')
		case UserActionAPI.methods.resyncRundown: return t('Re-Syncing Rundown')

		case UserActionAPI.methods.recordStop: return t('Stopping recording')
		case UserActionAPI.methods.recordStart: return t('Starting recording')
		case UserActionAPI.methods.recordDelete: return t('Deleting recording')

		case UserActionAPI.methods.setInOutPoints: return t('Setting In/Out points')
	}
	return method // fallback

}
