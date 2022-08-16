import deepExtend from 'deep-extend'
import { check, Match } from '../check'

describe('lib/check', () => {
	test('check basic', () => {
		expect(() => check('asdf', String)).not.toThrowError()
		expect(() => check(123, Number)).not.toThrowError()
		expect(() => check({ a: 1 }, Object)).not.toThrowError()
		expect(() => check({}, Object)).not.toThrowError()
		expect(() => check([1234, 5, 6], Array)).not.toThrowError()
		expect(() => check(true, Boolean)).not.toThrowError()
		expect(() => check(false, Boolean)).not.toThrowError()
		expect(() => check(() => console.log('hello'), Function)).not.toThrowError()

		expect(() => check(['asdf', 'asdf2'], [String])).not.toThrowError()
		expect(() => check([1, 2, 3], [Number])).not.toThrowError()

		// Bad values:
		expect(() => check(123, String)).toThrowError()
		expect(() => check('123', Number)).toThrowError()
		expect(() => check([], Object)).toThrowError()
		expect(() => check({}, Array)).toThrowError()
		expect(() => check(123, Array)).toThrowError()
		expect(() => check(null, Boolean)).toThrowError()
		expect(() => check(undefined, Boolean)).toThrowError()

		expect(() => check(['asdf', 1], [String])).toThrowError()
		expect(() => check([1, 2, 3, null], [Number])).toThrowError()
	})
	test('check object', () => {
		const val = {
			a: 1,
			b: {
				c: 2,
				e: [1, 2, 3],
			},
			e: [1, 2, 3],
		}
		const verify: Match.Pattern = {
			a: Number,
			b: {
				c: Number,
				e: [Number],
			},
			e: [Number],
		}

		expect(() => check(val, verify)).not.toThrowError()

		{
			const verify2 = deepExtend({}, verify) as any
			verify2.b.e = [String]
			expect(() => check(val, verify2)).toThrowError()
		}
	})
})
