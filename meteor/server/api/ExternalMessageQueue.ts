import { logger } from '../logging'
import {
	ExternalMessageQueue,
	ExternalMessageQueueObj,
	ExternalMessageQueueObjSOAP,
	ExternalMessageQueueObjSOAPMessageAttrFcn
} from '../../lib/collections/ExternalMessageQueue'
import { getCurrentTime, iterateDeeply, iterateDeeplyAsync, iterateDeeplyEnum } from '../../lib/lib'
import * as _ from 'underscore'
import * as soap from 'soap'
import * as parser from 'xml2json'
import { XmlEntities as Entities } from 'html-entities'
const entities = new Entities()

let runMessageQueue = true

let triggerdoMessageQueueTimeout: number = 0
export function triggerdoMessageQueue () {
	if (triggerdoMessageQueueTimeout) {
		Meteor.clearTimeout(triggerdoMessageQueueTimeout)
	}
	if (runMessageQueue) {
		triggerdoMessageQueueTimeout = Meteor.setTimeout(() => {
			doMessageQueue()
		},1000)
	}
}
Meteor.setTimeout(() => {
	triggerdoMessageQueue()
},5000)
function doMessageQueue () {
	console.log('doMessageQueue')
	let tryInterval = 1 * 60 * 1000
	try {
		let now = getCurrentTime()
		let messagesToSend = ExternalMessageQueue.find({
			expires: {$gt: now},
			lastTry: {$not: {$gt: now - tryInterval}},
			sent: {$not: {$gt: 0}}
		}).fetch()

		_.each(messagesToSend, (msg) => {
			try {
				console.log('Trying to send message: ' + msg._id)
				ExternalMessageQueue.update(msg._id, {$set: {
					tryCount: (msg.tryCount || 0) + 1,
					lastTry: now,
				}})

				let p
				if (msg.type === 'soap') {
					p = sendSOAPMessage(msg as ExternalMessageQueueObjSOAP)
				} else {
					throw new Meteor.Error(500, 'Unknown message type "' + msg.type + '"')
				}
				Promise.resolve(p)
				.then((result) => {
					ExternalMessageQueue.update(msg._id, {$set: {
						sent: getCurrentTime(),
						sentReply: result
					}})
					console.log('Message sucessfully sent: ' + msg._id)
				})
				.catch((e) => {
					logMessageError(msg, e)
				})
			} catch (e) {
				logMessageError(msg, e)
			}
		})
	} catch (e) {
		logger.error(e)
	}
	Meteor.setTimeout(() => {
		triggerdoMessageQueue()
	}, tryInterval) // 5 minutes
}
function logMessageError (msg: ExternalMessageQueueObj, e: any) {
	try {
		logger.warn(e)
		ExternalMessageQueue.update(msg._id, {$set: {
			errorMessage: (e['reason'] || e['message'] || e.toString()),
			errorMessageTime: getCurrentTime()
		}})
	} catch (e) {
		logger.error(e)
	}
}
function throwFatalError (msg, e) {

	ExternalMessageQueue.update(msg._id, {$set: {
		errorFatal: true
	}})

	throw e
}

async function sendSOAPMessage (msg: ExternalMessageQueueObjSOAP) {

	console.log('sendSOAPMessage')
	if (!msg.receiver) 		throwFatalError(msg, new Meteor.Error(401, 'attribute .receiver missing!'))
	if (!msg.receiver.url) 	throwFatalError(msg, new Meteor.Error(401, 'attribute .receiver.url missing!'))
	if (!msg.message) 		throwFatalError(msg, new Meteor.Error(401, 'attribute .message missing!'))
	if (!msg.message.fcn) 	throwFatalError(msg, new Meteor.Error(401, 'attribute .message.fcn missing!'))
	if (!msg.message.clip_key) 	throwFatalError(msg, new Meteor.Error(401, 'attribute .message.clip_key missing!'))
	if (!msg.message.clip) 	throwFatalError(msg, new Meteor.Error(401, 'attribute .message.clip missing!'))

	let url = msg.receiver.url

	console.log('url', url)

	let soapClient: soap.Client = await new Promise((resolve: (soapClient: soap.Client,) => any, reject) => {
		soap.createClient(url, (err, client: soap.Client) => {
			// console.log('callback', err)
			// console.log('keys', _.keys(client))
			if (err) reject(err)
			else resolve(client)
		})
	})

	// Prepare data, resolve the special {_fcn: {}} - functions:
	let iteratee = async (val) => {
		if (_.isObject(val) && val['_fcn']) {
			let valFcn = val as ExternalMessageQueueObjSOAPMessageAttrFcn
			let result = await resolveSOAPFcnData(soapClient, valFcn)

			return result
		} else {
			return iterateDeeplyEnum.CONTINUE
		}
	}
	msg.message.clip_key = 	await iterateDeeplyAsync(msg.message.clip_key, 	iteratee)
	msg.message.clip = 		await iterateDeeplyAsync(msg.message.clip, 		iteratee)

	// Send the message:

	await new Promise ((resolve, reject) => {
		let fcn = soapClient[msg.message.fcn ] as soap.ISoapMethod | undefined
		if (fcn) {

			let args = _.omit(msg.message, ['fcn'])

			console.log('SOAP', msg.message.fcn, args)

			fcn(
				args, (err: any, result: any, raw: any, soapHeader: any) => {
					if (err) {
						reject(err)
					} else {
						let resultValue = result[msg.message.fcn + 'Result']
						resolve(resultValue)
					}
				}
			)
		} else {
			reject(new Meteor.Error(401, 'SOAP method "' + msg.message.fcn + '" missing on endpoint!'))
		}
	})
}
async function resolveSOAPFcnData (soapClient: soap.Client, valFcn: ExternalMessageQueueObjSOAPMessageAttrFcn ) {
	return new Promise((resolve, reject) => {
		console.log('resolveSOAPFcnData')

		if (valFcn._fcn.soapFetchFrom) {
			let fetchFrom = valFcn._fcn.soapFetchFrom
			let fcn = soapClient[fetchFrom.fcn] as soap.ISoapMethod | undefined
			if (fcn) {

				let args = fetchFrom.attrs
				console.log('SOAP', fetchFrom.fcn, args)

				fcn(
					args, (err: any, result: any, raw: any, soapHeader: any) => {
						if (err) {
							reject(err)
						} else {
							console.log('reply', result)
							let resultValue = result[fetchFrom.fcn + 'Result']
							resolve(resultValue)
						}
					}
				)
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
							return val
						} else {
							return iterateDeeplyEnum.CONTINUE
						}
					}
					return val
				})
			}
			let xml = parser.toXml(val)
			// resolve(entities.encode(xml))
			resolve(xml)
		} else {
			reject(new Meteor.Error(401, 'Unknown SOAP function: ' + _.keys(valFcn._fcn)))
		}
	})
}
Meteor.methods({
	'removeExternalMessageQueueObj': (id) => {
		ExternalMessageQueue.remove(id)
	}
})
