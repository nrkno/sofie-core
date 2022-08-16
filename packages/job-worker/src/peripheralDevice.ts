import { PeripheralDeviceCommandId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { createManualPromise, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { JobContext } from './jobs'
import { getCurrentTime } from './lib'
import { logger } from './logging'

export async function executePeripheralDeviceFunction(
	context: JobContext,
	deviceId: PeripheralDeviceId,
	timeoutTime0: number | null,
	functionName: string,
	...args: any[]
): Promise<any> {
	const timeoutTime = timeoutTime0 ?? 3000 // also handles null

	const commandId: PeripheralDeviceCommandId = getRandomId()

	const result = createManualPromise<any>()

	// logger.debug('command created: ' + functionName)

	let timeoutCheck: NodeJS.Timeout | undefined

	let completed = false
	let pending = false
	let running = false

	// we've sent the command, let's just wait for the reply
	const checkReply = async () => {
		// If already running, set pending
		if (running) {
			pending = true
			return
		}
		// Mark running
		running = true
		pending = false

		try {
			const cmd = await context.directCollections.PeripheralDeviceCommands.findOne(commandId)
			// if (!cmd) throw new Meteor.Error('Command "' + commandId + '" not found')
			// logger.debug('checkReply')

			if (cmd) {
				const cmdId = cmd._id
				const cleanup = () => {
					if (timeoutCheck) {
						clearTimeout(timeoutCheck)
						timeoutCheck = undefined
					}

					Promise.resolve(watcher.close()).catch((e) => {
						logger.error(`Cleanup PeripheralDeviceCommand "${commandId}" watcher failed: ${e}`)
					})
					context.directCollections.PeripheralDeviceCommands.remove(cmdId).catch((e) => {
						logger.error(`Cleanup PeripheralDeviceCommand "${commandId}" document failed: ${e}`)
					})
				}

				if (cmd.hasReply) {
					// We've got a reply!

					// Do cleanup before the callback to ensure it doesn't get a timeout during the callback:
					cleanup()

					if (!completed) {
						completed = true
						// Handle result
						if (cmd.replyError) {
							result.manualReject(cmd.replyError)
						} else {
							result.manualResolve(cmd.reply)
						}
					}
				} else if (getCurrentTime() - (cmd.time || 0) >= timeoutTime) {
					// Timeout

					// Do cleanup:
					cleanup()

					if (!completed) {
						completed = true
						result.manualReject(
							new Error(
								`Timeout after ${timeoutTime} ms when executing the function "${cmd.functionName}" on device "${cmd.deviceId}"`
							)
						)
					}
				}
			}
		} finally {
			running = false
			// If another run is pending, try again
			if (pending) {
				doCheckReply()
			}
		}
	}

	const doCheckReply = () => {
		checkReply().catch((e) => {
			logger.error(`PeripheralDeviceCommand "${commandId}" check failed: ${e}`)
		})
	}

	const watcher = context.directCollections.PeripheralDeviceCommands.rawCollection.watch([
		{
			$match: { [`documentKey._id`]: commandId },
		},
	])
	watcher.on('change', (_change) => {
		// assume the change is something we want to look at
		doCheckReply()
	})
	watcher.on('error', (err) => {
		Promise.resolve(watcher.close()).catch((e) => {
			logger.error(`Cleanup PeripheralDeviceCommand "${commandId}" watcher failed: ${e}`)
		})

		if (!completed) {
			completed = true
			result.manualReject(err)
		}
	})

	timeoutCheck = setTimeout(doCheckReply, timeoutTime)

	await context.directCollections.PeripheralDeviceCommands.insertOne({
		_id: commandId,
		deviceId: deviceId,
		time: getCurrentTime(),
		functionName,
		args: args,
		hasReply: false,
	})

	return result
}
