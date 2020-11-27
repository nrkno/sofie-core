import { getRelevantSystemVersions } from '../coreSystem'

describe('coreSystem', () => {
	test('getRelevantSystemVersions', () => {
		const versions = getRelevantSystemVersions()

		expect(versions).toMatchObject({
			core: expect.stringMatching(/git\+|(\d+)\.(\d+)\.(\d+)/),
			'superfly-timeline': expect.stringMatching(/git\+|(\d+)\.(\d+)\.(\d+)/),
			'timeline-state-resolver-types': expect.stringMatching(/git\+|(\d+)\.(\d+)\.(\d+)/),
			'tv-automation-sofie-blueprints-integration': expect.stringMatching(/git\+|(\d+)\.(\d+)\.(\d+)/),
		})
	})
})
