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
import { Random } from 'meteor/random'

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

const postRoute3 = Picker.filter((req, res) => req.method === 'POST')
postRoute3.middleware(bodyParser.text({
	type: 'text/javascript',
	limit: '1mb'
}))
postRoute3.route('/backup/restore/blueprints', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		const body = (req as any).body
		if (!body) throw new Meteor.Error(500, 'Missing request body')

		if (typeof body !== 'string' || body.length < 10) throw new Meteor.Error(500, 'Invalid request body')

		logger.info('Got new blueprint. ' + body.length + ' bytes')

		const showStyle = ShowStyles.findOne('show0') // TODO - dynamuc
		if (!showStyle) throw new Meteor.Error(404, 'ShowStyle missing from db')

		ShowBlueprints.remove({ showStyleId: showStyle._id })
		ShowBlueprints.insert({
			_id: Random.id(7),
			showStyleId: showStyle._id,
			code: body as string,
			createdVersion: Date.now(),
			modified: Date.now()
		})
		// TODO - pull the version into a field, and show in the ui

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.debug('Blueprint restore failed: ', e)
	}

	res.end(content)
})
