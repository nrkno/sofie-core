import * as _ from 'underscore'
import * as soap from 'soap'
import * as parser from 'xml2json'
import {
	ExternalMessageQueueObjSOAP,
	ExternalMessageQueueObjSOAPMessageAttrFcn,
	iterateDeeplyEnum,
	iterateDeeplyAsync,
	iterateDeeply,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../../logging'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { escapeHtml } from '../lib'
import { FatalExternalMessageError } from '../ExternalMessageQueue'

type ExternalMessageQueueObjSOAP0 = ExternalMessageQueueObjSOAP & ExternalMessageQueueObj

export async function sendSOAPMessage(msg: ExternalMessageQueueObjSOAP0 & ExternalMessageQueueObj): Promise<void> {
	logger.info('sendSOAPMessage ' + msg._id)
	if (!msg.receiver) throw new FatalExternalMessageError('attribute .receiver missing!')
	if (!msg.receiver.url) throw new FatalExternalMessageError('attribute .receiver.url missing!')
	if (!msg.message) throw new FatalExternalMessageError('attribute .message missing!')
	if (!msg.message.fcn) throw new FatalExternalMessageError('attribute .message.fcn missing!')
	if (!msg.message.clip_key) throw new FatalExternalMessageError('attribute .message.clip_key missing!')
	if (!msg.message.clip) throw new FatalExternalMessageError('attribute .message.clip missing!')

	const url = msg.receiver.url

	const soapClient = await soap.createClientAsync(url)

	// Prepare data, resolve the special {_fcn: {}} - functions:
	const iteratee = async (val: any) => {
		if (_.isObject(val)) {
			if (val['_fcn']) {
				const valFcn = val as ExternalMessageQueueObjSOAPMessageAttrFcn
				return resolveSOAPFcnData(soapClient, valFcn)
			} else {
				return iterateDeeplyEnum.CONTINUE
			}
		} else if (_.isString(val)) {
			// Escape strings, so they are XML-compatible:
			return escapeHtml(val)
		} else {
			return val
		}
	}
	msg.message.clip_key = await iterateDeeplyAsync(msg.message.clip_key, iteratee)
	msg.message.clip = await iterateDeeplyAsync(msg.message.clip, iteratee)

	// Send the message:

	// Future: There look to be async versions of these methods, which natively return promises
	const fcn = soapClient[msg.message.fcn] as soap.SoapMethod | undefined
	if (fcn) {
		const args = _.omit(msg.message, ['fcn'])
		await new Promise((resolve, reject) => {
			fcn(args, (err: any, result: any, _raw: any, _soapHeader: any) => {
				if (err) {
					logger.debug('Sent SOAP message', args)
					reject(err)
				} else {
					const resultValue = result[msg.message.fcn + 'Result']
					resolve(resultValue)
				}
			})
		})
	} else {
		throw new Error(`SOAP method "${msg.message.fcn}" missing on endpoint!`)
	}
}
async function resolveSOAPFcnData(soapClient: soap.Client, valFcn: ExternalMessageQueueObjSOAPMessageAttrFcn) {
	if (valFcn._fcn.soapFetchFrom) {
		const fetchFrom = valFcn._fcn.soapFetchFrom
		const fcn = soapClient[fetchFrom.fcn] as soap.SoapMethod | undefined
		if (fcn) {
			const args = fetchFrom.attrs

			return new Promise((resolve, reject) => {
				fcn(args, (err: any, result: any, _raw: any, _soapHeader: any) => {
					if (err) {
						reject(err)
					} else {
						const resultValue = result[fetchFrom.fcn + 'Result']
						resolve(resultValue)
					}
				})
			})
		} else {
			throw new Error(`SOAP method "${fetchFrom.fcn}" missing on endpoint!`)
		}
	} else if (valFcn._fcn.xmlEncode) {
		const val = valFcn._fcn.xmlEncode.value

		// Convert into an object that parser.toXml can use:
		if (_.isObject(val)) {
			iterateDeeply(val, (val) => {
				if (_.isObject(val)) {
					if (val._t) {
						val.$t = val._t
						delete val._t
						if (_.isString(val.$t)) val.$t = escapeHtml(val.$t)
						return val
					} else {
						return iterateDeeplyEnum.CONTINUE
					}
				} else if (_.isString(val)) {
					// Escape strings, so they are XML-compatible:
					return escapeHtml(val)
				} else {
					return val
				}
			})
		}

		return parser.toXml(val)
	} else {
		throw new Error(`Unknown SOAP function: ${Object.keys(valFcn._fcn)}`)
	}
}
