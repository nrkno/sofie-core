import {
	IBlueprintPieceType,
	PieceLifespan,
	PlaylistTimingType,
	SourceLayerType,
} from '@sofie-automation/blueprints-integration'
import { DBPartInstance } from '../../dataModel/PartInstance'
import { PartId, PartInstanceId, RundownId, RundownPlaylistId } from '../../dataModel/Ids'
import { DBPart } from '../../dataModel/Part'
import { EmptyPieceTimelineObjectsBlob, Piece } from '../../dataModel/Piece'
import { PieceInstance, PieceInstancePiece } from '../../dataModel/PieceInstance'
import { Rundown, DBRundown } from '../../dataModel/Rundown'
import { literal } from '../../lib'
import { protectString } from '../../protectedString'
import { getPlayheadTrackingInfinitesForPart, processAndPrunePieceInstanceTimings } from '../infinites'

describe('Infinites', () => {
	function createPieceInstance(
		id: string,
		enable: Piece['enable'],
		sourceLayerId: string,
		lifespan: PieceLifespan,
		clearOrAdlib?: boolean | number,
		infinite?: PieceInstance['infinite']
	): PieceInstance {
		return literal<PieceInstance>({
			_id: protectString(id),
			rundownId: protectString(''),
			partInstanceId: protectString(''),
			playlistActivationId: protectString('active'),
			piece: literal<PieceInstancePiece>({
				_id: protectString(`${id}_p`),
				externalId: '',
				startPartId: protectString(''),
				enable: enable,
				name: '',
				lifespan: lifespan,
				sourceLayerId: sourceLayerId,
				outputLayerId: '',
				invalid: false,
				status: -1,
				virtual: clearOrAdlib === true,
				content: {},
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
				pieceType: IBlueprintPieceType.Normal,
			}),
			dynamicallyInserted: clearOrAdlib === true ? Date.now() : clearOrAdlib || undefined,
			infinite,
		})
	}

	describe('processAndPrunePieceInstanceTimings', () => {
		function runAndTidyResult(pieceInstances: PieceInstance[], nowInPart: number, includeVirtual?: boolean) {
			const resolvedInstances = processAndPrunePieceInstanceTimings(
				{
					sourceLayers: [
						{
							_id: 'one',
							_rank: 0,
							type: SourceLayerType.UNKNOWN,
							name: 'One',
						},
						{
							_id: 'two',
							_rank: 0,
							type: SourceLayerType.UNKNOWN,
							name: 'Two',
						},
					],
				},
				pieceInstances,
				nowInPart,
				undefined,
				includeVirtual
			)
			return resolvedInstances.map((p) => ({
				_id: p._id,
				start: p.piece.enable.start,
				end: p.resolvedEndCap,
				priority: p.priority,
			}))
		}

		test('simple seperate layers', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 0 }, 'one', PieceLifespan.OutOnRundownEnd),
				createPieceInstance('two', { start: 1000 }, 'two', PieceLifespan.OutOnRundownEnd),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'one',
					priority: 1,
					start: 0,
					end: undefined,
				},
				{
					_id: 'two',
					priority: 1,
					start: 1000,
					end: undefined,
				},
			])
		})
		test('basic collision', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 0 }, 'one', PieceLifespan.OutOnRundownEnd),
				createPieceInstance('two', { start: 1000, duration: 5000 }, 'one', PieceLifespan.OutOnRundownEnd),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'one',
					priority: 1,
					start: 0,
					end: 1000,
				},
				{
					_id: 'two',
					priority: 1,
					start: 1000,
					end: undefined,
				},
			])
		})
		test('onEnd type override', () => {
			const pieceInstances = [
				createPieceInstance('zero', { start: 0 }, 'one', PieceLifespan.OutOnShowStyleEnd),
				createPieceInstance('one', { start: 500 }, 'one', PieceLifespan.OutOnRundownEnd),
				createPieceInstance('two', { start: 1000, duration: 5000 }, 'one', PieceLifespan.OutOnSegmentEnd),
				createPieceInstance('four', { start: 2000, duration: 2000 }, 'one', PieceLifespan.WithinPart),
				createPieceInstance('three', { start: 3000 }, 'one', PieceLifespan.OutOnRundownEnd),
				createPieceInstance('five', { start: 4000 }, 'one', PieceLifespan.OutOnShowStyleEnd),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'zero',
					priority: 0,
					start: 0,
					end: 4000,
				},
				{
					_id: 'one',
					priority: 1,
					start: 500,
					end: 3000,
				},
				{
					_id: 'two',
					priority: 2,
					start: 1000,
					end: undefined,
				},
				{
					_id: 'four',
					priority: 5,
					start: 2000,
					end: undefined,
				},
				{
					_id: 'three',
					priority: 1,
					start: 3000,
					end: undefined,
				},
				{
					_id: 'five',
					priority: 0,
					start: 4000,
					end: undefined,
				},
			])
		})
		test('clear onEnd', () => {
			const pieceInstances = [
				createPieceInstance('zero', { start: 0 }, 'one', PieceLifespan.OutOnShowStyleEnd),
				createPieceInstance('one', { start: 500 }, 'one', PieceLifespan.OutOnRundownEnd),
				createPieceInstance('two', { start: 1000 }, 'one', PieceLifespan.OutOnSegmentEnd),
				createPieceInstance('three', { start: 3000 }, 'one', PieceLifespan.OutOnRundownEnd, true),
				createPieceInstance('two', { start: 5000 }, 'one', PieceLifespan.OutOnSegmentEnd, true),
				createPieceInstance('zero', { start: 6000 }, 'one', PieceLifespan.OutOnShowStyleEnd, true),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'zero',
					priority: 0,
					start: 0,
					end: 6000,
				},
				{
					_id: 'one',
					priority: 1,
					start: 500,
					end: 3000,
				},
				{
					_id: 'two',
					priority: 2,
					start: 1000,
					end: 5000,
				},
			])
		})
		test('clear onEnd; include virtuals', () => {
			const pieceInstances = [
				createPieceInstance('zero', { start: 0 }, 'one', PieceLifespan.OutOnShowStyleEnd),
				createPieceInstance('one', { start: 500 }, 'one', PieceLifespan.OutOnRundownEnd),
				createPieceInstance('two', { start: 1000 }, 'one', PieceLifespan.OutOnSegmentEnd),
				createPieceInstance('three', { start: 3000 }, 'one', PieceLifespan.OutOnRundownEnd, true),
				createPieceInstance('four', { start: 5000 }, 'one', PieceLifespan.OutOnSegmentEnd, true),
				createPieceInstance('five', { start: 6000 }, 'one', PieceLifespan.OutOnShowStyleEnd, true),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500, true)
			expect(resolvedInstances).toEqual([
				{
					_id: 'zero',
					priority: 0,
					start: 0,
					end: 6000,
				},
				{
					_id: 'one',
					priority: 1,
					start: 500,
					end: 3000,
				},
				{
					_id: 'two',
					priority: 2,
					start: 1000,
					end: 5000,
				},
				{
					_id: 'three',
					priority: 1,
					start: 3000,
					end: undefined,
				},
				{
					_id: 'four',
					priority: 2,
					start: 5000,
					end: undefined,
				},
				{
					_id: 'five',
					priority: 0,
					start: 6000,
					end: undefined,
				},
			])
		})
		test('stop onSegmentChange with onEnd', () => {
			const pieceInstances = [
				createPieceInstance('zero', { start: 0 }, 'one', PieceLifespan.OutOnShowStyleEnd),
				createPieceInstance('one', { start: 500 }, 'one', PieceLifespan.OutOnSegmentEnd),
				createPieceInstance('two', { start: 1000 }, 'one', PieceLifespan.OutOnSegmentChange),
				createPieceInstance('three', { start: 2000 }, 'one', PieceLifespan.OutOnRundownEnd),
				createPieceInstance('four', { start: 5000 }, 'one', PieceLifespan.OutOnSegmentEnd),
				createPieceInstance('five', { start: 6000 }, 'one', PieceLifespan.OutOnShowStyleEnd),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'zero',
					priority: 0,
					start: 0,
					end: 6000,
				},
				{
					_id: 'one',
					priority: 2,
					start: 500,
					end: 5000,
				},
				{
					_id: 'two',
					priority: 5,
					start: 1000,
					end: 5000,
				},
				{
					_id: 'three',
					priority: 1,
					start: 2000,
					end: undefined,
				},
				{
					_id: 'four',
					priority: 2,
					start: 5000,
					end: undefined,
				},
				{
					_id: 'five',
					priority: 0,
					start: 6000,
					end: undefined,
				},
			])
		})
		test('prefer newer adlib', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 1000 }, 'one', PieceLifespan.OutOnSegmentEnd, 6000),
				createPieceInstance('two', { start: 1000 }, 'one', PieceLifespan.OutOnSegmentEnd, 5500),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'one',
					priority: 2,
					start: 1000,
					end: undefined,
				},
			])
		})
		test('prefer newer adlib2', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 1000 }, 'one', PieceLifespan.OutOnRundownChange, 6000),
				createPieceInstance('two', { start: 1000 }, 'one', PieceLifespan.OutOnRundownChange, 5500),
				createPieceInstance('three', { start: 1000 }, 'one', PieceLifespan.OutOnRundownChange, 7000),
				createPieceInstance('four', { start: 1000 }, 'one', PieceLifespan.OutOnRundownChange, 4000),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'three',
					priority: 5,
					start: 1000,
					end: undefined,
				},
			])
		})
		test('prefer newer adlib3', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 1000 }, 'one', PieceLifespan.OutOnShowStyleEnd, 6000),
				createPieceInstance('two', { start: 1000 }, 'one', PieceLifespan.OutOnShowStyleEnd, 5500),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'one',
					priority: 0,
					start: 1000,
					end: undefined,
				},
			])
		})
		test('continue onChange when start=0 and onEnd is present, and both are infinite continuations', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 0 }, 'one', PieceLifespan.OutOnSegmentChange, 6000, {
					fromPreviousPart: true,
					fromPreviousPlayhead: true,
					infiniteInstanceId: protectString('one_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('one_b'),
				}),
				createPieceInstance('two', { start: 0 }, 'one', PieceLifespan.OutOnSegmentEnd, false, {
					fromPreviousPart: true,
					infiniteInstanceId: protectString('two_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('two_b'),
				}),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'one',
					priority: 5,
					start: 0,
					end: undefined,
				},
				{
					_id: 'two',
					priority: 2,
					start: 0,
					end: undefined,
				},
			])
		})
		test('stop onChange when start=0 and onEnd is present, and both are infinite continuations', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 0 }, 'one', PieceLifespan.OutOnSegmentChange, 6000, {
					fromPreviousPart: true,
					fromPreviousPlayhead: true,
					infiniteInstanceId: protectString('one_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('one_b'),
				}),
				createPieceInstance('two', { start: 0 }, 'one', PieceLifespan.OutOnSegmentEnd, false, {
					fromPreviousPart: false,
					infiniteInstanceId: protectString('two_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('two_b'),
				}),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'two',
					priority: 2,
					start: 0,
					end: undefined,
				},
			])
		})
		test('stop onRundownEnd continuation when start=0 and onSegmentEnd is present', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 0 }, 'one', PieceLifespan.OutOnRundownEnd, false, {
					fromPreviousPart: true,
					infiniteInstanceId: protectString('one_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('one_b'),
				}),
				createPieceInstance('two', { start: 0 }, 'one', PieceLifespan.OutOnSegmentEnd, false, {
					fromPreviousPart: false,
					infiniteInstanceId: protectString('two_a'),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString('two_b'),
				}),
			]

			pieceInstances[1].piece.virtual = true

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)

			// don't expect virtual Pieces in the results, but 'one' should be pruned too
			expect(resolvedInstances).toEqual([])
		})
	})
	describe('getPlayheadTrackingInfinitesForPart', () => {
		function runAndTidyResult(
			previousPartInstance: Pick<DBPartInstance, 'rundownId' | 'segmentId'> & { partId: PartId },
			previousPartPieces: PieceInstance[],
			rundown: Rundown,
			part: Pick<DBPart, 'rundownId' | 'segmentId'>,
			newInstanceId: PartInstanceId
		) {
			const resolvedInstances = getPlayheadTrackingInfinitesForPart(
				protectString('activation0'),
				new Set([previousPartInstance.partId]),
				new Set(),
				[],
				new Map(),
				previousPartInstance as any,
				previousPartPieces,
				rundown,
				part as any,
				newInstanceId,
				true,
				false
			)
			return resolvedInstances.map((p) => ({
				_id: p._id,
				start: p.piece.enable.start,
			}))
		}

		function createPieceInstanceAsInfinite(
			id: string,
			rundownId: RundownId,
			partId: PartId,
			enable: Piece['enable'],
			sourceLayerId: string,
			lifespan: PieceLifespan,
			clear?: boolean
		): PieceInstance {
			return literal<PieceInstance>({
				_id: protectString(id),
				rundownId: rundownId,
				partInstanceId: protectString(''),
				playlistActivationId: protectString('active'),
				piece: literal<PieceInstancePiece>({
					_id: protectString(`${id}_p`),
					externalId: '',
					startPartId: partId,
					enable: enable,
					name: '',
					lifespan: lifespan,
					sourceLayerId: sourceLayerId,
					outputLayerId: '',
					invalid: false,
					status: -1,
					virtual: clear,
					content: {},
					timelineObjectsString: EmptyPieceTimelineObjectsBlob,
					pieceType: IBlueprintPieceType.Normal,
				}),
				dynamicallyInserted: clear ? Date.now() : undefined,
				infinite: {
					infiniteInstanceId: protectString(`${id}_inf`),
					infiniteInstanceIndex: 0,
					infinitePieceId: protectString(`${id}_p`),
					fromPreviousPart: false,
				},
			})
		}

		function createRundown(
			id: RundownId,
			playlistId: RundownPlaylistId,
			name: string,
			externalId: string
		): Rundown {
			return literal<DBRundown>({
				_id: id,
				externalId,
				organizationId: protectString('test'),
				name,
				showStyleVariantId: protectString('test-variant'),
				showStyleBaseId: protectString('test-base'),
				studioId: protectString('studio0'),
				created: 0,
				modified: 0,
				importVersions: {
					studio: '0.0.0',
					showStyleBase: '0.0.0',
					showStyleVariant: '0.0.0',
					blueprint: '0.0.0',
					core: '0.0.0`',
				},
				externalNRCSName: 'test',
				playlistId,
				timing: {
					type: PlaylistTimingType.None,
				},
			})
		}

		test('multiple continued pieces starting at 0 should preserve the newest', () => {
			const playlistId = protectString('playlist0')
			const rundownId = protectString('rundown0')
			const segmentId = protectString('segment0')
			const partId = protectString('part0')
			const previousPartInstance = { rundownId, segmentId, partId }
			const previousPartPieces: PieceInstance[] = [
				createPieceInstanceAsInfinite(
					'one',
					rundownId,
					partId,
					{ start: 0 },
					'one',
					PieceLifespan.OutOnRundownEnd
				),
				createPieceInstanceAsInfinite(
					'two',
					rundownId,
					partId,
					{ start: 0 },
					'one',
					PieceLifespan.OutOnRundownEnd,
					true
				),
				{
					...createPieceInstanceAsInfinite(
						'three',
						rundownId,
						partId,
						{ start: 0 },
						'one',
						PieceLifespan.OutOnRundownChange
					),
					dynamicallyInserted: Date.now() + 5000,
				},
			]
			const part = { rundownId, segmentId }
			const instanceId = protectString('newInstance0')
			const rundown = createRundown(rundownId, playlistId, 'Test Rundown', 'rundown0')

			const continuedInstances = runAndTidyResult(
				previousPartInstance,
				previousPartPieces,
				rundown,
				part,
				instanceId
			)
			expect(continuedInstances).toEqual([
				{
					_id: 'newInstance0_three_p_continue',
					start: 0,
				},
				{
					_id: 'newInstance0_two_p_continue',
					start: 0,
				},
			])
		})
		test('ignore pieces that have stopped', () => {
			const playlistId = protectString('playlist0')
			const rundownId = protectString('rundown0')
			const segmentId = protectString('segment0')
			const partId = protectString('part0')
			const previousPartInstance = { rundownId, segmentId, partId }
			const previousPartPieces: PieceInstance[] = [
				createPieceInstanceAsInfinite(
					'one',
					rundownId,
					partId,
					{ start: 1000 },
					'one',
					PieceLifespan.OutOnRundownChange
				),
				{
					...createPieceInstanceAsInfinite(
						'two',
						rundownId,
						partId,
						{ start: 2000 },
						'two',
						PieceLifespan.OutOnRundownChange,
						true
					),
					userDuration: { end: 5000 },
				},
				{
					...createPieceInstanceAsInfinite(
						'three',
						rundownId,
						partId,
						{ start: 3000 },
						'three',
						PieceLifespan.OutOnRundownChange
					),
					stoppedPlayback: 5000,
				},
			]
			const part = { rundownId, segmentId }
			const instanceId = protectString('newInstance0')
			const rundown = createRundown(rundownId, playlistId, 'Test Rundown', 'rundown0')

			const continuedInstances = runAndTidyResult(
				previousPartInstance,
				previousPartPieces,
				rundown,
				part,
				instanceId
			)
			expect(continuedInstances).toEqual([
				{
					_id: 'newInstance0_one_p_continue',
					start: 0,
				},
			])
		})
	})
})
