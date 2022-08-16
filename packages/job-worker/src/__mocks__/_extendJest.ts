import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'

expect.extend({
	toBeWithinRange(received, floor, ceiling) {
		const pass = received >= floor && received <= ceiling
		return {
			message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
			pass: pass,
		}
	},

	toMatchUserError(received, expected, args) {
		const expectedError = UserError.create(expected)

		const pass =
			received instanceof UserError &&
			received.message.key === expectedError.message.key &&
			(args === undefined || JSON.stringify(args) === JSON.stringify(received.message.args))

		return {
			message: () =>
				`expected ${JSON.stringify(
					received instanceof UserError ? received.message : received
				)} to match ${JSON.stringify(expectedError.message)}`,
			pass: pass,
		}
	},

	toMatchToString(received, expected) {
		const received2 = 'toString' in received ? received.toString() : received
		const pass = typeof received2 === 'string' && !!received2.match(expected)

		return {
			message: () => `expected ${received.toString()} to match ${expected.toString()}`,
			pass: pass,
		}
	},
})

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace jest {
		interface Matchers<R> {
			toBeWithinRange(floor: number, ceiling: number): R

			toMatchUserError(message: UserErrorMessage, args?: { [k: string]: any }): R
			toMatchToString(message: string | RegExp): R
		}
	}
}
