import { CoreSystem, getCoreSystem, ServiceMessage } from '../../../lib/collections/CoreSystem'
import { logger } from '../../logging'

export { readAllMessages, writeMessage, WriteStatus }

interface WriteStatus {
	systemError?: boolean,
	isUpdate?: boolean
}

function readAllMessages (): Array<ServiceMessage> {
	const coreSystem = getCoreSystem()
	if (!coreSystem || !coreSystem.serviceMessages) {
		throw new Error('coreSystem.serviceMessages is not available. Database not migrated?')
	}

	const { serviceMessages } = coreSystem
	const messages = Object.keys(serviceMessages).map((key) => serviceMessages[key])

	return messages
}

function writeMessage (message: ServiceMessage): WriteStatus {
	const coreSystem = getCoreSystem()
	if (!coreSystem || !coreSystem.serviceMessages) {
		logger.error('coreSystem.serviceMessages is not available. Database not migrated?')
		return {
			systemError: true
		}
	}

	const status: WriteStatus = { systemError: false }

	const { serviceMessages } = coreSystem
	if (serviceMessages[message.id]) {
		status.isUpdate = true
	}

	serviceMessages[message.id] = message
	try {
		CoreSystem.update(coreSystem._id, { $set: { serviceMessages } })
		return status
	} catch (error) {
		logger.error(error.message)
		return {
			systemError: true
		}
	}
}
