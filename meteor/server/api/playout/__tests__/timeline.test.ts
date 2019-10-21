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
import { RundownPlaylists } from '../../../../lib/collections/RundownPlaylists'

describe('Timeline', () => {
	let env: DefaultEnvironment
	beforeEach(() => {
		env = setupDefaultStudioEnvironment()
	})
	testInFiber('non-existing studio', () => {
		expect(() => {
			updateTimeline('asdf')
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
			return RundownPlaylists.findOne(playlistId0)
		}
		expect(getRundown0()).toBeTruthy()
		expect(getPlaylist0()).toBeTruthy()

		const parts = getRundown0().getParts()

		expect(getPlaylist0()).toMatchObject({
			active: false,
			rehearsal: false
		})

		// Prepare and activate in rehersal:
		ServerPlayoutAPI.activateRundown(playlistId0, false)
		expect(getPlaylist0()).toMatchObject({
			active: true,
			rehearsal: false,
			currentPartId: null,
			nextPartId: parts[0]._id,
		})

		// Take the first Part:
		ServerPlayoutAPI.takeNextPart(playlistId0)
		expect(getPlaylist0()).toMatchObject({
			currentPartId: parts[0]._id,
			nextPartId: parts[1]._id,
		})

		updateTimeline(getRundown0().studioId)

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()

		const currentTime = 100 * 1000
		updateTimeline(getRundown0().studioId, currentTime)

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()

		// Deactivate rundown:
		ServerPlayoutAPI.deactivateRundown(playlistId0)
		expect(getPlaylist0()).toMatchObject({
			active: false,
			currentPartId: null,
			nextPartId: null
		})

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
	})
})
