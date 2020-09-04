import { IncomingMessage, ServerResponse } from 'http'
import { logger } from '../../../lib/logging'
import { Meteor } from 'meteor/meteor'
import { prepareUpdateRundownInner, savePreparedRundownChanges } from './rundownInput'
import { StudioId } from '../../../lib/collections/Studios'
import { check } from '../../../lib/check'
import { rundownIngestSyncFromStudioFunction } from './lib'
import { protectString } from '../../../lib/lib'
import { PickerPOST } from '../http'
import { makeNewIngestRundown } from './ingestCache'
import { IngestRundown } from 'tv-automation-sofie-blueprints-integration'

PickerPOST.route('/ingest/:studioId', (params, req: IncomingMessage, response: ServerResponse, next) => {
	check(params.studioId, String)
	response.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		let ingestRundown: any = req.body
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
export function importIngestRundown(studioId: StudioId, ingestRundown: IngestRundown) {
	return rundownIngestSyncFromStudioFunction(
		studioId,
		ingestRundown.externalId,
		(cache) => {
			const existingDbRundown = cache.Rundown.doc
			if (existingDbRundown && existingDbRundown.dataSource !== 'http')
				throw new Meteor.Error(
					403,
					`Cannot replace existing rundown from '${existingDbRundown.dataSource}' with http data`
				)

			return prepareUpdateRundownInner(cache, makeNewIngestRundown(ingestRundown), undefined, 'http')
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				savePreparedRundownChanges(cache, playoutInfo, preparedChanges)
			}
		}
	)
}
