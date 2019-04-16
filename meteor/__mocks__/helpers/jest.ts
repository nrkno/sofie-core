import { runInFiber } from '../Fibers'

export function testInFiber (testName: string, fcn: Function) {
	test(testName, async () => {
		await runInFiber(fcn)
	})
}

function testInFiberOnly (testName: string, fcn: Function) {
	test.only(testName, async () => {
		await runInFiber(fcn)
	})
}

testInFiber.only = testInFiberOnly
