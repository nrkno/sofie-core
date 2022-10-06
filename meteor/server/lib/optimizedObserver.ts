import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import { clone, createManualPromise, lazyIgnore, ProtectedString } from '../../lib/lib'
import { logger } from '../logging'
import { CustomPublish } from './customPublication'

interface OptimizedObserver<TData extends { _id: ProtectedString<any> }, TArgs, TContext, UpdateProps> {
	args: ReadonlyDeep<TArgs>
	context: Partial<TContext>
	lastData: TData[]
	triggerUpdate: TriggerUpdate<UpdateProps>
	stop: () => void
	dataReceivers: Array<CustomPublish<TData>>
	newDataReceivers: Array<CustomPublish<TData>>
}

/** Current fully setup optimized observers */
const optimizedObservers: Record<string, OptimizedObserver<any, unknown, unknown, unknown>> = {}
/** Setup in progress optimized observers */
const pendingObservers: Record<string, Promise<OptimizedObserver<any, unknown, unknown, unknown>>> = {}

// export interface OptimizedObserverHandle {
// 	stop: () => void
// }

export type TriggerUpdate<UpdateProps extends Record<string, any>> = (updateProps: Partial<UpdateProps>) => void

/**
 * This is an optimization to enable multiple listeners that observes (and manipulates) the same data, to only use one observer and manipulator,
 * then receive the result for each listener.
 *
 * @param identifier identifier, shared between the listeners that use the same observer.
 * @param setupObservers Set up the observers. This is run just 1 times for N listeners, on initialization.
 * @param manipulateData Manipulate the data. This is run 1 times for N listeners, per data update. (and on initialization). Return false if nothing has changed
 * @param receiveData Receive the manipulated data. This is run N times for N listeners, per data update (and on initialization).
 * @param lazynessDuration (Optional) How long to wait after a change before issueing an update. Default to 3 ms

 */
export async function setUpOptimizedObserver<
	PublicationDoc extends { _id: ProtectedString<any> },
	Args,
	State extends Record<string, any>,
	UpdateProps extends Record<string, any>
>(
	identifier: string,
	args0: ReadonlyDeep<Args>,
	setupObservers: (
		args: ReadonlyDeep<Args>,
		/** Trigger an update by mutating the context of manipulateData */
		triggerUpdate: TriggerUpdate<UpdateProps>
	) => Promise<Meteor.LiveQueryHandle[]>,
	manipulateData: (
		args: ReadonlyDeep<Args>,
		state: Partial<State>,
		newProps: ReadonlyDeep<Partial<UpdateProps> | undefined>
	) => Promise<PublicationDoc[] | null>,
	receiver: CustomPublish<PublicationDoc>,
	lazynessDuration: number = 3 // ms
): Promise<void> {
	const existingObserver = (optimizedObservers[identifier] || (await pendingObservers[identifier])) as
		| OptimizedObserver<PublicationDoc, Args, State, UpdateProps>
		| undefined

	if (existingObserver) {
		// There is an existing preparedObserver

		// Mark the received as new
		existingObserver.newDataReceivers.push(receiver)

		// Force an update to ensure the new receiver gets data soon
		existingObserver.triggerUpdate({})
	} else {
		let updateIsRunning = true

		let hasPendingUpdate = false
		let pendingUpdate: Record<string, any> = {}
		const converter = new OptimisedObserverGenericArray<PublicationDoc>()
		const triggerUpdate: TriggerUpdate<UpdateProps> = (updateProps) => {
			// Combine the pending updates
			pendingUpdate = {
				...pendingUpdate,
				...updateProps,
			}

			// If already running, set it as pending to be done afterwards
			if (updateIsRunning) {
				hasPendingUpdate = true
				return
			}

			// We are handling the update
			hasPendingUpdate = false

			// This could have multiple concurrent executions, but it shouldnt due to the boolean guards
			lazyIgnore(
				`optimizedObserver_${identifier}`,
				async () => {
					try {
						// Mark the update as running
						updateIsRunning = true

						const o = optimizedObservers[identifier] as OptimizedObserver<
							PublicationDoc,
							Args,
							State,
							UpdateProps
						>
						if (o) {
							// Fetch and clear the pending updates
							const newProps = pendingUpdate as ReadonlyDeep<Partial<UpdateProps>>
							pendingUpdate = {}

							const start = Date.now()
							const result = await manipulateData(o.args, o.context, newProps)
							const manipulateTime = Date.now()
							const manipulateDuration = manipulateTime - start

							// If result === null, that means no changes were made
							if (result !== null) {
								const changes = converter.updatedDocs(result)
								for (const dataReceiver of o.dataReceivers) {
									dataReceiver.changed(changes)
								}
								o.lastData = result
							}
							if (o.newDataReceivers.length) {
								const newDataReceivers = o.newDataReceivers
								// Move to 'active' receivers
								o.dataReceivers.push(...newDataReceivers)
								o.newDataReceivers = []
								// send initial data
								for (const dataReceiver of newDataReceivers) {
									dataReceiver.init(o.lastData)
								}
							}

							const publishTime = Date.now() - manipulateTime
							const totalTime = Date.now() - start

							/** Limit for what to consider a slow observer */
							const SLOW_OBSERVE_TIME = 50 // ms

							if (totalTime > SLOW_OBSERVE_TIME) {
								logger.debug(
									`Slow optimized observer ${identifier}. Total: ${totalTime}, manipulate: ${manipulateDuration}, publish: ${publishTime} (receivers: ${o.dataReceivers.length})`
								)
							}
						}
					} finally {
						// Update has finished, check if another needs to be performed
						updateIsRunning = false

						if (hasPendingUpdate) {
							// There is another pending update, make sure it gets executed asap
							Meteor.defer(() => {
								triggerUpdate({})
							})
						}
					}
				},
				lazynessDuration // ms
			)
		}

		// use pendingObservers, to ensure a second doesnt get created in parallel
		const manualPromise = createManualPromise<OptimizedObserver<any, unknown, unknown, unknown>>()
		pendingObservers[identifier] = manualPromise
		manualPromise.catch(() => {
			// Ensure it doesn't go uncaught
		})

		try {
			const args = clone<ReadonlyDeep<Args>>(args0)
			const observers = await setupObservers(args, triggerUpdate)

			const newObserver: OptimizedObserver<PublicationDoc, Args, State, UpdateProps> = {
				args: args,
				context: {},
				lastData: [],
				triggerUpdate: triggerUpdate,
				stop: () => {
					observers.forEach((observer) => observer.stop())
				},
				dataReceivers: [receiver],
				newDataReceivers: [],
			}

			// Do the intial data load and emit
			const result = await manipulateData(args, newObserver.context, undefined)
			newObserver.lastData = result === null ? [] : result
			receiver.init(newObserver.lastData)
			updateIsRunning = false

			if (hasPendingUpdate) {
				// An update is pending, let it be executed once the final observer is stored
				Meteor.defer(() => {
					triggerUpdate({})
				})
			}

			// Observer is now ready for all to use
			const newObserver2 = newObserver as OptimizedObserver<any, unknown, unknown, unknown>
			optimizedObservers[identifier] = newObserver2
			manualPromise.manualResolve(newObserver2)
		} catch (e: any) {
			manualPromise.manualReject(e)
		} finally {
			// Make sure to not leave it pending forever
			delete pendingObservers[identifier]
		}
	}

	receiver.onStop(() => {
		const o = optimizedObservers[identifier] as OptimizedObserver<PublicationDoc, Args, State, UpdateProps>
		if (o) {
			const i = o.dataReceivers.indexOf(receiver)
			if (i != -1) {
				o.dataReceivers.splice(i, 1)
			}
			// clean up if empty:
			if (!o.dataReceivers.length) {
				delete optimizedObservers[identifier]
				o.stop()
			}
		}
	})
}

export interface PreparedPublicationChanges<T extends { _id: ProtectedString<any> }> {
	added: T[]
	changed: T[]
	removed: T['_id'][]
}

export class OptimisedObserverGenericArray<DBObj extends { _id: ProtectedString<any> }> {
	#docs = new Map<DBObj['_id'], DBObj>()
	#firstRun: boolean = true

	public get isFirstRun(): boolean {
		return this.#firstRun
	}

	updatedDocs(newDocs: DBObj[]): PreparedPublicationChanges<DBObj> {
		const changes: PreparedPublicationChanges<DBObj> = {
			added: [],
			changed: [],
			removed: [],
		}

		const newIds = new Set<DBObj['_id']>()
		// figure out which documents have changed

		const oldIds = Array.from(this.#docs.keys())

		for (const newDoc0 of newDocs) {
			const id = newDoc0._id
			if (newIds.has(id)) {
				throw new Meteor.Error(`Error in custom publication: _id "${id}" is not unique!`)
			}
			newIds.add(id)

			const oldDoc = this.#docs.get(id)
			if (!oldDoc) {
				const newDoc = clone(newDoc0)

				// added
				this.#docs.set(id, newDoc)
				changes.added.push(newDoc)
			} else if (!_.isEqual(oldDoc, newDoc0)) {
				const newDoc = clone(newDoc0)

				// changed
				changes.changed.push(newDoc)
				this.#docs.set(id, newDoc)
			}
		}

		for (const id of oldIds) {
			if (!newIds.has(id)) {
				// Removed
				this.#docs.delete(id)
				changes.removed.push(id)
			}
		}

		if (this.#firstRun) {
			this.#firstRun = false
		}

		return changes
	}
}
