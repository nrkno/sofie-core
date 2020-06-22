import { Meteor } from 'meteor/meteor'
import '../../../__mocks__/_extendJest'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
} from '../../../__mocks__/helpers/database'
import { getHash, waitForPromise, protectString } from '../../../lib/lib'
import { ClientAPI } from '../../../lib/api/client'
import { UserActionsLog } from '../../../lib/collections/UserActionsLog'
import { MeteorCall } from '../../../lib/api/methods'
import { RundownLayoutType, RundownLayouts } from '../../../lib/collections/RundownLayouts'

require('../client') // include in order to create the Meteor methods needed
require('../rundownLayouts') // include in order to create the Meteor methods needed

enum RundownLayoutsAPIMethods { // Using our own method definition, to catch external API changes
	'removeRundownLayout' = 'rundownLayout.removeRundownLayout',
	'createRundownLayout' = 'rundownLayout.createRundownLayout',
}

describe('Rundown Layouts', () => {
	let env: DefaultEnvironment
	beforeAll(() => {
		env = setupDefaultStudioEnvironment()
	})
	let rundownLayoutId: string
	testInFiber('Create rundown layout', () => {
		const res = Meteor.call(
			RundownLayoutsAPIMethods.createRundownLayout,
			'Test',
			RundownLayoutType.RUNDOWN_LAYOUT,
			env.showStyleBaseId
		)
		expect(typeof res).toBe('string') // this should contain the ID for the rundown layout
		rundownLayoutId = res

		const item = RundownLayouts.findOne(protectString(rundownLayoutId))
		expect(item).toMatchObject({
			_id: rundownLayoutId,
		})
	})
	testInFiber('Remove rundown layout', () => {
		const item0 = RundownLayouts.findOne(protectString(rundownLayoutId))
		expect(item0).toMatchObject({
			_id: rundownLayoutId,
		})

		const res = Meteor.call(RundownLayoutsAPIMethods.removeRundownLayout, rundownLayoutId)

		const item1 = RundownLayouts.findOne(protectString(rundownLayoutId))
		expect(item1).toBeUndefined()
	})
})
