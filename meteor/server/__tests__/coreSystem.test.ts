import { testInFiber } from '../../__mocks__/helpers/jest'
import { getRelevantSystemVersions } from '../coreSystem'

describe('coreSystem', () => {
	testInFiber('getRelevantSystemVersions', () => {
		const versions = getRelevantSystemVersions()

		expect(versions).toEqual({
			core: expect.stringMatching(/^(\d+)\.(\d+)\.(\d+)/),
			'mos-connection': expect.stringMatching(/^(\d+)\.(\d+)\.(\d+)/),
			'superfly-timeline': expect.stringMatching(/^(\d+)\.(\d+)\.(\d+)/),
			'timeline-state-resolver-types': expect.stringMatching(/^(\d+)\.(\d+)\.(\d+)/),
		})
	})
})
