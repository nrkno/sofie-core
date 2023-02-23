import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client'
import { TRPCSubscriptionObserver } from '@trpc/client/dist/internals/TRPCUntypedClient'
import type { AppRouter, TrpcDocChange } from '../../lib/api/trpc/server'
import { MongoReadOnlyCollection } from '../../lib/collections/lib'

// create persistent WebSocket connection
const wsClient = createWSClient({
	url: `ws://localhost:3005`,
})

// Notice the <AppRouter> generic here.
const trpc = createTRPCProxyClient<AppRouter>({
	links: [
		wsLink({
			client: wsClient,
		}),
		// httpBatchLink({
		// 	url: 'http://localhost:3000/trpc',
		// }),
	],
})
window['trpc'] = trpc

export { trpc as trpcClient }

// trpc.take.mutate({}).then(r => console.log(r))

// window['test-subscription'] = trpc.partNotes.subscribe('ye8T_Hpg5nrN_zXHO2RwRtecqdg_', {
// 	onStarted() {
// 		console.log('sub started')
// 	},
// 	onStopped() {
// 		console.log('sub stopped')
// 	},
// 	onComplete() {
// 		console.log('sub complete')
// 	},
// 	onData(data) {
// 		console.log('received', data)
// 	},
// 	onError(err) {
// 		console.error('error', err)
// 	},
// })

export function subscribeIntoMongoCollection<TDoc extends { _id: ProtectedString<any> }>(
	collection: MongoReadOnlyCollection<TDoc>
): TRPCSubscriptionObserver<TrpcDocChange<TDoc>, any> {
	const rawCollection = (collection as any)._collection // as Mongo.Collection<TDoc>
	if (!rawCollection) throw new Error('Missing collection')

	let isReady = false

	// TODO - there are a LOT of issues here, with the morphing into minimongo, but it kinda works

	return {
		onStarted() {
			console.log('sub started')
		},
		onStopped() {
			console.log('sub stopped')
		},
		onComplete() {
			// Future: cleanup docs, but only the ones that we exclusively 'own'
			console.log('sub complete')
		},
		onData(data) {
			console.log('received', data)
			if (isReady) {
				// TODO - some buffering/debounce to avoid excessive reactivity when multiple docs change
				switch (data.type) {
					case 'init':
						// Not valid
						break
					case 'update': {
						rawCollection._collection.pauseObservers()
						for (const doc of data.added) {
							rawCollection._collection.insert(doc)
						}

						for (const doc of data.changed) {
							rawCollection._collection.update(doc._id, { $set: doc })
						}

						for (const id of data.removed) {
							rawCollection._collection.remove(id)
						}
						rawCollection._collection.resumeObservers()

						break
					}

					default:
						assertNever(data)
				}
			} else {
				switch (data.type) {
					case 'init':
						isReady = true
						rawCollection._collection.pauseObservers()
						for (const doc of data.docs) {
							rawCollection._collection.insert(doc)
						}
						console.log('bulk inserted', data.docs.length)
						rawCollection._collection.resumeObservers()
						break
					case 'update': {
						// Not valid
						break
					}
					default:
						assertNever(data)
				}
				//
			}
		},
		onError(err) {
			console.error('error', err)
		},
	}
}
