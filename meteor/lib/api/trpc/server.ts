import { Meteor } from 'meteor/meteor'
import { WebApp } from 'meteor/webapp'
import { inferAsyncReturnType, initTRPC } from '@trpc/server'
// import { createHTTPServer } from '@trpc/server/adapters/standalone'
import * as trpcExpress from '@trpc/server/adapters/express'
import express from 'express'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { check } from 'meteor/check'
import { ServerClientAPI } from '../../../server/api/client'
import { triggerWriteAccess } from '../../../server/security/lib/securityVerify'
import { RundownPlaylists } from '../../collections/libCollections'
import { getCurrentTime, getRandomString, protectString } from '../../lib'
import { z } from 'zod'
import { RundownPlaylistId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MethodContextAPI } from '../methods'
import { ResolveOptions } from '@trpc/server/dist/core/internals/utils'

// created for each request
const createContext = ({ req, res }: trpcExpress.CreateExpressContextOptions) => ({}) // no context
type Context = inferAsyncReturnType<typeof createContext>

const t = initTRPC.context<Context>().create({
	isServer: Meteor.isServer,
	isDev: !Meteor.isProduction,
})

const router = t.router
const publicProcedure = t.procedure

const makeConnection = (_ctx: ResolveOptions<any>): Meteor.Connection => {
	// TODO - this needs filling out, or should be dropped by the places we call
	return {
		id: getRandomString(),
		close: () => {
			/* no-op */
		},
		onClose: () => {
			/* no-op */
		},
		// TODO
		clientAddress: 'unknown',
		httpHeaders: {},
		// clientAddress: ctx.req.headers.host || 'unknown',
		// httpHeaders: ctx.req.headers,
	}
}
function getMethodContext(connection: Meteor.Connection): MethodContextAPI {
	// TODO - this needs filling out, or should be dropped by the places we call
	return {
		userId: null,
		connection,
		isSimulation: false,
		setUserId: () => {
			/* no-op */
		},
		unblock: () => {
			/* no-op */
		},
	}
}

const appRouter = router({
	hello: publicProcedure
		.input((val: unknown) => {
			if (typeof val === 'string') return val
			throw new Error(`Invalid input: ${typeof val}`)
		})
		.query((req) => {
			const input = req.input

			return { echo: input }
		}),
	take: publicProcedure
		.input(
			z.object({
				userEvent: z.string(),
				eventTime: z.number(),
				rundownPlaylistId: z.string(),
				fromPartInstanceId: z.string().nullable(),
			})
		)
		.mutation(
			// TODO - should this use Meteor.bindEnvironment? that breaks the return type..
			async (req) => {
				const args = req.input
				const rundownPlaylistId = protectString<RundownPlaylistId>(args.rundownPlaylistId)
				const fromPartInstanceId = protectString<PartInstanceId>(args.fromPartInstanceId)

				triggerWriteAccess()
				const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
				if (!rundownPlaylist) throw new Error(`Rundown playlist ${rundownPlaylistId} does not exist`)

				return await ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
					getMethodContext(makeConnection(req)),
					args.userEvent,
					getCurrentTime(),
					rundownPlaylistId,
					() => {
						check(rundownPlaylistId, String)
					},
					StudioJobs.TakeNextPart,
					{
						playlistId: rundownPlaylistId,
						fromPartInstanceId: fromPartInstanceId ?? rundownPlaylist.currentPartInstanceId,
					}
				)
			}
		),
})

export type AppRouter = typeof appRouter

Meteor.startup(() => {
	const app = express()
	app.use(
		'/trpc',
		trpcExpress.createExpressMiddleware({
			router: appRouter,
			createContext,
		})
	)

	WebApp.connectHandlers.use(app)
})
