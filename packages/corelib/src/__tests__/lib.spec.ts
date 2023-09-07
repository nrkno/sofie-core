import { TSR } from '@sofie-automation/blueprints-integration'
import { TimelineObjGeneric, TimelineObjType } from '../dataModel/Timeline'
import {
	formatDateAsTimecode,
	formatDurationAsTimecode,
	getHash,
	literal,
	objectPathGet,
	objectPathSet,
	removeNullyProperties,
} from '../lib'
import { UserError, UserErrorMessage } from '../error'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

describe('Lib', () => {
	test('getHash', () => {
		const h0 = getHash('abc')
		const h1 = getHash('abcd')
		const h2 = getHash('abc')

		expect(h0).toEqual(h2)
		expect(h0).not.toEqual(h1)
	})
	test('literal', () => {
		const obj = literal<TimelineObjGeneric>({
			id: 'abc',
			enable: {
				start: 0,
			},
			layer: 'L1',
			content: { deviceType: TSR.DeviceType.ABSTRACT },
			objectType: TimelineObjType.RUNDOWN,
			priority: 0,
		})
		expect(obj).toEqual({
			id: 'abc',
			enable: {
				start: 0,
			},
			layer: 'L1',
			content: { deviceType: TSR.DeviceType.ABSTRACT },
			objectType: TimelineObjType.RUNDOWN,
			priority: 0,
		})
		const layer: string | number = obj.layer // just to check typings
		expect(layer).toBeTruthy()
	})
	test('formatDateAsTimecode', () => {
		const d = new Date('2019-01-01 13:04:15.145')
		expect(d.getMilliseconds()).toEqual(145)
		expect(formatDateAsTimecode({ frameRate: 25 }, d)).toEqual('13:04:15:03')
	})
	test('formatDurationAsTimecode', () => {
		expect(formatDurationAsTimecode({ frameRate: 25 }, (2 * 3600 + 5 * 60 + 7) * 1000 + 500)).toEqual('02:05:07:12')
	})
	test('removeNullyProperties', () => {
		expect(
			removeNullyProperties({
				a: 1,
				b: 2,
				c: null,
				e: undefined,
				f: {
					a: 1,
					b: 2,
					c: null,
					e: undefined,
				},
			})
		).toEqual({
			a: 1,
			b: 2,
			e: undefined,
			f: {
				a: 1,
				b: 2,
				e: undefined,
			},
		})
	})
	test('objectPathGet', () => {
		expect(
			objectPathGet(
				{
					a: 1,
					b: {
						c: 1,
						d: {
							e: 2,
						},
					},
				},
				'b.d.e'
			)
		).toEqual(2)
	})
	test('objectPathSet', () => {
		const o: any = {
			a: 1,
			b: {
				c: 1,
				d: {
					e: 2,
				},
			},
		}
		objectPathSet(o, 'b.d.f', 42)
		expect(o.b.d.f).toEqual(42)
	})
	test('stringifyError', () => {
		// string:
		expect(stringifyError('abc')).toBe('abc')

		// Error:
		const error = new Error('Hello')
		expect(stringifyError(error)).toMatch(/Error: Hello/)
		expect(stringifyError(error)).toMatch(/lib\.spec/)

		// Instance of classes (similar to for example KeyboardEvents):
		class MyTestEvent {
			public prop = 'abc'
		}
		const event = new MyTestEvent()
		expect(stringifyError(event)).toMatch(/MyTestEvent.*abc/)

		// Some object:
		const obj = {
			prop: {
				anotherProp: 'abc',
			},
		}
		expect(stringifyError(obj)).toMatch(/anotherProp.*abc/)

		// UserError:
		const userError = UserError.fromUnknown(error, UserErrorMessage.ValidationFailed, {}, 42)
		// The stringification should trigger .toString() -> .toJSON() in UserError:
		const str = stringifyError(userError)
		expect(str).toMatch(/^UserError: /)
		expect(JSON.parse(str.replace('UserError: ', ''))).toMatchObject({
			errorCode: 42,
			key: UserErrorMessage.ValidationFailed,
			message: {
				key: 'Validation failed!',
				args: {},
			},
			rawError: expect.stringMatching(/Error: Hello/),
		})

		// Array of stuff:
		const arr = ['qwerty', error, event, obj]
		expect(stringifyError(arr)).toMatch(/qwerty/)
		expect(stringifyError(arr)).toMatch(/Error: Hello/)
		expect(stringifyError(event)).toMatch(/MyTestEvent.*abc/)
		expect(stringifyError(obj)).toMatch(/anotherProp.*abc/)
	})
})
