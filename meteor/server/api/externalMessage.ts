import { Meteor } from 'meteor/meteor'
import { SegmentLine } from '../../lib/collections/SegmentLines'
import { RunningOrder } from '../../lib/collections/RunningOrders'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { logger } from '../logging'
import { loadBlueprints, getMessageContext } from './blueprints'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../lib/collections/ExternalMessageQueue'
import { getCurrentTime, removeNullyProperties } from '../../lib/lib'
import { triggerdoMessageQueue } from './ExternalMessageQueue'
import * as _ from 'underscore'
import { IBlueprintExternalMessageQueueObj } from 'tv-automation-sofie-blueprints-integration'

export function triggerExternalMessage (
	runningOrder: RunningOrder,
	takeSegmentLine: SegmentLine,
	previousSegmentLine: SegmentLine | null
) {
	// console.log('triggerExternalMessage')
	logger.debug('triggerExternalMessage')
	try {
		let showStyleBase: ShowStyleBase | undefined = ShowStyleBases.findOne(runningOrder.showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, 'ShowStyleBase "' + runningOrder.showStyleBaseId + '" not found!')

		const innerContext = getMessageContext(runningOrder)
		try {
			const blueprints = loadBlueprints(showStyleBase)

			let resultMessages: Array<IBlueprintExternalMessageQueueObj> | null = blueprints.Message(innerContext, runningOrder, takeSegmentLine, previousSegmentLine)

			if (resultMessages === null) {
				// do nothing
			} else if (_.isObject(resultMessages) && _.isEmpty(resultMessages)) {
				// do nothing
			} else {

				_.each(resultMessages, (message) => {

					// check the output:
					if (!message) 			throw new Meteor.Error('Falsy result!')
					if (!message.type) 		throw new Meteor.Error('attribute .type missing!')
					if (!message.receiver) 	throw new Meteor.Error('attribute .receiver missing!')
					if (!message.message) 	throw new Meteor.Error('attribute .message missing!')

					// Save the output into the message queue, for later processing:
					let now = getCurrentTime()
					let message2: ExternalMessageQueueObj = {
						_id: '',
						studioId: runningOrder.studioInstallationId,
						created: now,
						tryCount: 0,
						expires: now + 35 * 24 * 3600 * 1000, // 35 days
						...message
					}

					message = removeNullyProperties(message)

					// console.log('result', result)

					if (!runningOrder.rehearsal) { // Don't save the message when running rehearsals
						ExternalMessageQueue.insert(message2)

						triggerdoMessageQueue() // trigger processing of the queue
					}
				})

			}
		} catch (e) {
			let str = e.toString() + ' ' + (e.stack || '')
			throw new Meteor.Error(402, 'Error executing blueprint message helper: ' + str )
		}
	} catch (e) {
		logger.error(e)
	}
}
