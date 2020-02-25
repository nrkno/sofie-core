import * as i18next from 'i18next'
import {
	NotificationCenter,
	Notification,
	NoticeLevel
} from './notifications/notifications'
import { ClientAPI } from '../../lib/api/client'
import { Meteor } from 'meteor/meteor'
import { eventContextForLog } from './clientAPI'
import { UserActionAPIMethods } from '../../lib/api/userActions'

export function doUserAction<Result>(
	t: i18next.TranslationFunction<any, object, string>,
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

function userActionMethodName(
	t: i18next.TranslationFunction<any, object, string>,
	method: UserActionAPIMethods
) {
	switch (method) {
		// @todo: go through these and set better names:
		case UserActionAPIMethods.take: return t('Take')
		case UserActionAPIMethods.setNext: return t('Setting Next')
		case UserActionAPIMethods.moveNext: return t('Moving Next')

		case UserActionAPIMethods.prepareForBroadcast: return t('Preparing for broadcast')
		case UserActionAPIMethods.resetRundownPlaylist: return t('Resetting Rundown')
		case UserActionAPIMethods.resetAndActivate: return t('Resetting and activating Rundown')
		case UserActionAPIMethods.activate: return t('Activating Rundown')
		case UserActionAPIMethods.deactivate: return t('Deactivating Rundown')
		case UserActionAPIMethods.reloadData: return t('Reloading rundown data')

		case UserActionAPIMethods.disableNextPiece: return t('Disabling next piece')
		case UserActionAPIMethods.togglePartArgument: return t('Toggling Part-Argument')
		case UserActionAPIMethods.pieceTakeNow: return t('Taking Piece')

		case UserActionAPIMethods.segmentAdLibPieceStart: return t('Starting AdLib-piece')
		case UserActionAPIMethods.baselineAdLibPieceStart: return t('Starting AdLib-piece')
		// case UserActionAPIMethods.segmentAdLibPieceStop: return t('Stopping AdLib-piece')

		case UserActionAPIMethods.sourceLayerStickyPieceStart: return t('Starting sticky-pice')

		case UserActionAPIMethods.activateHold: return t('Activating Hold')

		case UserActionAPIMethods.saveEvaluation: return t('Saving Evaluation')

		case UserActionAPIMethods.storeRundownSnapshot: return t('Creating Snapshot for debugging')

		case UserActionAPIMethods.sourceLayerOnPartStop: return t('Stopping source layer')

		case UserActionAPIMethods.removeRundown: return t('Removing Rundown')
		case UserActionAPIMethods.resyncRundown: return t('Re-Syncing Rundown')

		case UserActionAPIMethods.recordStop: return t('Stopping recording')
		case UserActionAPIMethods.recordStart: return t('Starting recording')
		case UserActionAPIMethods.recordDelete: return t('Deleting recording')

		case UserActionAPIMethods.setInOutPoints: return t('Setting In/Out points')

		case UserActionAPIMethods.bucketAdlibImport: return t('Importing Bucker Adlib-piece')
		case UserActionAPIMethods.bucketAdlibStart: return t('Starting Bucket Adlib-piece')

		case UserActionAPIMethods.createBucket: return t('Creating Bucket')
		case UserActionAPIMethods.removeBucket: return t('Deleting Bucket')
		case UserActionAPIMethods.emptyBucket: return t('Emptying Bucket')
		case UserActionAPIMethods.modifyBucket: return t('Chaning Bucket')
		case UserActionAPIMethods.removeBucketAdLib: return t('Removing Bucket Adlib-piece')
	}
	return method // fallback
}
