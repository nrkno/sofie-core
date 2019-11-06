import { setLoggerLevel } from '../server/api/logger'

// Include this file in to get access to the extended functions

expect.extend({
	toBeWithinRange (received, floor, ceiling) {
		const pass = received >= floor && received <= ceiling
		return {
			message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
			pass: pass
		}
	},
	toBeFuzzy (received, target, fuzzyness) {
		const pass = (
			received >= target - fuzzyness &&
			received <= target + fuzzyness
		)
		return {
			message: () => `expected ${received} to be within ${fuzzyness} to ${target}`,
			pass: pass
		}
	},
})
declare global {
	namespace jest {
		interface Matchers<R> {
			toMatchObject<E extends {}[]> (expected: Partial<R>): R

			toBeWithinRange (floor: number, ceiling: number): R
			toBeFuzzy (target: number, fuzzyness: number): R
		}
	}
}
