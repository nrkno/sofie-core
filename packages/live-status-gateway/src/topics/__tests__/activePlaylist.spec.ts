import { ActivePlaylistStatus, ActivePlaylistTopic } from '../activePlaylistTopic'
import { makeMockLogger, makeMockSubscriber, makeTestPlaylist, makeTestShowStyleBase } from './utils'
import { PlaylistHandler } from '../../collections/playlistHandler'
import { ShowStyleBaseHandler } from '../../collections/showStyleBaseHandler'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { PartInstancesHandler, SelectedPartInstances } from '../../collections/partInstancesHandler'
import { protectString, unprotectString, unprotectStringArray } from '@sofie-automation/server-core-integration/dist'
import { PartialDeep } from 'type-fest'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartsHandler } from '../../collections/partsHandler'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PieceInstancesHandler, SelectedPieceInstances } from '../../collections/pieceInstancesHandler'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

function makeEmptyTestPartInstances(): SelectedPartInstances {
	return {
		current: undefined,
		firstInSegmentPlayout: undefined,
		inCurrentSegment: [],
		next: undefined,
	}
}

function makeTestPartInstances(currentPartInstanceId: string): PartialDeep<SelectedPartInstances> {
	const part1: Partial<DBPart> = {
		_id: protectString('PART_1'),
		title: 'Test Part',
		segmentId: protectString('SEGMENT_1'),
		expectedDurationWithPreroll: 10000,
		expectedDuration: 10000,
	}
	const testPartInstances: PartialDeep<SelectedPartInstances> = {
		current: {
			_id: currentPartInstanceId,
			part: part1,
			timings: { plannedStartedPlayback: 1600000060000 },
		},
		firstInSegmentPlayout: {},
		inCurrentSegment: [
			literal<PartialDeep<DBPartInstance>>({
				_id: protectString(currentPartInstanceId),
				part: part1,
				timings: { plannedStartedPlayback: 1600000060000 },
			}),
		] as DBPartInstance[],
	}
	return testPartInstances
}

describe('ActivePlaylistTopic', () => {
	it('notifies subscribers', async () => {
		const topic = new ActivePlaylistTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		await topic.update(PlaylistHandler.name, playlist)

		const testShowStyleBase = makeTestShowStyleBase()
		await topic.update(ShowStyleBaseHandler.name, testShowStyleBase as DBShowStyleBase)

		const testPartInstancesMap = makeEmptyTestPartInstances()
		await topic.update(PartInstancesHandler.name, testPartInstancesMap)

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: ActivePlaylistStatus = {
			event: 'activePlaylist',
			name: playlist.name,
			id: unprotectString(playlist._id),
			currentPart: null,
			nextPart: null,
			currentSegment: null,
			rundownIds: unprotectStringArray(playlist.rundownIdsInOrder),
			activePieces: [],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(expectedStatus)
	})

	it('provides segment and part', async () => {
		const topic = new ActivePlaylistTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		const currentPartInstanceId = 'CURRENT_PART_INSTANCE_ID'

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		playlist.currentPartInfo = {
			consumesQueuedSegmentId: false,
			manuallySelected: false,
			partInstanceId: protectString(currentPartInstanceId),
			rundownId: playlist.rundownIdsInOrder[0],
		}
		await topic.update(PlaylistHandler.name, playlist)

		const testShowStyleBase = makeTestShowStyleBase()
		await topic.update(ShowStyleBaseHandler.name, testShowStyleBase as DBShowStyleBase)
		const part1: Partial<DBPart> = {
			_id: protectString('PART_1'),
			title: 'Test Part',
			segmentId: protectString('SEGMENT_1'),
			expectedDurationWithPreroll: 10000,
			expectedDuration: 10000,
		}
		const testPartInstances: PartialDeep<SelectedPartInstances> = {
			current: {
				_id: currentPartInstanceId,
				part: part1,
				timings: { plannedStartedPlayback: 1600000060000 },
			},
			firstInSegmentPlayout: {},
			inCurrentSegment: [
				literal<PartialDeep<DBPartInstance>>({
					_id: protectString(currentPartInstanceId),
					part: part1,
					timings: { plannedStartedPlayback: 1600000060000 },
				}),
			] as DBPartInstance[],
		}
		await topic.update(PartInstancesHandler.name, testPartInstances as SelectedPartInstances)

		await topic.update(PartsHandler.name, [part1] as DBPart[])

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: ActivePlaylistStatus = {
			event: 'activePlaylist',
			name: playlist.name,
			id: unprotectString(playlist._id),
			currentPart: {
				id: 'PART_1',
				name: 'Test Part',
				segmentId: 'SEGMENT_1',
				timing: { startTime: 1600000060000, expectedDurationMs: 10000, expectedEndTime: 1600000070000 },
				pieces: [],
			},
			nextPart: null,
			currentSegment: {
				id: 'SEGMENT_1',
				timing: {
					expectedDurationMs: 10000,
					expectedEndTime: 1600000070000,
				},
			},
			rundownIds: unprotectStringArray(playlist.rundownIdsInOrder),
			activePieces: [],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(expectedStatus)
	})

	it('provides active pieces', async () => {
		const topic = new ActivePlaylistTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		const currentPartInstanceId = 'CURRENT_PART_INSTANCE_ID'

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		playlist.currentPartInfo = {
			consumesQueuedSegmentId: false,
			manuallySelected: false,
			partInstanceId: protectString(currentPartInstanceId),
			rundownId: playlist.rundownIdsInOrder[0],
		}
		await topic.update(PlaylistHandler.name, playlist)

		const testPartInstances = makeTestPartInstances(currentPartInstanceId)
		await topic.update(PartInstancesHandler.name, testPartInstances as SelectedPartInstances)

		const testShowStyleBase = makeTestShowStyleBase()
		await topic.update(ShowStyleBaseHandler.name, testShowStyleBase as DBShowStyleBase)

		const testPieceInstances: PartialDeep<SelectedPieceInstances> = {
			currentPartInstance: [],
			nextPartInstance: [],
			active: [
				literal<PartialDeep<PieceInstance>>({
					_id: protectString('PIECE_1'),
					piece: {
						name: 'Piece 1',
						outputLayerId: 'pgm',
						sourceLayerId: 'layer0',
						tags: ['my_tag'],
					},
				}),
			] as PieceInstance[],
		}
		await topic.update(PieceInstancesHandler.name, testPieceInstances as SelectedPieceInstances)

		await topic.update(PartsHandler.name, [testPartInstances.current!.part] as DBPart[])

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: Partial<ActivePlaylistStatus> = {
			event: 'activePlaylist',
			name: playlist.name,
			id: unprotectString(playlist._id),
			nextPart: null,
			rundownIds: unprotectStringArray(playlist.rundownIdsInOrder),
			activePieces: [
				{
					id: 'PIECE_1',
					name: 'Piece 1',
					sourceLayer: 'Layer 0',
					outputLayer: 'PGM',
					tags: ['my_tag'],
				},
			],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(expectedStatus)
	})
})
