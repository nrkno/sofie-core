import { ActivePlaylistStatus, ActivePlaylistTopic } from '../activePlaylist'
import { makeMockLogger, makeMockSubscriber, makeTestPlaylist } from './utils'
import { PlaylistHandler } from '../../collections/playlistHandler'
import { ShowStyleBaseHandler } from '../../collections/showStyleBaseHandler'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { SourceLayerType } from '@sofie-automation/blueprints-integration/dist'
import { PartInstanceName, PartInstancesHandler } from '../../collections/partInstancesHandler'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { protectString, unprotectString, unprotectStringArray } from '@sofie-automation/server-core-integration/dist'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { AdLibActionsHandler } from '../../collections/adLibActionsHandler'
import { GlobalAdLibActionsHandler } from '../../collections/globalAdLibActionsHandler'

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

function makeTestPartInstanceMap(): Map<PartInstanceName, DBPartInstance | undefined> {
	return new Map([]) // TODO
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
})
