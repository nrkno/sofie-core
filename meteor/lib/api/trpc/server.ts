import { Meteor } from 'meteor/meteor'
import { inferAsyncReturnType, initTRPC } from '@trpc/server'
// import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { check } from 'meteor/check'
import { ServerClientAPI } from '../../../server/api/client'
import { triggerWriteAccess } from '../../../server/security/lib/securityVerify'
import { RundownPlaylists } from '../../collections/libCollections'
import { getCurrentTime, getRandomString, isProtectedString, ProtectedString, protectString } from '../../lib'
import { z } from 'zod'
import ws from 'ws'
import { RundownPlaylistId, PartInstanceId, UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MethodContextAPI } from '../methods'
import { ResolveOptions } from '@trpc/server/dist/core/internals/utils'
import { observable, Observer } from '@trpc/server/observable'
import { setupNotesPublication } from '../../../server/publications/segmentPartNotesUI/publication'
import { CustomPublish, CustomPublishChanges } from '../../../server/lib/customPublication'
import { UISegmentPartNote } from '../rundownNotifications'
import { applyWSSHandler, CreateWSSContextFnOptions } from '@trpc/server/adapters/ws'

// created for each request
const createContext = (_a: CreateWSSContextFnOptions) => ({}) // no context
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
			type: 'init'
			docs: Array<T>
	  }
	| {
			type: 'update'
			added: Array<T>
			changed: Array<Pick<T, '_id'> & Partial<T>>
			removed: T['_id'][]
	  }

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

		this.emit.next({
			type: 'init',
			docs,
		})

		this.#isReady = true
	}

	changed(changes: CustomPublishChanges<TDoc>): void {
		if (!this.#isReady) throw new Meteor.Error(500, 'TrpcCustomPublish has not been initialised')

		this.emit.next({
			type: 'update',
			...changes,
		})
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

	take: publicProcedure
		.input(
			(val: unknown) => {
				if (typeof val !== 'object' || !val) throw new Error('Invalid input, expected object')

				const userEvent = val['userEvent']
				if (typeof userEvent !== 'string') throw new Error(`Invalid userEvent: ${typeof userEvent}`)
				const eventTime = val['eventTime']
				if (typeof eventTime !== 'number') throw new Error(`Invalid eventTime: ${typeof eventTime}`)
				const rundownPlaylistId = val['rundownPlaylistId']
				if (!isProtectedString<RundownPlaylistId>(rundownPlaylistId))
					throw new Error(`Invalid userEvent: ${typeof userEvent}`)
				const fromPartInstanceId: PartInstanceId | null = val['fromPartInstanceId']
				if (fromPartInstanceId !== null && !isProtectedString<PartInstanceId>(fromPartInstanceId))
					throw new Error(`Invalid userEvent: ${typeof userEvent}`)

				return {
					userEvent,
					eventTime,
					rundownPlaylistId,
					fromPartInstanceId,
				}
			}
			// TODO: this would be nice, but needs ProtectedStrings
			// z.object({
			// 	userEvent: z.string(),
			// 	eventTime: z.number(),
			// 	rundownPlaylistId: z.string(),
			// 	fromPartInstanceId: z.string().nullable(),
			// })
		)
		.mutation(
			// TODO - should this use Meteor.bindEnvironment? that breaks the return type..
			async (req) => {
				console.log('TRPC TAKE')
				const args = req.input

				triggerWriteAccess()
				const rundownPlaylist = RundownPlaylists.findOne(args.rundownPlaylistId)
				if (!rundownPlaylist) throw new Error(`Rundown playlist ${args.rundownPlaylistId} does not exist`)

				return await ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
					getMethodContext(makeConnection(req)),
					args.userEvent,
					getCurrentTime(),
					args.rundownPlaylistId,
					() => {
						check(args.rundownPlaylistId, String)
					},
					StudioJobs.TakeNextPart,
					{
						playlistId: args.rundownPlaylistId,
						fromPartInstanceId: args.fromPartInstanceId ?? rundownPlaylist.currentPartInstanceId,
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
	const handler = applyWSSHandler({ wss, router: appRouter, createContext })

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
})
