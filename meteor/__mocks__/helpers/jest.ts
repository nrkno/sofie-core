import { runInFiber } from '../Fibers'

export function beforeAllInFiber(fcn: Function, timeout?: number) {
	beforeAll(async () => {
		await runInFiber(fcn)
	}, timeout)
}
export function afterAllInFiber(fcn: Function, timeout?: number) {
	afterAll(async () => {
		await runInFiber(fcn)
	}, timeout)
}
export function beforeEachInFiber(fcn: Function, timeout?: number) {
	beforeEach(async () => {
		await runInFiber(fcn)
	}, timeout)
}
export function afterEachInFiber(fcn: Function, timeout?: number) {
	afterEach(async () => {
		await runInFiber(fcn)
	}, timeout)
}

export function testInFiber(testName: string, fcn: Function, timeout?: number) {
	test(
		testName,
		async () => {
			await runInFiber(fcn)
		},
		timeout
	)
}

export function testInFiberOnly(testName: string, fcn: Function, timeout?: number) {
	// tslint:disable-next-line:no-focused-test
	test.only(
		testName,
		async () => {
			await runInFiber(fcn)
		},
		timeout
	)
}
const orgSetTimeout = setTimeout
export async function runAllTimers() {
	// Run all timers, and wait, multiple times.
	// This is to allow timers AND internal promises to resolve in inner functions
	for (let i = 0; i < 50; i++) {
		jest.runOnlyPendingTimers()
		await new Promise((resolve) => orgSetTimeout(resolve, 0))
	}
}

// testInFiber.only = testInFiberOnly
