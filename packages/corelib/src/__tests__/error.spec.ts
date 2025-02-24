import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { UserError, UserErrorMessage } from '../error.js'

describe('UserError', () => {
	test('stringifyError', () => {
		const rawError = new Error('raw')
		rawError.stack = 'mock stack'
		const userError = UserError.from(rawError, UserErrorMessage.PartNotFound, { key: 'translatable message' })

		expect(stringifyError(userError)).toEqual(
			'UserError: ' +
				JSON.stringify({
					rawError: 'Error: raw, mock stack',
					message: {
						key: 'The selected part does not exist',
						args: {
							key: 'translatable message',
						},
					},
					key: 25,
					errorCode: 500,
				})
		)

		// serialized and restored
		const restored = JSON.parse(userError.toString())
		expect(stringifyError(restored)).toEqual('raw, mock stack')
	})
})
