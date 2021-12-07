import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { setupDefaultJobEnvironment } from '../../__mocks__/context'
import { getShowStyleConfigRef, getStudioConfigRef, preprocessStudioConfig } from '../config'

describe('Test blueprint config', () => {
	test('compileStudioConfig', () => {
		const jobContext = setupDefaultJobEnvironment()
		jobContext.setStudio({
			...jobContext.studio,
			settings: {
				sofieUrl: 'host url',
				mediaPreviewsUrl: '',
				frameRate: 25,
			},
			blueprintConfig: { sdfsdf: 'one', another: 5 },
		})

		const res = preprocessStudioConfig(jobContext.studio, jobContext.studioBlueprint.blueprint)
		expect(res).toEqual({
			SofieHostURL: 'host url',
			sdfsdf: 'one',
			another: 5,
		})
	})

	test('getStudioConfigRef', () => {
		expect(getStudioConfigRef(protectString('st0'), 'key0')).toEqual('${studio.st0.key0}')
	})
	test('getShowStyleConfigRef', () => {
		expect(getShowStyleConfigRef(protectString('var0'), 'key1')).toEqual('${showStyle.var0.key1}')
	})

	// describe('retrieveRefs', () => {
	// 	test('empty/invalid', async () => {
	// 		expect(await ConfigRef.retrieveRefs('')).toEqual('')
	// 		expect(await ConfigRef.retrieveRefs(undefined as any)).toEqual(undefined)
	// 		expect(await ConfigRef.retrieveRefs(null as any)).toEqual(null)
	// 	})

	// 	test('bad format', async () => {
	// 		expect(await ConfigRef.retrieveRefs('$(studio.one.two)')).toEqual('$(studio.one.two)')
	// 		expect(await ConfigRef.retrieveRefs('abcd')).toEqual('abcd')
	// 	})

	// 	test('undefined - normal', async () => {
	// 		const modifier = jest.fn((v) => v)

	// 		expect(await ConfigRef.retrieveRefs('${studio.one.two}_extra', modifier)).toEqual('undefined_extra')
	// 		expect(await ConfigRef.retrieveRefs('${showStyle.one.two}_extra', modifier)).toEqual('undefined_extra')

	// 		expect(modifier).toHaveBeenCalledTimes(2)
	// 	})
	// 	test('undefined - bail', async () => {
	// 		const modifier = jest.fn((v) => v)

	// 		await expect(ConfigRef.retrieveRefs('${studio.one.two}_extra', modifier, true)).rejects.toThrowMeteor(
	// 			404,
	// 			`Ref \"\${studio.one.two}\": Studio \"one\" not found`
	// 		)
	// 		await expect(ConfigRef.retrieveRefs('${showStyle.one.two}_extra', modifier, true)).rejects.toThrowMeteor(
	// 			404,
	// 			`Ref \"\${showStyle.one.two}\": Showstyle variant \"one\" not found`
	// 		)

	// 		expect(modifier).toHaveBeenCalledTimes(0)
	// 	})
	// 	test('undefined - modifier', async () => {
	// 		const modifier = jest.fn(() => 'nope')

	// 		expect(await ConfigRef.retrieveRefs('${studio.one.two}_extra', modifier)).toEqual('nope_extra')
	// 		expect(await ConfigRef.retrieveRefs('${showStyle.one.two}_extra', modifier)).toEqual('nope_extra')

	// 		expect(modifier).toHaveBeenCalledTimes(2)
	// 	})

	// 	test('studio with data', async () => {
	// 		const studio = Studios.findOne() as Studio
	// 		expect(studio).toBeTruthy()

	// 		Studios.update(studio._id, {
	// 			$set: {
	// 				blueprintConfig: { two: 'abc', number: 99, bool: true, obj: [{ _id: '0', a: 1 }] },
	// 			},
	// 		})

	// 		expect(
	// 			await ConfigRef.retrieveRefs(
	// 				`\${studio.${studio._id}.two} = \${studio.${studio._id}.number}. Correct = \${studio.${studio._id}.bool}`
	// 			)
	// 		).toEqual('abc = 99. Correct = true')
	// 		expect(
	// 			await ConfigRef.retrieveRefs(`\${studio.${studio._id}.name} = \${studio.${studio._id}.obj}`)
	// 		).toEqual('undefined = [object Object]') // Not pretty, but expected
	// 	})
	// 	test('showstyle with data', async () => {
	// 		const variant = ShowStyleVariants.findOne() as ShowStyleVariant
	// 		expect(variant).toBeTruthy()

	// 		ShowStyleBases.update(variant.showStyleBaseId, {
	// 			$set: {
	// 				blueprintConfig: { number: 56, bool: true },
	// 			},
	// 		})
	// 		ShowStyleVariants.update(variant._id, {
	// 			$set: {
	// 				blueprintConfig: { two: 'abc', number: 88, obj: [{ _id: '0', a: 1 }] },
	// 			},
	// 		})

	// 		expect(
	// 			await ConfigRef.retrieveRefs(
	// 				`\${showStyle.${variant._id}.two} = \${showStyle.${variant._id}.number}. Correct = \${showStyle.${variant._id}.bool}`
	// 			)
	// 		).toEqual('abc = 88. Correct = true')
	// 		expect(
	// 			await ConfigRef.retrieveRefs(`\${showStyle.${variant._id}.name} = \${showStyle.${variant._id}.obj}`)
	// 		).toEqual('undefined = [object Object]') // Not pretty, but expected
	// 	})
	// })
})
