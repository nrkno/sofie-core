import { runInFiber } from '../Fibers'

export function testInFiber (testName: string, fcn: Function) {
	test(testName, async () => {
		await runInFiber(fcn)
	})
}
