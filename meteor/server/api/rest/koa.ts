import Koa from 'koa'
import cors from '@koa/cors'
import KoaRouter from '@koa/router'
import { WebApp } from 'meteor/webapp'
import { Meteor } from 'meteor/meteor'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import _ from 'underscore'

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

const REVERSE_PROXY_COUNT = process.env.HTTP_FORWARDED_COUNT ? parseInt(process.env.HTTP_FORWARDED_COUNT) : 0

// X-Forwarded-For (a de-facto standard) has the following syntax by convention
// X-Forwarded-For: 203.0.113.195, 2001:db8:85a3:8d3:1319:8a2e:370:7348
// X-Forwarded-For: 203.0.113.195,2001:db8:85a3:8d3:1319:8a2e:370:7348,198.51.100.178
function getClientAddrFromXForwarded(headerVal: undefined | string | string[]): string | undefined {
	if (headerVal === undefined) return undefined
	if (typeof headerVal !== 'string') {
		headerVal = _.last(headerVal) as string
	}
	const remoteAddresses = headerVal.split(',')
	return remoteAddresses[remoteAddresses.length - REVERSE_PROXY_COUNT]?.trim() ?? remoteAddresses[0]?.trim()
}

// Forwarded uses the following syntax:
// Forwarded: for=192.0.2.60;proto=http;by=203.0.113.43
// Forwarded: for=192.0.2.43, for="[2001:db8:cafe::17]"
function getClientAddrFromForwarded(forwardedVal: string | undefined): string | undefined {
	if (forwardedVal === undefined) return undefined
	const allProxies = forwardedVal.split(',')
	const proxyInfo = allProxies[allProxies.length - REVERSE_PROXY_COUNT] ?? allProxies[0]
	const directives = proxyInfo?.trim().split(';')
	for (const directive of directives) {
		let match: RegExpMatchArray | null
		if ((match = directive.trim().match(/^for=("\[)?([\w.:])+(\]")?/))) {
			return match[2]
		}
	}
	return undefined
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
		clientAddress:
			// This replicates Meteor behavior which uses the HTTP_FORWARDED_COUNT to extract the "world-facing"
			// IP address of the Client User Agent
			getClientAddrFromForwarded(ctx.req.headers.forwarded) ||
			getClientAddrFromXForwarded(ctx.req.headers['x-forwarded-for']) ||
			ctx.req.socket.remoteAddress ||
			'unknown',
		httpHeaders: ctx.req.headers as Record<string, string>,
	}
}
