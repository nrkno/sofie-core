import { Meteor } from 'meteor/meteor'
import { getCurrentTime, getRandomId } from '../lib'
import { PeripheralDeviceCommands, PeripheralDeviceCommandId } from '../collections/PeripheralDeviceCommands'
import { PubSub, meteorSubscribe } from './pubsub'
import { DeviceConfigManifest } from './deviceConfig'
import { ExpectedPackageStatusAPI, IngestPlaylist, TSR } from '@sofie-automation/blueprints-integration'
import {
	PeripheralDeviceId,
	PeripheralDevice,
	PeripheralDeviceStatusObject,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '../collections/PeripheralDevices'
import { MediaWorkFlowId, MediaWorkFlow } from '../collections/MediaWorkFlows'
import { MediaObject } from '../collections/MediaObjects'
import { MediaWorkFlowStepId, MediaWorkFlowStep } from '../collections/MediaWorkFlowSteps'
import { PartPlaybackCallbackData, PiecePlaybackCallbackData, TimelineHash } from '../collections/Timeline'
import { ExpectedPackageId } from '../collections/ExpectedPackages'
import { ExpectedPackageWorkStatusId } from '../collections/ExpectedPackageWorkStatuses'

// Note: When making changes to this file, remember to also update the copy in core-integration library

// Fakin these, so we don't have to expose this to the client

export { TimeDiff, DiffTimeResult } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceApi'
export * from '@sofie-automation/shared-lib/dist/peripheralDevice/mediaManager'
export { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'

export namespace PeripheralDeviceAPI {
	export async function executeFunctionWithCustomTimeout(
		deviceId: PeripheralDeviceId,
		timeoutTime0: number | undefined,
		functionName: string,
		...args: any[]
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
				functionName,
				args: args,
				hasReply: false,
			})
		})
	}

	/** Same as executeFunction, but returns a promise instead */
	export async function executeFunction(
		deviceId: PeripheralDeviceId,
		functionName: string,
		...args: any[]
	): Promise<any> {
		return executeFunctionWithCustomTimeout(deviceId, undefined, functionName, ...args)
	}
}
