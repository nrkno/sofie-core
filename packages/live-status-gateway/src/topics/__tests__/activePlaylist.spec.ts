import { ActivePlaylistStatus, ActivePlaylistTopic } from '../activePlaylistTopic'
import { makeMockLogger, makeMockSubscriber, makeTestPlaylist } from './utils'
import { PlaylistHandler } from '../../collections/playlistHandler'
import { ShowStyleBaseHandler } from '../../collections/showStyleBaseHandler'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { SourceLayerType } from '@sofie-automation/blueprints-integration/dist'
import { PartInstancesHandler, SelectedPartInstances } from '../../collections/partInstancesHandler'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { protectString, unprotectString, unprotectStringArray } from '@sofie-automation/server-core-integration/dist'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { AdLibActionsHandler } from '../../collections/adLibActionsHandler'
import { GlobalAdLibActionsHandler } from '../../collections/globalAdLibActionsHandler'
import { PartialDeep } from 'type-fest'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartsHandler } from '../../collections/partsHandler'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'

function makeTestShowStyleBase(): Pick<DBShowStyleBase, 'sourceLayersWithOverrides' | 'outputLayersWithOverrides'> {
	return {
		sourceLayersWithOverrides: {
			defaults: { layer0: { _id: 'layer0', name: 'Layer 0', _rank: 0, type: SourceLayerType.VT } },
			overrides: [],
		},
		outputLayersWithOverrides: {
			defaults: { pgm: { _id: 'pgm', name: 'PGM', _rank: 0, isPGM: true } },
			overrides: [],
		},
	}
}

function makeTestPartInstanceMap(): SelectedPartInstances {
	return {
		current: undefined,
		firstInSegmentPlayout: undefined,
		inCurrentSegment: [],
		next: undefined,
	}
}

function makeTestAdLibActions(): AdLibAction[] {
	return [
		{
			_id: protectString('ACTION_0'),
			actionId: 'ACTION_0',
			partId: protectString('part0'),
			rundownId: protectString('RUNDOWN_0'),
			display: {
				content: {},
				label: { key: 'An Action' },
				sourceLayerId: 'layer0',
				outputLayerId: 'pgm',
				tags: ['adlib_tag'],
			},
			externalId: 'NCS_ACTION_0',
			userData: {},
			userDataManifest: {},
		},
	]
}

function makeTestGlobalAdLibActions(): RundownBaselineAdLibAction[] {
	return [
		{
			_id: protectString('GLOBAL_ACTION_0'),
			actionId: 'GLOBAL_ACTION_0',
			rundownId: protectString('RUNDOWN_0'),
			display: {
				content: {},
				label: { key: 'A Global Action' },
				sourceLayerId: 'layer0',
				outputLayerId: 'pgm',
				tags: ['global_adlib_tag'],
			},
			externalId: 'NCS_GLOBAL_ACTION_0',
			userData: {},
			userDataManifest: {},
		},
	]
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

		const testPartInstancesMap = makeTestPartInstanceMap()
		await topic.update(PartInstancesHandler.name, testPartInstancesMap)

		const testAdLibActions = makeTestAdLibActions()
		await topic.update(AdLibActionsHandler.name, testAdLibActions)

		const testGlobalAdLibActions = makeTestGlobalAdLibActions()
		await topic.update(GlobalAdLibActionsHandler.name, testGlobalAdLibActions)

		// TODO: AdLibPieces and Global AdLibPieces

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: ActivePlaylistStatus = {
			event: 'activePlaylist',
			name: playlist.name,
			id: unprotectString(playlist._id),
			adLibs: [
				{
					actionType: [],
					id: 'ACTION_0',
					name: 'An Action',
					outputLayer: 'PGM',
					sourceLayer: 'Layer 0',
					tags: ['adlib_tag'],
				},
			],
			currentPart: null,
			nextPart: null,
			currentSegment: null,
			globalAdLibs: [
				{
					actionType: [],
					id: 'GLOBAL_ACTION_0',
					name: 'A Global Action',
					outputLayer: 'PGM',
					sourceLayer: 'Layer 0',
					tags: ['global_adlib_tag'],
				},
			],
			rundownIds: unprotectStringArray(playlist.rundownIdsInOrder),
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
			adLibs: [],
			currentPart: {
				id: 'PART_1',
				name: 'Test Part',
				segmentId: 'SEGMENT_1',
				timing: { startTime: 1600000060000, expectedDurationMs: 10000, expectedEndTime: 1600000070000 },
			},
			nextPart: null,
			currentSegment: {
				id: 'SEGMENT_1',
				timing: {
					expectedDurationMs: 10000,
					expectedEndTime: 1600000070000,
				},
			},
			globalAdLibs: [],
			rundownIds: unprotectStringArray(playlist.rundownIdsInOrder),
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(expectedStatus)
	})
})
