import Koa from 'koa'
import cors from '@koa/cors'
import KoaRouter from '@koa/router'
import { WebApp } from 'meteor/webapp'
import { Meteor } from 'meteor/meteor'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'

declare module 'http' {
	interface IncomingMessage {
		// Meteor http routing performs this addition
		body?: object | string
	}
}

export function bindKoaRouter(koaRouter: KoaRouter, bindPath: string): void {
	const app = new Koa()
	// Expose the API at the url
	WebApp.rawConnectHandlers.use(bindPath, (req, res) => {
		const callback = Meteor.bindEnvironment(app.callback())
		callback(req, res).catch(() => res.end())
	})

	app.use(async (ctx, next) => {
		// Strange - sometimes a JSON body gets parsed by Koa before here (eg for a POST call?).
		if (typeof ctx.req.body === 'object') {
			ctx.disableBodyParser = true
			if (Array.isArray(ctx.req.body)) {
				ctx.request.body = [...ctx.req.body]
			} else {
				ctx.request.body = { ...ctx.req.body }
			}
		}
		await next()
	})
	app.use(
		cors({
			// Allow anything
			origin(ctx) {
				return ctx.get('Origin') || '*'
			},
		})
	)
	app.use(koaRouter.routes()).use(koaRouter.allowedMethods())
}

export const makeMeteorConnectionFromKoa = (
	ctx: Koa.ParameterizedContext<
		Koa.DefaultState,
		Koa.DefaultContext & KoaRouter.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
		unknown
	>
): Meteor.Connection => {
	return {
		id: getRandomString(),
		close: () => {
			/* no-op */
		},
		onClose: () => {
			/* no-op */
		},
		clientAddress: ctx.req.headers.host || 'unknown',
		httpHeaders: ctx.req.headers as Record<string, string>,
	}
}
