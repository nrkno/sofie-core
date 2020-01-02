import { setupDefaultStudioEnvironment, setupMockStudio } from '../../../../__mocks__/helpers/database'
import { compileStudioConfig, ConfigRef } from '../config'
import { Studio, Studios } from '../../../../lib/collections/Studios'
import { ShowStyleVariants, ShowStyleVariant } from '../../../../lib/collections/ShowStyleVariants'
import { ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'

describe('Test blueprint config', () => {

	beforeAll(() => {
		setupDefaultStudioEnvironment()
	})

	test('compileStudioConfig', () => {
		const studio = setupMockStudio({
			settings: {
				sofieUrl: 'host url',
				mediaPreviewsUrl: ''
			},
			config: [
				{ _id: 'sdfsdf', value: 'one' },
				{ _id: 'another', value: 5 }
			]
		})

		const res = compileStudioConfig(studio)
		expect(res).toEqual({
			SofieHostURL: 'host url',
			sdfsdf: 'one',
			another: 5
		})
	})

	test('getStudioConfigRef', () => {
		expect(ConfigRef.getStudioConfigRef('st0', 'key0')).toEqual('${studio.st0.key0}')
	})
	test('getShowStyleConfigRef', () => {
		expect(ConfigRef.getShowStyleConfigRef('var0', 'key1')).toEqual('${showStyle.var0.key1}')
	})

	describe('retrieveRefs', () => {
		test('empty/invalid', () => {
			expect(ConfigRef.retrieveRefs('')).toEqual('')
			expect(ConfigRef.retrieveRefs(undefined as any)).toEqual(undefined)
			expect(ConfigRef.retrieveRefs(null as any)).toEqual(null)
		})

		test('bad format', () => {
			expect(ConfigRef.retrieveRefs('$(studio.one.two)')).toEqual('$(studio.one.two)')
			expect(ConfigRef.retrieveRefs('abcd')).toEqual('abcd')
		})

		test('undefined - normal', () => {
			const modifier = jest.fn(v => v)

			expect(ConfigRef.retrieveRefs('${studio.one.two}_extra', modifier)).toEqual('undefined_extra')
			expect(ConfigRef.retrieveRefs('${showStyle.one.two}_extra', modifier)).toEqual('undefined_extra')

			expect(modifier).toHaveBeenCalledTimes(2)
		})
		test('undefined - bail', () => {
			const modifier = jest.fn(v => v)

			try {
				expect(ConfigRef.retrieveRefs('${studio.one.two}_extra', modifier, true)).toEqual('undefined_extra')
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[404] Ref \"\${studio.one.two}\": Studio \"one\" not found`)
			}
			try {
				expect(ConfigRef.retrieveRefs('${showStyle.one.two}_extra', modifier, true)).toEqual('undefined_extra')
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[404] Ref \"\${showStyle.one.two}\": Showstyle variant \"one\" not found`)
			}

			expect(modifier).toHaveBeenCalledTimes(0)
		})
		test('undefined - modifier', () => {
			const modifier = jest.fn(() => 'nope')

			expect(ConfigRef.retrieveRefs('${studio.one.two}_extra', modifier)).toEqual('nope_extra')
			expect(ConfigRef.retrieveRefs('${showStyle.one.two}_extra', modifier)).toEqual('nope_extra')

			expect(modifier).toHaveBeenCalledTimes(2)
		})

		test('studio with data', () => {
			const studio = Studios.findOne() as Studio
			expect(studio).toBeTruthy()

			Studios.update(studio._id, {
				$set: {
					config: [
						{
							_id: 'two',
							value: 'abc'
						},
						{
							_id: 'number',
							value: 99
						},
						{
							_id: 'bool',
							value: true
						},
						{
							_id: 'obj',
							value: [{ _id: '0', a: 1 }]
						}
					]
				}
			})

			expect(ConfigRef.retrieveRefs(`\${studio.${studio._id}.two} = \${studio.${studio._id}.number}. Correct = \${studio.${studio._id}.bool}`)).toEqual('abc = 99. Correct = true')
			expect(ConfigRef.retrieveRefs(`\${studio.${studio._id}.name} = \${studio.${studio._id}.obj}`)).toEqual('undefined = [object Object]') // Not pretty, but expected
		})
		test('showstyle with data', () => {
			const variant = ShowStyleVariants.findOne() as ShowStyleVariant
			expect(variant).toBeTruthy()

			ShowStyleBases.update(variant.showStyleBaseId, {
				$set: {
					config: [
						{
							_id: 'number',
							value: 56
						},
						{
							_id: 'bool',
							value: true
						},
					]
				}
			})
			ShowStyleVariants.update(variant._id, {
				$set: {
					config: [
						{
							_id: 'two',
							value: 'abc'
						},
						{
							_id: 'number',
							value: 88
						},
						{
							_id: 'obj',
							value: [{ _id: '0', a: 1 }]
						}
					]
				}
			})

			expect(ConfigRef.retrieveRefs(`\${showStyle.${variant._id}.two} = \${showStyle.${variant._id}.number}. Correct = \${showStyle.${variant._id}.bool}`)).toEqual('abc = 88. Correct = true')
			expect(ConfigRef.retrieveRefs(`\${showStyle.${variant._id}.name} = \${showStyle.${variant._id}.obj}`)).toEqual('undefined = [object Object]') // Not pretty, but expected
		})
	})

})
