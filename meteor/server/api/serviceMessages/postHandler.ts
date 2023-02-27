import { IncomingMessage, ServerResponse } from 'http'
import { logger } from '../../logging'
import { ServiceMessage, Criticality } from '../../../lib/collections/CoreSystem'
import { writeMessage } from './serviceMessagesApi'
import moment from 'moment'
import { Params } from 'meteor/meteorhacks:picker'

export { BodyParsingIncomingMessage, postHandler }

interface BodyParsingIncomingMessage extends IncomingMessage {
	body?: any
}

const INPUT_MISSING_PARTIAL = 'Missing data in input: '

const validCriticalities = Object.keys(Criticality)
	.filter((k) => typeof Criticality[k as any] === 'number')
	.map((k) => Criticality[k])

/**
 * Create new or update existing service message.
 *
 * Picker route handler, see Picker documentation for interface details.
 */
async function postHandler(_params: Params, req: BodyParsingIncomingMessage, res: ServerResponse): Promise<void> {
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

	if (!criticality || (typeof criticality === 'string' && criticality.trim().length < 1)) {
		res.statusCode = 400
		res.end(`${INPUT_MISSING_PARTIAL}criticality`)
		return
	}
	if (isNaN(criticality) || validCriticalities.indexOf(Number(criticality)) < 0) {
		res.statusCode = 400
		res.end(`Invalid value for criticality: ${criticality}, wanted one of ${validCriticalities.join(',')}`)
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
		criticality: Number(criticality),
		message,
		sender,
		timestamp: new Date(timestamp).getTime(),
	} as ServiceMessage

	try {
		const status = await writeMessage(serviceMessage)
		res.statusCode = status.isUpdate === true ? 200 : 201
		res.setHeader('Content-Type', 'application/json; charset-utf8')
		res.end(JSON.stringify(serviceMessage))
	} catch (error) {
		logger.error(`Unable to store message`, { serviceMessage, error })
		res.statusCode = 500
		res.end('System error, unable to store message')
	}
}
