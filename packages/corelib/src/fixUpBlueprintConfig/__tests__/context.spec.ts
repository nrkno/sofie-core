import { ObjectWithOverrides } from '../../settings/objectWithOverrides'
import { literal } from '../../lib'
import { FixUpBlueprintConfigContext } from '../context'
import { ICommonContext } from '@sofie-automation/blueprints-integration'

describe('getConfig', () => {
	const fakeCommonContext: ICommonContext = null as any
	function createConfigBlob() {
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

	test('Initial', () => {
		const config = createConfigBlob()
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		expect(context.getConfig()).toEqual({
			a: 1,
			c: 5,
		})
	})

	test('Mutate (externally) is reactive', () => {
		const config = createConfigBlob()
		config.overrides.push({ op: 'set', path: 'c', value: 10 })
		const context = new FixUpBlueprintConfigContext(fakeCommonContext, {}, config)

		expect(context.getConfig()).toEqual({
			a: 1,
			c: 10,
		})
	})
})
