import * as _ from 'underscore'
import { ReactiveVar } from 'meteor/reactive-var'
import { Tracker } from 'meteor/tracker'

export namespace ReactiveDataHelper {
	const rVarCache: _.Dictionary<ReactiveVar<any>> = {}
	const trackers: _.Dictionary<Tracker.Computation> = {}

	function cacheId (...params): string {
		return params.join('_')
	}

	export function simpleObjCompare (objA, objB) {
		if (objA === objB) {
			return true
		} else if (objA && objB) {
			return (JSON.stringify(objA) === JSON.stringify(objB))
		} else {
			return false
		}
	}

	export function memoizeRVar<T> (computation: (...params) => ReactiveVar<T>, ...labels): ((...params) => ReactiveVar<T>) {
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

	export function registerComputation (id: string, comp: Tracker.Computation) {
		if (trackers[id] && !trackers[id].stopped) {
			trackers[id].stop()
		}

		trackers[id] = comp
	}

	export function stopComputation (id: string) {
		if (trackers[id]) {
			trackers[id].stop()
			delete trackers[id]
		}
	}
}
