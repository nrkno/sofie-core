import { Meteor } from 'meteor/meteor'
import { SegmentLine } from '../../lib/collections/SegmentLines'
import { RunningOrder } from '../../lib/collections/RunningOrders'
import { ShowStyles, ShowStyle } from '../../lib/collections/ShowStyles'
import { logger } from '../logging'
import { preventSaveDebugData, convertCodeToFunction, getContext, TemplateContext } from './templates/templates'
import { RuntimeFunctions } from '../../lib/collections/RuntimeFunctions'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../lib/collections/ExternalMessageQueue'
import { getCurrentTime, removeNullyProperties } from '../../lib/lib'
import { triggerdoMessageQueue } from './ExternalMessageQueue'
import * as _ from 'underscore'

export function triggerExternalMessage (
	runningOrder: RunningOrder,
	takeSegmentLine: SegmentLine,
	previousSegmentLine: SegmentLine | null
) {
	// console.log('triggerExternalMessage')
	logger.debug('triggerExternalMessage')
	try {
		let showStyle: ShowStyle | undefined = ShowStyles.findOne(runningOrder.showStyleId)
		if (!showStyle) throw new Meteor.Error(404, 'ShowStyle "' + runningOrder.showStyleId + '" not found!')
		// if a showStyle does not have a message template assigned, then just exit
		if (!showStyle.messageTemplate) return

		let functionId = showStyle.messageTemplate

		const runtimeFunction = RuntimeFunctions.findOne({
			showStyleId: showStyle._id,
			active: true,
			templateId: functionId,
			isHelper: true
		})
		if (!runtimeFunction) throw new Meteor.Error(404, 'RuntimeFunctions helper "' + functionId + '" not found')

		let context: TemplateContext = {
			runningOrderId: runningOrder._id,
			runningOrder: runningOrder,
			studioId: runningOrder.studioInstallationId,
			segmentLine: takeSegmentLine,
			templateId: functionId
		}
		let innerContext = getContext(context, true)
		let fcn
		try {
			fcn = convertCodeToFunction(innerContext, runtimeFunction, 'take_' + takeSegmentLine.slug)
		} catch (e) {
			throw new Meteor.Error(402, 'Syntax error in runtime function helper "' + functionId + '": ' + e.toString())
		}
		try {
			// @ts-ignore the message function doesn't follow the typing
			let resultMessages: Array<ExternalMessageQueueObj> | null = fcn(runningOrder, takeSegmentLine, previousSegmentLine)

			if (resultMessages === null) {
				preventSaveDebugData()
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
					message.created = now
					message.studioId = runningOrder.studioInstallationId
					message.tryCount = 0
					if (!message.expires) message.expires = now + 35 * 24 * 3600 * 1000 // 35 days

					message = removeNullyProperties(message)

					// console.log('result', result)

					if (!runningOrder.rehearsal) { // Don't save the message when running rehearsals
						ExternalMessageQueue.insert(message)

						triggerdoMessageQueue() // trigger processing of the queue
					}
				})

			}
		} catch (e) {
			let str = e.toString() + ' ' + (e.stack || '')
			throw new Meteor.Error(402, 'Error executing runtime function helper "' + functionId + '": ' + str )
		}
	} catch (e) {
		logger.error(e)
	}
}
