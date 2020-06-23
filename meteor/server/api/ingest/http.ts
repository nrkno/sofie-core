import { IncomingMessage, ServerResponse } from 'http'
import { logger } from '../../../lib/logging'
import { Meteor } from 'meteor/meteor'
import { updateRundownAndSaveCache } from './rundownInput'
import { Studios, StudioId } from '../../../lib/collections/Studios'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { getRundownId } from './lib'
import { protectString, check } from '../../../lib/lib'
import { PickerPOST } from '../http'

PickerPOST.route('/ingest/:studioId', (params, req: IncomingMessage, response: ServerResponse, next) => {
	check(params.studioId, String)
	response.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		let ingestRundown = req.body
		if (!ingestRundown) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
		if (typeof ingestRundown !== 'object') {
			// sometimes, the browser can send the JSON with wrong mimetype, resulting in it not being parsed
			ingestRundown = JSON.parse(ingestRundown)
		}

		importIngestRundown(protectString<StudioId>(params.studioId), ingestRundown)

		response.statusCode = 200
		response.end(content)
	} catch (e) {
		response.setHeader('Content-Type', 'text/plain')
		response.statusCode = e.errorCode || 500
		response.end('Error: ' + e.toString())

		if (e.errorCode !== 404) {
			logger.error(e)
		}
	}
})
export function importIngestRundown(studioId: StudioId, ingestRundown: any) {
	const studio = Studios.findOne(studioId)
	if (!studio) throw new Meteor.Error(404, `Studio ${studioId} does not exist`)

	const rundownId = getRundownId(studio, ingestRundown.externalId)

	const existingDbRundown = Rundowns.findOne(rundownId)
	// If the RO exists and is not from http then don't replace it. Otherwise, it is free to be replaced
	if (existingDbRundown && existingDbRundown.dataSource !== 'http')
		throw new Meteor.Error(
			403,
			`Cannot replace existing rundown from '${existingDbRundown.dataSource}' with http data`
		)

	updateRundownAndSaveCache(studio, rundownId, existingDbRundown, ingestRundown, 'http')
	// handleUpdatedRundown(studio, undefined, ingestRundown, 'http') // TODO-INFINITES
}
