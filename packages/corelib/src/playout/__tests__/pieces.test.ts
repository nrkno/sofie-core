import { getRandomId, literal } from '../../lib'
import { Piece } from '../../dataModel/Piece'
import { createPieceGroupAndCap } from '../pieces'
import { TimelineObjRundown } from '../../dataModel/Timeline'
import { TSR } from '@sofie-automation/blueprints-integration'
import { protectString } from '../../protectedString'

type PieceInstanceParam = Parameters<typeof createPieceGroupAndCap>[0]

type TimelineEnable = TSR.Timeline.TimelineEnable

describe('Pieces', () => {
	describe('createPieceGroupAndCap', () => {
		function createFakePiece(enable: Piece['enable'], sourceLayerId: string): Piece {
			return {
				enable,
				sourceLayerId,
			} as any
		}

		const simplePieceInstance = literal<PieceInstanceParam>({
			_id: protectString('randomId9000'),
			rundownId: getRandomId(),
			partInstanceId: protectString('randomId9002'),
			piece: createFakePiece({ start: 10 }, 'some-layer'),
			infinite: undefined,
			resolvedEndCap: undefined,
			priority: 123,
		})
		const simplePieceGroup = {
			children: [],
			content: {
				deviceType: 0,
				type: 'group',
			},
			enable: {
				end: undefined,
				start: 10,
			},
			id: 'piece_group_randomId9000',
			inGroup: undefined,
			infinitePieceInstanceId: undefined,
			isGroup: true,
			layer: 'some-layer',
			metaData: {
				pieceId: 'randomId9000',
				isPieceTimeline: true,
			},
			objectType: 'rundown',
			pieceInstanceId: 'randomId9000',
			partInstanceId: 'randomId9002',
			priority: 123,
		}
		const partGroup = { id: 'randomId9003' } as any as TimelineObjRundown

		test('Basic piece', () => {
			const res = createPieceGroupAndCap(simplePieceInstance)

			expect(res.capObjs).toHaveLength(0)
			expect(res.pieceGroup).toStrictEqual(simplePieceGroup)
		})
		test('Basic piece with a partGroup', () => {
			const res = createPieceGroupAndCap(simplePieceInstance, partGroup)

			expect(res.capObjs).toHaveLength(0)
			expect(res.pieceGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
			})
		})
		test('override enable', () => {
			const enable: TimelineEnable = { start: 'abc + 3', end: 999 }
			const res = createPieceGroupAndCap(simplePieceInstance, partGroup, enable)

			expect(res.capObjs).toHaveLength(0)
			expect(res.pieceGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
				enable,
			})
		})
		test('Numeric end cap with resolvedEndCap', () => {
			const enable: TimelineEnable = { start: 'abc + 3', end: 999 }

			{
				// cap is sooner
				const pieceInstance: PieceInstanceParam = {
					...simplePieceInstance,
					resolvedEndCap: 800,
				}
				const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)

				expect(res.capObjs).toHaveLength(0)
				expect(res.pieceGroup).toStrictEqual({
					...simplePieceGroup,
					inGroup: partGroup.id,
					enable: {
						...enable,
						end: 800,
					},
				})
			}

			{
				// cap is later
				const pieceInstance: PieceInstanceParam = {
					...simplePieceInstance,
					resolvedEndCap: 8000,
				}
				const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)

				expect(res.capObjs).toHaveLength(0)
				expect(res.pieceGroup).toStrictEqual({
					...simplePieceGroup,
					inGroup: partGroup.id,
					enable,
				})
			}
		})
		test('Numeric duration with resolvedEndCap', () => {
			{
				// numeric start
				const enable: TimelineEnable = { start: 234, duration: 999 }
				const pieceInstance: PieceInstanceParam = {
					...simplePieceInstance,
					resolvedEndCap: 800,
				}
				const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)

				expect(res.capObjs).toHaveLength(0)
				expect(res.pieceGroup).toStrictEqual({
					...simplePieceGroup,
					inGroup: partGroup.id,
					enable: {
						start: enable.start,
						end: 800,
					},
				})
			}

			{
				// string start
				const enable: TimelineEnable = { start: 'abc + 3', duration: 999 }
				const pieceInstance: PieceInstanceParam = {
					...simplePieceInstance,
					resolvedEndCap: 800,
				}
				const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)

				expect(res.capObjs).toStrictEqual([
					{
						children: [],
						content: { deviceType: 0, type: 'group' },
						enable: { end: 800, start: 0 },
						id: 'piece_group_randomId9000_cap',
						inGroup: 'randomId9003',
						isGroup: true,
						layer: '',
						objectType: 'rundown',
						partInstanceId: 'randomId9002',
						metaData: {
							isPieceTimeline: true,
						},
					},
				])
				expect(res.pieceGroup).toStrictEqual({
					...simplePieceGroup,
					inGroup: 'piece_group_randomId9000_cap',
					enable,
				})
			}
		})
		test('Basic piece - unbounded piece', () => {
			const enable: TimelineEnable = { start: 'abc + 3' }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: 800,
			}
			const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)

			expect(res.capObjs).toHaveLength(0)
			expect(res.pieceGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
				enable: {
					...enable,
					end: 800,
				},
			})
		})

		test('resolvedEndCap of now and numeric piece end', () => {
			const enable: TimelineEnable = { start: 'abc + 3', end: 999 }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: 'now',
			}
			const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)

			expect(res.capObjs).toStrictEqual([
				{
					content: { deviceType: 0 },
					enable: { start: 'now' },
					id: 'piece_group_randomId9000_cap_now',
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
				},
				{
					children: [],
					content: { deviceType: 0, type: 'group' },
					enable: { end: '#piece_group_randomId9000_cap_now.start', start: 0 },
					id: 'piece_group_randomId9000_cap',
					inGroup: partGroup.id,
					isGroup: true,
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
				},
			])
			expect(res.pieceGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: 'piece_group_randomId9000_cap',
				enable,
			})
		})

		test('resolvedEndCap of now and no piece end', () => {
			const enable: TimelineEnable = { start: 'abc + 3' }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: 'now',
			}
			const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)

			expect(res.capObjs).toStrictEqual([
				{
					content: { deviceType: 0 },
					enable: { start: 'now' },
					id: 'piece_group_randomId9000_cap_now',
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
				},
			])
			expect(res.pieceGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
				enable: {
					...enable,
					end: '#piece_group_randomId9000_cap_now.start',
				},
			})
		})

		test('resolvedEndCap of now and reference piece end', () => {
			const enable: TimelineEnable = { start: 'abc + 3', end: 'def - 9' }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: 'now',
			}
			const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)

			expect(res.capObjs).toStrictEqual([
				{
					content: { deviceType: 0 },
					enable: { start: 'now' },
					id: 'piece_group_randomId9000_cap_now',
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
				},
				{
					children: [],
					content: { deviceType: 0, type: 'group' },
					enable: { end: '#piece_group_randomId9000_cap_now.start', start: 0 },
					id: 'piece_group_randomId9000_cap',
					inGroup: partGroup.id,
					isGroup: true,
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
				},
			])
			expect(res.pieceGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: 'piece_group_randomId9000_cap',
				enable,
			})
		})

		test('resolvedEndCap of relative and piece relative end', () => {
			const enable: TimelineEnable = { start: 'abc + 3', end: 'def - 9' }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: 'aaa + 99',
			}
			const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)

			expect(res.capObjs).toStrictEqual([
				{
					children: [],
					content: { deviceType: 0, type: 'group' },
					enable: { end: pieceInstance.resolvedEndCap, start: 0 },
					id: 'piece_group_randomId9000_cap',
					inGroup: partGroup.id,
					isGroup: true,
					layer: '',
					objectType: 'rundown',
					partInstanceId: 'randomId9002',
					metaData: {
						isPieceTimeline: true,
					},
				},
			])
			expect(res.pieceGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: 'piece_group_randomId9000_cap',
				enable,
			})
		})

		test('resolvedEndCap of relative and no piece end', () => {
			const enable: TimelineEnable = { start: 'abc + 3' }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: 'aaa + 99',
			}
			const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)

			expect(res.capObjs).toHaveLength(0)
			expect(res.pieceGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
				enable: {
					...enable,
					end: 'aaa + 99',
				},
			})
		})

		test('resolvedEndCap with piece start offset', () => {
			const enable: TimelineEnable = { start: 0 }

			const pieceInstance: PieceInstanceParam = {
				...simplePieceInstance,
				resolvedEndCap: 500,
			}

			// No offset
			const res = createPieceGroupAndCap(pieceInstance, partGroup, enable)
			expect(res.capObjs).toHaveLength(0)
			expect(res.pieceGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
				enable: {
					...enable,
					end: 500,
				},
			})

			// Factor in offset
			const res2 = createPieceGroupAndCap(pieceInstance, partGroup, enable, 100)
			expect(res2.capObjs).toHaveLength(0)
			expect(res2.pieceGroup).toStrictEqual({
				...simplePieceGroup,
				inGroup: partGroup.id,
				enable: {
					...enable,
					end: 400,
				},
			})
		})
	})
})
