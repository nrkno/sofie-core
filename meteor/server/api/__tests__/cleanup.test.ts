import { Collections } from '../../../lib/lib'
import { testInFiber } from '../../../__mocks__/helpers/jest'

import '../../../lib/main' // include this in order to get all of the collection set up
import { cleanupOldDataInner } from '../cleanup'

describe('Cleanup', () => {
	testInFiber('Check that all collections are covered', () => {
		expect(Collections.size).toBeGreaterThan(10)

		const result = cleanupOldDataInner(false)
		expect(typeof result).not.toBe('string')

		for (const name of Collections.keys()) {
			// Check that the collection has been handled in the function cleanupOldDataInner:
			expect(result).toHaveProperty(name)
		}
	})
})
