import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment } from '../../../../__mocks__/helpers/database'
import { RESTART_SALT } from '../../../../lib/api/userActions'
import { getHash } from '../../../../lib/lib'
import { UserActionsLog } from '../../../../lib/collections/UserActionsLog'
import { MeteorCall } from '../../../../lib/api/methods'
import { ClientAPI } from '../../../../lib/api/client'

require('../../client') // include in order to create the Meteor methods needed
require('../../userActions') // include in order to create the Meteor methods needed

describe('User Actions - General', () => {
	beforeEach(async () => {
		await setupDefaultStudioEnvironment()
	})

	testInFiber('Restart Core', async () => {
		jest.useFakeTimers()

		// Generate restart token
		const res = (await MeteorCall.userAction.generateRestartToken('e')) as ClientAPI.ClientResponseSuccess<string>
		expect(res).toMatchObject({ success: 200 })
		expect(typeof res.result).toBe('string')

		const mockExit = jest.spyOn(process, 'exit').mockImplementation()

		// Use an invalid token to try and restart it
		await expect(MeteorCall.userAction.restartCore('e', 'invalidToken')).resolves.toMatchUserRawError(
			/Restart token is invalid/
		)

		await expect(MeteorCall.userAction.restartCore('e', getHash(RESTART_SALT + res.result))).resolves.toMatchObject(
			{
				success: 200,
			}
		)

		jest.runAllTimers()

		expect(mockExit).toHaveBeenCalledTimes(1)
		jest.useRealTimers()
	})

	testInFiber('GUI Status', async () => {
		await expect(MeteorCall.userAction.guiFocused('click')).resolves.toMatchObject({ success: 200 })
		const logs0 = UserActionsLog.find({
			method: 'guiFocused',
		}).fetch()
		expect(logs0).toHaveLength(1)
		// expect(logs0[0]).toMatchObject({
		// 	context: 'mousedown',
		// 	args: JSON.stringify([ [ 'dummyClientData' ] ])
		// })
		await expect(MeteorCall.userAction.guiBlurred('click')).resolves.toMatchObject({ success: 200 })
		const logs1 = UserActionsLog.find({
			method: 'guiBlurred',
		}).fetch()
		expect(logs1).toHaveLength(1)
		// expect(logs1[0]).toMatchObject({
		// 	context: 'interval',
		// 	args: JSON.stringify([ [ 'dummyClientData' ] ])
		// })
	})
})
