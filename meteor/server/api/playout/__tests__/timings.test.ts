import {} from 'type-fest'
import { RundownHoldState } from '../../../../lib/collections/Rundowns'
import { literal } from '../../../../lib/lib'
import { calculatePartTimings, CalculateTimingsPieceInstance, PartCalculatedTimings } from '../timings'

describe('Part Playout Timings', () => {
	describe('calculatePartTimings', () => {
		const pieceInstancesNoPartPreroll: CalculateTimingsPieceInstance[] = [
			{
				piece: {
					enable: { start: 0 },
					prerollDuration: 0,
					isTransition: false,
				},
			},
			{
				piece: {
					enable: { start: 5000 },
					prerollDuration: 1000,
					isTransition: false,
				},
			},
			{
				piece: {
					enable: { start: 0 },
					prerollDuration: 500, // Ignored
					isTransition: true,
				},
			},
		]
		const pieceInstances500msPartPreroll: CalculateTimingsPieceInstance[] = [
			{
				piece: {
					enable: { start: 0 },
					prerollDuration: 500,
					isTransition: false,
				},
			},
			{
				piece: {
					enable: { start: 0 },
					prerollDuration: 150,
					isTransition: false,
				},
			},
			{
				piece: {
					enable: { start: 5000 },
					prerollDuration: 1000,
					isTransition: false,
				},
			},
			{
				piece: {
					enable: { start: 0 },
					prerollDuration: 500, // Ignored
					isTransition: true,
				},
			},
		]

		describe('no transition', () => {
			describe('no preroll', () => {
				test('no previous part', () => {
					const timings = calculatePartTimings(
						undefined,
						undefined,
						{
							part: {},
						},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 0,
						})
					)
				})

				test('with previous part', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {
								autoNext: true,
							},
						},
						{
							part: {},
						},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 0,
						})
					)
				})

				test('with previous part outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {
								outTransitionDuration: 289,
							},
						},
						{
							part: {},
						},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 289,
							fromPartRemaining: 289,
						})
					)
				})

				test('with previous part autonextoverlap', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {
								autoNext: true,
								autoNextOverlap: 452,
							},
						},
						{
							part: {},
						},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 452,
						})
					)
				})

				test('with previous part autonextoverlap and outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {
								autoNext: true,
								autoNextOverlap: 452,
								outTransitionDuration: 256,
							},
						},
						{
							part: {},
						},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 452,
						})
					)
				})

				test('with previous part autonextoverlap and larger outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {
								autoNext: true,
								autoNextOverlap: 452,
								outTransitionDuration: 2256,
							},
						},
						{
							part: {},
						},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 2256 - 452,
							fromPartRemaining: 2256,
						})
					)
				})
			})
			describe('500ms preroll', () => {
				test('no previous part', () => {
					const timings = calculatePartTimings(
						undefined,
						undefined,
						{
							part: {},
						},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500,
						})
					)
				})

				test('with previous part', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {},
						},
						{
							part: {},
						},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500,
						})
					)
				})

				test('with previous part outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {
								outTransitionDuration: 289,
							},
						},
						{
							part: {},
						},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500,
						})
					)
				})

				test('with previous part larger outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {
								outTransitionDuration: 823,
							},
						},
						{
							part: {},
						},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 823,
							fromPartRemaining: 823,
						})
					)
				})

				test('with previous part autonextoverlap', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {
								autoNext: true,
								autoNextOverlap: 452,
							},
						},
						{
							part: {},
						},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500 + 452,
						})
					)
				})

				test('with previous part autonextoverlap and outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {
								autoNext: true,
								autoNextOverlap: 452,
								outTransitionDuration: 256,
							},
						},
						{
							part: {},
						},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500 + 452,
						})
					)
				})

				test('with previous part autonextoverlap and larger outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							part: {
								autoNext: true,
								autoNextOverlap: 452,
								outTransitionDuration: 2256,
							},
						},
						{
							part: {},
						},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 2256 - 452,
							fromPartRemaining: 2256,
						})
					)
				})
			})
		})

		describe('overrule transition', () => {
			test('no previous part', () => {
				const timings = calculatePartTimings(
					undefined,
					undefined,
					{
						part: {
							inTransition: {
								blockTakeDuration: 5000,
								previousPartKeepaliveDuration: 5000,
								partContentDelayDuration: 1000,
							},
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500,
					})
				)
			})

			test('previous autonextoverlap', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						part: {
							autoNext: true,
							autoNextOverlap: 452,
						},
					},
					{
						part: {
							inTransition: {
								blockTakeDuration: 5000,
								previousPartKeepaliveDuration: 5000,
								partContentDelayDuration: 1000,
							},
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500 + 452,
					})
				)
			})

			test('previous disableNextPartInTransition', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						part: {
							disableNextPartInTransition: true,
						},
					},
					{
						part: {
							inTransition: {
								blockTakeDuration: 5000,
								previousPartKeepaliveDuration: 5000,
								partContentDelayDuration: 1000,
							},
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500,
					})
				)
			})

			test('HOLD complete', () => {
				const timings = calculatePartTimings(
					RundownHoldState.COMPLETE,
					{
						part: {},
					},
					{
						part: {
							inTransition: {
								blockTakeDuration: 5000,
								previousPartKeepaliveDuration: 5000,
								partContentDelayDuration: 1000,
							},
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500,
					})
				)
			})

			test('HOLD pending', () => {
				const timings = calculatePartTimings(
					RundownHoldState.PENDING,
					{
						part: {},
					},
					{
						part: {
							inTransition: {
								blockTakeDuration: 5000,
								previousPartKeepaliveDuration: 5000,
								partContentDelayDuration: 1000,
							},
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500,
					})
				)
			})

			test('HOLD active', () => {
				const timings = calculatePartTimings(
					RundownHoldState.ACTIVE,
					{
						part: {},
					},
					{
						part: {
							inTransition: {
								blockTakeDuration: 5000,
								previousPartKeepaliveDuration: 5000,
								partContentDelayDuration: 1000,
							},
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500,
					})
				)
			})
		})

		describe('with transition', () => {
			test('high preroll', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						part: {},
					},
					{
						part: {
							inTransition: {
								blockTakeDuration: 0, // unused
								previousPartKeepaliveDuration: 628,
								partContentDelayDuration: 345,
							},
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 500 - 345,
						toPartDelay: 500,
						fromPartRemaining: 500 - 345 + 628,
					})
				)
			})

			test('high content delay', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						part: {},
					},
					{
						part: {
							inTransition: {
								blockTakeDuration: 0, // unused
								previousPartKeepaliveDuration: 628,
								partContentDelayDuration: 987,
							},
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 0,
						toPartDelay: 987,
						fromPartRemaining: 628,
					})
				)
			})

			test('previous outtransition', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						part: {
							outTransitionDuration: 200,
						},
					},
					{
						part: {
							inTransition: {
								blockTakeDuration: 0, // unused
								previousPartKeepaliveDuration: 628,
								partContentDelayDuration: 345,
							},
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 500 - 345,
						toPartDelay: 500,
						fromPartRemaining: 500 - 345 + 628,
					})
				)
			})
			test('previous high outtransition', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						part: {
							outTransitionDuration: 987,
						},
					},
					{
						part: {
							inTransition: {
								blockTakeDuration: 0, // unused
								previousPartKeepaliveDuration: 628,
								partContentDelayDuration: 345,
							},
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 987 - 628,
						toPartDelay: 987 - 628 + 345,
						fromPartRemaining: 987,
					})
				)
			})
		})
	})
})
