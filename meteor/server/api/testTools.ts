import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { RecordedFiles, RecordedFile } from '../../lib/collections/RecordedFiles'
import { getCurrentTime } from '../../lib/lib'
import { TestToolsAPI } from '../../lib/api/testTools'
import { setMeteorMethods } from '../methods'
import { logger } from '../logging'
import { updateTimeline } from './playout'

export namespace ServerTestToolsAPI {
	/**
	 * Stop a currently running recording
	 */
	export function recordStop (studioId: string) {
		const updated = RecordedFiles.update({
			studioId: studioId,
			stoppedAt: {$exists: false}
		}, {
			$set: {
				stoppedAt: getCurrentTime()
			}
		})

		if (updated === 0) throw new Meteor.Error(404, `No active recording for "${studioId}" was found!`)

		updateTimeline(studioId)

		return true
	}

	export function recordStart (studioId: string, name: string) {
		const active = RecordedFiles.findOne({
			studioId: studioId,
			stoppedAt: {$exists: false}
		})
		if (active) throw new Meteor.Error(404, `An active recording for "${studioId}" was found!`)

		const id = Random.id(7)
		RecordedFiles.insert({
			_id: id,
			studioId: studioId,
			modified: getCurrentTime(),
			startedAt: getCurrentTime(),
			name: name,
			path: 'test-recordings/' + id + '_' + name + '.mp4'
		})

		updateTimeline(studioId)

		return true
	}

}

let methods = {}
methods[TestToolsAPI.methods.recordStop] = (studioId) => {
	return ServerTestToolsAPI.recordStop(studioId)
}
methods[TestToolsAPI.methods.recordStart] = (studioId, name) => {
	return ServerTestToolsAPI.recordStart(studioId, name)
}

// Transform methods:
_.each(methods, (fcn: Function, key) => {
	methods[key] = (...args: any[]) => {
		// logger.info('------- Method call -------')
		// logger.info(key)
		// logger.info(args)
		// logger.info('---------------------------')
		try {
			return fcn.apply(null, args)
		} catch (e) {
			logger.error(e.message || e.reason || (e.toString ? e.toString() : null) || e)
			throw e
		}
	}
})

// Apply methods:
setMeteorMethods(methods)
