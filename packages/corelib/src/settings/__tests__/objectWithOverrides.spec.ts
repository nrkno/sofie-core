import { literal } from '../../lib'
import { applyAndValidateOverrides, SomeObjectOverrideOp } from '../objectWithOverrides'

interface BasicType {
	valA?: string
	valB: {
		valC: number
		valD?: string
	}
}

describe('applyAndValidateOverrides', () => {
	test('no overrides', () => {
		const inputObj = {
			abc: 'def',
		}

		const res = applyAndValidateOverrides({ defaults: inputObj, overrides: [] })
		expect(res).toBeTruthy()

		expect(res.obj).toStrictEqual(inputObj)
		expect(res.invalid).toHaveLength(0)
		expect(res.preserve).toHaveLength(0)
		expect(res.unused).toHaveLength(0)
	})

	test('invalid overrides', () => {
		const inputObj = {
			abc: 'def',
		}

		const res = applyAndValidateOverrides({
			defaults: inputObj,
			overrides: [
				{
					op: 'unknown',
				},
				{},
			] as any,
		})
		expect(res).toBeTruthy()

		expect(res.obj).toStrictEqual(inputObj)
		expect(res.invalid).toHaveLength(2)
		expect(res.preserve).toHaveLength(0)
		expect(res.unused).toHaveLength(0)
	})

	test('some good overrides', () => {
		const inputObj: BasicType = {
			valA: 'abc',
			valB: {
				valC: 5,
			},
		}
		const inputOps: SomeObjectOverrideOp[] = [
			{ op: 'delete', path: 'valA' },
			{ op: 'set', path: 'valB', value: { valC: 9 } },
			{ op: 'set', path: 'valB.valD', value: 'def' },
		]

		const res = applyAndValidateOverrides({
			defaults: inputObj,
			overrides: inputOps,
		})
		expect(res).toBeTruthy()

		expect(res.obj).toStrictEqual(
			literal<BasicType>({
				valB: {
					valC: 9,
					valD: 'def',
				},
			})
		)
		expect(res.invalid).toHaveLength(0)
		expect(res.preserve).toStrictEqual(inputOps)
		expect(res.unused).toHaveLength(0)
	})

	test('unused overrides', () => {
		const inputObj: BasicType = {
			// valA: 'abc',
			valB: {
				valC: 5,
			},
		}
		const inputOps: SomeObjectOverrideOp[] = [
			{ op: 'delete', path: 'valA' },
			{ op: 'set', path: 'valB', value: { valC: 9, valD: 'def' } },
			{ op: 'set', path: 'valB.valD', value: 'def' },
		]

		const res = applyAndValidateOverrides({
			defaults: inputObj,
			overrides: inputOps,
		})
		expect(res).toBeTruthy()

		expect(res.obj).toStrictEqual(
			literal<BasicType>({
				valB: {
					valC: 9,
					valD: 'def',
				},
			})
		)
		expect(res.invalid).toHaveLength(0)
		expect(res.preserve).toStrictEqual(inputOps)
		expect(res.unused).toStrictEqual([inputOps[0], inputOps[2]])
	})
})
