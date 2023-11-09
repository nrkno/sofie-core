import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration/dist/documents/playlistTiming'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { mock, MockProxy } from 'jest-mock-extended'
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
	}
}

export function makeTestShowStyleBase(): Pick<
	DBShowStyleBase,
	'sourceLayersWithOverrides' | 'outputLayersWithOverrides'
> {
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
