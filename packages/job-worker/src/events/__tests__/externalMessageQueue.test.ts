import {
	PlaylistTimingType,
	ExternalMessageQueueObjSlack,
	IBlueprintExternalMessageQueueType,
} from '@sofie-automation/blueprints-integration'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { getCurrentTime } from '../../lib'
import { queueExternalMessages } from '../handle'
import { setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

describe('Test external message queue static methods', () => {
	let context: MockJobContext
	let rundown: Rundown
	let playlist: DBRundownPlaylist
	beforeAll(async () => {
		context = setupDefaultJobEnvironment()

		const showStyle = await setupMockShowStyleCompound(context)

		const now = getCurrentTime()
		await context.directCollections.RundownPlaylists.insertOne({
			_id: protectString('playlist_1'),
			externalId: 'mock_rpl',
			name: 'Mock',
			studioId: protectString(''),
			created: 0,
			modified: 0,
			currentPartInstanceId: protectString('part_now'),
			nextPartInstanceId: protectString('partNext'),
			previousPartInstanceId: null,
			activationId: protectString('active'),
			timing: {
				type: PlaylistTimingType.None,
			},
		})
		await context.directCollections.Rundowns.insertOne({
			_id: protectString('rundown_1'),
			name: 'Mockito 1',
			externalId: 'mockito',
			playlistId: protectString('playlist_1'),
			_rank: 0,

			studioId: context.studio._id,
			showStyleVariantId: showStyle.showStyleVariantId,
			showStyleBaseId: showStyle._id,
			peripheralDeviceId: undefined,
			created: now,
			modified: now,
			importVersions: {
				studio: 'wibble',
				showStyleBase: 'wobble',
				showStyleVariant: 'jelly',
				blueprint: 'on',
				core: 'plate',
			},
			externalNRCSName: 'mockNRCS',
			organizationId: protectString(''),
			timing: {
				type: PlaylistTimingType.None,
			},
		})
		rundown = (await context.directCollections.Rundowns.findOne()) as Rundown
		playlist = (await context.directCollections.RundownPlaylists.findOne(rundown.playlistId)) as DBRundownPlaylist
	})

	test('add a slack-type message', async () => {
		// setLogLevel(LogLevel.DEBUG)

		await expect(context.directCollections.ExternalMessageQueue.findOne()).resolves.toBeFalsy()

		const slackMessage: ExternalMessageQueueObjSlack = {
			type: IBlueprintExternalMessageQueueType.SLACK,
			receiver: 'fred',
			message: 'whats up doc?',
		}
		expect(rundown).toBeTruthy()
		await queueExternalMessages(context.directCollections.ExternalMessageQueue, rundown, playlist, [slackMessage])

		const messages = await context.directCollections.ExternalMessageQueue.findFetch()
		expect(messages).toHaveLength(1)
		const message = messages[0]
		expect(message).toBeTruthy()
		expect(message).toMatchObject({
			type: 'slack',
			receiver: slackMessage.receiver,
			tryCount: 0,
			studioId: rundown.studioId,
			rundownId: rundown._id,
		})
		expect(message.expires).toBeGreaterThan(getCurrentTime())
	})
})
