import * as _ from 'underscore'
import { setupDefaultStudioEnvironment } from '../../../../__mocks__/helpers/database'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { literal } from '../../../../lib/lib'
import { Studios, Studio } from '../../../../lib/collections/Studios'
import { postProcessStudioBaselineObjects, postProcessRundownBaselineItems, postProcessAdLibPieces, postProcessPieces } from '../postProcess'
import { TSRTimelineObjBase, DeviceType } from 'timeline-state-resolver-types'
import { RundownContext } from '../context'
import { IBlueprintPiece, IBlueprintAdLibPiece, TimelineObjectCoreExt, IBlueprintPieceDB } from 'tv-automation-sofie-blueprints-integration'
import { Piece } from '../../../../lib/collections/Pieces'
import { TimelineObjGeneric, TimelineObjType } from '../../../../lib/collections/Timeline'
import { AdLibPiece } from '../../../../lib/collections/AdLibPieces'

describe('Test blueprint post-process', () => {

	beforeAll(() => {
		setupDefaultStudioEnvironment()
	})

	function getStudio () {
		const studio = Studios.findOne() as Studio
		expect(studio).toBeTruthy()
		return studio
	}
	function getContext () {
		const rundown = {
			externalId: 'fakeRo',
			_id: 'fakeRo',
			name: 'Fake RO',
			showStyleBaseId: '',
			showStyleVariantId: ''
		}
		return new RundownContext(new Rundown(rundown as any), getStudio())
	}

	function ensureAllKeysDefined<T> (template: T, objects: T[]) {
		const errs: string[] = []
		_.each(objects, (obj, i) => {
			for (const key of _.keys(template)) {
				const key2 = key as keyof T
				if (obj[key2] === undefined) {
					errs.push(`${i}.${key2}`)
				}
			}
		})

		expect(errs).toEqual([])
	}

	describe('postProcessStudioBaselineObjects', () => {

		testInFiber('no objects', () => {
			const studio = getStudio()

			// Ensure that an empty array works ok
			const res = postProcessStudioBaselineObjects(studio, [])
			expect(res).toHaveLength(0)
		})
		testInFiber('null object', () => {
			const studio = getStudio()

			// Ensure that a null object gets dropped
			const res = postProcessStudioBaselineObjects(studio, [null as any])
			expect(res).toHaveLength(0)
		})
		testInFiber('some no ids', () => {
			const studio = getStudio()

			const rawObjects = literal<TSRTimelineObjBase[]>([
				{
					id: 'testObj',
					enable: {},
					layer: 'one',
					content: {
						deviceType: DeviceType.ABSTRACT
					}
				},
				{
					id: '',
					enable: {},
					layer: 'two',
					content: {
						deviceType: DeviceType.CASPARCG
					}
				},
				{
					id: 'finalObj',
					enable: {},
					layer: 'three',
					content: {
						deviceType: DeviceType.ATEM
					}
				},
				{
					id: '',
					enable: {},
					layer: 'four',
					content: {
						deviceType: DeviceType.HYPERDECK
					}
				}
			])

			// TODO - mock getHash?

			const res = postProcessStudioBaselineObjects(studio, _.clone(rawObjects))

			// Nothing should have been overridden (yet)
			_.each(rawObjects, obj => {
				// 'Hack' off the invalid fields to make the MatchObject pass
				if (obj.id === '') delete obj.id
			})
			expect(res).toMatchObject(rawObjects)

			// Certain fields should be defined by simple rules
			expect(_.filter(res, r => r.id === '')).toHaveLength(0)
			expect(_.filter(res, r => r.objectType !== 'rundown')).toHaveLength(0)

			// Ensure no ids were duplicates
			const ids = _.map(res, obj => obj.id)
			expect(ids).toHaveLength(_.uniq(ids).length)
		})
		testInFiber('duplicate ids', () => {
			const studio = getStudio()

			const rawObjects = literal<TSRTimelineObjBase[]>([
				{
					id: 'testObj',
					enable: {},
					layer: 'one',
					content: {
						deviceType: DeviceType.ABSTRACT
					}
				},
				{
					id: '',
					enable: {},
					layer: 'two',
					content: {
						deviceType: DeviceType.CASPARCG
					}
				},
				{
					id: 'testObj',
					enable: {},
					layer: 'three',
					content: {
						deviceType: DeviceType.ATEM
					}
				},
				{
					id: '',
					enable: {},
					layer: 'four',
					content: {
						deviceType: DeviceType.HYPERDECK
					}
				}
			])

			try {
				postProcessStudioBaselineObjects(studio, _.clone(rawObjects))
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[400] Error in blueprint "${studio.blueprintId}": ids of timelineObjs must be unique! ("testObj")`)
			}
		})
	})

	describe('postProcessRundownBaselineItems', () => {
		testInFiber('no objects', () => {
			const context = getContext()

			// Ensure that an empty array works ok
			const res = postProcessRundownBaselineItems(context, [])
			expect(res).toHaveLength(0)
		})
		testInFiber('null object', () => {
			const context = getContext()

			// Ensure that a null object gets dropped
			const res = postProcessRundownBaselineItems(context, [null as any])
			expect(res).toHaveLength(0)
		})
		testInFiber('some no ids', () => {
			const context = getContext()

			const rawObjects = literal<TSRTimelineObjBase[]>([
				{
					id: 'testObj',
					enable: {},
					layer: 'one',
					content: {
						deviceType: DeviceType.ABSTRACT
					}
				},
				{
					id: '',
					enable: {},
					layer: 'two',
					content: {
						deviceType: DeviceType.CASPARCG
					}
				},
				{
					id: 'finalObj',
					enable: {},
					layer: 'three',
					content: {
						deviceType: DeviceType.ATEM
					}
				},
				{
					id: '',
					enable: {},
					layer: 'four',
					content: {
						deviceType: DeviceType.HYPERDECK
					}
				}
			])

			// mock getHash, to track the returned ids
			const mockedIds = ['mocked1', 'mocked2']
			const expectedIds = _.compact(_.map(rawObjects, obj => obj.id)).concat(mockedIds)
			jest.spyOn(context, 'getHashId').mockImplementation(() => mockedIds.shift() || '')

			const res = postProcessRundownBaselineItems(context, _.clone(rawObjects))

			// Nothing should have been overridden (yet)
			_.each(rawObjects, obj => {
				// 'Hack' off the invalid fields to make the MatchObject pass
				if (obj.id === '') delete obj.id
			})
			expect(res).toMatchObject(rawObjects)

			// Certain fields should be defined by simple rules
			expect(_.filter(res, r => r.id === '')).toHaveLength(0)
			expect(_.filter(res, r => r.objectType !== 'rundown')).toHaveLength(0)

			// Ensure getHashId was called as expected
			expect(context.getHashId).toHaveBeenCalledTimes(2)
			expect(context.getHashId).toHaveBeenNthCalledWith(1, 'baseline_1')
			expect(context.getHashId).toHaveBeenNthCalledWith(2, 'baseline_3')

			// Ensure no ids were duplicates
			const ids = _.map(res, obj => obj.id).sort()
			expect(ids).toEqual(expectedIds.sort())

			// Ensure all required keys are defined
			const tmpObj = literal<TimelineObjGeneric>({
				_id: '',
				id: '',
				layer: '',
				enable: {},
				content: {} as any,
				objectType: TimelineObjType.RUNDOWN,
				studioId: ''
			})
			ensureAllKeysDefined(tmpObj, res)
		})
		testInFiber('duplicate ids', () => {
			const context = getContext()

			const rawObjects = literal<TSRTimelineObjBase[]>([
				{
					id: 'testObj',
					enable: {},
					layer: 'one',
					content: {
						deviceType: DeviceType.ABSTRACT
					}
				},
				{
					id: '',
					enable: {},
					layer: 'two',
					content: {
						deviceType: DeviceType.CASPARCG
					}
				},
				{
					id: 'testObj',
					enable: {},
					layer: 'three',
					content: {
						deviceType: DeviceType.ATEM
					}
				},
				{
					id: '',
					enable: {},
					layer: 'four',
					content: {
						deviceType: DeviceType.HYPERDECK
					}
				}
			])

			try {
				postProcessRundownBaselineItems(context, _.clone(rawObjects))
				expect(true).toBe(false) // Please throw and don't get here
			} catch (e) {
				expect(e.message).toBe(`[400] Error in baseline blueprint: ids of timelineObjs must be unique! ("testObj")`)
			}
		})
	})

	describe('postProcessAdLibPieces', () => {
		testInFiber('no pieces', () => {
			const context = getContext()

			// Ensure that an empty array works ok
			const res = postProcessAdLibPieces(context, [], 'blueprint9')
			expect(res).toHaveLength(0)
		})
		testInFiber('null piece', () => {
			const context = getContext()

			// Ensure that a null object gets dropped
			const res = postProcessAdLibPieces(context, [null as any], 'blueprint9')
			expect(res).toHaveLength(0)
		})
		testInFiber('various pieces', () => {
			const context = getContext()

			const pieces = literal<IBlueprintAdLibPiece[]>([
				{
					_rank: 0,
					name: 'test',
					externalId: 'eid0',
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0'
				},
				{
					_rank: 2,
					name: 'test',
					externalId: 'eid1',
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {}
				},
				{
					_rank: 1,
					name: 'test2',
					externalId: 'eid2',
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: []
					}
				},
				{
					_rank: 9,
					name: 'test2',
					externalId: 'eid2',
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: [
							null as any
						]
					}
				}
			])

			// mock getHash, to track the returned ids
			const mockedIds = ['mocked1', 'mocked2', 'mocked3', 'mocked4']
			const expectedIds = _.clone(mockedIds)
			jest.spyOn(context, 'getHashId').mockImplementation(() => mockedIds.shift() || '')

			const res = postProcessAdLibPieces(context, pieces, 'blueprint9')
			// expect(res).toHaveLength(3)
			expect(res).toMatchObject(pieces.map(p => _.omit(p, '_id')))

			// Ensure all required keys are defined
			const tmpObj = literal<AdLibPiece>({
				_id: '',
				_rank: 0,
				disabled: false,
				name: '',
				externalId: '',
				sourceLayerId: '',
				outputLayerId: '',
				rundownId: '',
				status: 0
			})
			ensureAllKeysDefined(tmpObj, res)

			// Ensure getHashId was called as expected
			expect(context.getHashId).toHaveBeenCalledTimes(4)
			expect(context.getHashId).toHaveBeenNthCalledWith(1, 'blueprint9_undefined_adlib_piece_0')
			expect(context.getHashId).toHaveBeenNthCalledWith(2, 'blueprint9_undefined_adlib_piece_1')
			expect(context.getHashId).toHaveBeenNthCalledWith(3, 'blueprint9_undefined_adlib_piece_2')
			expect(context.getHashId).toHaveBeenNthCalledWith(4, 'blueprint9_undefined_adlib_piece_3')

			// Ensure no ids were duplicates
			const ids = _.map(res, obj => obj._id).sort()
			expect(ids).toEqual(expectedIds.sort())
		})
		testInFiber('piece with content', () => {
			const context = getContext()

			const piece = literal<IBlueprintAdLibPiece>({
				_rank: 9,
				name: 'test2',
				externalId: 'eid2',
				sourceLayerId: 'sl0',
				outputLayerId: 'ol0',
				content: {
					timelineObjects: [
						literal<TimelineObjectCoreExt>({
							id: '',
							enable: {},
							layer: 'four',
							content: {
								deviceType: DeviceType.HYPERDECK
							}
						})
					]
				}
			})

			const res = postProcessAdLibPieces(context, [piece], 'blueprint9')
			expect(res).toHaveLength(1)
			expect(res).toMatchObject([piece])

			const tlObjId = res[0].content!.timelineObjects![0].id
			expect(tlObjId).not.toEqual('')
		})
	})

	describe('postProcessPieces', () => {
		testInFiber('no pieces', () => {
			const context = getContext()

			// Ensure that an empty array works ok
			const res = postProcessPieces(context, [], 'blueprint9', 'part8')
			expect(res).toHaveLength(0)
		})
		testInFiber('null piece', () => {
			const context = getContext()

			// Ensure that a null object gets dropped
			const res = postProcessPieces(context, [null as any], 'blueprint9', 'part8')
			expect(res).toHaveLength(0)
		})
		testInFiber('various pieces', () => {
			const context = getContext()

			const pieces = literal<IBlueprintPiece[]>([
				{
					_id: 'id0',
					name: 'test',
					externalId: 'eid0',
					enable: { start: 0 },
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0'
				},
				{
					_id: '',
					name: 'test',
					externalId: 'eid1',
					enable: { start: 0 },
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {}
				},
				{
					_id: '',
					name: 'test2',
					externalId: 'eid2',
					enable: { start: 0 },
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: []
					}
				},
				{
					_id: 'id3',
					name: 'test2',
					externalId: 'eid2',
					enable: { start: 0 },
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: [
							null as any
						]
					}
				}
			])

			// mock getHash, to track the returned ids
			const mockedIds = ['mocked1', 'mocked2']
			const expectedIds = _.compact(_.map(pieces, obj => obj._id)).concat(mockedIds)
			jest.spyOn(context, 'getHashId').mockImplementation(() => mockedIds.shift() || '')

			const res = postProcessPieces(context, pieces, 'blueprint9', 'part8')
			expect(res).toMatchObject(pieces.map(p => _.omit(p, '_id')))

			// Ensure all required keys are defined
			const tmpObj = literal<Piece>({
				_id: '',
				name: '',
				externalId: '',
				enable: {},
				sourceLayerId: '',
				outputLayerId: '',
				partId: '',
				rundownId: '',
				status: 0
			})
			ensureAllKeysDefined(tmpObj, res)

			// Ensure getHashId was called as expected
			expect(context.getHashId).toHaveBeenCalledTimes(2)
			expect(context.getHashId).toHaveBeenNthCalledWith(1, 'blueprint9_part8_piece_0')
			expect(context.getHashId).toHaveBeenNthCalledWith(2, 'blueprint9_part8_piece_1')

			// Ensure no ids were duplicates
			const ids = _.map(res, obj => obj._id).sort()
			expect(ids).toEqual(expectedIds.sort())
		})
		testInFiber('piece with content', () => {
			const context = getContext()

			const piece = literal<IBlueprintPiece>({
				_id: '',
				name: 'test2',
				externalId: 'eid2',
				enable: { start: 0 },
				sourceLayerId: 'sl0',
				outputLayerId: 'ol0',
				content: {
					timelineObjects: [
						literal<TimelineObjectCoreExt>({
							id: '',
							enable: {},
							layer: 'four',
							content: {
								deviceType: DeviceType.HYPERDECK
							}
						})
					]
				}
			})

			const res = postProcessPieces(context, [piece], 'blueprint9', 'part6')
			expect(res).toHaveLength(1)
			expect(res).toMatchObject([_.omit(piece, '_id')])

			const tlObjId = res[0].content!.timelineObjects![0].id
			expect(tlObjId).not.toEqual('')
		})
	})
})
