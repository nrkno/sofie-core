import { runInFiber } from '../Fibers'

export function beforeAllInFiber (fcn: Function) {
	beforeAll(async () => {
		await runInFiber(fcn)
	})
}
export function beforeEachInFiber (fcn: Function) {
	beforeEach(async () => {
		await runInFiber(fcn)
	})
}

export function testInFiber (testName: string, fcn: Function) {
	test(testName, async () => {
		await runInFiber(fcn)
	})
}

export function testInFiberOnly (testName: string, fcn: Function) {
	test.only(testName, async () => {
		await runInFiber(fcn)
	})
}
const orgSetTimeout = setTimeout
export async function runAllTimers () {
	// Run all timers, and wait, multiple times.
	// This is to allow timers AND internal promises to resolve in inner functions
	for (let i = 0; i < 50; i++) {
		jest.runOnlyPendingTimers()
		await new Promise(resolve => orgSetTimeout(resolve, 0))
	}
}

// testInFiber.only = testInFiberOnly
