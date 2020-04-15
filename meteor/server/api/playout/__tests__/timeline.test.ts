import { Meteor } from 'meteor/meteor'
import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { fixSnapshot } from '../../../../__mocks__/helpers/snapshot'
import { setupDefaultStudioEnvironment, DefaultEnvironment, setupDefaultRundownPlaylist } from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import '../api'
import { Timeline } from '../../../../lib/collections/Timeline'
import { ServerPlayoutAPI } from '../playout'
import { updateTimeline } from '../timeline'
import { RundownPlaylists, RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { PartInstances } from '../../../../lib/collections/PartInstances'
import { protectString } from '../../../../lib/lib'
import { MethodContext } from '../../../../lib/api/methods'

const DEFAULT_CONTEXT: MethodContext = {}

describe('Timeline', () => {
	let env: DefaultEnvironment
	beforeEach(() => {
		env = setupDefaultStudioEnvironment()
	})
	testInFiber('non-existing studio', () => {
		expect(() => {
			updateTimeline(protectString('asdf'))
		}).toThrowError(/not found/i)
	})
	testInFiber('Basic rundown', () => {
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
			return RundownPlaylists.findOne(playlistId0) as RundownPlaylist
		}
		expect(getRundown0()).toBeTruthy()
		expect(getPlaylist0()).toBeTruthy()

		const parts = getRundown0().getParts()

		expect(getPlaylist0()).toMatchObject({
			active: false,
			rehearsal: false
		})

		{
			// Prepare and activate in rehersal:
			ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_CONTEXT, playlistId0, false)
			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeFalsy()
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance!.part._id).toEqual(parts[0]._id)
			expect(getPlaylist0()).toMatchObject({
				active: true,
				rehearsal: false,
				currentPartInstanceId: null,
				// nextPartInstanceId: parts[0]._id,
			})
		}

		{
			// Take the first Part:
			ServerPlayoutAPI.takeNextPart(DEFAULT_CONTEXT, playlistId0)
			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
			// expect(getPlaylist0()).toMatchObject({
			// 	currentPartInstanceId: parts[0]._id,
			// 	nextPartInstanceId: parts[1]._id,
			// })
		}

		updateTimeline(getRundown0().studioId)

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()

		const currentTime = 100 * 1000
		updateTimeline(getRundown0().studioId, currentTime)

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()

		{
			// Deactivate rundown:
			ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_CONTEXT, playlistId0)
			expect(getPlaylist0()).toMatchObject({
				active: false,
				currentPartInstanceId: null,
				nextPartInstanceId: null
			})
		}

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
	})
})
