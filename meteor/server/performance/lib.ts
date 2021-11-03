import { PerformanceTestResult } from '../../lib/api/system'

export interface PerformanceTest {
	label: string
	description: string
	baseline: number
	testFunction: () => Promise<number> | number
}

export function compileTestResult(
	label: string,
	description: string,
	baseline: number,
	runs: number[]
): PerformanceTestResult {
	const result: PerformanceTestResult = {
		label,
		description,

		valueMean: 0,
		valueMax95: 0,
		valueMin95: 0,
		valueMax: 0,
		valueMin: 0,
		count: 0,
		baseline,
	}

	if (runs.length > 0) {
		runs.sort((a, b) => a - b) // Lowest first

		result.valueMean = round(runs.reduce((memo, value) => memo + value, 0) / runs.length)

		const indexMax95 = round(Math.round((runs.length - 1) * 0.95))
		const indexMin95 = round(Math.round((runs.length - 1) * 0.05))
		result.valueMax95 = round(runs[indexMax95])
		result.valueMin95 = round(runs[indexMin95])

		result.valueMax = round(Math.max(...runs))
		result.valueMin = round(Math.min(...runs))

		result.count = round(runs.length)
	}
	return result
}

function round(v: number): number {
	return Math.round(v * 100) / 100
}
