import { compileTestResult, PerformanceTest } from './lib'
import { PerformanceTestResult } from '../../lib/api/system'
import { dbWriteAndObserve } from './dbWriteAndObserve'
import { internalTest } from './internal'
import { logger } from '../logging'

export async function runAllPerformanceTests(): Promise<PerformanceTestResult[]> {
	const results: PerformanceTestResult[] = []

	logger.debug('PerformanceTests: starting...')

	results.push(await runTest(dbWriteAndObserve()))
	results.push(await runTest(internalTest()))

	logger.debug('PerformanceTests: done!')

	return results
}

async function runTest(test: PerformanceTest) {
	const timePerTest = 3000 // ms

	logger.debug(`PerformanceTests: ${test.label}`)

	return compileTestResult(
		test.label,
		test.description,
		test.baseline,
		await runTestForATime(test.testFunction, timePerTest)
	)
}

async function runTestForATime(theTest: () => Promise<number> | number, timePerTest: number): Promise<number[]> {
	const runs: number[] = []

	const startTime = Date.now()
	while (Date.now() - startTime < timePerTest) {
		const p = Promise.resolve(theTest())

		// Make a time out in case a test misbehaves:
		await Promise.race([
			p,
			new Promise((_, reject) => {
				setTimeout(() => {
					reject(`Timeout in ${theTest.name}`)
				}, timePerTest * 1.5)
			}),
		])

		runs.push(await p)
	}

	return runs
}
