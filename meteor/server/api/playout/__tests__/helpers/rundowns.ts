import { PartHoldMode, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { getCurrentTime, protectString } from '../../../../../lib/lib'
import { DBRundown, Rundowns, RundownId } from '../../../../../lib/collections/Rundowns'
import { DBSegment, Segments } from '../../../../../lib/collections/Segments'
import { DBPart, Parts } from '../../../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../../../lib/collections/Pieces'
import { RundownAPI } from '../../../../../lib/api/rundown'
import { RundownPlaylistId } from '../../../../../lib/collections/RundownPlaylists'
import { DefaultEnvironment } from '../../../../../__mocks__/helpers/database'

export function setupRundownBase(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	partPropsOverride: Partial<DBPart> = {}
) {
	const rundown: DBRundown = {
		peripheralDeviceId: env.ingestDevice._id,
		organizationId: null,
		studioId: env.studio._id,
		showStyleBaseId: env.showStyleBase._id,
		showStyleVariantId: env.showStyleVariant._id,
		timing: {
			type: 'none' as any,
		},

		playlistId: playlistId,
		_rank: 0,

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
	}
	Rundowns.insert(rundown)

	const segment0: DBSegment = {
		_id: protectString(rundownId + '_segment0'),
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		rundownId: rundown._id,
		name: 'Segment 0',
		externalModified: 1,
	}
	Segments.insert(segment0)
	/* tslint:disable:ter-indent*/
	//
	const part00: DBPart = {
		_id: protectString(rundownId + '_part0_0'),
		segmentId: segment0._id,
		rundownId: rundown._id,
		_rank: 0,
		externalId: 'MOCK_PART_0_0',
		title: 'Part 0 0',

		...partPropsOverride,
	}
	Parts.insert(part00)

	const piece000: Piece = {
		_id: protectString(rundownId + '_piece000'),
		externalId: 'MOCK_PIECE_000',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 000',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece000)

	const piece001: Piece = {
		_id: protectString(rundownId + '_piece001'),
		externalId: 'MOCK_PIECE_001',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 001',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[1]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece001)

	return { rundown, segment0, part00 }
}

export function setupPart2(
	env: DefaultEnvironment,
	rundownId: RundownId,
	rundown: DBRundown,
	segment0: DBSegment,
	partPropsOverride: Partial<DBPart> = {},
	piece0PropsOverride: Partial<Piece> = {}
) {
	const part01: DBPart = {
		_id: protectString(rundownId + '_part0_1'),
		segmentId: segment0._id,
		rundownId: segment0.rundownId,
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',

		...partPropsOverride,
	}
	Parts.insert(part01)

	const piece010: Piece = {
		_id: protectString(rundownId + '_piece010'),
		externalId: 'MOCK_PIECE_010',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 010',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},

		...piece0PropsOverride,
	}
	Pieces.insert(piece010)

	return { part01 }
}

export function setupRundownWithPreroll(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0 } = setupRundownBase(env, playlistId, rundownId)

	setupPart2(env, rundownId, rundown, segment0, {}, { prerollDuration: 500 })

	return rundownId
}

export function setupRundownWithInTransition(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0 } = setupRundownBase(env, playlistId, rundownId)

	setupPart2(env, rundownId, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 0,
		},
	})

	return rundownId
}

export function setupRundownWithInTransitionPlannedPiece(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0 } = setupRundownBase(env, playlistId, rundownId)

	const { part01 } = setupPart2(env, rundownId, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	// delayed piece
	const piece012: Piece = {
		_id: protectString(rundownId + '_piece012'),
		externalId: 'MOCK_PIECE_012',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 012',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 1000,
			duration: 1000,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[3]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece012)

	return rundownId
}

export function setupRundownWithInTransitionContentDelay(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0 } = setupRundownBase(env, playlistId, rundownId)

	const { part01 } = setupPart2(env, rundownId, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	return rundownId
}

export function setupRundownWithInTransitionContentDelayAndPreroll(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0 } = setupRundownBase(env, playlistId, rundownId)

	const { part01 } = setupPart2(
		env,
		rundownId,
		rundown,
		segment0,
		{
			inTransition: {
				blockTakeDuration: 1000,
				previousPartKeepaliveDuration: 1000,
				partContentDelayDuration: 500,
			},
		},
		{
			prerollDuration: 250,
		}
	)

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	return rundownId
}

export function setupRundownWithInTransitionExistingInfinite(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId)

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[3]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.OutOnSegmentEnd,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece002)

	const { part01 } = setupPart2(env, rundownId, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	return rundownId
}

export function setupRundownWithInTransitionNewInfinite(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId)

	const { part01 } = setupPart2(env, rundownId, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	const piece012: Piece = {
		_id: protectString(rundownId + '_piece012'),
		externalId: 'MOCK_PIECE_012',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part01._id,
		name: 'Piece 012',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[3]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.OutOnSegmentEnd,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece012)

	return rundownId
}

export function setupRundownWithInTransitionEnableHold(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0 } = setupRundownBase(env, playlistId, rundownId, { holdMode: PartHoldMode.FROM })

	const { part01 } = setupPart2(env, rundownId, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},

		holdMode: PartHoldMode.TO,
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	return rundownId
}

export function setupRundownWithInTransitionDisabled(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0 } = setupRundownBase(env, playlistId, rundownId, { disableNextPartInTransition: true })

	const { part01 } = setupPart2(env, rundownId, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 1000,
			previousPartKeepaliveDuration: 1000,
			partContentDelayDuration: 500,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		enable: {
			start: 0,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
		isTransition: true,
	}
	Pieces.insert(piece011)

	return rundownId
}

export function setupRundownWithOutTransition(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId, {
		outTransitionDuration: 1000,
	})

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		status: RundownAPI.PieceStatusCode.OK,
		isOutTransition: true,
		enable: {
			start: 0, // will be overwritten
			duration: 1000,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece002)

	setupPart2(env, rundownId, rundown, segment0)

	return rundownId
}

export function setupRundownWithOutTransitionAndPreroll(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId, {
		outTransitionDuration: 1000,
	})

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		status: RundownAPI.PieceStatusCode.OK,
		isOutTransition: true,
		enable: {
			start: 0, // will be overwritten
			duration: 1000,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece002)

	setupPart2(env, rundownId, rundown, segment0, {}, { prerollDuration: 250 })

	return rundownId
}

export function setupRundownWithOutTransitionAndPreroll2(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId, {
		outTransitionDuration: 250,
	})

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		status: RundownAPI.PieceStatusCode.OK,
		isOutTransition: true,
		enable: {
			start: 0, // will be overwritten
			duration: 250,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece002)

	setupPart2(env, rundownId, rundown, segment0, {}, { prerollDuration: 1000 })

	return rundownId
}

export function setupRundownWithOutTransitionAndInTransition(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0, part00 } = setupRundownBase(env, playlistId, rundownId, {
		outTransitionDuration: 600,
	})

	const piece002: Piece = {
		_id: protectString(rundownId + '_piece002'),
		externalId: 'MOCK_PIECE_002',
		startRundownId: rundown._id,
		startSegmentId: part00.segmentId,
		startPartId: part00._id,
		name: 'Piece 002',
		status: RundownAPI.PieceStatusCode.OK,
		isOutTransition: true,
		enable: {
			start: 0, // will be overwritten
			duration: 600,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece002)

	const { part01 } = setupPart2(env, rundownId, rundown, segment0, {
		inTransition: {
			blockTakeDuration: 500,
			previousPartKeepaliveDuration: 250,
			partContentDelayDuration: 300,
		},
	})

	const piece011: Piece = {
		_id: protectString(rundownId + '_piece011'),
		externalId: 'MOCK_PIECE_011',
		startRundownId: rundown._id,
		startSegmentId: part01.segmentId,
		startPartId: part01._id,
		name: 'Piece 011',
		status: RundownAPI.PieceStatusCode.OK,
		isTransition: true,
		enable: {
			start: 0,
			duration: 500,
		},
		sourceLayerId: env.showStyleBase.sourceLayers[2]._id,
		outputLayerId: env.showStyleBase.outputLayers[0]._id,
		lifespan: PieceLifespan.WithinPart,
		invalid: false,
		content: {
			timelineObjects: [],
		},
	}
	Pieces.insert(piece011)

	return rundownId
}

export function setupRundownWithOutTransitionEnableHold(
	env: DefaultEnvironment,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
): RundownId {
	const { rundown, segment0 } = setupRundownBase(env, playlistId, rundownId, {
		holdMode: PartHoldMode.FROM,
		outTransitionDuration: 500,
	})

	setupPart2(env, rundownId, rundown, segment0, { holdMode: PartHoldMode.TO })

	return rundownId
}
