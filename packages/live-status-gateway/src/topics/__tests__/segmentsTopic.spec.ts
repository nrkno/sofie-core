import { mock } from 'jest-mock-extended'
import { SegmentsStatus, SegmentsTopic } from '../segmentsTopic'
import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { PlaylistHandler } from '../../collections/playlist'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { protectString, unprotectString } from '@sofie-automation/server-core-integration'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { SegmentsHandler } from '../../collections/segmentsHandler'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

function makeMockLogger() {
	return mock<Logger>()
}

// TODO: this should not have to mock a WebSocket, refactor topic to be unaware of underlying transport (WebSocketTopic -> RealtimeTopic)
function makeMockSubscriber() {
	return mock<WebSocket>()
}

const RUNDOWN_1_ID = 'RUNDOWN_1'
const RUNDOWN_2_ID = 'RUNDOWN_2'

function makeTestSegment(id: string, rank: number, rundownId: string): DBSegment {
	return {
		_id: protectString(id),
		externalId: `NCS_SEGMENT_${id}`,
		name: `Segment ${id}`,
		_rank: rank,
		rundownId: protectString(rundownId),
		externalModified: 1695799420147,
	}
}

function makeTestPlaylist(id?: string): DBRundownPlaylist {
	return {
		_id: protectString(id ?? 'PLAYLIST_1'),
		created: 1695799420147,
		externalId: 'NCS_PLAYLIST_1',
		currentPartInfo: null,
		modified: 1695799420147,
		name: 'My Playlist',
		nextPartInfo: null,
		previousPartInfo: null,
		rundownIdsInOrder: [protectString(RUNDOWN_1_ID), protectString(RUNDOWN_2_ID)],
		studioId: protectString('STUDIO_1'),
		timing: { type: PlaylistTimingType.None },
	}
}

describe('SegmentsTopic', () => {
	it('notifies added subscribers immediately', async () => {
		const topic = new SegmentsTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: SegmentsStatus = {
			event: 'segments',
			rundownPlaylistId: null,
			segments: [],
		}
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus)]])
		mockSubscriber.send.mockClear()
	})

	it('notifies subscribers when playlist changes from null', async () => {
		const topic = new SegmentsTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		const testPlaylist = makeTestPlaylist()
		await topic.update(PlaylistHandler.name, testPlaylist)

		const expectedStatus: SegmentsStatus = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist._id),
			segments: [],
		}
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus)]])
	})

	it('notifies subscribers when playlist id changes', async () => {
		const topic = new SegmentsTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		const testPlaylist = makeTestPlaylist()
		await topic.update(PlaylistHandler.name, testPlaylist)

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		const testPlaylist2 = makeTestPlaylist('PLAYLIST_2')
		await topic.update(PlaylistHandler.name, testPlaylist2)

		const expectedStatus2: SegmentsStatus = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist2._id),
			segments: [],
		}
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus2)]])
	})

	it('does not notify subscribers when an unimportant property of the playlist changes', async () => {
		const topic = new SegmentsTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		const testPlaylist = makeTestPlaylist()
		await topic.update(PlaylistHandler.name, testPlaylist)

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		const testPlaylist2 = makeTestPlaylist()
		testPlaylist2.currentPartInfo = {
			partInstanceId: protectString('PI_1'),
			consumesNextSegmentId: true,
			manuallySelected: false,
			rundownId: protectString(RUNDOWN_1_ID),
		}
		testPlaylist2.name = 'Another Playlist'
		testPlaylist2.startedPlayback = Date.now()
		// ... this is enough to prove that it works as expected

		await topic.update(PlaylistHandler.name, testPlaylist2)

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(0)
	})

	it('notifies subscribers when segments change', async () => {
		const topic = new SegmentsTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		const testPlaylist = makeTestPlaylist()
		await topic.update(PlaylistHandler.name, testPlaylist)

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		await topic.update(SegmentsHandler.name, [
			makeTestSegment('2_1', 1, RUNDOWN_2_ID),
			makeTestSegment('2_2', 2, RUNDOWN_2_ID),
			makeTestSegment('1_2', 2, RUNDOWN_1_ID),
			makeTestSegment('1_1', 1, RUNDOWN_1_ID),
		])

		const expectedStatus: SegmentsStatus = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist._id),
			segments: [
				{ id: '1_1', rundownId: RUNDOWN_1_ID, name: 'Segment 1_1' },
				{ id: '1_2', rundownId: RUNDOWN_1_ID, name: 'Segment 1_2' },
				{ id: '2_1', rundownId: RUNDOWN_2_ID, name: 'Segment 2_1' },
				{ id: '2_2', rundownId: RUNDOWN_2_ID, name: 'Segment 2_2' },
			],
		}
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus)]])
	})

	it('notifies subscribers when rundown order changes', async () => {
		const topic = new SegmentsTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		const testPlaylist = makeTestPlaylist()
		await topic.update(PlaylistHandler.name, testPlaylist)
		await topic.update(SegmentsHandler.name, [
			makeTestSegment('2_1', 1, RUNDOWN_2_ID),
			makeTestSegment('2_2', 2, RUNDOWN_2_ID),
			makeTestSegment('1_2', 2, RUNDOWN_1_ID),
			makeTestSegment('1_1', 1, RUNDOWN_1_ID),
		])

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		const testPlaylist2 = makeTestPlaylist()
		testPlaylist2.rundownIdsInOrder = [protectString(RUNDOWN_2_ID), protectString(RUNDOWN_1_ID)]
		await topic.update(PlaylistHandler.name, testPlaylist2)

		const expectedStatus: SegmentsStatus = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist._id),
			segments: [
				{ id: '2_1', rundownId: RUNDOWN_2_ID, name: 'Segment 2_1' },
				{ id: '2_2', rundownId: RUNDOWN_2_ID, name: 'Segment 2_2' },
				{ id: '1_1', rundownId: RUNDOWN_1_ID, name: 'Segment 1_1' },
				{ id: '1_2', rundownId: RUNDOWN_1_ID, name: 'Segment 1_2' },
			],
		}
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus)]])
	})
})
