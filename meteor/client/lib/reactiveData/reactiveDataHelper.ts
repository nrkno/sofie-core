import * as _ from 'underscore'
import { ReactiveVar } from 'meteor/reactive-var'
import { Tracker } from 'meteor/tracker'
import { meteorSubscribe, PubSubTypes } from '../../../lib/api/pubsub'
import { Meteor } from 'meteor/meteor'

export namespace ReactiveDataHelper {
	const rVarCache: _.Dictionary<ReactiveVar<any>> = {}

	function cacheId(...params): string {
		return params.join('_')
	}

	export function simpleObjCompare(objA, objB) {
		if (objA === objB) {
			return true
		} else if (objA && objB) {
			return JSON.stringify(objA) === JSON.stringify(objB)
		} else {
			return false
		}
	}

	export function memoizeRVar<T, A0>(computation: (a0: A0) => ReactiveVar<T>, ...labels): (a0: A0) => ReactiveVar<T>
	export function memoizeRVar<T, A0, A1>(
		computation: (a0: A0, a1: A1) => ReactiveVar<T>,
		...labels
	): (a0: A0, a1: A1) => ReactiveVar<T>
	export function memoizeRVar<T, A0, A1, A2>(
		computation: (a0: A0, a1: A1, a2: A2) => ReactiveVar<T>,
		...labels
	): (a0: A0, a1: A1, a2: A2) => ReactiveVar<T>
	export function memoizeRVar<T>(
		computation: (...params) => ReactiveVar<T>,
		...labels
	): (...params) => ReactiveVar<T> {
		return function (...params): ReactiveVar<T> {
			const cId = cacheId(computation.name, ...labels, ...params)
			if (rVarCache[cId]) {
				return rVarCache[cId]
			} else {
				const rVar = computation(...params)
				rVarCache[cId] = rVar
				return rVar
			}
		}
	}
}

const isolatedAutorunsMem: {
	[key: string]: {
		dependancy: Tracker.Dependency
		value: any
	}
} = {}

/**
 * Create a reactive computation that will be run independently of the outer one. If the same function (using the same
 * name and parameters) will be used again, this computation will only be computed once on invalidation and it's
 * result will be memoized and reused on every other call.
 *
 * The function will be considered "same", if `functionName` and `params` match.
 *
 * If the `fnc` computation is invalidated, the outer computations will only be invalidated if the value returned from
 * `fnc` fails a deep equality check (_.isEqual).
 *
 * @export
 * @template T
 * @param {T} fnc The computation function to be memoized and calculated separately from the outer one.
 * @param {string} functionName The name of this computation function
 * @param {...Parameters<T>} params Params `fnc` depends on from the outer scope. All parameters will be passed through to the function.
 * @return {*}  {ReturnType<T>}
 */
export function memoizedIsolatedAutorun<T extends (...args: any) => any>(
	fnc: T,
	functionName: string,
	...params: Parameters<T>
): ReturnType<T> {
	function hashFncAndParams(fName: string, p: any): string {
		return fName + '_' + JSON.stringify(p)
	}

	let result: ReturnType<T>
	const fId = hashFncAndParams(functionName, params)
	// const _parentComputation = Tracker.currentComputation
	if (isolatedAutorunsMem[fId] === undefined) {
		const dep = new Tracker.Dependency()
		dep.depend()
		const computation = Tracker.nonreactive(() => {
			const computation = Tracker.autorun(() => {
				result = fnc(...(params as any))

				const oldValue = isolatedAutorunsMem[fId] && isolatedAutorunsMem[fId].value

				isolatedAutorunsMem[fId] = {
					dependancy: dep,
					value: result,
				}

				if (!Tracker.currentComputation.firstRun) {
					if (!_.isEqual(oldValue, result)) {
						dep.changed()
					}
				}
			})
			computation.onStop(() => {
				delete isolatedAutorunsMem[fId]
			})
			return computation
		})
		const gc = Meteor.setInterval(() => {
			if (!dep.hasDependents()) {
				Meteor.clearInterval(gc)
				computation.stop()
			}
		}, 5000)
	} else {
		result = isolatedAutorunsMem[fId].value
		isolatedAutorunsMem[fId].dependancy.depend()
	}
	// @ts-ignore
	return result
}

/**
 * Slow down the reactivity of the inner function `fnc` to the outer computation.
 *
 * This is essentially a `throttle` for reactivity. If the inner `fnc` computation is invalidated, it will wait `delay`
 * time to invalidate the outer computation.
 *
 * @export
 * @template T
 * @param {T} fnc The wrapped computation
 * @param {number} delay The amount of time to wait before invalidating the outer function
 * @return {*}  {ReturnType<T>}
 */
export function slowDownReactivity<T extends (...args: any) => any>(fnc: T, delay: number): ReturnType<T> {
	// if the delay is <= 0, call straight away and register a direct dependency
	if (delay <= 0) {
		return fnc()
	}

	// if the delay is > 0, slow down the reactivity
	const dep = new Tracker.Dependency()
	dep.depend()

	let result: ReturnType<T>
	let invalidationTimeout: number | null = null
	let parentInvalidated = false
	const parentComputation = Tracker.currentComputation
	const computation = Tracker.nonreactive(() => {
		const computation = Tracker.autorun(() => {
			result = fnc()
		})
		computation.onInvalidate(() => {
			// if the parent hasn't been invalidated and there is no scheduled invalidation
			if (parentInvalidated === false && invalidationTimeout === null) {
				invalidationTimeout = Meteor.setTimeout(() => {
					invalidationTimeout = null
					dep.changed()
				}, delay)
			}
		})
		return computation
	})
	parentComputation?.onInvalidate(() => {
		// stop the inner computation, if the parent computation has been invalidated
		// and clean out any timeouts that may have been registered
		parentInvalidated = true
		computation.stop()
		if (invalidationTimeout) Meteor.clearTimeout(invalidationTimeout)
	})

	// @ts-ignore
	return result
}

export abstract class WithManagedTracker {
	private _autoruns: Tracker.Computation[] = []
	private _subs: Meteor.SubscriptionHandle[] = []

	stop() {
		this._autoruns.forEach((comp) => comp.stop())
		setTimeout(() => {
			this._subs.forEach((comp) => comp.stop())
		}, 2000) // wait for a couple of seconds, before unsubscribing
	}

	subscriptionsReady(): boolean {
		return this._subs.every((e) => e.ready())
	}

	protected subscribe<K extends keyof PubSubTypes>(sub: K, ...args: Parameters<PubSubTypes[K]>) {
		this._subs.push(meteorSubscribe(sub, ...args))
	}

	protected autorun(
		func: (comp: Tracker.Computation) => void,
		options?: { onError: Function | undefined } | undefined
	): Tracker.Computation {
		return Tracker.nonreactive(() => {
			const comp = Tracker.autorun(func, options)
			this._autoruns.push(comp)
			return comp
		}) as any as Tracker.Computation
	}
}

// let s = 'abc'
// let n = 123
// let arr = [s,n]

// function testFcn (a1: string, a2: number): number
// function testFcn (...params) {
// 	return params[1]
// }

// function fixFunction<T> (f: () => T): () => T {
// 	return f
// }

// let f = fixFunction( function (): string {
// 	return 'hello'
// })

// let retVal = f()
