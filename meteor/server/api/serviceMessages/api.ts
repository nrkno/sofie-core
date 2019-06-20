import { CoreSystem } from '../../../lib/collections/CoreSystem'
import { IncomingMessage, ServerResponse } from 'http'
import { Picker } from 'meteor/meteorhacks:picker'
import { postHandler } from './postHandler'
import { logger } from '../../logging'
import * as bodyParser from 'body-parser'
import { readAllMessages } from './serviceMessagesApi'

const postRoute = Picker.filter((req, res) => req.method === 'POST')
postRoute.middleware(bodyParser.json())
postRoute.route('/serviceMessages', postHandler)

const getRoute = Picker.filter((req, res) => req.method === 'GET')
getRoute.route('/serviceMessages', getHandler)
getRoute.route('/serviceMessages/:id', getMessageHandler)

const deleteRoute = Picker.filter((req, res) => req.method === 'DELETE')
deleteRoute.route('/serviceMessages/:id', deleteHandler)


/**
 * List all current messages stored on this instance
 */
function getHandler (
	params,
	req: IncomingMessage,
	res: ServerResponse,
	next: () => void
) {
	try {
		const valuesArray = readAllMessages()
		res.setHeader('Content-Type', 'application/json; charset-utf8')
		res.end(JSON.stringify(valuesArray), 'utf-8')
	} catch (error) {
		res.statusCode = 500
		res.end('Unable to list service messages')
		return
	}
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
