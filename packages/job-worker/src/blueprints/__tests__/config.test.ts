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
})
