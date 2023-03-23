import { DBStudio } from '../lib/collections/Studios'
import { clone, getCurrentTime, unprotectString } from '../lib/lib'
import { DBRundownPlaylist } from '../lib/collections/RundownPlaylists'
import { DBRundown } from '../lib/collections/Rundowns'
import { DBSegment } from '../lib/collections/Segments'
import { DBPart } from '../lib/collections/Parts'
import { IBlueprintPieceType, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { Piece, PieceStatusCode, EmptyPieceTimelineObjectsBlob } from '../lib/collections/Pieces'
import { AdLibPiece } from '../lib/collections/AdLibPieces'
import { getRundownId } from '../server/api/ingest/lib'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { PartInstance } from '../lib/collections/PartInstances'
import { PieceInstance } from '../lib/collections/PieceInstances'
import {
	PartId,
	PartInstanceId,
	PeripheralDeviceId,
	PieceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	SegmentId,
	SegmentPlayoutId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

export function defaultRundownPlaylist(_id: RundownPlaylistId, studioId: StudioId): DBRundownPlaylist {
	return {
		_id: _id,

		externalId: 'MOCK_RUNDOWNPLAYLIST',
		organizationId: null,
		studioId: studioId,

		name: 'Default RundownPlaylist',
		created: getCurrentTime(),
		modified: getCurrentTime(),

		// activationId: undefined,
		rehearsal: false,
		currentPartInstanceId: null,
		nextPartInstanceId: null,
		previousPartInstanceId: null,
		timing: {
			type: 'none' as any,
		},
		rundownIdsInOrder: [],
	}
}
export function defaultRundown(
	externalId: string,
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

		_id: getRundownId(studioId, externalId),
		externalId: externalId,
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

		externalNRCSName: 'mock',
		timing: {
			type: 'none' as any,
		},
	}
}

export function defaultStudio(_id: StudioId): DBStudio {
	return {
		_id: _id,

		name: 'mockStudio',
		organizationId: null,
		mappingsWithOverrides: wrapDefaultObject({}),
		supportedShowStyleBase: [],
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		settings: {
			frameRate: 25,
			mediaPreviewsUrl: '',
		},
		_rundownVersionHash: '',
		routeSets: {},
		routeSetExclusivityGroups: {},
		packageContainers: {},
		previewContainerIds: [],
		thumbnailContainerIds: [],
	}
}

export function defaultSegment(_id: SegmentId, rundownId: RundownId): DBSegment {
	return {
		_id: _id,
		_rank: 0,
		externalId: unprotectString(_id),
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
		externalId: unprotectString(_id),
		title: 'Default Part',
		expectedDurationWithPreroll: undefined,
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
		status: PieceStatusCode.OK,
		lifespan: PieceLifespan.WithinPart,
		pieceType: IBlueprintPieceType.Normal,
		invalid: false,
		enable: {
			start: 0,
		},
		sourceLayerId: '',
		outputLayerId: '',
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
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
		status: PieceStatusCode.OK,
		lifespan: PieceLifespan.WithinPart,
		sourceLayerId: '',
		outputLayerId: '',
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
}
export function defaultPartInstance(
	_id: PartInstanceId,
	playlistActivationId: RundownPlaylistActivationId,
	segmentPlayoutId: SegmentPlayoutId,
	part: DBPart
): PartInstance {
	return {
		_id,
		isTemporary: false,
		part: clone(part),
		playlistActivationId,
		rehearsal: false,
		rundownId: part.rundownId,
		segmentId: part.segmentId,
		takeCount: 0,
		segmentPlayoutId,
	}
}
export function defaultPieceInstance(
	_id: PieceInstanceId,
	playlistActivationId: RundownPlaylistActivationId,
	rundownId: RundownId,
	partInstanceId: PartInstanceId,
	piece: Piece
): PieceInstance {
	return {
		_id,
		partInstanceId,
		piece: clone(piece),
		playlistActivationId,
		rundownId,
		isTemporary: false,
	}
}
