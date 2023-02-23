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
	const pendingInitialDocs = new Map<TDoc['_id'], TDoc>()

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
					case 'ready':
						// Not valid
						break
					case 'delete':
						rawCollection._collection.remove(data.id)
						break
					case 'upsert': {
						rawCollection._collection.update(data.id, data.fields, {
							upsert: true,
						})
						break
					}
					default:
						assertNever(data)
				}
			} else {
				switch (data.type) {
					case 'ready':
						isReady = true
						// rawCollection._collection.pauseObservers()
						for (const doc of pendingInitialDocs.values()) {
							rawCollection._collection.insert(doc)
						}
						console.log('bulk inserted', pendingInitialDocs.size)
						// rawCollection._collection.resumeObservers()
						pendingInitialDocs.clear()
						break
					case 'delete':
						pendingInitialDocs.delete(data.id)
						break
					case 'upsert': {
						const doc = pendingInitialDocs.get(data.id)
						pendingInitialDocs.set(data.id, {
							...(doc || {}),
							...data.fields,
						})
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
