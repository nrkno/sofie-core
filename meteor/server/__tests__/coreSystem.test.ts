
import { getRelevantSystemVersions } from '../coreSystem'

jest.mock('meteor/random', require('../../__mocks__/random').setup, { virtual: true })
jest.mock('meteor/meteorhacks:picker', require('../../__mocks__/meteorhacks-picker').setup, { virtual: true })
jest.mock('meteor/mongo', require('../../__mocks__/mongo').setup, { virtual: true })

describe('coreSystem', () => {

	test('getRelevantSystemVersions', () => {

		const versions = getRelevantSystemVersions()

		expect(versions).toMatchObject({
			'core': 									expect.stringMatching(/(\d+)\.(\d+)\.(\d+)/),
			'superfly-timeline':						expect.stringMatching(/(\d+)\.(\d+)\.(\d+)/),
			'timeline-state-resolver-types': 			expect.stringMatching(/(\d+)\.(\d+)\.(\d+)/),
			'tv-automation-sofie-blueprints-integration': expect.stringMatching(/(\d+)\.(\d+)\.(\d+)/)
		})
	})
})
