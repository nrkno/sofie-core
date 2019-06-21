import { IncomingMessage, ServerResponse } from 'http'
import { logger } from '../../logging'
import { write } from 'fs-extra'
import { stat } from 'fs'
import { ServiceMessage, Criticality } from '../../../lib/collections/CoreSystem'
import { writeMessage } from './serviceMessagesApi'
import * as moment from 'moment'

export { BodyParsingIncomingMessage, postHandler }

interface BodyParsingIncomingMessage extends IncomingMessage {
	body?: any
}

const INPUT_MISSING_PARTIAL = 'Missing data in input: '

const validCriticalities = Object.values(Criticality).filter((value) => !isNaN(value))

/**
 * Create new or update existing service message.
 *
 * Picker route handler, see Picker documentation for interface details.
 */
function postHandler (
	params,
	req: BodyParsingIncomingMessage,
	res: ServerResponse,
) {
	const { body } = req
	if (!body) {
		res.statusCode = 400
		res.end('No input data')
		return
	}

	const { id, criticality, message, sender, timestamp } = body

	if (!id || id.trim().length < 1) {
		res.statusCode = 400
		res.end(`${INPUT_MISSING_PARTIAL}id`)
		return
	}

	if (!criticality || isNaN(criticality) || validCriticalities.indexOf(criticality) < 0) {
		res.statusCode = 400
		res.end(`${INPUT_MISSING_PARTIAL}criticality`)
		return
	}

	if (!message || message.trim().length < 1) {
		res.statusCode = 400
		res.end(`${INPUT_MISSING_PARTIAL}message`)
		return
	}

	if (!timestamp || !moment(new Date(timestamp)).isValid()) {
		res.statusCode = 400
		res.end(`${INPUT_MISSING_PARTIAL}timestamp`)
		return
	}

	const serviceMessage = {
		id,
		criticality,
		message,
		sender,
		timestamp: new Date(timestamp)
	} as ServiceMessage

	try {
		const status = writeMessage(serviceMessage)
		res.statusCode = status.isUpdate === true ? 200 : 201
		res.setHeader('Content-Type', 'application/json; charset-utf8')
		res.end(JSON.stringify(serviceMessage))
	} catch (error) {
		res.statusCode = 500
		res.end('System error, unable to store message')
	}
}

