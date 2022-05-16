import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import { setupDefaultJobEnvironment } from '../../__mocks__/context'
import {
	getShowStyleConfigRef,
	getStudioConfigRef,
	preprocessStudioConfig,
	retrieveBlueprintConfigRefs,
} from '../config'

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
		jobContext.updateStudioBlueprint({
			studioConfigManifest: undefined,
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

	describe('retrieveRefs', () => {
		test('empty/invalid', async () => {
			const jobContext = setupDefaultJobEnvironment()

			expect(await retrieveBlueprintConfigRefs(jobContext, '')).toEqual('')
			expect(await retrieveBlueprintConfigRefs(jobContext, undefined as any)).toEqual(undefined)
			expect(await retrieveBlueprintConfigRefs(jobContext, null as any)).toEqual(null)
		})

		test('bad format', async () => {
			const jobContext = setupDefaultJobEnvironment()

			expect(await retrieveBlueprintConfigRefs(jobContext, '$(studio.one.two)')).toEqual('$(studio.one.two)')
			expect(await retrieveBlueprintConfigRefs(jobContext, 'abcd')).toEqual('abcd')
		})

		test('undefined - normal', async () => {
			const jobContext = setupDefaultJobEnvironment()

			const modifier = jest.fn((v) => v)

			expect(await retrieveBlueprintConfigRefs(jobContext, '${studio.one.two}_extra', modifier)).toEqual(
				'undefined_extra'
			)
			expect(await retrieveBlueprintConfigRefs(jobContext, '${showStyle.one.two}_extra', modifier)).toEqual(
				'undefined_extra'
			)

			expect(modifier).toHaveBeenCalledTimes(2)
		})
		test('undefined - bail', async () => {
			const jobContext = setupDefaultJobEnvironment()

			const modifier = jest.fn((v) => v)

			await expect(
				retrieveBlueprintConfigRefs(jobContext, '${studio.one.two}_extra', modifier, true)
			).rejects.toThrowError(`Ref "\${studio.one.two}": Studio "one" not valid`)
			await expect(
				retrieveBlueprintConfigRefs(jobContext, '${showStyle.one.two}_extra', modifier, true)
			).rejects.toThrowError(`Ref "\${showStyle.one.two}": Showstyle variant "one" not found`)

			expect(modifier).toHaveBeenCalledTimes(0)
		})
		test('undefined - modifier', async () => {
			const jobContext = setupDefaultJobEnvironment()

			const modifier = jest.fn(() => 'nope')

			expect(await retrieveBlueprintConfigRefs(jobContext, '${studio.one.two}_extra', modifier)).toEqual(
				'nope_extra'
			)
			expect(await retrieveBlueprintConfigRefs(jobContext, '${showStyle.one.two}_extra', modifier)).toEqual(
				'nope_extra'
			)

			expect(modifier).toHaveBeenCalledTimes(2)
		})

		test('studio with data', async () => {
			const jobContext = setupDefaultJobEnvironment()

			const studioId = jobContext.studioId
			jobContext.setStudio({
				...jobContext.studio,
				blueprintConfig: { two: 'abc', number: 99, bool: true, obj: [{ _id: '0', a: 1 }] },
			})
			jobContext.updateStudioBlueprint({
				// Bypass running through configManifest
				studioConfigManifest: undefined,
			})

			expect(
				await retrieveBlueprintConfigRefs(
					jobContext,
					`\${studio.${studioId}.two} = \${studio.${studioId}.number}. Correct = \${studio.${studioId}.bool}`
				)
			).toEqual('abc = 99. Correct = true')
			expect(
				await retrieveBlueprintConfigRefs(
					jobContext,
					`\${studio.${studioId}.name} = \${studio.${studioId}.obj}`
				)
			).toEqual('undefined = [object Object]') // Not pretty, but expected
		})

		test('showstyle with data', async () => {
			const jobContext = setupDefaultJobEnvironment()

			const showStyle = await setupMockShowStyleCompound(jobContext)

			await jobContext.directCollections.ShowStyleBases.update(showStyle._id, {
				$set: {
					blueprintConfig: { number: 56, bool: true },
				},
			})
			await jobContext.directCollections.ShowStyleVariants.update(showStyle.showStyleVariantId, {
				$set: {
					blueprintConfig: { two: 'abc', number: 88, obj: [{ _id: '0', a: 1 }] },
				},
			})
			jobContext.setStudio({
				...jobContext.studio,
				supportedShowStyleBase: [showStyle._id],
			})
			jobContext.updateShowStyleBlueprint({
				// Bypass running through configManifest
				showStyleConfigManifest: undefined,
			})

			expect(
				await retrieveBlueprintConfigRefs(
					jobContext,
					`\${showStyle.${showStyle.showStyleVariantId}.two} = \${showStyle.${showStyle.showStyleVariantId}.number}. Correct = \${showStyle.${showStyle.showStyleVariantId}.bool}`
				)
			).toEqual('abc = 88. Correct = true')
			expect(
				await retrieveBlueprintConfigRefs(
					jobContext,
					`\${showStyle.${showStyle.showStyleVariantId}.name} = \${showStyle.${showStyle.showStyleVariantId}.obj}`
				)
			).toEqual('undefined = [object Object]') // Not pretty, but expected
		})
	})
})
