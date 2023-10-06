import { Meteor } from 'meteor/meteor'
import { getCurrentTime, getRandomId } from '../lib'
import { PubSub, meteorSubscribe } from './pubsub'
import { PeripheralDeviceCommandId, PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { PeripheralDeviceCommands } from '../collections/libCollections'

export * from '@sofie-automation/shared-lib/dist/peripheralDevice/mediaManager'

export namespace PeripheralDeviceAPI {
	export async function executeFunctionWithCustomTimeout(
		deviceId: PeripheralDeviceId,
		timeoutTime0: number | undefined,
		action: {
			functionName?: string
			args?: Array<any>
			actionId?: string
			payload?: Record<string, any>
		}
	): Promise<any> {
		return new Promise<any>((resolve, reject) => {
			const timeoutTime: number = timeoutTime0 || 3000 // also handles null

			const commandId: PeripheralDeviceCommandId = getRandomId()

			let subscription: Meteor.SubscriptionHandle | null = null
			if (Meteor.isClient) {
				subscription = meteorSubscribe(PubSub.peripheralDeviceCommands, deviceId)
			}
			// logger.debug('command created: ' + functionName)

			let observer: Meteor.LiveQueryHandle | null = null
			let timeoutCheck: number = 0
			// we've sent the command, let's just wait for the reply
			const checkReply = () => {
				const cmd = PeripheralDeviceCommands.findOne(commandId)

				if (cmd) {
					const cmdId = cmd._id
					const cleanup = () => {
						if (observer) {
							observer.stop()
							observer = null
						}
						if (subscription) subscription.stop()
						if (timeoutCheck) {
							Meteor.clearTimeout(timeoutCheck)
							timeoutCheck = 0
						}
						PeripheralDeviceCommands.remove(cmdId)
					}

					if (cmd.hasReply) {
						// We've got a reply!

						// Do cleanup before the callback to ensure it doesn't get a timeout during the callback:
						cleanup()

						// Handle result
						if (cmd.replyError) {
							reject(cmd.replyError)
						} else {
							resolve(cmd.reply)
						}
					} else if (getCurrentTime() - (cmd.time || 0) >= timeoutTime) {
						// Timeout

						// Do cleanup:
						cleanup()

						reject(
							`Timeout after ${timeoutTime} ms when executing the function "${cmd.functionName}" on device "${cmd.deviceId}"`
						)
					}
				}
			}

			observer = PeripheralDeviceCommands.find({
				_id: commandId,
			}).observeChanges({
				added: checkReply,
				changed: checkReply,
			})
			timeoutCheck = Meteor.setTimeout(checkReply, timeoutTime)

			PeripheralDeviceCommands.insert({
				_id: commandId,
				deviceId: deviceId,
				time: getCurrentTime(),
				hasReply: false,

				...action,
			})
		})
	}

	/** Same as executeFunction, but returns a promise instead */
	export async function executeFunction(
		deviceId: PeripheralDeviceId,
		functionName: string,
		...args: any[]
	): Promise<any> {
		return executeFunctionWithCustomTimeout(deviceId, undefined, { functionName, args })
	}
}
