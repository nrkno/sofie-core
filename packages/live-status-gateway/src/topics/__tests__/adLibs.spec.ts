import { protectString, unprotectString } from '@sofie-automation/server-core-integration'
import { makeMockLogger, makeMockSubscriber, makeTestPlaylist, makeTestShowStyleBase } from './utils'
import { AdLibsStatus, AdLibsTopic } from '../adLibsTopic'
import { PlaylistHandler } from '../../collections/playlistHandler'
import { ShowStyleBaseExt, ShowStyleBaseHandler } from '../../collections/showStyleBaseHandler'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { AdLibActionsHandler } from '../../collections/adLibActionsHandler'
import { GlobalAdLibActionsHandler } from '../../collections/globalAdLibActionsHandler'

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
			publicData: { a: 'b' },
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
			publicData: { c: 'd' },
		},
	]
}

describe('ActivePlaylistTopic', () => {
	it('notifies subscribers', async () => {
		const topic = new AdLibsTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		await topic.update(PlaylistHandler.name, playlist)

		const testShowStyleBase = makeTestShowStyleBase()
		await topic.update(ShowStyleBaseHandler.name, testShowStyleBase as ShowStyleBaseExt)

		const testAdLibActions = makeTestAdLibActions()
		await topic.update(AdLibActionsHandler.name, testAdLibActions)

		const testGlobalAdLibActions = makeTestGlobalAdLibActions()
		await topic.update(GlobalAdLibActionsHandler.name, testGlobalAdLibActions)

		// TODO: AdLibPieces and Global AdLibPieces

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: AdLibsStatus = {
			event: 'adLibs',
			rundownPlaylistId: unprotectString(playlist._id),
			adLibs: [
				{
					actionType: [],
					id: 'ACTION_0',
					name: 'An Action',
					outputLayer: 'PGM',
					sourceLayer: 'Layer 0',
					tags: ['adlib_tag'],
					publicData: { a: 'b' },
				},
			],
			globalAdLibs: [
				{
					actionType: [],
					id: 'GLOBAL_ACTION_0',
					name: 'A Global Action',
					outputLayer: 'PGM',
					sourceLayer: 'Layer 0',
					tags: ['global_adlib_tag'],
					publicData: { c: 'd' },
				},
			],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(expectedStatus)
	})
})
