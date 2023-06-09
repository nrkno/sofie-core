import KoaRouter from '@koa/router'
import { bindKoaRouter } from './koa'
import { Meteor } from 'meteor/meteor'
import koa from 'koa'
import { koaRouter as apiV1Router } from './v1/index'

import './v0/index'
import { snapshotPrivateApiRouter } from '../snapshot'
import { shelfLayoutsRouter } from '../rundownLayouts'

const LATEST_REST_API = 'v1.0'

const apiRouter = new KoaRouter()

apiRouter.get('/', redirectToLatest)
apiRouter.get('/latest', redirectToLatest)

apiRouter.use('/v1.0', apiV1Router.routes(), apiV1Router.allowedMethods())

apiRouter.use('/private/snapshot', snapshotPrivateApiRouter.routes(), snapshotPrivateApiRouter.allowedMethods())
apiRouter.use('/private/shelfLayouts', shelfLayoutsRouter.routes(), shelfLayoutsRouter.allowedMethods())

async function redirectToLatest(ctx: koa.ParameterizedContext, _next: koa.Next): Promise<void> {
	ctx.redirect(`/api/${LATEST_REST_API}`)
	ctx.status = 307
}

Meteor.startup(() => {
	bindKoaRouter(apiRouter, '/api')
})
