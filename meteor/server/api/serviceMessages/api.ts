import { IncomingMessage, ServerResponse } from 'http'
import { Picker } from 'meteor/meteorhacks:picker'
import { CoreSystem } from '../../../lib/collections/CoreSystem'
import { logger } from '../../logging';

Picker.route('/serviceMessages', (params, req, res, next) => {
	const { method } = req

	if (method === 'POST') {
		return postHandler(params, req, res, next)
	}
	if (method == 'GET') {
		return getHandler(params, req, res, next)
	}

	res.statusCode = 405
	res.end()
})

Picker.route('/serviceMessages/:id', (params, req, res, next) => {
	const { method } = req

	if (method === 'DELETE') {
		return deleteHandler(params, req, res, next)
	}
	if (method == 'GET') {
		return getMessageHandler(params, req, res, next)
	}

	res.statusCode = 405
	res.end()
})

/**
 * Create new or update existing message
 */
function postHandler (
	params,
	req: IncomingMessage,
	res: ServerResponse,
	next: () => void
) {
	// validate !? => 400
	// exists? update exisiting => 200/204
	// create => 201
	// fuckup? => 500
}

/**
 * List all current messages stored on this instance
 */
function getHandler (
	params,
	req: IncomingMessage,
	res: ServerResponse,
	next: () => void
) {
	const coreSystem = CoreSystem.findOne()
	if (!coreSystem || !coreSystem.serviceMessages) {
		return
	}

	const { serviceMessages } = coreSystem
	logger.info(`serviceMessages: ${typeof serviceMessages}`, serviceMessages)
	const valuesArray = Array.from(Object.entries(serviceMessages))
	logger.info(`valuesArray: ${valuesArray.length}, ${typeof valuesArray}`)
	res.end(JSON.stringify(valuesArray))
}

/**
 * Delete a message
 */
function deleteHandler (
	params,
	req: IncomingMessage,
	res: ServerResponse,
	next: () => void
) {
	// exists ? delete => 200/204 : 404
}

/**
 * Retrieves a single message based on a given id
 */
function getMessageHandler (
	params,
	req: IncomingMessage,
	res: ServerResponse,
	next: () => void
) {
	// exists ? => json object, 200 : => 404
}
