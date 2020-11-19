/**
 * This is a very rudimentary mock of a Meteor Tracker. It is quite likely buggy and may not accurately represent
 * the order in which flags are turned on/off, since that's not clear from Meteor documentation.
 * Also, all of the Tracker.flush() and related methods are not implemented.
 */

export namespace TrackerMock {
	type ComputationCallback = (computation: Computation) => void
	type AutorunCallback<T> = (computation: Computation) => T
	export let currentComputation: Computation | null = null
	export let active: boolean = false

	export class Dependency {
		private dependents: Computation[] = []
		public changed = (): void => {
			this.dependents.forEach((comp) => comp.invalidate())
		}
		public depend = (): void => {
			if (TrackerMock.currentComputation) {
				const comp = TrackerMock.currentComputation
				if (comp) {
					const length = this.dependents.push(comp)
					comp.onStop(() => {
						this.dependents.splice(length - 1, 1)
					})
				}
			}
		}
		public hasDependents = (): boolean => {
			return this.dependents.length > 0
		}
	}

	export class Computation {
		private onInvalidateClbs: Array<ComputationCallback> = []
		private onStopClbs: Array<ComputationCallback> = []
		stopped: boolean = false
		invalidated: boolean = false
		firstRun: boolean = true
		parentComputation: Computation | null = null

		private runAll = (clbs: Array<ComputationCallback>) => {
			clbs.forEach((clb) => clb(this))
		}
		public stop = () => {
			this.stopped = true
			this.runAll(this.onInvalidateClbs)
			this.onInvalidateClbs.length = 0
			this.runAll(this.onStopClbs)
			this.onStopClbs.length = 0
			return
		}
		public invalidate = () => {
			this.invalidated = true
			this.runAll(this.onInvalidateClbs)
			this.invalidated = false
			return
		}
		public onInvalidate = (clb: ComputationCallback) => {
			this.onInvalidateClbs.push(clb)
		}
		public onStop = (clb: ComputationCallback) => {
			this.onStopClbs.push(clb)
		}
	}

	export function autorun<T>(runFunc: AutorunCallback<T>, options = {}): T {
		const comp = new TrackerMock.Computation()
		comp.parentComputation = TrackerMock.currentComputation

		TrackerMock.currentComputation = comp
		TrackerMock.active = !!TrackerMock.currentComputation
		const result = runFunc(comp)
		comp.firstRun = false
		comp.onInvalidate(() => {
			runFunc(comp)
		})
		TrackerMock.currentComputation = comp.parentComputation
		TrackerMock.active = !!TrackerMock.currentComputation

		return result
	}
	export function flush() {
		throw new Error(`Tracker.flush() is not implemented in the mock Tracker`)
	}
	export function nonreactive<T>(runFunc: () => T): T {
		const comp = TrackerMock.currentComputation
		TrackerMock.currentComputation = null
		TrackerMock.active = !!TrackerMock.currentComputation
		const result = runFunc()
		TrackerMock.currentComputation = comp
		TrackerMock.active = !!TrackerMock.currentComputation
		return result
	}
	export function inFlush(): boolean {
		throw new Error(`Tracker.inFlush() is not implemented in the mock Tracker`)
	}
	export function onInvalidate(clb: ComputationCallback) {
		if (TrackerMock.currentComputation) {
			TrackerMock.currentComputation.onInvalidate(clb)
		}
		return
	}
	export function afterFlush(clb: Function) {
		throw new Error(`Tracker.afterFlush() is not implemented in the mock Tracker`)
	}
}

export function setup() {
	return {
		Tracker: TrackerMock,
	}
}
