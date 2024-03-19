import * as v8 from 'node:v8'
import { Readable } from 'stream'
import { Meteor } from 'meteor/meteor'
import { fixValidPath } from '../../lib/lib'
import { logger } from '../logging'
import { Settings } from '../../lib/Settings'
import { Credentials } from '../security/lib/credentials'
import { SystemWriteAccess } from '../security/system'
import { sleep } from '@sofie-automation/corelib/dist/lib'
import { PickerGET } from './http'
import { ServerResponse, IncomingMessage } from 'http'
import { stringifyError } from '@sofie-automation/corelib/dist/lib'

async function retrieveHeapSnapshot(cred0: Credentials): Promise<Readable> {
	if (Settings.enableUserAccounts) {
		await SystemWriteAccess.coreSystem(cred0)
	}
	logger.warn('Taking heap snapshot, expect system to be unresponsive for a few seconds..')
	await sleep(100) // Allow the logger to catch up before continuing..

	const stream = v8.getHeapSnapshot()
	return stream
}

// Setup endpoints:
async function handleKoaResponse(req: IncomingMessage, res: ServerResponse, snapshotFcn: () => Promise<Readable>) {
	if (!`${req.url}`.includes(`areYouSure=yes`)) {
		res.statusCode = 403
		res.setHeader('Content-Type', 'text/plain')
		res.end('?areYouSure=yes')
		return
	}

	try {
		const stream = await snapshotFcn()

		res.setHeader('Content-Type', 'application/octet-stream')
		res.setHeader(
			'Content-Disposition',
			`attachment; filename*=UTF-8''${fixValidPath(
				`sofie-heap-snapshot-${new Date().toISOString()}.heapsnapshot`
			)}`
		)
		res.statusCode = 200
		stream.pipe(res)
		// res.write()
		// res.body = JSON.stringify(snapshot, null, 4)
	} catch (e: any) {
		res.setHeader('Content-Type', 'text/plain')
		res.statusCode = e instanceof Meteor.Error && typeof e.error === 'number' ? e.error : 500
		res.end('Error: ' + stringifyError(e))

		if (res.statusCode !== 404) {
			logger.error(stringifyError(e))
		}
	}
}

if (!Settings.enableUserAccounts) {
	// Retrieve heap snapshot:
	PickerGET.route('/heapSnapshot/retrieve', async (_, req: IncomingMessage, res: ServerResponse) => {
		return handleKoaResponse(req, res, async () => {
			return retrieveHeapSnapshot({ userId: null })
		})
	})
}
