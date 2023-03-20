import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment } from '../../../../__mocks__/helpers/database'
import { RESTART_SALT } from '../../../../lib/api/userActions'
import { getCurrentTime, getHash } from '../../../../lib/lib'
import { MeteorCall } from '../../../../lib/api/methods'
import { ClientAPI } from '../../../../lib/api/client'
import { UserActionsLog } from '../../../collections'

require('../../client') // include in order to create the Meteor methods needed
require('../../userActions') // include in order to create the Meteor methods needed

describe('User Actions - General', () => {
	beforeEach(async () => {
		await setupDefaultStudioEnvironment()
	})

	testInFiber('Restart Core', async () => {
		jest.useFakeTimers()

		// Generate restart token
		const res = (await MeteorCall.userAction.generateRestartToken(
			'e',
			getCurrentTime()
		)) as ClientAPI.ClientResponseSuccess<string>
		expect(res).toMatchObject({ success: 200 })
		expect(typeof res.result).toBe('string')

		const mockExit = jest.spyOn(process, 'exit').mockImplementation()

		// Use an invalid token to try and restart it
		await expect(
			MeteorCall.userAction.restartCore('e', getCurrentTime(), 'invalidToken')
		).resolves.toMatchUserRawError(/Restart token is invalid/)

		await expect(
			MeteorCall.userAction.restartCore('e', getCurrentTime(), getHash(RESTART_SALT + res.result))
		).resolves.toMatchObject({
			success: 200,
		})

		jest.runAllTimers()

		expect(mockExit).toHaveBeenCalledTimes(1)
		jest.useRealTimers()
	})

	testInFiber('GUI Status', async () => {
		await expect(MeteorCall.userAction.guiFocused('click', getCurrentTime())).resolves.toMatchObject({
			success: 200,
		})
		const logs0 = await UserActionsLog.findFetchAsync({
			method: 'guiFocused',
		})
		expect(logs0).toHaveLength(1)
		// expect(logs0[0]).toMatchObject({
		// 	context: 'mousedown',
		// 	args: JSON.stringify([ [ 'dummyClientData' ] ])
		// })
		await expect(MeteorCall.userAction.guiBlurred('click', getCurrentTime())).resolves.toMatchObject({
			success: 200,
		})
		const logs1 = await UserActionsLog.findFetchAsync({
			method: 'guiBlurred',
		})
		expect(logs1).toHaveLength(1)
		// expect(logs1[0]).toMatchObject({
		// 	context: 'interval',
		// 	args: JSON.stringify([ [ 'dummyClientData' ] ])
		// })
	})
})
