import { Meteor } from 'meteor/meteor'
import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { fixSnapshot } from '../../../../__mocks__/helpers/snapshot'
import { mockupCollection } from '../../../../__mocks__/helpers/lib'
import { setupDefaultStudioEnvironment, DefaultEnvironment, setupDefaultRundownPlaylist } from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import '../api'
import { Timeline as OrgTimeline } from '../../../../lib/collections/Timeline'
import { ServerPlayoutAPI } from '../playout'
import { deactivate } from '../../userActions'
import { RundownPlaylists } from '../../../../lib/collections/RundownPlaylists'

const Timeline = mockupCollection(OrgTimeline)

describe('Playout API', () => {
	let env: DefaultEnvironment
	beforeEach(() => {
		env = setupDefaultStudioEnvironment()
	})
	testInFiber('Basic rundown control', () => {
		const {
			rundownId: rundownId0,
			playlistId: playlistId0
		} = setupDefaultRundownPlaylist(env)
		expect(rundownId0).toBeTruthy()
		expect(playlistId0).toBeTruthy()

		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const getPlaylist0 = () => {
			return RundownPlaylists.findOne(playlistId0)
		}
		const parts = getRundown0().getParts()

		expect(getPlaylist0()).toMatchObject({
			active: false,
			rehearsal: false
		})

		expect(Timeline.insert).not.toHaveBeenCalled()
		expect(Timeline.upsert).not.toHaveBeenCalled()
		expect(Timeline.update).not.toHaveBeenCalled()

		// Prepare and activate in rehersal:
		ServerPlayoutAPI.activateRundown(playlistId0, false)
		expect(getPlaylist0()).toMatchObject({
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
		ServerPlayoutAPI.takeNextPart(playlistId0)
		expect(getPlaylist0()).toMatchObject({
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
		ServerPlayoutAPI.deactivateRundown(playlistId0)
		expect(getPlaylist0()).toMatchObject({
			active: false,
			currentPartId: null,
			nextPartId: null
		})

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
		expect(fixSnapshot(getPlaylist0())).toMatchSnapshot()
		expect(fixSnapshot(getRundown0())).toMatchSnapshot()

		expect(Timeline.insert).toHaveBeenCalled()
		expect(Timeline.upsert).toHaveBeenCalled()
		expect(Timeline.update).toHaveBeenCalled()
	})
})
