import { protectString, ProtectedString } from '../protectedString'
import { FindOptions, mongoFindOptions } from '../mongo'

describe('mongoFindOptions', () => {
	const rawDocs = ['1', '2', '3', '4', '5', '6', '7'].map((s) => ({ _id: protectString(s) }))

	test('nothing', () => {
		expect(mongoFindOptions(rawDocs)).toEqual(rawDocs)
		expect(mongoFindOptions(rawDocs, {})).toEqual(rawDocs)
	})
	test('range', () => {
		expect(mongoFindOptions(rawDocs, { limit: 4 }).map((s) => s._id)).toEqual(['1', '2', '3', '4'])
		expect(mongoFindOptions(rawDocs, { skip: 4 }).map((s) => s._id)).toEqual(['5', '6', '7'])
		expect(mongoFindOptions(rawDocs, { skip: 2, limit: 3 }).map((s) => s._id)).toEqual(['3', '4', '5'])
	})

	interface SomeDoc {
		_id: ProtectedString<any>
		val: string
		val2: string
	}

	const rawDocs2: SomeDoc[] = [
		{
			_id: protectString('1'),
			val: 'a',
			val2: 'c',
		},
		{
			_id: protectString('2'),
			val: 'x',
			val2: 'c',
		},
		{
			_id: protectString('3'),
			val: 'n',
			val2: 'b',
		},
	]

	test('fields', () => {
		// those are covered by MongoFieldSpecifier type:
		// expect(() => mongoFindOptions(rawDocs, { fields: { val: 0, val2: 1 } })).toThrowError('options.fields cannot contain both include and exclude rules')
		// expect(() => mongoFindOptions(rawDocs, { fields: { _id: 0, val2: 1 } })).not.toThrowError()
		// expect(() => mongoFindOptions(rawDocs, { fields: { _id: '1', val: 0 } })).not.toThrowError()

		expect(mongoFindOptions(rawDocs2, { fields: { val: 0 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '1',
				val2: 'c',
			},
			{
				_id: '2',
				val2: 'c',
			},
			{
				_id: '3',
				val2: 'b',
			},
		])
		expect(mongoFindOptions(rawDocs2, { fields: { val: 0, _id: 0 } } as FindOptions<SomeDoc>)).toEqual([
			{
				val2: 'c',
			},
			{
				val2: 'c',
			},
			{
				val2: 'b',
			},
		])
		expect(mongoFindOptions(rawDocs2, { fields: { val: 1 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '1',
				val: 'a',
			},
			{
				_id: '2',
				val: 'x',
			},
			{
				_id: '3',
				val: 'n',
			},
		])
		// those are covered by MongoFieldSpecifier type:
		// expect(mongoFindOptions(rawDocs2, { fields: { val: 1, _id: 0 } })).toEqual([
		// 	{
		// 		val: 'a',
		// 	},
		// 	{
		// 		val: 'x',
		// 	},
		// 	{
		// 		val: 'n',
		// 	},
		// ])
	})

	test('fields2', () => {
		expect(mongoFindOptions(rawDocs2, { sort: { val: 1 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '1',
				val: 'a',
				val2: 'c',
			},
			{
				_id: '3',
				val: 'n',
				val2: 'b',
			},
			{
				_id: '2',
				val: 'x',
				val2: 'c',
			},
		])
		expect(mongoFindOptions(rawDocs2, { sort: { val: -1 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '2',
				val: 'x',
				val2: 'c',
			},
			{
				_id: '3',
				val: 'n',
				val2: 'b',
			},
			{
				_id: '1',
				val: 'a',
				val2: 'c',
			},
		])

		expect(mongoFindOptions(rawDocs2, { sort: { val2: 1, val: 1 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '3',
				val: 'n',
				val2: 'b',
			},
			{
				_id: '1',
				val: 'a',
				val2: 'c',
			},
			{
				_id: '2',
				val: 'x',
				val2: 'c',
			},
		])
		expect(mongoFindOptions(rawDocs2, { sort: { val2: 1, val: -1 } } as FindOptions<SomeDoc>)).toEqual([
			{
				_id: '3',
				val: 'n',
				val2: 'b',
			},
			{
				_id: '2',
				val: 'x',
				val2: 'c',
			},
			{
				_id: '1',
				val: 'a',
				val2: 'c',
			},
		])
	})
})
