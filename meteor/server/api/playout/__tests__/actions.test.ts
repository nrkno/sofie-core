import { Meteor } from 'meteor/meteor'
import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { mockupCollection } from '../../../../__mocks__/helpers/lib'
import { setupDefaultStudioEnvironment, DefaultEnvironment, setupDefaultRundown, setupMockPeripheralDevice } from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import '../api'
import { Timeline as OrgTimeline } from '../../../../lib/collections/Timeline'
import { activateRundown, prepareStudioForBroadcast } from '../actions'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { PeripheralDeviceCommands } from '../../../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import * as _ from 'underscore'

// const Timeline = mockupCollection(OrgTimeline)

describe('Playout Actions', () => {
	let env: DefaultEnvironment
	let playoutDevice: PeripheralDevice

	function getPeripheralDeviceCommands (playoutDevice: PeripheralDevice) {
		return PeripheralDeviceCommands.find({ deviceId: playoutDevice._id }, { sort: { time: 1 } }).fetch()
	}
	function clearPeripheralDeviceCommands (playoutDevice: PeripheralDevice) {
		return PeripheralDeviceCommands.remove({ deviceId: playoutDevice._id })
	}

	beforeEach(() => {
		env = setupDefaultStudioEnvironment()

		playoutDevice = setupMockPeripheralDevice(
			PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
			PeripheralDeviceAPI.DeviceType.PLAYOUT,
			PeripheralDeviceAPI.SUBTYPE_PROCESS,
			env.studio
		)

		_.each(Rundowns.find().fetch(),rundown => rundown.remove())
	})
	testInFiber('activateRundown', () => {
		const rundownId0 = setupDefaultRundown(env, 'ro0')
		expect(rundownId0).toBeTruthy()

		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}

		const rundownId1 = setupDefaultRundown(env, 'ro1')
		expect(rundownId1).toBeTruthy()

		const getRundown1 = () => {
			return Rundowns.findOne(rundownId1) as Rundown
		}

		const rundownId2 = setupDefaultRundown(env, 'ro2')
		expect(rundownId2).toBeTruthy()

		const rundownRemoved = Rundowns.findOne(rundownId2) as Rundown
		Rundowns.remove(rundownId2)

		// Activating a rundown that doesn't exist:
		expect(() => {
			activateRundown(rundownRemoved, false)
		}).toThrowError(/not found/)

		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(0)
		// Activating a rundown, to rehearsal
		activateRundown(getRundown0(), true)
		expect(getRundown0()).toMatchObject({ active: true, rehearsal: true })

		// Activating a rundown
		activateRundown(getRundown0(), false)
		expect(getRundown0()).toMatchObject({ active: true, rehearsal: false })

		// Activating a rundown, back to rehearsal
		activateRundown(getRundown0(), true)
		expect(getRundown0()).toMatchObject({ active: true, rehearsal: true })

		// Activating another rundown
		expect(() => {
			activateRundown(getRundown1(), false)
		}).toThrowError(/only one rundown can be active/i)
	})
	testInFiber('prepareStudioForBroadcast', () => {
		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(0)

		// prepareStudioForBroadcast
		prepareStudioForBroadcast(env.studio)

		expect(getPeripheralDeviceCommands(playoutDevice)).toHaveLength(1)
		expect(getPeripheralDeviceCommands(playoutDevice)[0]).toMatchObject({
			functionName: 'devicesMakeReady'
		})
	})
})
