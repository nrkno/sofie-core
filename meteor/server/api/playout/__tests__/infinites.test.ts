import { Meteor } from 'meteor/meteor'
import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../../__mocks__/helpers/database'
import { PieceInstance, PieceInstancePiece } from '../../../../lib/collections/PieceInstances'
import { literal, protectString } from '../../../../lib/lib'
import { PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { processAndPrunePieceInstanceTimings } from '../infinites'
import { Piece } from '../../../../lib/collections/Pieces'

describe('Infinites', () => {
	let env: DefaultEnvironment
	beforeEach(() => {
		env = setupDefaultStudioEnvironment()
	})

	function runAndTidyResult(pieceInstances: PieceInstance[], nowInPart: number) {
		const resolvedInstances = processAndPrunePieceInstanceTimings(pieceInstances, nowInPart)
		return resolvedInstances.map((p) => ({
			_id: p._id,
			start: p.resolvedStart,
			end: p.resolvedEndCap,
			priority: p.priority,
		}))
	}

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
			}),
			dynamicallyInserted: clear,
		})
	}

	describe('tidyUpPieceInstanceTimings', () => {
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
})
