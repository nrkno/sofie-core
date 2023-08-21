import { applyAndValidateOverrides, ObjectWithOverrides, wrapDefaultObject } from '../../settings/objectWithOverrides'
import { literal } from '../../lib'
import { FixUpBlueprintConfigContext } from '../context'
import { ICommonContext, JSONSchema } from '@sofie-automation/blueprints-integration'

function createSimpleConfigBlob() {
	return literal<ObjectWithOverrides<any>>({
		defaults: {
			a: 1,
			b: 2,
			c: 3,
		},
		overrides: [
			{ op: 'delete', path: 'b' },
			{ op: 'set', path: 'c', value: 5 },
		],
	})
}

function createComplexConfigBlob() {
	return literal<ObjectWithOverrides<any>>({
		defaults: {
			a: 1,
			b: 2,
			c: 3,
			obj: {
				a: 1,
				b: 2,
			},
			arr: [3, 4, 5],
			// TODO - include object-table
		},
		overrides: [
			{ op: 'delete', path: 'b' },
			{ op: 'set', path: 'c', value: 5 },
			{ op: 'set', path: 'obj.b', value: 5 },
			{ op: 'set', path: 'arr', value: [6, 7] },
		],
	})
}

function createComplexBlobSchema(): JSONSchema {
	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		type: 'object',
		properties: {
			a: {
				type: 'string',
			},
			b: {
				type: 'number',
			},
			c: {
				type: 'number',
			},
			obj: {
				type: 'object',
				properties: {
					a: {
						type: 'number',
					},
					b: {
						type: 'number',
					},
				},
			},
		},
	}
}

describe('getConfig', () => {
	const fakeCommonContext: ICommonContext = null as any

	test('Initial', () => {
		const config = createSimpleConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		expect(context.getConfig()).toEqual({
			a: 1,
			c: 5,
		})
	})

	test('Mutate (externally) is reactive', () => {
		const config = createSimpleConfigBlob()
		config.overrides.push({ op: 'set', path: 'c', value: 10 })
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		expect(context.getConfig()).toEqual({
			a: 1,
			c: 10,
		})
	})
})

describe('listPaths', () => {
	const fakeCommonContext: ICommonContext = null as any

	test('Initial', () => {
		const config = createSimpleConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		expect(context.listPaths()).toEqual(['b', 'c'])
	})

	test('Mutate (externally) is reactive', () => {
		const config = createSimpleConfigBlob()
		config.overrides.push({ op: 'set', path: 'c', value: 10 })
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		expect(context.listPaths()).toEqual(['b', 'c', 'c'])
	})
})

describe('listInvalidPaths', () => {
	const fakeCommonContext: ICommonContext = null as any

	test('Initial', () => {
		const config = createSimpleConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		expect(context.listInvalidPaths()).toEqual([])
	})

	test('Mutate (externally) is reactive', () => {
		const config = createSimpleConfigBlob()
		config.overrides.push({ op: 'set', path: 'c', value: 10 })
		config.overrides.push({ op: 'set', path: 'b.1', value: 10 })
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		expect(context.listInvalidPaths()).toEqual(['b.1'])
	})
})

describe('hasOperations', () => {
	const fakeCommonContext: ICommonContext = null as any

	test('hasOperations', () => {
		const config = createSimpleConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		expect(context.hasOperations('a')).toBeFalsy()
		expect(context.hasOperations('d')).toBeFalsy()
		expect(context.hasOperations('c.1')).toBeFalsy()
		expect(context.hasOperations('')).toBeFalsy()

		expect(context.hasOperations('b')).toBeTruthy()
		expect(context.hasOperations('c')).toBeTruthy()

		config.overrides.push({ op: 'set', path: 'a.1', value: 10 })
		expect(context.hasOperations('a')).toBeTruthy()
	})
})

describe('addSetOperation', () => {
	const fakeCommonContext: ICommonContext = null as any
	const configSchema = createComplexBlobSchema()

	test('set invalid path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, config)

		expect(() => context.addSetOperation('zz', true)).toThrow(/does not exist/)
	})

	test('set new path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, config)

		const initialBlob = applyAndValidateOverrides(config).obj
		context.addSetOperation('a', true)
		expect(applyAndValidateOverrides(config).obj).toEqual({
			...initialBlob,
			a: true,
		})
	})

	test('override existing path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, config)

		const initialBlob = applyAndValidateOverrides(config).obj
		context.addSetOperation('b', true)
		expect(applyAndValidateOverrides(config).obj).toEqual({
			...initialBlob,
			b: true,
		})
	})

	test('set child property path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, config)

		const initialBlob = applyAndValidateOverrides(config).obj
		context.addSetOperation('obj.c', true)
		expect(applyAndValidateOverrides(config).obj).toEqual({
			...initialBlob,
			obj: {
				...initialBlob.obj,
				c: true,
			},
		})
	})

	test('override child property path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, config)

		const initialBlob = applyAndValidateOverrides(config).obj
		context.addSetOperation('obj.b', true)
		expect(applyAndValidateOverrides(config).obj).toEqual({
			...initialBlob,
			obj: {
				...initialBlob.obj,
				b: true,
			},
		})
	})

	test('override property with child values', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, configSchema, config)

		const initialBlob = applyAndValidateOverrides(config).obj
		context.addSetOperation('obj', true)
		expect(applyAndValidateOverrides(config).obj).toEqual({
			...initialBlob,
			obj: true,
		})
	})

	// test('one', () => {
	// 	const config = createSimpleConfigBlob()
	// 	const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)
	// 	expect(context.hasOperations('a')).toBeFalsy()
	// 	expect(context.hasOperations('d')).toBeFalsy()
	// 	expect(context.hasOperations('c.1')).toBeFalsy()
	// 	expect(context.hasOperations('')).toBeFalsy()
	// 	expect(context.hasOperations('b')).toBeTruthy()
	// 	expect(context.hasOperations('c')).toBeTruthy()
	// 	config.overrides.push({ op: 'set', path: 'a.1', value: 10 })
	// 	expect(context.hasOperations('a')).toBeTruthy()
	// })
})

describe('addDeleteOperation', () => {
	// const fakeCommonContext: ICommonContext = null as any
	// test('one', () => {
	// 	const config = createSimpleConfigBlob()
	// 	const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)
	// 	expect(context.hasOperations('a')).toBeFalsy()
	// 	expect(context.hasOperations('d')).toBeFalsy()
	// 	expect(context.hasOperations('c.1')).toBeFalsy()
	// 	expect(context.hasOperations('')).toBeFalsy()
	// 	expect(context.hasOperations('b')).toBeTruthy()
	// 	expect(context.hasOperations('c')).toBeTruthy()
	// 	config.overrides.push({ op: 'set', path: 'a.1', value: 10 })
	// 	expect(context.hasOperations('a')).toBeTruthy()
	// })
})

describe('removeOperations', () => {
	const fakeCommonContext: ICommonContext = null as any

	function getOverridePaths(config: ObjectWithOverrides<any>): string[] {
		return config.overrides.map((op) => op.path)
	}

	test('empty path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		const currentPaths = getOverridePaths(config)
		context.removeOperations('')
		expect(getOverridePaths(config)).toEqual(currentPaths)
	})

	test('path with no ops', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		{
			const currentPaths = getOverridePaths(config)
			context.removeOperations('a')
			expect(getOverridePaths(config)).toEqual(currentPaths)
		}

		{
			const currentPaths = getOverridePaths(config)
			context.removeOperations('obj.a')
			expect(getOverridePaths(config)).toEqual(currentPaths)
		}
	})

	test('unmatched path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		const currentPaths = getOverridePaths(config)
		context.removeOperations('notreal')
		expect(getOverridePaths(config)).toEqual(currentPaths)
	})

	test('root level path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		const pathsToRemove = ['b']

		const currentPaths = getOverridePaths(config).filter((p) => !pathsToRemove.includes(p))
		context.removeOperations('b')
		expect(getOverridePaths(config)).toEqual(currentPaths)
	})

	test('root level path affects children', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		const pathsToRemove = ['obj.b']

		const currentPaths = getOverridePaths(config).filter((p) => !pathsToRemove.includes(p))
		context.removeOperations('obj')
		expect(getOverridePaths(config)).toEqual(currentPaths)
	})

	test('nested path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		const pathsToRemove = ['obj.b']

		const currentPaths = getOverridePaths(config).filter((p) => !pathsToRemove.includes(p))
		context.removeOperations('obj.b')
		expect(getOverridePaths(config)).toEqual(currentPaths)
	})
})

describe('renameOperations', () => {
	const fakeCommonContext: ICommonContext = null as any

	function getOverridePaths(config: ObjectWithOverrides<any>): string[] {
		return config.overrides.map((op) => op.path)
	}

	test('empty path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		const currentPaths = getOverridePaths(config)
		context.renameOperations('', 'ab')
		expect(getOverridePaths(config)).toEqual(currentPaths)
	})

	test('path with no ops', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		{
			const currentPaths = getOverridePaths(config)
			context.renameOperations('a', 'z')
			expect(getOverridePaths(config)).toEqual(currentPaths)
		}

		{
			const currentPaths = getOverridePaths(config)
			context.renameOperations('obj.a', 'z.z')
			expect(getOverridePaths(config)).toEqual(currentPaths)
		}
	})

	test('unmatched path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		const currentPaths = getOverridePaths(config)
		context.renameOperations('notreal', 'z')
		expect(getOverridePaths(config)).toEqual(currentPaths)
	})

	test('root level path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		const pathsToRemove = ['b']

		const currentPaths = getOverridePaths(config)
			.filter((p) => !pathsToRemove.includes(p))
			.concat('z')
		context.renameOperations('b', 'z')
		expect(getOverridePaths(config)).toEqual(currentPaths)
	})

	test('root level path affects children', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		const pathsToRemove = ['obj.b']

		const currentPaths = getOverridePaths(config)
			.filter((p) => !pathsToRemove.includes(p))
			.concat('z.b')
		context.renameOperations('obj', 'z')
		expect(getOverridePaths(config)).toEqual(currentPaths)
	})

	test('nested path', () => {
		const config = createComplexConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		const pathsToRemove = ['obj.b']

		const currentPaths = getOverridePaths(config)
			.filter((p) => !pathsToRemove.includes(p))
			.concat('z')
		context.renameOperations('obj.b', 'z')
		expect(getOverridePaths(config)).toEqual(currentPaths)
	})
})

describe('warnUnfixable', () => {
	const fakeCommonContext: ICommonContext = null as any
	test('unimplemented', () => {
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, wrapDefaultObject({}))

		// TODO
		expect(() => context.warnUnfixable('', { key: '' })).toThrow()
	})
})
