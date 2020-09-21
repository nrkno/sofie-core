import { getRandomId, getCurrentTime } from '../lib/lib'
import { StudioId } from '../lib/collections/Studios'
import { DBRundownPlaylist, RundownPlaylistId } from '../lib/collections/RundownPlaylists'
import { PeripheralDeviceId } from '../lib/collections/PeripheralDevices'
import { ShowStyleBaseId } from '../lib/collections/ShowStyleBases'
import { ShowStyleVariantId } from '../lib/collections/ShowStyleVariants'
import { DBRundown, RundownId } from '../lib/collections/Rundowns'
import { DBSegment, SegmentId } from '../lib/collections/Segments'
import { PartId, DBPart } from '../lib/collections/Parts'
import { RundownAPI } from '../lib/api/rundown'
import { PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { PieceId, Piece } from '../lib/collections/Pieces'
import { AdLibPiece } from '../lib/collections/AdLibPieces'

export function defaultRundownPlaylist(
	_id: RundownPlaylistId,
	studioId: StudioId,
	ingestDeviceId: PeripheralDeviceId
): DBRundownPlaylist {
	return {
		_id: _id,

		externalId: 'MOCK_RUNDOWNPLAYLIST',
		peripheralDeviceId: ingestDeviceId,
		organizationId: null,
		studioId: studioId,

		name: 'Default RundownPlaylist',
		created: getCurrentTime(),
		modified: getCurrentTime(),

		active: false,
		rehearsal: false,
		currentPartInstanceId: null,
		nextPartInstanceId: null,
		previousPartInstanceId: null,
	}
}
export function defaultRundown(
	_id: RundownId,
	studioId: StudioId,
	ingestDeviceId: PeripheralDeviceId,
	playlistId: RundownPlaylistId,
	showStyleBaseId: ShowStyleBaseId,
	showStyleVariantId: ShowStyleVariantId
): DBRundown {
	return {
		peripheralDeviceId: ingestDeviceId,
		studioId: studioId,
		showStyleBaseId: showStyleBaseId,
		showStyleVariantId: showStyleVariantId,

		organizationId: null,

		playlistId: playlistId,
		_rank: 0,

		_id: _id,
		externalId: 'MOCK_RUNDOWN',
		name: 'Default Rundown',

		created: getCurrentTime(),
		modified: getCurrentTime(),
		importVersions: {
			studio: '',
			showStyleBase: '',
			showStyleVariant: '',
			blueprint: '',
			core: '',
		},

		dataSource: 'mock',
		externalNRCSName: 'mock',
	}
}

export function defaultSegment(_id: SegmentId, rundownId: RundownId): DBSegment {
	return {
		_id: _id,
		_rank: 0,
		externalId: 'MOCK_SEGMENT',
		rundownId: rundownId,
		name: 'Default Segment',
		externalModified: 1,
	}
}

export function defaultPart(_id: PartId, rundownId: RundownId, segmentId: SegmentId): DBPart {
	return {
		_id: _id,
		rundownId: rundownId,
		segmentId: segmentId,
		_rank: 0,
		externalId: 'MOCK_PART',
		title: 'Default Part',
	}
}
export function defaultPiece(_id: PieceId, rundownId: RundownId, segmentId: SegmentId, partId: PartId): Piece {
	return {
		_id: _id,
		externalId: 'MOCK_PIECE',
		startRundownId: rundownId,
		startSegmentId: segmentId,
		startPartId: partId,
		name: 'Default Piece',
		status: RundownAPI.PieceStatusCode.OK,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		enable: {
			start: 0,
		},
		sourceLayerId: '',
		outputLayerId: '',
	}
}
export function defaultAdLibPiece(_id: PieceId, rundownId: RundownId, partId: PartId): AdLibPiece {
	return {
		_id: _id,
		externalId: 'MOCK_ADLIB',
		rundownId: rundownId,
		partId: partId,
		_rank: 0,
		name: 'Default Adlib',
		status: RundownAPI.PieceStatusCode.OK,
		lifespan: PieceLifespan.WithinPart,
		sourceLayerId: '',
		outputLayerId: '',
	}
}
