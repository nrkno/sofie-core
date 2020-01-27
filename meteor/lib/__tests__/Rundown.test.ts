import { testInFiber } from '../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment, DefaultEnvironment, setupDefaultRundownPlaylist } from '../../__mocks__/helpers/database'
import { getResolvedSegment } from '../Rundown'
import { RundownPlaylists } from '../collections/RundownPlaylists';


describe('lib/Rundown', () => {
	let env: DefaultEnvironment
	let playlistId: string
	beforeAll(() => {
		env = setupDefaultStudioEnvironment()
		playlistId = setupDefaultRundownPlaylist(env).playlistId
	})
	testInFiber('getResolvedSegment', () => {

		const showStyleBase = env.showStyleBase
		const playlist = RundownPlaylists.findOne(playlistId)
		if (!playlist) throw new Error('Rundown not found')

		const segments = playlist.getSegments()
		const segment = segments[0]
		const nextSegment = segments[1]

		const resolvedSegment = getResolvedSegment(
			showStyleBase,
			playlist,
			segment,
			true
		)
		expect(resolvedSegment).toBeTruthy()
		expect(resolvedSegment.parts).toHaveLength(2)
		expect(resolvedSegment).toMatchObject({
			// segmentExtended: SegmentExtended,
			// parts: Array<PartExtended>,
			isLiveSegment: false,
			isNextSegment: false,
			currentLivePart: undefined,
			hasRemoteItems: false,
			hasGuestItems: false,
			hasAlreadyPlayed: false,
			autoNextPart: false,
			followingPart: nextSegment.getParts()[0]
		})
		expect(resolvedSegment).toMatchSnapshot()
	})
})
