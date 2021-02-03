import { testInFiber } from '../../__mocks__/helpers/jest'
import { getRelevantSystemVersions } from '../coreSystem'

describe('coreSystem', () => {
	testInFiber('getRelevantSystemVersions', () => {
		const versions = getRelevantSystemVersions()

		expect(versions).toMatchObject({
			core: expect.stringMatching(/git\+|(\d+)\.(\d+)\.(\d+)/),
			'superfly-timeline': expect.stringMatching(/git\+|(\d+)\.(\d+)\.(\d+)/),
			'timeline-state-resolver-types': expect.stringMatching(/git\+|(\d+)\.(\d+)\.(\d+)/),
		})
	})
})
