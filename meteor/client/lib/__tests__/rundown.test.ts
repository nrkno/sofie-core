import { RundownPlaylistId, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import {
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupDefaultStudioEnvironment,
} from '../../../__mocks__/helpers/database'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { RundownUtils } from '../rundown'

describe('client/lib/rundown', () => {
	let env: DefaultEnvironment
	let playlistId: RundownPlaylistId
	beforeAll(() => {
		env = setupDefaultStudioEnvironment()
		playlistId = setupDefaultRundownPlaylist(env).playlistId
	})
	testInFiber('RundownUtils.getResolvedSegment', () => {
		const showStyleBase = env.showStyleBase
		const playlist = RundownPlaylists.findOne(playlistId)
		if (!playlist) throw new Error('Rundown not found')

		const segments = playlist.getSegments()
		const parts = playlist.getAllOrderedParts()
		const segment = segments[0]
		const nextSegment = segments[1]

		const resolvedSegment = RundownUtils.getResolvedSegment(
			showStyleBase,
			playlist,
			segment,
			new Set(segments.slice(0, 0).map((segment) => segment._id)),
			parts.map((part) => part._id)
		)
		expect(resolvedSegment).toBeTruthy()
		expect(resolvedSegment.parts).toHaveLength(2)
		expect(resolvedSegment).toMatchObject({
			// segmentExtended: SegmentExtended,
			// parts: Array<PartExtended>,
			isLiveSegment: false,
			isNextSegment: false,
			currentLivePart: undefined,
			currentNextPart: undefined,
			hasRemoteItems: false,
			hasGuestItems: false,
			hasAlreadyPlayed: false,
			autoNextPart: false,
		})
		expect(resolvedSegment).toMatchSnapshot()
	})
})
