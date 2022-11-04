import { ManualPromise, createManualPromise } from '@sofie-automation/corelib/dist/lib'
import { Meteor } from 'meteor/meteor'
import { waitForPromise } from '../../../lib/lib'

export interface ReactiveMongoObserverGroupHandle extends Meteor.LiveQueryHandle {
	/**
	 * Restart the observers inside this group
	 */
	restart(): void
}

/**
 * Helper to trigger reactivity inside of an OptimisedObserver whenever one of the other Mongo observers changes
 * Note: care needs to be taken when using this, as Mongo observers call `added` for every document when they start. It is very easy to form an infinite loop of observer invalidations
 * @param generator Function to generate the `Meteor.LiveQueryHandle`s
 * @returns Handle to stop and restart the observer group
 */
export function ReactiveMongoObserverGroup(
	generator: () => Promise<Array<Meteor.LiveQueryHandle>>
): ReactiveMongoObserverGroupHandle {
	let running = true
	let pendingStop: ManualPromise<void> | undefined
	let pendingRestart: ManualPromise<void> | undefined
	let handles: Array<Meteor.LiveQueryHandle> | null = null

	const stopAll = () => {
		if (handles) {
			for (const handle of handles) {
				handle.stop()
			}
			handles = null
		}
	}

	// TODO - write unit tests for this helper

	// TODO - debounce?
	let checkRunning = false
	const runCheck = () => {
		let result: ManualPromise<void> | undefined
		try {
			if (!running) throw new Meteor.Error(500, 'ObserverGroup has been stopped!')

			if (checkRunning) return
			checkRunning = true

			// stop() has been called
			if (pendingStop) {
				running = false

				result = pendingStop
				pendingStop = undefined

				// Stop the child observers
				stopAll()

				result.manualResolve()

				// Ensure there is no pending restart
				if (pendingRestart)
					pendingRestart.manualReject(new Meteor.Error(500, 'ReactiveMongoObserverGroup has been stopped'))

				// Stop loop
				return
			}

			// restart() has been called
			if (pendingRestart) {
				result = pendingRestart
				pendingRestart = undefined

				// Stop the child observers
				stopAll()
			}

			// Start the child observers
			if (!handles) {
				// handles = await generator()
				handles = waitForPromise(generator())

				// check for another pending operation
				Meteor.defer(() => runCheck())
			}

			// Inform caller
			if (result) result.manualResolve()
		} catch (e: any) {
			// TODO -  log?
			if (result) result.manualReject(e)
		} finally {
			checkRunning = false
		}
	}

	const handle: ReactiveMongoObserverGroupHandle = {
		stop: () => {
			if (!running) throw new Meteor.Error(500, 'ReactiveMongoObserverGroup is not running!')

			let promise = pendingStop
			if (!promise) {
				promise = createManualPromise<void>()
				pendingStop = promise
			}

			Meteor.defer(() => runCheck())

			// Block the caller until the stop has completed
			waitForPromise(promise)
		},
		restart: () => {
			if (!running) throw new Meteor.Error(500, 'ReactiveMongoObserverGroup is not running!')

			let promise = pendingRestart
			if (!promise) {
				promise = createManualPromise<void>()
				pendingRestart = promise
			}

			Meteor.defer(() => runCheck())

			// Block the caller until the restart has completed
			waitForPromise(promise)
		},
	}

	// Initial setup of observers
	Meteor.defer(() => runCheck())

	return handle
}
