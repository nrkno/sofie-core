import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import { ShowStyle, ShowStyles } from '../lib/collections/ShowStyles'
import { ShowBlueprints } from '../lib/collections/ShowBlueprints'
import * as bodyParser from 'body-parser'
import { logger } from './logging'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../lib/api/peripheralDevice'
import { PeripheralDevices, PeripheralDevice } from '../lib/collections/PeripheralDevices'
import { Meteor } from 'meteor/meteor'
import { MosString128 } from 'mos-connection'
import { evalBlueprints } from './api/blueprints'

export interface RunningOrderCacheBackup {
	type: 'runningOrderCache'
	data: {
		type: 'roCreate' | 'fullStory'
		data: any
	}[]
}
export function restoreRunningOrder (backup: RunningOrderCacheBackup) {
	const roCreates = backup.data.filter(d => d.type === 'roCreate')
	const stories = backup.data.filter(d => d.type === 'fullStory')
	if (roCreates.length !== 1) {
		throw new Meteor.Error(500, 'bad number of roCreate entries')
	}
	if (stories.length !== roCreates[0].data.Stories.length) {
		throw new Meteor.Error(500, 'bad number of fullStory entries')
	}

	// TODO - this should choose one in a better way
	let pd = PeripheralDevices.findOne({
		type: PeripheralDeviceAPI.DeviceType.MOSDEVICE
	}) as PeripheralDevice
	if (!pd) {
		throw new Meteor.Error(404, 'MOS Device not found to be used for mock running order!')
	}
	let id = pd._id
	let token = pd.token

	// Delete the existing copy, to ensure this is a clean import
	Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, id, token, new MosString128(roCreates[0].data.ID))

	// Create the RO
	Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, id, token, roCreates[0].data)

	// Import each story
	_.each(stories, (story) => {
		Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, story.data)
	})
}

const postJSONRoute = Picker.filter((req, res) => req.method === 'POST')
postJSONRoute.middleware(bodyParser.json({
	limit: '1mb' // Arbitrary limit
}))
postJSONRoute.route('/backup/restore', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		const body = (req as any).body
		if (!body || !body.type) throw new Meteor.Error(500, 'Missing type in request body')

		switch (body.type) {
			case 'runningOrderCache':
				restoreRunningOrder(body as RunningOrderCacheBackup)
				break
			default:
				throw new Meteor.Error(500, 'Unknown type "' + body.type + '" in request body')
		}

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.debug('Backup restore failed: ', e)
	}

	res.end(content)
})

const postJsRoute = Picker.filter((req, res) => req.method === 'POST')
postJsRoute.middleware(bodyParser.text({
	type: 'text/javascript',
	limit: '1mb'
}))
postJsRoute.route('/blueprints/restore/:showStyleId', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		const body = (req as any).body
		if (!body) throw new Meteor.Error(500, 'Missing request body')

		if (typeof body !== 'string' || body.length < 10) throw new Meteor.Error(500, 'Invalid request body')

		logger.info('Got new blueprint. ' + body.length + ' bytes')

		const showStyle = ShowStyles.findOne(params.showStyleId)
		if (!showStyle) throw new Meteor.Error(404, 'ShowStyle missing from db')

		const newBlueprint: ShowBlueprint = {
			_id: Random.id(7),
			showStyleId: showStyle._id,
			code: body as string,
			modified: Date.now(),
			version: ''
		}

		const blueprintCollection = evalBlueprints(newBlueprint, showStyle.name, false)
		newBlueprint.version = blueprintCollection.Version

		ShowBlueprints.remove({ showStyleId: showStyle._id })
		ShowBlueprints.insert(newBlueprint)

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.debug('Blueprint restore failed: ' + e)
	}

	res.end(content)
})
