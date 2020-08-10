export async function expectToExecuteQuickerThan(fcn: () => void | Promise<void>, maxDuration: number): Promise<void> {
	const startTime = Date.now()
	await Promise.resolve(fcn())
	const duration = Date.now() - startTime
	const pass = duration < maxDuration

	if (!pass) {
		throw new Error(`Expected function execution to take less than ${maxDuration} ms (it took ${duration} ms )`)
	}
	expect(duration).toBeLessThan(maxDuration)
}
