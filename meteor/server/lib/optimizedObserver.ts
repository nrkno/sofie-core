import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { clone, createManualPromise, lazyIgnore } from '../../lib/lib'
import { logger } from '../logging'

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
	Data,
	Args,
	Context extends Record<string, any>,
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
		context: Partial<Context>,
		newProps: ReadonlyDeep<Partial<UpdateProps> | undefined>
	) => Promise<Data[] | false>,
	receiveData: (args: ReadonlyDeep<Args>, newData: Data[], previousData: Data[]) => void,
	lazynessDuration: number = 3 // ms
): Promise<OptimizedObserverHandle> {
	const existingObserver = (optimizedObservers[identifier] || (await pendingObservers[identifier])) as
		| OptimizedObserver<Data, Args, Context, UpdateProps>
		| undefined

	if (existingObserver) {
		// There is an existing preparedObserver

		// Mark the received as new
		existingObserver.newDataReceivers.push(receiveData)

		// Force an update to ensure the new receiver gets data soon
		existingObserver.triggerUpdate({})
	} else {
		let updateIsRunning = true

		let hasPendingUpdate = false
		let pendingUpdate: Record<string, any> = {}
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

						const o = optimizedObservers[identifier] as OptimizedObserver<Data, Args, Context, UpdateProps>
						if (o) {
							// Fetch and clear the pending updates
							const newProps = pendingUpdate as ReadonlyDeep<Partial<UpdateProps>>
							pendingUpdate = {}

							const start = Date.now()
							const result = await manipulateData(o.args, o.context, newProps)
							const manipulateTime = Date.now()
							const manipulateDuration = manipulateTime - start

							// If result === false, that means no changes were made
							if (result !== false) {
								for (const dataReceiver of o.dataReceivers) {
									dataReceiver(o.args, result, o.lastData)
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
									dataReceiver(o.args, o.lastData, [])
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
		const manualPromise = createManualPromise<OptimizedObserver<unknown, unknown, unknown, unknown>>()
		pendingObservers[identifier] = manualPromise

		try {
			const args = clone<ReadonlyDeep<Args>>(args0)
			const observers = await setupObservers(args, triggerUpdate)

			const newObserver: OptimizedObserver<Data, Args, Context, UpdateProps> = {
				args: args,
				context: {},
				lastData: [],
				triggerUpdate: triggerUpdate,
				stop: () => {
					observers.forEach((observer) => observer.stop())
				},
				dataReceivers: [receiveData],
				newDataReceivers: [],
			}

			// Do the intial data load and emit
			const result = await manipulateData(args, newObserver.context, undefined)
			newObserver.lastData = result === false ? [] : result
			receiveData(args, newObserver.lastData, [])
			updateIsRunning = false

			if (hasPendingUpdate) {
				// An update is pending, let it be executed once the final observer is stored
				Meteor.defer(() => {
					triggerUpdate({})
				})
			}

			// Observer is now ready for all to use
			const newObserver2 = newObserver as OptimizedObserver<unknown, unknown, unknown, unknown>
			optimizedObservers[identifier] = newObserver2
			manualPromise.manualResolve(newObserver2)
		} catch (e: any) {
			manualPromise.manualReject(e)
		} finally {
			// Make sure to not leave it pending forever
			delete pendingObservers[identifier]
		}
	}

	return {
		stop: () => {
			const o = optimizedObservers[identifier] as OptimizedObserver<Data, Args, Context, UpdateProps>
			if (o) {
				const i = o.dataReceivers.indexOf(receiveData)
				if (i != -1) {
					o.dataReceivers.splice(i, 1)
				}
				// clean up if empty:
				if (!o.dataReceivers.length) {
					delete optimizedObservers[identifier]
					o.stop()
				}
			}
		},
	}
}

export interface OptimizedObserverHandle {
	stop: () => void
}

interface OptimizedObserver<TData, TArgs, TContext, UpdateProps> {
	args: ReadonlyDeep<TArgs>
	context: Partial<TContext>
	lastData: TData[]
	triggerUpdate: TriggerUpdate<UpdateProps>
	stop: () => void
	dataReceivers: Array<(args: ReadonlyDeep<TArgs>, newData: TData[], previousData: TData[]) => void>
	newDataReceivers: Array<(args: ReadonlyDeep<TArgs>, newData: TData[], previousData: TData[]) => void>
}

const optimizedObservers: Record<string, OptimizedObserver<unknown, unknown, unknown, unknown>> = {}
const pendingObservers: Record<string, Promise<OptimizedObserver<unknown, unknown, unknown, unknown>>> = {}
