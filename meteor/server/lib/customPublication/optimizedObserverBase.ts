import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { clone, createManualPromise, lazyIgnore, ProtectedString } from '../../../lib/lib'
import { logger } from '../../logging'
import { CustomPublish, CustomPublishChanges } from './publish'

interface OptimizedObserverWrapper<TData extends { _id: ProtectedString<any> }, TArgs, TContext, UpdateProps> {
	/** Subscribers ready for data updates */
	activeSubscribers: Array<CustomPublish<TData>>
	/** New subscribers that are awaiting their initial data */
	newSubscribers: Array<CustomPublish<TData>>

	/** When set, the observer is initialised, and interested in being told when subscribers join or leave */
	subscribersChanged?: () => void

	/** The innards of the observer, this takes some time to initialize, but we can let subscribers join and leave while it runs */
	observer: Promise<OptimizedObserver<TData, TArgs, TContext, UpdateProps>>
}

interface OptimizedObserver<TData extends { _id: ProtectedString<any> }, TArgs, TContext, UpdateProps> {
	args: ReadonlyDeep<TArgs>
	context: Partial<TContext>
	lastData: TData[]
	triggerUpdate: TriggerUpdate<UpdateProps>
	stop: () => void
}

type AnyOptimizedObserverWrapper = OptimizedObserverWrapper<any, unknown, unknown, unknown>

/** Optimized observers */
const optimizedObservers: Record<string, AnyOptimizedObserverWrapper> = {}

export type TriggerUpdate<UpdateProps extends Record<string, any>> = (updateProps: Partial<UpdateProps>) => void

/**
 * This should not be used directly, and should be used through one of the setUpOptimizedObserverArray or setUpCollectionOptimizedObserver wrappers
 *
 * This is an optimization to enable multiple listeners that observes (and manipulates) the same data, to only use one observer and manipulator,
 * then receive the result for each listener.
 *
 * @param identifier identifier, shared between the listeners that use the same observer.
 * @param setupObservers Set up the observers. This is run just 1 times for N listeners, on initialization.
 * @param manipulateData Manipulate the data. This is run 1 times for N listeners, per data update. (and on initialization). Return an array of all the documents, and an object describing the changes
 * @param receiver The CustomPublish for the subscriber that wants to create (or be added to) the observer
 * @param lazynessDuration (Optional) How long to wait after a change before issueing an update. Default to 3 ms
 */
export async function setUpOptimizedObserverInner<
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
	) => Promise<[PublicationDoc[], CustomPublishChanges<PublicationDoc>]>,
	receiver: CustomPublish<PublicationDoc>,
	lazynessDuration: number = 3 // ms
): Promise<void> {
	/**
	 * Note: the contents of this function get referenced while the observer is running, even if the original subscriber has left.
	 * So remember to think about this in the context of the observer
	 */
	let thisObserver = optimizedObservers[identifier] as
		| OptimizedObserverWrapper<PublicationDoc, Args, State, UpdateProps>
		| undefined

	// Once this receiver stops, this will be called to remove it from the subscriber lists
	function removeReceiver() {
		if (thisObserver) {
			const i = thisObserver.activeSubscribers.indexOf(receiver)
			if (i !== -1) thisObserver.activeSubscribers.splice(i, 1)

			const i2 = thisObserver.newSubscribers.indexOf(receiver)
			if (i2 !== -1) thisObserver.newSubscribers.splice(i2, 1)

			// clean up if empty:
			if (
				!thisObserver.activeSubscribers.length &&
				!thisObserver.newSubscribers.length &&
				thisObserver.subscribersChanged
			) {
				thisObserver.subscribersChanged()
			}
		}
	}

	if (thisObserver) {
		// There is an existing optimizedObserver

		// Add the new subscriber
		thisObserver.newSubscribers.push(receiver)
		receiver.onStop(() => removeReceiver())

		// If the optimizedObserver is setup, we can notify it that we need data
		if (thisObserver.subscribersChanged) thisObserver.subscribersChanged()

		// Wait for the observer to be ready
		await thisObserver.observer
	} else {
		let thisInner: OptimizedObserver<PublicationDoc, Args, State, UpdateProps> | undefined
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

						if (thisObserver && thisInner) {
							if (!thisObserver.activeSubscribers.length && !thisObserver.newSubscribers.length) {
								delete optimizedObservers[identifier]
								thisInner.stop()
							}

							// Fetch and clear the pending updates
							const newProps = pendingUpdate as ReadonlyDeep<Partial<UpdateProps>>
							pendingUpdate = {}

							const start = Date.now()
							const [newDocs, changes] = await manipulateData(thisInner.args, thisInner.context, newProps)
							const manipulateTime = Date.now()
							const manipulateDuration = manipulateTime - start

							const hasChanges =
								changes.added.length > 0 || changes.changed.length > 0 || changes.removed.length > 0

							// If result === null, that means no changes were made
							if (hasChanges) {
								for (const dataReceiver of thisObserver.activeSubscribers) {
									dataReceiver.changed(changes)
								}
								thisInner.lastData = newDocs
							}
							if (thisObserver.newSubscribers.length) {
								const newDataReceivers = thisObserver.newSubscribers
								// Move to 'active' receivers
								thisObserver.activeSubscribers.push(...newDataReceivers)
								thisObserver.newSubscribers = []
								// send initial data
								for (const dataReceiver of newDataReceivers) {
									dataReceiver.init(thisInner.lastData)
								}
							}

							const publishTime = Date.now() - manipulateTime
							const totalTime = Date.now() - start

							/** Limit for what to consider a slow observer */
							const SLOW_OBSERVE_TIME = 50 // ms

							if (totalTime > SLOW_OBSERVE_TIME) {
								logger.debug(
									`Slow optimized observer ${identifier}. Total: ${totalTime}, manipulate: ${manipulateDuration}, publish: ${publishTime} (receivers: ${thisObserver.activeSubscribers.length})`
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

		const manualPromise = createManualPromise<OptimizedObserver<PublicationDoc, Args, State, UpdateProps>>()

		// Store the optimizedObserver, so that other subscribers can join onto this without creating their own
		thisObserver = optimizedObservers[identifier] = {
			newSubscribers: [receiver],
			activeSubscribers: [],
			observer: manualPromise,
		}
		receiver.onStop(() => removeReceiver())

		/**
		 * We can now do async things
		 */

		try {
			// Setup the mongo observers
			const args = clone<ReadonlyDeep<Args>>(args0)
			const observers = await setupObservers(args, triggerUpdate)

			thisInner = {
				args: args,
				context: {},
				lastData: [],
				triggerUpdate: triggerUpdate,
				stop: () => {
					observers.forEach((observer) => observer.stop())
				},
			}

			// Do the intial data load
			const [result] = await manipulateData(args, thisInner.context, undefined)
			thisInner.lastData = result

			const newDataReceivers = thisObserver.newSubscribers
			if (newDataReceivers.length === 0) {
				// There is no longer any subscriber to this
				delete optimizedObservers[identifier]
				thisInner.stop()

				manualPromise.manualReject(new Meteor.Error(500, 'All subscribers disappeared!'))
				return
			}

			// Let subscribers notify that they have unsubscribe
			thisObserver.subscribersChanged = () => triggerUpdate({})

			// Promote the initial new subscribers to active
			thisObserver.newSubscribers = []
			thisObserver.activeSubscribers = newDataReceivers
			for (const receiver of newDataReceivers) {
				receiver.init(result)
			}
			updateIsRunning = false

			if (hasPendingUpdate) {
				// An update is pending, let it be executed once the final observer is stored
				Meteor.defer(() => {
					triggerUpdate({})
				})
			}

			// Observer is now ready for all to use
			manualPromise.manualResolve(thisInner)
		} catch (e: any) {
			// The setup failed, so delete and cleanup the in-progress observer
			delete optimizedObservers[identifier]
			if (thisInner) thisInner.stop()

			manualPromise.manualReject(e)

			// Propogate to the susbcriber that started this
			throw e
		}
	}
}
