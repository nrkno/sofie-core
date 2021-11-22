import { Collections } from '../../../lib/lib'
import { testInFiber } from '../../../__mocks__/helpers/jest'

import '../../../lib/main' // include this in order to get all of the collection set up
import { cleanupOldDataInner } from '../cleanup'

describe('Cleanup', () => {
	testInFiber('Check that all collections are covered', () => {
		expect(Object.keys(Collections).length).toBeGreaterThan(10)

		const result = cleanupOldDataInner(false)

		for (const name of Object.keys(Collections)) {
			// Check that the collection has been handled in the function cleanupOldDataInner:
			expect(result).toHaveProperty(name)
		}
	})
})
