import { PlaylistTimingType } from '@sofie-automation/blueprints-integration/dist/documents/playlistTiming'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
// eslint-disable-next-line node/no-extraneous-import
import { mock, MockProxy } from 'jest-mock-extended'
import { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler'
import { Logger } from 'winston'
import { WebSocket } from 'ws'

const RUNDOWN_1_ID = 'RUNDOWN_1'
const RUNDOWN_2_ID = 'RUNDOWN_2'

export function makeMockLogger(): MockProxy<Logger> {
	return mock<Logger>()
}

// TODO: this should not have to mock a WebSocket, refactor topic to be unaware of underlying transport (WebSocketTopic -> RealtimeTopic)
export function makeMockSubscriber(): MockProxy<WebSocket> {
	return mock<WebSocket>()
}

export function makeTestPlaylist(id?: string): DBRundownPlaylist {
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
		publicData: { a: 'b' },
	}
}

export function makeTestShowStyleBase(): Pick<ShowStyleBaseExt, 'sourceLayerNamesById' | 'outputLayerNamesById'> {
	return {
		sourceLayerNamesById: new Map([['layer0', 'Layer 0']]),
		outputLayerNamesById: new Map([['pgm', 'PGM']]),
	}
}
