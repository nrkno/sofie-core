import { logger } from '../../../lib/logging'
import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import { Rundowns } from '../../collections'
import { getRundownId, runIngestOperation } from './lib'
import { protectString } from '../../../lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { IngestRundown } from '@sofie-automation/blueprints-integration'
import { getExternalNRCSName } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { checkStudioExists } from '../../optimizations'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

export const ingestRouter = new KoaRouter()

ingestRouter.post(
	'/:studioId',
	bodyParser({
		jsonLimit: '200mb',
	}),
	async (ctx) => {
		check(ctx.params.studioId, String)
		ctx.response.type = 'text/plain'

		try {
			if (ctx.request.type !== 'application/json')
				throw new Meteor.Error(400, 'Upload rundown: Invalid content-type')

			const ingestRundown = ctx.request.body as IngestRundown
			if (!ingestRundown) throw new Meteor.Error(400, 'Upload rundown: Missing request body')
			if (typeof ingestRundown !== 'object') throw new Meteor.Error(400, 'Upload rundown: Invalid request body')

			await importIngestRundown(protectString<StudioId>(ctx.params.studioId), ingestRundown)

			ctx.response.status = 200
			ctx.response.body = ''
		} catch (e) {
			ctx.response.type = 'text/plain'
			ctx.response.status = e instanceof Meteor.Error && typeof e.error === 'number' ? e.error : 500
			ctx.response.body = 'Error: ' + stringifyError(e)

			if (ctx.response.status !== 404) {
				logger.error(stringifyError(e))
			}
		}
	}
)

export async function importIngestRundown(studioId: StudioId, ingestRundown: IngestRundown): Promise<void> {
	const studioExists = await checkStudioExists(studioId)
	if (!studioExists) throw new Meteor.Error(404, `Studio ${studioId} does not exist`)

	const rundownId = getRundownId(studioId, ingestRundown.externalId)

	const existingDbRundown = await Rundowns.findOneAsync(rundownId)
	// If the RO exists and is not from http then don't replace it. Otherwise, it is free to be replaced
	if (existingDbRundown && existingDbRundown.externalNRCSName !== getExternalNRCSName(undefined))
		throw new Meteor.Error(
			403,
			`Cannot replace existing rundown from '${existingDbRundown.externalNRCSName}' with http data`
		)

	await runIngestOperation(studioId, IngestJobs.UpdateRundown, {
		rundownExternalId: ingestRundown.externalId,
		peripheralDeviceId: null,
		ingestRundown: ingestRundown,
		isCreateAction: true,
	})
}
