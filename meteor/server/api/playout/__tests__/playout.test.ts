import { Meteor } from 'meteor/meteor'
import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { fixSnapshot } from '../../../../__mocks__/helpers/snapshot'
import { mockupCollection } from '../../../../__mocks__/helpers/lib'
import { setupDefaultStudioEnvironment, DefaultEnvironment, setupDefaultRundown } from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import '../api'
import { Timeline as OrgTimeline } from '../../../../lib/collections/Timeline'
import { ServerPlayoutAPI } from '../playout'
import { deactivate } from '../../userActions'

const Timeline = mockupCollection(OrgTimeline)

describe('Playout API', () => {
	let env: DefaultEnvironment
	beforeEach(() => {
		env = setupDefaultStudioEnvironment()
	})
	testInFiber('Basic rundown control', () => {
		const rundownId0 = setupDefaultRundown(env)
		expect(rundownId0).toBeTruthy()

		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const parts = getRundown0().getParts()

		expect(getRundown0()).toMatchObject({
			active: false,
			rehearsal: false
		})

		expect(Timeline.insert).not.toHaveBeenCalled()
		expect(Timeline.upsert).not.toHaveBeenCalled()
		expect(Timeline.update).not.toHaveBeenCalled()

		// Prepare and activate in rehersal:
		ServerPlayoutAPI.activateRundown(rundownId0, false)
		expect(getRundown0()).toMatchObject({
			active: true,
			rehearsal: false,
			currentPartId: null,
			nextPartId: parts[0]._id,
		})

		expect(Timeline.insert).toHaveBeenCalled()
		expect(Timeline.upsert).toHaveBeenCalled()
		expect(Timeline.update).toHaveBeenCalled()
		Timeline.mockClear()

		// Take the first Part:
		ServerPlayoutAPI.takeNextPart(rundownId0)
		expect(getRundown0()).toMatchObject({
			currentPartId: parts[0]._id,
			nextPartId: parts[1]._id,
		})

		expect(Timeline.insert).toHaveBeenCalled()
		expect(Timeline.upsert).toHaveBeenCalled()
		expect(Timeline.update).toHaveBeenCalled()
		Timeline.mockClear()

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
		expect(fixSnapshot(getRundown0())).toMatchSnapshot()


		// Deactivate rundown:
		ServerPlayoutAPI.deactivateRundown(rundownId0)
		expect(getRundown0()).toMatchObject({
			active: false,
			currentPartId: null,
			nextPartId: null
		})

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
		expect(fixSnapshot(getRundown0())).toMatchSnapshot()

		expect(Timeline.insert).toHaveBeenCalled()
		expect(Timeline.upsert).toHaveBeenCalled()
		expect(Timeline.update).toHaveBeenCalled()
	})
})
