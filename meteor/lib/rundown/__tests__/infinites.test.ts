import '../../../__mocks__/_extendJest'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../__mocks__/helpers/database'
import { PieceInstance, PieceInstancePiece } from '../../../lib/collections/PieceInstances'
import { literal, protectString, getCurrentTime } from '../../../lib/lib'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import {
	getPieceInstancesForPart,
	getPlayheadTrackingInfinitesForPart,
	processAndPrunePieceInstanceTimings,
} from '../infinites'
import { Piece } from '../../../lib/collections/Pieces'
import { PartInstance, PartInstanceId } from '../../collections/PartInstances'
import { DBPart, Part, PartId } from '../../collections/Parts'
import { RundownId } from '../../collections/Rundowns'

describe('Infinites', () => {
	let env: DefaultEnvironment
	beforeEach(() => {
		env = setupDefaultStudioEnvironment()
	})

	function createPieceInstance(
		id: string,
		enable: Piece['enable'],
		sourceLayerId: string,
		lifespan: PieceLifespan,
		clear?: boolean
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
				virtual: clear,
				content: { timelineObjects: [] },
			}),
			dynamicallyInserted: clear ? getCurrentTime() : undefined,
		})
	}

	describe('processAndPrunePieceInstanceTimings', () => {
		function runAndTidyResult(pieceInstances: PieceInstance[], nowInPart: number) {
			const resolvedInstances = processAndPrunePieceInstanceTimings(env.showStyleBase, pieceInstances, nowInPart)
			return resolvedInstances.map((p) => ({
				_id: p._id,
				start: p.piece.enable.start,
				end: p.resolvedEndCap,
				priority: p.priority,
			}))
		}

		testInFiber('simple seperate layers', () => {
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
		testInFiber('basic collision', () => {
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
		testInFiber('onEnd type override', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 0 }, 'one', PieceLifespan.OutOnRundownEnd),
				createPieceInstance('two', { start: 1000, duration: 5000 }, 'one', PieceLifespan.OutOnSegmentEnd),
				createPieceInstance('four', { start: 2000, duration: 2000 }, 'one', PieceLifespan.WithinPart),
				createPieceInstance('three', { start: 3000 }, 'one', PieceLifespan.OutOnRundownEnd),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'one',
					priority: 1,
					start: 0,
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
			])
		})
		testInFiber('clear onEnd', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 0 }, 'one', PieceLifespan.OutOnRundownEnd),
				createPieceInstance('two', { start: 1000 }, 'one', PieceLifespan.OutOnSegmentEnd),
				createPieceInstance('three', { start: 3000 }, 'one', PieceLifespan.OutOnRundownEnd, true),
				createPieceInstance('two', { start: 5000 }, 'one', PieceLifespan.OutOnSegmentEnd, true),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'one',
					priority: 1,
					start: 0,
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
		testInFiber('stop onSegmentChange with onEnd', () => {
			const pieceInstances = [
				createPieceInstance('one', { start: 0 }, 'one', PieceLifespan.OutOnSegmentEnd),
				createPieceInstance('two', { start: 1000 }, 'one', PieceLifespan.OutOnSegmentChange),
				createPieceInstance('three', { start: 2000 }, 'one', PieceLifespan.OutOnRundownEnd),
				createPieceInstance('four', { start: 5000 }, 'one', PieceLifespan.OutOnSegmentEnd),
			]

			const resolvedInstances = runAndTidyResult(pieceInstances, 500)
			expect(resolvedInstances).toEqual([
				{
					_id: 'one',
					priority: 2,
					start: 0,
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
			])
		})
	})
	describe('getPlayheadTrackingInfinitesForPart', () => {
		function runAndTidyResult(
			previousPartInstance: Pick<PartInstance, 'rundownId' | 'segmentId'> & { partId: PartId },
			previousPartPieces: PieceInstance[],
			part: Pick<DBPart, 'rundownId' | 'segmentId'>,
			newInstanceId: PartInstanceId
		) {
			const resolvedInstances = getPlayheadTrackingInfinitesForPart(
				protectString('activation0'),
				new Set([previousPartInstance.partId]),
				new Set(),
				previousPartInstance as any,
				previousPartPieces,
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
					content: { timelineObjects: [] },
				}),
				dynamicallyInserted: clear ? getCurrentTime() : undefined,
				infinite: {
					infiniteInstanceId: protectString(`${id}_inf`),
					infinitePieceId: protectString(`${id}_p`),
					fromPreviousPart: false,
				},
			})
		}

		testInFiber('multiple continued pieces starting at 0 should preserve the newest', () => {
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

			const continuedInstances = runAndTidyResult(previousPartInstance, previousPartPieces, part, instanceId)
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
	})
})
