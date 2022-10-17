import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { ExternalMessageQueue } from '../../lib/collections/ExternalMessageQueue'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { getCurrentTime } from '../../lib/lib'
import { registerClassToMeteorMethods } from '../methods'
import { NewExternalMessageQueueAPI, ExternalMessageQueueAPIMethods } from '../../lib/api/ExternalMessageQueue'
import { StatusObject, setSystemStatus } from '../systemStatus/systemStatus'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { StudioContentWriteAccess } from '../security/studio'
import { ExternalMessageQueueObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'

let updateExternalMessageQueueStatusTimeout: number = 0
function updateExternalMessageQueueStatus(): void {
	if (!updateExternalMessageQueueStatusTimeout) {
		updateExternalMessageQueueStatusTimeout = Meteor.setTimeout(() => {
			updateExternalMessageQueueStatusTimeout = 0

			// TODO - limit the fields of this query
			const messagesOnQueueCursor = ExternalMessageQueue.find({
				sent: { $not: { $gt: 0 } },
				tryCount: { $gt: 3 },
			})
			const messagesOnQueueCount: number = messagesOnQueueCursor.count()
			let status: StatusObject = {
				statusCode: StatusCode.GOOD,
			}
			if (messagesOnQueueCount > 0) {
				// TODO - this is fetching ALL of the docs that match the query, then only using the first
				const messagesOnQueueExample = messagesOnQueueCursor.fetch()[0]
				status = {
					statusCode: StatusCode.WARNING_MAJOR,
					messages: [
						`There are ${messagesOnQueueCount} unsent messages on queue (one of the unsent messages has the error message: "${
							messagesOnQueueExample.errorMessage
						}", to receiver "${messagesOnQueueExample.type}", "${JSON.stringify(
							messagesOnQueueExample.receiver
						)}")`,
					],
				}
			}
			setSystemStatus('External Message queue', status)
		}, 5000)
	}
}

ExternalMessageQueue.find({
	sent: { $not: { $gt: 0 } },
	tryCount: { $gt: 3 },
}).observeChanges({
	added: updateExternalMessageQueueStatus,
	changed: updateExternalMessageQueueStatus,
	removed: updateExternalMessageQueueStatus,
})
Meteor.startup(() => {
	updateExternalMessageQueueStatus()
	// triggerdoMessageQueue(5000)
})

async function removeExternalMessage(context: MethodContext, messageId: ExternalMessageQueueObjId): Promise<void> {
	check(messageId, String)
	await StudioContentWriteAccess.externalMessage(context, messageId)

	// TODO - is this safe? what if it is in the middle of execution?
	await ExternalMessageQueue.removeAsync(messageId)
}
async function toggleHold(context: MethodContext, messageId: ExternalMessageQueueObjId): Promise<void> {
	check(messageId, String)
	const access = await StudioContentWriteAccess.externalMessage(context, messageId)
	const m = access.message
	if (!m) throw new Meteor.Error(404, `ExternalMessage "${messageId}" not found!`)

	await ExternalMessageQueue.updateAsync(messageId, {
		$set: {
			hold: !m.hold,
		},
	})
}
async function retry(context: MethodContext, messageId: ExternalMessageQueueObjId): Promise<void> {
	check(messageId, String)
	const access = await StudioContentWriteAccess.externalMessage(context, messageId)
	const m = access.message
	if (!m) throw new Meteor.Error(404, `ExternalMessage "${messageId}" not found!`)

	const tryGap = getCurrentTime() - 1 * 60 * 1000
	await ExternalMessageQueue.updateAsync(messageId, {
		$set: {
			manualRetry: true,
			hold: false,
			errorFatal: false,
			lastTry: m.lastTry !== undefined && m.lastTry > tryGap ? tryGap : m.lastTry,
		},
	})
	// triggerdoMessageQueue(1000)
}
class ServerExternalMessageQueueAPI extends MethodContextAPI implements NewExternalMessageQueueAPI {
	async remove(messageId: ExternalMessageQueueObjId) {
		return removeExternalMessage(this, messageId)
	}
	async toggleHold(messageId: ExternalMessageQueueObjId) {
		return toggleHold(this, messageId)
	}
	async retry(messageId: ExternalMessageQueueObjId) {
		return retry(this, messageId)
	}
}
registerClassToMeteorMethods(ExternalMessageQueueAPIMethods, ServerExternalMessageQueueAPI, false)
