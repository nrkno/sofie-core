import { Meteor } from 'meteor/meteor'
import { logger } from '../../lib/logging'

import { AllPubSubTypes } from '@sofie-automation/meteor-lib/dist/api/pubsub'

/**
 * Type safe wrapper around Meteor.subscribe()
 * @param name name of the subscription
 * @param args arguments to the subscription
 * @returns Meteor subscription handle
 */
export function meteorSubscribe<K extends keyof AllPubSubTypes>(
	name: K,
	...args: Parameters<AllPubSubTypes[K]>
): Meteor.SubscriptionHandle {
	if (Meteor.isClient) {
		const callbacks = {
			onError: (...errs: any[]) => {
				logger.error('meteorSubscribe', name, ...args, ...errs)
			},
		}

		return Meteor.subscribe(name, ...args, callbacks)
	} else throw new Meteor.Error(500, 'meteorSubscribe is only available client-side')
}
