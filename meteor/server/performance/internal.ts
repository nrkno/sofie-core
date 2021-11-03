import { PerformanceTest } from './lib'

export function internalTest(): PerformanceTest {
	// Note: This is just an initial attempt to make something that is affected by CPU and memory

	return {
		label: 'Internal',
		description: 'Internal performance in Sofie Core. The result is affected by things like CPU and RAM.',
		baseline: 20,
		testFunction: () => {
			// Prepare test: ----------------------------------------------------------

			const lookup: {
				[key: string]: any
			} = {}

			for (let i = 0; i < 100; i++) {
				const key = 'Key' + Math.random()
				lookup[key] = {
					_id: key,
					prop0: 'randomValue_qwertyuiopasdfghjklzxcvbnm' + Math.random(),
				}
			}

			// Start the test: --------------------------------------------------------
			const startTime = Date.now()

			for (let i = 0; i < 10; i++) {
				const objKeyCount = 30
				for (let j = 0; j < objKeyCount; j++) {
					for (const [key, obj] of Object.entries(lookup)) {
						obj['prop' + j] = key + obj['prop' + (j - 1)] + i
					}
				}

				for (let j = 0; j < objKeyCount; j++) {
					for (const obj of Object.values(lookup)) {
						delete obj['prop' + j]
					}
				}
			}

			return Date.now() - startTime
		},
	}
}
