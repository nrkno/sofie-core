import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import { ShowStyle, ShowStyles } from '../lib/collections/ShowStyles'
import { RuntimeFunction, RuntimeFunctions } from '../lib/collections/RuntimeFunctions'
import * as bodyParser from 'body-parser'
import { logger } from './logging'
import { Selector } from '../lib/typings/meteor'

export interface ShowStyleBackup {
	type: 'showstyle'
	showStyle: ShowStyle
	templates: RuntimeFunction[]
}

export function getShowBackup (showId: string, onlyActiveTemplates: boolean): ShowStyleBackup {
	const showStyle = ShowStyles.findOne(showId)
	if (!showStyle) throw new Meteor.Error(404, 'Show style not found')

	const filter: Selector<RuntimeFunction> = { showStyleId: showId }
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
function restoreShowBackup (backup: ShowStyleBackup) {
	const newShow = backup.showStyle
	if (!newShow) throw new Meteor.Error(500, 'ShowStyle missing from restore data')

	const showStyle = ShowStyles.findOne(newShow._id)
	if (showStyle) ShowStyles.remove(showStyle)
	ShowStyles.insert(newShow)

	RuntimeFunctions.remove({ showStyleId: newShow._id })
	if (backup.templates) {
		backup.templates.forEach(t => {
			const tmp: any = t
			// Rejoin any line breaks that were split in the backup process
			if (typeof tmp.code === 'object') {
				tmp.code = tmp.code.join('\n')
			}

			RuntimeFunctions.insert(t)
		})
	}
}

function runBackup (params, req: IncomingMessage, res: ServerResponse, onlyActive: boolean){
	let data: any = getShowBackup(params.id, onlyActive)
	res.setHeader('Content-Type', 'application/json')

	let content = ''
	if (!data) {
		res.statusCode = 404
		content = ''
	} else {
		res.statusCode = 200

		// Split on line breaks to an array to make it diff better
		data.templates.forEach(t => t.code = t.code.split('\n'))
		content = JSON.stringify(data, null, 4)
	}

	res.end(content)
}

// Server route
Picker.route('/backup/show/:id', (params, req: IncomingMessage, res: ServerResponse, next) => {
	runBackup(params, req, res, false)
})
Picker.route('/backup/show/:id/active', (params, req: IncomingMessage, res: ServerResponse, next) => {
	runBackup(params, req, res, true)
})

const postRoute = Picker.filter((req, res) => req.method === 'POST')
postRoute.middleware(bodyParser.json({
	limit: '1mb' // Arbitrary limit
}))
postRoute.route('/backup/restore', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		const body = (req as any).body
		if (!body || !body.type) throw new Meteor.Error(500, 'Missing type in request body')

		switch (body.type) {
			case 'showstyle':
				restoreShowBackup(body as ShowStyleBackup)
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
