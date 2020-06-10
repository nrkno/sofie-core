import { getRelevantSystemVersions } from '../coreSystem'

describe('coreSystem', () => {
	test('getRelevantSystemVersions', () => {
		const versions = getRelevantSystemVersions()

		expect(versions).toMatchObject({
			core: expect.stringMatching(/(\d+)\.(\d+)\.(\d+)/),
			'superfly-timeline': expect.stringMatching(/(\d+)\.(\d+)\.(\d+)/),
			'timeline-state-resolver-types': expect.stringMatching(/(\d+)\.(\d+)\.(\d+)/),
			'tv-automation-sofie-blueprints-integration': expect.stringMatching(/(\d+)\.(\d+)\.(\d+)/),
		})
	})
})
