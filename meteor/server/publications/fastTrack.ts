import { Meteor } from 'meteor/meteor'
import { logger } from '../logging'

export enum FastTrackObservers {
	TIMELINE = 'timeline',
}

const fastTrackObserver: {
	[key: string]: {
		useCount: number
		onData: (data: any) => void
	}
} = {}

function getKey(key: string, args: any[]): string {
	return key + args.join(',')
}

export function setupFastTrackObserver<T>(
	key: string,
	keyArgs: any[],
	onData: (data: T) => void
): Meteor.LiveQueryHandle {
	const fullKey = getKey(key, keyArgs)

	if (!fastTrackObserver[fullKey]) {
		fastTrackObserver[fullKey] = {
			useCount: 1,
			onData: onData,
		}
	} else {
		fastTrackObserver[fullKey].useCount++
	}
	return {
		stop: () => {
			fastTrackObserver[fullKey].useCount--
			if (!fastTrackObserver[fullKey].useCount) {
				delete fastTrackObserver[fullKey]
			}
		},
	}
}

export function triggerFastTrackObserver(key: string, keyArgs: any[], data: any) {
	const fullKey = getKey(key, keyArgs)

	try {
		fastTrackObserver[fullKey]?.onData(data)
	} catch (e) {
		logger.error(e)
	}
}
