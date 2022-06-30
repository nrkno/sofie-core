import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import {
	RundownPlaylistId,
	RundownId,
	BlueprintId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { EmptyPieceTimelineObjectsBlob, Piece, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime, getSystemVersion } from '../lib'
import {
	IBlueprintPieceType,
	IOutputLayer,
	ISourceLayer,
	PieceLifespan,
	PlaylistTimingType,
	SourceLayerType,
	StatusCode,
} from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleCompound'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')
import { defaultRundownPlaylist } from './defaultCollectionObjects'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PeripheralDevice,
	PeripheralDeviceSubType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { createShowStyleCompound } from '../showStyles'
import { ReadonlyDeep } from 'type-fest'

export enum LAYER_IDS {
	SOURCE_CAM0 = 'cam0',
	SOURCE_VT0 = 'vt0',
	SOURCE_TRANSITION0 = 'transition0',
	SOURCE_GRAPHICS0 = 'graphics0',
	OUTPUT_PGM = 'pgm',
}

export async function setupMockShowStyleCompound(
	context: JobContext,
	blueprintId?: BlueprintId,
	doc?: Partial<DBShowStyleBase>,
	doc2?: Partial<DBShowStyleVariant>
): Promise<ReadonlyDeep<ShowStyleCompound>> {
	const base = await setupMockShowStyleBase(context, blueprintId, doc)
	const variant = await setupMockShowStyleVariant(context, base._id, doc2)
	const compound = createShowStyleCompound(base, variant)
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	return compound!
}

export async function setupMockShowStyleBase(
	context: JobContext,
	blueprintId?: BlueprintId,
	doc?: Partial<DBShowStyleBase>
): Promise<DBShowStyleBase> {
	doc = doc || {}

	const dbI = (await context.directCollections.ShowStyleBases.findFetch()).length

	const defaultShowStyleBase: DBShowStyleBase = {
		_id: protectString('mockShowStyleBase' + dbI),
		name: 'mockShowStyleBase',
		organizationId: null,
		outputLayers: [
			literal<IOutputLayer>({
				_id: LAYER_IDS.OUTPUT_PGM,
				_rank: 0,
				isPGM: true,
				name: 'PGM',
			}),
		],
		sourceLayers: [
			literal<ISourceLayer>({
				_id: LAYER_IDS.SOURCE_CAM0,
				_rank: 0,
				name: 'Camera',
				type: SourceLayerType.CAMERA,
				exclusiveGroup: 'main',
			}),
			literal<ISourceLayer>({
				_id: LAYER_IDS.SOURCE_VT0,
				_rank: 1,
				name: 'VT',
				type: SourceLayerType.VT,
				exclusiveGroup: 'main',
			}),
			literal<ISourceLayer>({
				_id: LAYER_IDS.SOURCE_TRANSITION0,
				_rank: 2,
				name: 'Transition',
				type: SourceLayerType.TRANSITION,
			}),
			literal<ISourceLayer>({
				_id: LAYER_IDS.SOURCE_GRAPHICS0,
				_rank: 3,
				name: 'Graphic',
				type: SourceLayerType.GRAPHICS,
			}),
		],
		blueprintConfig: {},
		blueprintId: blueprintId ?? protectString('blueprint0'),
		// hotkeyLegend?: Array<HotkeyDefinition>
		_rundownVersionHash: '',
	}
	const showStyleBase = _.extend(defaultShowStyleBase, doc)
	await context.directCollections.ShowStyleBases.insertOne(showStyleBase)
	return showStyleBase
}
export async function setupMockShowStyleVariant(
	context: JobContext,
	showStyleBaseId: ShowStyleBaseId,
	doc?: Partial<DBShowStyleVariant>
): Promise<DBShowStyleVariant> {
	doc = doc || {}

	const dbI = (await context.directCollections.ShowStyleVariants.findFetch()).length

	const defaultShowStyleVariant: DBShowStyleVariant = {
		_id: protectString('mockShowStyleVariant' + dbI),
		name: 'mockShowStyleVariant',
		showStyleBaseId: showStyleBaseId,
		blueprintConfig: {},
		_rundownVersionHash: '',
	}
	const showStyleVariant = _.extend(defaultShowStyleVariant, doc)
	await context.directCollections.ShowStyleVariants.insertOne(showStyleVariant)

	return showStyleVariant
}

export async function setupDefaultRundownPlaylist(
	context: JobContext,
	showStyleCompound0?: ReadonlyDeep<ShowStyleCompound>,
	rundownId0?: RundownId
): Promise<{ rundownId: RundownId; playlistId: RundownPlaylistId }> {
	const rundownId: RundownId = rundownId0 ?? getRandomId()

	const showStyleCompound =
		showStyleCompound0 ||
		(await context.directCollections.ShowStyleVariants.findOne().then(
			(v) => v && context.getShowStyleCompound(v._id)
		))
	if (!showStyleCompound) throw new Error('No ShowStyle compound exists in the database yet')

	const playlistId = await context.directCollections.RundownPlaylists.insertOne(
		defaultRundownPlaylist(protectString('playlist_' + rundownId), context.studioId)
	)
	await setupDefaultRundown(context, showStyleCompound, playlistId, rundownId)

	return {
		rundownId,
		playlistId,
	}
}

export async function setupDefaultRundown(
	context: JobContext,
	showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): Promise<void> {
	await context.directCollections.Rundowns.insertOne({
		peripheralDeviceId: undefined,
		organizationId: null,
		studioId: context.studioId,
		showStyleBaseId: showStyleCompound._id,
		showStyleVariantId: showStyleCompound.showStyleVariantId,

		playlistId: playlistId,

		_id: rundownId,
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

		externalNRCSName: 'mock',

		timing: {
			type: PlaylistTimingType.None,
		},
	})

	const segment0Id = await context.directCollections.Segments.insertOne({
		_id: protectString(rundownId + '_segment0'),
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		rundownId: rundownId,
		name: 'Segment 0',
		externalModified: 1,
	})

	const part00: DBPart = {
		_id: protectString(rundownId + '_part0_0'),
		segmentId: segment0Id,
		rundownId: rundownId,
		_rank: 0,
		externalId: 'MOCK_PART_0_0',
		title: 'Part 0 0',
		expectedDurationWithPreroll: undefined,
	}
	await context.directCollections.Parts.insertOne(part00)

	const piece000: Piece = {
		_id: protectString(rundownId + '_piece000'),
		externalId: 'MOCK_PIECE_000',
		startRundownId: rundownId,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 000',
		status: PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: showStyleCompound.sourceLayers[0]._id,
		outputLayerId: showStyleCompound.outputLayers[0]._id,
		pieceType: IBlueprintPieceType.Normal,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.directCollections.Pieces.insertOne(piece000)

	const piece001: Piece = {
		_id: protectString(rundownId + '_piece001'),
		externalId: 'MOCK_PIECE_001',
		startRundownId: rundownId,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 001',
		status: PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: showStyleCompound.sourceLayers[1]._id,
		outputLayerId: showStyleCompound.outputLayers[0]._id,
		pieceType: IBlueprintPieceType.Normal,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.directCollections.Pieces.insertOne(piece001)

	const adLibPiece000: AdLibPiece = {
		_id: protectString(rundownId + '_adLib000'),
		_rank: 0,
		expectedDuration: 1000,
		lifespan: PieceLifespan.WithinPart,
		externalId: 'MOCK_ADLIB_000',
		partId: part00._id,
		rundownId: rundownId,
		status: PieceStatusCode.UNKNOWN,
		name: 'AdLib 0',
		sourceLayerId: showStyleCompound.sourceLayers[1]._id,
		outputLayerId: showStyleCompound.outputLayers[0]._id,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	await context.directCollections.AdLibPieces.insertOne(adLibPiece000)

	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0Id,
		rundownId: rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',
		expectedDurationWithPreroll: undefined,
	}
	await context.directCollections.Parts.insertOne(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundownId,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: showStyleCompound.sourceLayers[0]._id,
		outputLayerId: showStyleCompound.outputLayers[0]._id,
		pieceType: IBlueprintPieceType.Normal,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}
	await context.directCollections.Pieces.insertOne(piece010)

	const segment1Id = await context.directCollections.Segments.insertOne({
		_id: protectString(rundownId + '_segment1'),
		_rank: 1,
		externalId: 'MOCK_SEGMENT_2',
		rundownId: rundownId,
		name: 'Segment 1',
		externalModified: 1,
	})

	const part10: DBPart = {
		_id: protectString(rundownId + '_part1_0'),
		segmentId: segment1Id,
		rundownId: rundownId,
		_rank: 0,
		externalId: 'MOCK_PART_1_0',
		title: 'Part 1 0',
		expectedDurationWithPreroll: undefined,
	}
	await context.directCollections.Parts.insertOne(part10)

	const part11: DBPart = {
		_id: protectString(rundownId + '_part1_1'),
		segmentId: segment1Id,
		rundownId: rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_1_1',
		title: 'Part 1 1',
		expectedDurationWithPreroll: undefined,
	}
	await context.directCollections.Parts.insertOne(part11)

	const part12: DBPart = {
		_id: protectString(rundownId + '_part1_2'),
		segmentId: segment1Id,
		rundownId: rundownId,
		_rank: 2,
		externalId: 'MOCK_PART_1_2',
		title: 'Part 1 2',
		expectedDurationWithPreroll: undefined,
	}
	await context.directCollections.Parts.insertOne(part12)

	await context.directCollections.Segments.insertOne({
		_id: protectString(rundownId + '_segment2'),
		_rank: 2,
		externalId: 'MOCK_SEGMENT_2',
		rundownId: rundownId,
		name: 'Segment 2',
		externalModified: 1,
	})

	const globalAdLib0: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib0'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_0',
		lifespan: PieceLifespan.OutOnRundownEnd,
		rundownId: rundownId,
		status: PieceStatusCode.UNKNOWN,
		name: 'Global AdLib 0',
		sourceLayerId: showStyleCompound.sourceLayers[0]._id,
		outputLayerId: showStyleCompound.outputLayers[0]._id,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	const globalAdLib1: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib1'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_1',
		lifespan: PieceLifespan.OutOnRundownEnd,
		rundownId: rundownId,
		status: PieceStatusCode.UNKNOWN,
		name: 'Global AdLib 1',
		sourceLayerId: showStyleCompound.sourceLayers[1]._id,
		outputLayerId: showStyleCompound.outputLayers[0]._id,
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	await context.directCollections.RundownBaselineAdLibPieces.insertOne(globalAdLib0)
	await context.directCollections.RundownBaselineAdLibPieces.insertOne(globalAdLib1)
}

export async function setupMockPeripheralDevice(
	context: JobContext,
	category: PeripheralDeviceCategory,
	type: PeripheralDeviceType,
	subType: PeripheralDeviceSubType,
	doc?: Partial<PeripheralDevice>
): Promise<PeripheralDevice> {
	doc = doc || {}

	const dbI = (await context.directCollections.PeripheralDevices.findFetch()).length

	const defaultDevice: PeripheralDevice = {
		_id: protectString('mockDevice' + dbI),
		name: 'mockDevice',
		organizationId: null,
		studioId: context.studioId,
		settings: {},

		category: category,
		type: type,
		subType: subType,

		created: 1234,
		status: {
			statusCode: StatusCode.GOOD,
		},
		lastSeen: 1234,
		lastConnected: 1234,
		connected: true,
		connectionId: 'myConnectionId',
		token: 'mockToken',
		configManifest: {
			deviceConfig: [],
		},
		versions: {
			'@sofie-automation/server-core-integration': getSystemVersion(),
		},
	}
	const device = _.extend(defaultDevice, doc) as PeripheralDevice
	await context.directCollections.PeripheralDevices.insertOne(device)
	return device
}

export async function setupMockIngestDevice(context: JobContext): Promise<PeripheralDevice> {
	return setupMockPeripheralDevice(
		context,
		PeripheralDeviceCategory.INGEST,
		PeripheralDeviceType.MOS,
		PERIPHERAL_SUBTYPE_PROCESS
	)
}
