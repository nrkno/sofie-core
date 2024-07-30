import { TFunction } from 'i18next'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { UserAction } from '@sofie-automation/meteor-lib/dist/userAction'
import { getCurrentTime, Time } from '../../lib'

export function doUserAction<Result>(
	_t: TFunction,
	userEvent: string,
	_action: UserAction,
	fcn: (event: string, timeStamp: Time) => Promise<ClientAPI.ClientResponse<Result>>,
	callback?: (err: any, res?: Result) => void | boolean,
	_okMessage?: string
): void {
	if (Meteor.isClient) {
		throw new Error('This version of doUserAction cannot be called from the client')
	} else {
		fcn(userEvent, getCurrentTime()).then(
			(value) =>
				typeof callback === 'function' &&
				(ClientAPI.isClientResponseSuccess(value) ? callback(undefined, value.result) : callback(value)),
			(reason) => typeof callback === 'function' && callback(reason)
		)
	}
}
