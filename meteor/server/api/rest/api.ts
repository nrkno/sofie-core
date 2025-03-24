import KoaRouter from '@koa/router'
import { bindKoaRouter } from './koa.js'
import { Meteor } from 'meteor/meteor'
import koa from 'koa'
import { koaRouter as apiV1Router } from './v1/index.js'
import { snapshotPrivateApiRouter } from '../snapshot.js'
import { shelfLayoutsRouter } from '../rundownLayouts.js'
import { ingestRouter } from '../ingest/http.js'
import { actionTriggersRouter } from '../triggeredActions.js'
import { peripheralDeviceRouter } from '../peripheralDevice.js'
import { blueprintsRouter } from '../blueprints/http.js'
import { createLegacyApiRouter } from './v0/index.js'
import { heapSnapshotPrivateApiRouter } from '../heapSnapshot.js'

const LATEST_REST_API = 'v1.0'

const apiRouter = new KoaRouter()

apiRouter.get('/', redirectToLatest)
apiRouter.get('/latest', redirectToLatest)

apiRouter.use('/v1.0', apiV1Router.routes(), apiV1Router.allowedMethods())

apiRouter.use('/private/ingest', ingestRouter.routes(), ingestRouter.allowedMethods())
apiRouter.use('/private/snapshot', snapshotPrivateApiRouter.routes(), snapshotPrivateApiRouter.allowedMethods())
apiRouter.use('/private/shelfLayouts', shelfLayoutsRouter.routes(), shelfLayoutsRouter.allowedMethods())
apiRouter.use('/private/actionTriggers', actionTriggersRouter.routes(), actionTriggersRouter.allowedMethods())
apiRouter.use('/private/peripheralDevices', peripheralDeviceRouter.routes(), peripheralDeviceRouter.allowedMethods())
apiRouter.use('/private/blueprints', blueprintsRouter.routes(), blueprintsRouter.allowedMethods())
apiRouter.use(
	'/private/heapSnapshot',
	heapSnapshotPrivateApiRouter.routes(),
	heapSnapshotPrivateApiRouter.allowedMethods()
)

async function redirectToLatest(ctx: koa.ParameterizedContext, _next: koa.Next): Promise<void> {
	ctx.redirect(`/api/${LATEST_REST_API}`)
	ctx.status = 307
}

Meteor.startup(() => {
	// Needs to be lazily generated
	const legacyApiRouter = createLegacyApiRouter()
	apiRouter.use('/0', legacyApiRouter.routes(), legacyApiRouter.allowedMethods())

	bindKoaRouter(apiRouter, '/api')
})
