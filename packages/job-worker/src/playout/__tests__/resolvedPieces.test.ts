import { PartInstanceId, RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupMockShowStyleCompound, setupDefaultRundownPlaylist } from '../../__mocks__/presetCollections'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
// import { getResolvedPiecesInner } from '../resolvedPieces'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ReadonlyDeep } from 'type-fest'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getRandomId, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { IBlueprintPieceType, PieceLifespan } from '@sofie-automation/blueprints-integration'
import {
	PieceInstance,
	PieceInstancePiece,
	ResolvedPieceInstance,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import _ = require('underscore')
import { JobContext } from '../../jobs'
import {
	PieceInstanceWithTimings,
	processAndPrunePieceInstanceTimings,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'

describe('Resolved Pieces', () => {
	let context: MockJobContext
	let playlistId: RundownPlaylistId
	let rundownId: RundownId
	let sourceLayers: ReadonlyDeep<SourceLayers>

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		const showStyle = await setupMockShowStyleCompound(context)
		sourceLayers = showStyle.sourceLayers

		const { playlistId: playlistId0, rundownId: rundownId0 } = await setupDefaultRundownPlaylist(context)
		playlistId = playlistId0
		rundownId = rundownId0
	})

	type StrippedResult = Pick<ResolvedPieceInstance, '_id' | 'resolvedStart' | 'resolvedDuration'>[]
	function stripResult(result: ResolvedPieceInstance[]): StrippedResult {
		return result.map((piece) => _.pick(piece, '_id', 'resolvedStart', 'resolvedDuration'))
	}

	function createPieceInstance(
		sourceLayerId: string,
		enable: PieceInstancePiece['enable'],
		piecePartial?: Partial<
			Pick<PieceInstancePiece, 'lifespan' | 'virtual' | 'prerollDuration' | 'postrollDuration'>
		>,
		instancePartial?: Partial<Pick<PieceInstance, 'userDuration'>>
	): PieceInstance {
		return {
			_id: getRandomId(),
			playlistActivationId: protectString(''),
			rundownId,
			partInstanceId: protectString(''),
			disabled: false,
			piece: {
				_id: getRandomId(),
				externalId: '',
				startPartId: protectString(''),
				invalid: false,
				name: '',
				content: {},
				pieceType: IBlueprintPieceType.Normal,
				sourceLayerId,
				outputLayerId: '',
				lifespan: piecePartial?.lifespan ?? PieceLifespan.WithinPart,
				enable,
				virtual: piecePartial?.virtual ?? false,
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
			},
			userDuration: instancePartial?.userDuration,
		}
	}

	function resolveStartOfInstance(nowInPart: number, instance: PieceInstanceWithTimings): number {
		return instance.piece.enable.start === 'now' ? nowInPart ?? 0 : instance.piece.enable.start
	}

	function resolvePrunedPieceInstances(
		nowInPart: number,
		pieceInstances: PieceInstanceWithTimings[]
	): ResolvedPieceInstance[] {
		const pieceInstancesMap = normalizeArrayToMap(pieceInstances, '_id')

		// Calculate the durations
		return pieceInstances.map((instance) => {
			const resolvedStart = resolveStartOfInstance(nowInPart, instance)

			let resolvedEnd: number | undefined
			if (typeof instance.resolvedEndCap === 'number') {
				resolvedEnd = instance.resolvedEndCap
				// } else if (instance.resolvedEndCap === 'now') {
				// 	// TODO - something should test this route?
				// 	// resolvedEnd = nowInPart
			} else if (instance.resolvedEndCap) {
				const otherInstance = pieceInstancesMap.get(instance.resolvedEndCap.relativeToStartOf)
				if (otherInstance) {
					resolvedEnd = resolveStartOfInstance(nowInPart, otherInstance)
				}
			}

			const caps: number[] = []
			if (resolvedEnd !== undefined) caps.push(resolvedEnd - resolvedStart)
			if (instance.piece.enable.duration !== undefined) caps.push(instance.piece.enable.duration)

			if (instance.userDuration) {
				if ('endRelativeToPart' in instance.userDuration) {
					caps.push(instance.userDuration.endRelativeToPart - resolvedStart)
				} else if ('endRelativeToNow' in instance.userDuration) {
					caps.push(nowInPart + instance.userDuration.endRelativeToNow - resolvedStart)
				}
			}

			return {
				...instance,
				resolvedStart,
				resolvedDuration: caps.length ? Math.min(...caps) : undefined,
			}
		})
	}

	function getResolvedPiecesInner(
		_context: JobContext,
		sourceLayers: SourceLayers,
		_playlistId: RundownPlaylistId,
		_partInstanceId: PartInstanceId,
		nowInPart: number | null,
		pieceInstances: PieceInstance[]
	): ResolvedPieceInstance[] {
		const preprocessedPieces = processAndPrunePieceInstanceTimings(sourceLayers, pieceInstances, nowInPart ?? 0)
		return resolvePrunedPieceInstances(nowInPart ?? 0, preprocessedPieces)
	}

	test('simple single piece', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 0 })

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 0,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('non-overlapping simple pieces', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000, duration: 2000 })
		const piece1 = createPieceInstance(sourceLayerId, { start: 4000 })

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0, piece1]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 2000,
			},
			{
				_id: piece1._id,
				resolvedStart: 4000,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('overlapping simple pieces', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000, duration: 8000 })
		const piece1 = createPieceInstance(sourceLayerId, { start: 4000 })

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0, piece1]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 3000,
			},
			{
				_id: piece1._id,
				resolvedStart: 4000,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('colliding infinites', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000 }, { lifespan: PieceLifespan.OutOnRundownEnd })
		const piece1 = createPieceInstance(sourceLayerId, { start: 4000 }, { lifespan: PieceLifespan.OutOnSegmentEnd })
		const piece2 = createPieceInstance(sourceLayerId, { start: 8000, duration: 2000 })

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0, piece1, piece2]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: undefined,
			},
			{
				_id: piece1._id,
				resolvedStart: 4000,
				resolvedDuration: undefined,
			},
			{
				_id: piece2._id,
				resolvedStart: 8000,
				resolvedDuration: 2000,
			},
		] satisfies StrippedResult)
	})

	test('stopped by virtual', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000 }, { lifespan: PieceLifespan.OutOnRundownEnd })
		const piece1 = createPieceInstance(
			sourceLayerId,
			{ start: 4000 },
			{ lifespan: PieceLifespan.OutOnRundownEnd, virtual: true }
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0, piece1]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 3000,
			},
		] satisfies StrippedResult)
	})

	test('part not playing, timed interacts with "now"', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000 })
		const piece1 = createPieceInstance(
			sourceLayerId,
			{ start: 'now' },
			{ lifespan: PieceLifespan.WithinPart, virtual: true }
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0, piece1]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece1._id,
				resolvedStart: 0,
				resolvedDuration: 1000,
			},
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('part is playing, timed interacts with "now"', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(sourceLayerId, { start: 1000 })
		const piece1 = createPieceInstance(
			sourceLayerId,
			{ start: 'now' },
			{ lifespan: PieceLifespan.WithinPart, virtual: true }
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			2500,
			[piece0, piece1]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 1500,
			},
			{
				_id: piece1._id,
				resolvedStart: 2500,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('userDuration.endRelativeToPart', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(
			sourceLayerId,
			{ start: 1000 },
			{},
			{
				userDuration: {
					endRelativeToPart: 2000,
				},
			}
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			2500,
			[piece0]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 1000,
			},
		] satisfies StrippedResult)
	})

	test('userDuration.endRelativeToNow', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(
			sourceLayerId,
			{ start: 1000 },
			{},
			{
				userDuration: {
					endRelativeToNow: 2000,
				},
			}
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			2500,
			[piece0]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 3500,
			},
		] satisfies StrippedResult)
	})

	test('preroll has no effect', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(
			sourceLayerId,
			{ start: 1000 },
			{
				prerollDuration: 500,
			}
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: undefined,
			},
		] satisfies StrippedResult)
	})

	test('postroll has no effect', async () => {
		const sourceLayerId = Object.keys(sourceLayers)[0]
		expect(sourceLayerId).toBeTruthy()

		const piece0 = createPieceInstance(
			sourceLayerId,
			{ start: 1000, duration: 1000 },
			{
				postrollDuration: 500,
			}
		)

		const resolvedPieces = getResolvedPiecesInner(
			context,
			sourceLayers,
			playlistId,
			protectString('partInstance0'),
			null,
			[piece0]
		)

		expect(stripResult(resolvedPieces)).toEqual([
			{
				_id: piece0._id,
				resolvedStart: 1000,
				resolvedDuration: 1000,
			},
		] satisfies StrippedResult)
	})
})
