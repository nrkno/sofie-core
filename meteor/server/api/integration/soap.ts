import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import * as soap from 'soap'
import * as parser from 'xml2json'
import {
	ExternalMessageQueueObjSOAP,
	ExternalMessageQueueObjSOAPMessageAttrFcn,
	iterateDeeplyEnum,
	iterateDeeplyAsync,
	iterateDeeply,
} from 'tv-automation-sofie-blueprints-integration'
import { throwFatalError } from '../ExternalMessageQueue'
import { ExternalMessageQueueObj } from '../../../lib/collections/ExternalMessageQueue'
import { logger } from '../../logging'
import { escapeHtml } from '../../../lib/lib'
// import { XmlEntities as Entities } from 'html-entities'
// const entities = new Entities()

type ExternalMessageQueueObjSOAP0 = ExternalMessageQueueObjSOAP & ExternalMessageQueueObj
export async function sendSOAPMessage(msg: ExternalMessageQueueObjSOAP0 & ExternalMessageQueueObj) {
	logger.info('sendSOAPMessage ' + msg._id)
	if (!msg.receiver) throwFatalError(msg, new Meteor.Error(401, 'attribute .receiver missing!'))
	if (!msg.receiver.url) throwFatalError(msg, new Meteor.Error(401, 'attribute .receiver.url missing!'))
	if (!msg.message) throwFatalError(msg, new Meteor.Error(401, 'attribute .message missing!'))
	if (!msg.message.fcn) throwFatalError(msg, new Meteor.Error(401, 'attribute .message.fcn missing!'))
	if (!msg.message.clip_key) throwFatalError(msg, new Meteor.Error(401, 'attribute .message.clip_key missing!'))
	if (!msg.message.clip) throwFatalError(msg, new Meteor.Error(401, 'attribute .message.clip missing!'))

	let url = msg.receiver.url

	// console.log('url', url)

	let soapClient: soap.Client = await new Promise((resolve: (soapClient: soap.Client) => any, reject) => {
		soap.createClient(url, (err, client: soap.Client) => {
			// console.log('callback', err)
			// console.log('keys', _.keys(client))
			if (err) reject(err)
			else resolve(client)
		})
	})

	// Prepare data, resolve the special {_fcn: {}} - functions:
	let iteratee = async (val: any) => {
		if (_.isObject(val)) {
			if (val['_fcn']) {
				let valFcn = val as ExternalMessageQueueObjSOAPMessageAttrFcn
				let result = await resolveSOAPFcnData(soapClient, valFcn)

				return result
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

	await new Promise((resolve, reject) => {
		let fcn = soapClient[msg.message.fcn] as soap.ISoapMethod | undefined
		if (fcn) {
			let args = _.omit(msg.message, ['fcn'])

			// console.log('SOAP', msg.message.fcn, args)

			fcn(args, (err: any, result: any, raw: any, soapHeader: any) => {
				if (err) {
					logger.debug('Sent SOAP message', args)
					reject(err)
				} else {
					let resultValue = result[msg.message.fcn + 'Result']
					resolve(resultValue)
				}
			})
		} else {
			reject(new Meteor.Error(401, 'SOAP method "' + msg.message.fcn + '" missing on endpoint!'))
		}
	})
}
async function resolveSOAPFcnData(soapClient: soap.Client, valFcn: ExternalMessageQueueObjSOAPMessageAttrFcn) {
	return new Promise((resolve, reject) => {
		// console.log('resolveSOAPFcnData')

		if (valFcn._fcn.soapFetchFrom) {
			let fetchFrom = valFcn._fcn.soapFetchFrom
			let fcn = soapClient[fetchFrom.fcn] as soap.ISoapMethod | undefined
			if (fcn) {
				let args = fetchFrom.attrs
				// console.log('SOAP', fetchFrom.fcn, args)

				fcn(args, (err: any, result: any, raw: any, soapHeader: any) => {
					if (err) {
						reject(err)
					} else {
						// console.log('reply', result)
						let resultValue = result[fetchFrom.fcn + 'Result']
						resolve(resultValue)
					}
				})
			} else {
				reject(new Meteor.Error(401, 'SOAP method "' + fetchFrom.fcn + '" missing on endpoint!'))
			}
		} else if (valFcn._fcn.xmlEncode) {
			let val = valFcn._fcn.xmlEncode.value

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
			let xml: string = parser.toXml(val)
			// resolve(entities.encode(xml))
			resolve(xml)
		} else {
			reject(new Meteor.Error(401, 'Unknown SOAP function: ' + _.keys(valFcn._fcn)))
		}
	})
}
