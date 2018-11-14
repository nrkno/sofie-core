import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import { ShowStyle, ShowStyles } from '../lib/collections/ShowStyles'
import { RuntimeFunction, RuntimeFunctions } from '../lib/collections/RuntimeFunctions'
import { MongoSelector } from '../lib/typings/meteor'
import { getCurrentTime } from '../lib/lib'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../lib/api/peripheralDevice'
import { PeripheralDevices, PeripheralDevice } from '../lib/collections/PeripheralDevices'
import { Meteor } from 'meteor/meteor'
import { MosString128 } from 'mos-connection'

export interface ShowStyleBackup {
	type: 'showstyle'
	showStyle: ShowStyle
	templates: RuntimeFunction[]
}

export function getShowBackup (showId: string, onlyActiveTemplates: boolean): ShowStyleBackup {
	const showStyle = ShowStyles.findOne(showId)
	if (!showStyle) throw new Meteor.Error(404, 'Show style not found')

	const filter: MongoSelector<RuntimeFunction> = { showStyleId: showId }
	if (onlyActiveTemplates) {
		filter.active = true
	}

	const templates = RuntimeFunctions.find(filter,{
		sort: {
			showStyleId: 1,
			templateId: 1,
			active: -1,
			createdVersion: 1,
		}
	}).fetch()

	return {
		type: 'showstyle',
		showStyle: showStyle,
		templates: templates,
	}
}
export function restoreShowBackup (backup: ShowStyleBackup) {
	const newShow = backup.showStyle
	if (!newShow) throw new Meteor.Error(500, 'ShowStyle missing from restore data')

	const showStyle = ShowStyles.findOne(newShow._id)
	if (showStyle) ShowStyles.remove(showStyle._id)
	ShowStyles.insert(newShow)

	RuntimeFunctions.remove({ showStyleId: newShow._id })
	if (backup.templates) {
		backup.templates.forEach(t => {
			const tmp: any = t
			// Rejoin any line breaks that were split in the backup process
			if (typeof tmp.code === 'object') {
				tmp.code = tmp.code.join('\n')
			}

			t.modified = getCurrentTime()

			RuntimeFunctions.insert(t)
		})
	}
}

function runBackup (params, req: IncomingMessage, res: ServerResponse, onlyActive: boolean) {
	let data: any = getShowBackup(params.id, onlyActive)
	let fileName = 'backup'
	if (data && (data.showStyle as ShowStyle).name) {
		fileName = ((data.showStyle as ShowStyle).name).replace(/\s/g, '-')
	}
	res.setHeader('Content-Type', 'application/json')
	res.setHeader('Content-Disposition', `attachment; filename="${fileName}.json"`)

	let content = ''
	if (!data) {
		res.statusCode = 404
		content = ''
	} else {
		res.statusCode = 200

		// Split on line breaks to an array to make it diff better
		data.templates.forEach(t => {
			t.code = t.code.split('\n')
			t.createdVersion = undefined
			t.modified = undefined
		})
		content = JSON.stringify(data, null, 4)
	}

	res.end(content)
}

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

// Blueprints Server route
Picker.route('/backup/show/:id', (params, req: IncomingMessage, res: ServerResponse, next) => {
	runBackup(params, req, res, false)
})
Picker.route('/backup/show/:id/active', (params, req: IncomingMessage, res: ServerResponse, next) => {
	runBackup(params, req, res, true)
})
