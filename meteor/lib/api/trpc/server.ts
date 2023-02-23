import { Meteor, Subscription } from 'meteor/meteor'
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
import { getCurrentTime, getRandomString, ProtectedString, protectString } from '../../lib'
import { z } from 'zod'
import ws from 'ws'
import { RundownPlaylistId, PartInstanceId, UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MethodContextAPI } from '../methods'
import { ResolveOptions } from '@trpc/server/dist/core/internals/utils'
import { observable, Observer } from '@trpc/server/observable'
import { setupNotesPublication } from '../../../server/publications/segmentPartNotesUI/publication'
import { CustomPublish, CustomPublishChanges, MeteorCustomPublish } from '../../../server/lib/customPublication'
import { UISegmentPartNote } from '../rundownNotifications'
import { CustomCollectionName } from '../pubsub'
import { applyWSSHandler, CreateWSSContextFnOptions } from '@trpc/server/adapters/ws'

// created for each request
const createContext = (_a: trpcExpress.CreateExpressContextOptions) => ({}) // no context
const createWsContext = (_a: CreateWSSContextFnOptions) => ({}) // no context
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

export type TrpcDocChange<T extends { _id: ProtectedString<any> }> =
	| {
			type: 'replace'
			doc: T
	  }
	| {
			type: 'update'
			id: T['_id']
			fields: any
	  }
	| {
			type: 'delete'
			id: T['_id']
	  }
	| { type: 'ready' }

class TrpcCustomPublish<TDoc extends { _id: ProtectedString<any> }> implements CustomPublish<TDoc> {
	#onStop: (() => void) | undefined
	#isReady = false

	constructor(private readonly emit: Observer<TrpcDocChange<TDoc>, any>) {}

	callStop(): void {
		if (this.#onStop) this.#onStop()
	}

	get isReady(): boolean {
		return this.#isReady
	}

	get userId(): UserId | null {
		throw new Error('Method not implemented.')
	}

	onStop(callback: () => void) {
		this.#onStop = Meteor.bindEnvironment(callback)
	}

	init(docs: TDoc[]) {
		if (this.#isReady) throw new Meteor.Error(500, 'TrpcCustomPublish has already been initialised')

		for (const doc of docs) {
			this.emit.next({
				type: 'replace',
				doc: doc,
			})
		}

		this.emit.next({
			type: 'ready',
		})

		this.#isReady = true
	}

	changed(changes: CustomPublishChanges<TDoc>): void {
		if (!this.#isReady) throw new Meteor.Error(500, 'TrpcCustomPublish has not been initialised')

		// TODO - inform client of a batch?

		for (const doc of changes.added.values()) {
			this.emit.next({
				type: 'replace',
				doc: doc,
			})
		}

		for (const doc of changes.changed.values()) {
			this.emit.next({
				type: 'update',
				id: doc._id,
				fields: doc,
			})
		}

		for (const id of changes.removed.values()) {
			this.emit.next({
				type: 'delete',
				id: id,
			})
		}
	}
}

// Hack to expose a non-fiber safe version of setupNotesPublication
const setupNotesPublication2 = Meteor.bindEnvironment(
	(playlistId: RundownPlaylistId, pub: CustomPublish<UISegmentPartNote>, emit: Observer<any, any>) => {
		setupNotesPublication(playlistId, pub).catch((e) => {
			console.error('failed to setup publication', e)
			emit.error('Failed')
		})
	}
)

const appRouter = router({
	partNotes: publicProcedure.input(z.string()).subscription(async (req) => {
		// `resolve()` is triggered for each client when they start subscribing `onAdd`
		// return an `observable` with a callback which is triggered immediately
		return observable<TrpcDocChange<UISegmentPartNote>>((emit) => {
			const pub = new TrpcCustomPublish(emit)

			setupNotesPublication2(protectString(req.input), pub, emit)

			// unsubscribe function when client disconnects or stops subscribing
			return () => {
				pub.callStop()
			}
		})
	}),

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
	const wss = new ws.Server({
		port: 3005,
	})
	const handler = applyWSSHandler({ wss, router: appRouter, createContext: createWsContext })

	wss.on('connection', (ws) => {
		console.log(`➕➕ Connection (${wss.clients.size})`)
		ws.once('close', () => {
			console.log(`➖➖ Connection (${wss.clients.size})`)
		})
	})
	console.log('✅ WebSocket Server listening on ws://localhost:3001')
	process.on('SIGTERM', () => {
		console.log('SIGTERM')
		handler.broadcastReconnectNotification()
		wss.close()
	})

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
