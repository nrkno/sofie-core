import * as _ from 'underscore'
import {
	postProcessAdLibPieces,
	postProcessPieces,
	postProcessRundownBaselineItems,
	postProcessStudioBaselineObjects,
} from '../postProcess'
import {
	IBlueprintAdLibPiece,
	IBlueprintPiece,
	IUserNotesContext,
	PieceLifespan,
	PlaylistTimingType,
	TimelineObjectCoreExt,
	TSR,
} from '@sofie-automation/blueprints-integration'
import { setupDefaultJobEnvironment } from '../../__mocks__/context'
import { clone, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { JobContext } from '../../jobs'
import { RundownContext, StudioContext } from '../context'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { TimelineObjGeneric, TimelineObjType } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'

describe('Test blueprint post-process', () => {
	function getContext(jobContext: JobContext): RundownContext {
		const rundown: DBRundown = {
			externalId: 'fakeRo',
			_id: protectString('fakeRo'),
			name: 'Fake RO',
			showStyleBaseId: protectString(''),
			showStyleVariantId: protectString(''),
			organizationId: protectString(''),
			studioId: jobContext.studioId,
			peripheralDeviceId: protectString(''),
			created: 0,
			modified: 0,
			importVersions: {
				studio: '',
				showStyleBase: '',
				showStyleVariant: '',
				blueprint: '',
				core: '',
			},
			externalNRCSName: 'mockNRCS',
			playlistId: protectString(''),
			_rank: 0,
			timing: {
				type: PlaylistTimingType.None,
			},
		}

		const showStyle = {} as ShowStyleCompound

		const context = new RundownContext(
			{ name: rundown.name, identifier: `rundownId=${rundown._id}` },
			jobContext.studio,
			jobContext.getStudioBlueprintConfig(),
			showStyle,
			jobContext.getShowStyleBlueprintConfig(showStyle),
			rundown
		)

		// Make sure we arent an IUserNotesContext, as that means new work to handle those notes
		expect((context as unknown as IUserNotesContext).notifyUserError).toBeUndefined()
		return context
	}
	function getStudioContext(jobContext: JobContext) {
		const context = new StudioContext(
			{ name: jobContext.studio.name, identifier: `studioId=${jobContext.studio._id}` },
			jobContext.studio,
			jobContext.getStudioBlueprintConfig()
		)

		// Make sure we arent an IUserNotesContext, as that means new work to handle those notes
		expect((context as unknown as IUserNotesContext).notifyUserError).toBeUndefined()
		return context
	}

	function ensureAllKeysDefined<T>(template: T, objects: T[]) {
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
		const context = setupDefaultJobEnvironment()
		test('no objects', () => {
			// Ensure that an empty array works ok
			const res = postProcessStudioBaselineObjects(context.studio, [])
			expect(res).toHaveLength(0)
		})

		test('some no ids', () => {
			const rawObjects = literal<TSR.TSRTimelineObjBase[]>([
				{
					id: 'testObj',
					enable: {},
					layer: 'one',
					content: {
						deviceType: TSR.DeviceType.ABSTRACT,
					},
				},
				{
					id: '',
					enable: {},
					layer: 'two',
					content: {
						deviceType: TSR.DeviceType.CASPARCG,
					},
				},
				{
					id: 'finalObj',
					enable: {},
					layer: 'three',
					content: {
						deviceType: TSR.DeviceType.ATEM,
					},
				},
				{
					id: '',
					enable: {},
					layer: 'four',
					content: {
						deviceType: TSR.DeviceType.HYPERDECK,
					},
				},
			])

			// TODO - mock getHash?

			const res = postProcessStudioBaselineObjects(context.studio, clone(rawObjects))

			// Nothing should have been overridden (yet)
			_.each(rawObjects, (obj) => {
				// 'Hack' off the invalid fields to make the MatchObject pass
				// @ts-expect-error
				if (obj.id === '') delete obj.id
			})
			expect(res).toMatchObject(rawObjects)

			// Certain fields should be defined by simple rules
			expect(_.filter(res, (r) => r.id === '')).toHaveLength(0)
			expect(_.filter(res, (r) => r.objectType !== 'rundown')).toHaveLength(0)

			// Ensure no ids were duplicates
			const ids = _.map(res, (obj) => obj.id)
			expect(ids).toHaveLength(_.uniq(ids).length)
		})
		test('duplicate ids', () => {
			const blueprintId = context.studio.blueprintId

			const rawObjects = literal<TSR.TSRTimelineObjBase[]>([
				{
					id: 'testObj',
					enable: {},
					layer: 'one',
					content: {
						deviceType: TSR.DeviceType.ABSTRACT,
					},
				},
				{
					id: '',
					enable: {},
					layer: 'two',
					content: {
						deviceType: TSR.DeviceType.CASPARCG,
					},
				},
				{
					id: 'testObj',
					enable: {},
					layer: 'three',
					content: {
						deviceType: TSR.DeviceType.ATEM,
					},
				},
				{
					id: '',
					enable: {},
					layer: 'four',
					content: {
						deviceType: TSR.DeviceType.HYPERDECK,
					},
				},
			])

			expect(() => postProcessStudioBaselineObjects(context.studio, clone(rawObjects))).toThrow(
				`Error in blueprint "${blueprintId}": ids of timelineObjs must be unique! ("testObj")`
			)
		})
	})

	describe('postProcessRundownBaselineItems', () => {
		test('no objects', async () => {
			const jobContext = setupDefaultJobEnvironment()
			const context = getContext(jobContext)

			// Ensure that an empty array works ok
			const res = postProcessRundownBaselineItems(context, protectString('some-blueprints'), [])
			expect(res).toHaveLength(0)
		})

		test('some no ids', () => {
			const jobContext = setupDefaultJobEnvironment()
			const context = getContext(jobContext)

			const rawObjects = literal<TSR.TSRTimelineObjBase[]>([
				{
					id: 'testObj',
					enable: {},
					layer: 'one',
					content: {
						deviceType: TSR.DeviceType.ABSTRACT,
					},
				},
				{
					id: '',
					enable: {},
					layer: 'two',
					content: {
						deviceType: TSR.DeviceType.CASPARCG,
					},
				},
				{
					id: 'finalObj',
					enable: {},
					layer: 'three',
					content: {
						deviceType: TSR.DeviceType.ATEM,
					},
				},
				{
					id: '',
					enable: {},
					layer: 'four',
					content: {
						deviceType: TSR.DeviceType.HYPERDECK,
					},
				},
			])

			// mock getHash, to track the returned ids
			const mockedIds = ['mocked1', 'mocked2']
			const expectedIds = _.compact(_.map(rawObjects, (obj) => obj.id)).concat(mockedIds)
			jest.spyOn(context, 'getHashId').mockImplementation(() => mockedIds.shift() || '')

			const res = postProcessRundownBaselineItems(context, protectString('some-blueprints'), _.clone(rawObjects))

			// Nothing should have been overridden (yet)
			_.each(rawObjects, (obj) => {
				// 'Hack' off the invalid fields to make the MatchObject pass
				// @ts-expect-error
				if (obj.id === '') delete obj.id
			})
			expect(res).toMatchObject(rawObjects)

			// Certain fields should be defined by simple rules
			expect(_.filter(res, (r) => r.id === '')).toHaveLength(0)
			expect(_.filter(res, (r) => r.objectType !== 'rundown')).toHaveLength(0)

			// Ensure getHashId was called as expected
			expect(context.getHashId).toHaveBeenCalledTimes(2)
			expect(context.getHashId).toHaveBeenNthCalledWith(1, 'baseline_1')
			expect(context.getHashId).toHaveBeenNthCalledWith(2, 'baseline_3')

			// Ensure no ids were duplicates
			const ids = _.map(res, (obj) => obj.id).sort()
			expect(ids).toEqual(expectedIds.sort())

			// Ensure all required keys are defined
			const tmpObj = literal<TimelineObjGeneric>({
				id: '',
				layer: '',
				enable: {},
				content: {} as any,
				objectType: TimelineObjType.RUNDOWN,
			})
			ensureAllKeysDefined(tmpObj, res)
		})

		test('duplicate ids', () => {
			const jobContext = setupDefaultJobEnvironment()
			const context = getContext(jobContext)

			const rawObjects = literal<TSR.TSRTimelineObjBase[]>([
				{
					id: 'testObj',
					enable: {},
					layer: 'one',
					content: {
						deviceType: TSR.DeviceType.ABSTRACT,
					},
				},
				{
					id: '',
					enable: {},
					layer: 'two',
					content: {
						deviceType: TSR.DeviceType.CASPARCG,
					},
				},
				{
					id: 'testObj',
					enable: {},
					layer: 'three',
					content: {
						deviceType: TSR.DeviceType.ATEM,
					},
				},
				{
					id: '',
					enable: {},
					layer: 'four',
					content: {
						deviceType: TSR.DeviceType.HYPERDECK,
					},
				},
			])

			const blueprintId = 'some-blueprints'
			expect(() =>
				postProcessRundownBaselineItems(context, protectString(blueprintId), _.clone(rawObjects))
			).toThrow(`Error in blueprint "${blueprintId}": ids of timelineObjs must be unique! ("testObj")`)
		})
	})

	describe('postProcessAdLibPieces', () => {
		test('no pieces', () => {
			const jobContext = setupDefaultJobEnvironment()
			const context = getStudioContext(jobContext)

			const blueprintId = protectString('blueprint0')
			const rundownId = protectString('rundown1')

			// Ensure that an empty array works ok
			const res = postProcessAdLibPieces(jobContext, context, blueprintId, rundownId, undefined, [])
			expect(res).toHaveLength(0)
		})

		test('various pieces', () => {
			const jobContext = setupDefaultJobEnvironment()
			const context = getStudioContext(jobContext)

			const blueprintId = protectString('blueprint9')
			const rundownId = protectString('rundown1')

			const pieces = literal<IBlueprintAdLibPiece[]>([
				{
					_rank: 2,
					name: 'test',
					externalId: 'eid1',
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {} as any,
					lifespan: PieceLifespan.WithinPart,
				},
				{
					_rank: 1,
					name: 'test2',
					externalId: 'eid2',
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: [],
					},
					lifespan: PieceLifespan.WithinPart,
				},
				{
					_rank: 9,
					name: 'test2',
					externalId: 'eid2',
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: [],
					},
					lifespan: PieceLifespan.WithinPart,
				},
			])

			// mock getHash, to track the returned ids
			const mockedIds = ['mocked1', 'mocked2', 'mocked3']
			const expectedIds = _.clone(mockedIds)
			jest.spyOn(context, 'getHashId').mockImplementation(() => mockedIds.shift() || '')

			const res = postProcessAdLibPieces(jobContext, context, blueprintId, rundownId, undefined, pieces)
			// expect(res).toHaveLength(3)
			expect(res).toMatchObject(pieces.map((p) => _.omit(p, '_id')))

			// Ensure all required keys are defined
			const tmpObj = literal<AdLibPiece>({
				_id: protectString(''),
				_rank: 0,
				name: '',
				externalId: '',
				sourceLayerId: '',
				outputLayerId: '',
				rundownId: protectString(''),
				status: 0,
				content: {
					timelineObjects: [],
				},
				lifespan: PieceLifespan.WithinPart,
			})
			ensureAllKeysDefined(tmpObj, res)

			// Ensure getHashId was called as expected
			expect(context.getHashId).toHaveBeenCalledTimes(3)
			expect(context.getHashId).toHaveBeenNthCalledWith(1, 'blueprint9_undefined_adlib_piece_eid1_0')
			expect(context.getHashId).toHaveBeenNthCalledWith(2, 'blueprint9_undefined_adlib_piece_eid2_0')
			expect(context.getHashId).toHaveBeenNthCalledWith(3, 'blueprint9_undefined_adlib_piece_eid2_1')

			// Ensure no ids were duplicates
			const ids = _.map(res, (obj) => obj._id).sort()
			expect(ids).toEqual(expectedIds.sort())
		})

		test('piece with content', () => {
			const jobContext = setupDefaultJobEnvironment()
			const context = getStudioContext(jobContext)

			const blueprintId = protectString('blueprint0')
			const rundownId = protectString('rundown1')

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
								deviceType: TSR.DeviceType.HYPERDECK,
							},
						}),
					],
				},
				lifespan: PieceLifespan.WithinPart,
			})

			const res = postProcessAdLibPieces(jobContext, context, blueprintId, rundownId, undefined, [piece])
			expect(res).toHaveLength(1)
			expect(res).toMatchObject([piece])

			const tlObjId = res[0].content!.timelineObjects![0].id
			expect(tlObjId).not.toEqual('')
		})
	})

	describe('postProcessPieces', () => {
		test('no pieces', () => {
			const jobContext = setupDefaultJobEnvironment()
			const context = getContext(jobContext)

			// Ensure that an empty array works ok
			const res = postProcessPieces(
				jobContext,
				context,
				[],
				protectString('blueprint9'),
				context._rundown._id,
				protectString('segment5'),
				protectString('part8')
			)
			expect(res).toHaveLength(0)
		})

		test('various pieces', () => {
			const jobContext = setupDefaultJobEnvironment()
			const context = getContext(jobContext)

			const pieces = literal<IBlueprintPiece[]>([
				{
					name: 'test',
					externalId: 'eid1',
					enable: { start: 0 },
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {} as any,
					lifespan: PieceLifespan.OutOnSegmentEnd,
				},
				{
					name: 'test2',
					externalId: 'eid2',
					enable: { start: 0 },
					sourceLayerId: 'sl0',
					outputLayerId: 'ol0',
					content: {
						timelineObjects: [],
					},
					lifespan: PieceLifespan.WithinPart,
				},
			])

			// mock getHash, to track the returned ids
			const mockedIds = ['mocked1', 'mocked2']
			const expectedIds = [...mockedIds]
			jest.spyOn(context, 'getHashId').mockImplementation(() => mockedIds.shift() || '')

			const res = postProcessPieces(
				jobContext,
				context,
				pieces,
				protectString('blueprint9'),
				context._rundown._id,
				protectString('segment5'),
				protectString('part8')
			)
			expect(res).toMatchObject(pieces.map((p) => _.omit(p, '_id')))

			// Ensure all required keys are defined
			const tmpObj = literal<Piece>({
				_id: protectString(''),
				name: '',
				externalId: '',
				enable: { start: 0 },
				sourceLayerId: '',
				outputLayerId: '',
				startPartId: protectString(''),
				startSegmentId: protectString(''),
				startRundownId: protectString(''),
				status: 0,
				lifespan: PieceLifespan.WithinPart,
				content: {
					timelineObjects: [],
				},
				invalid: false,
			})
			ensureAllKeysDefined(tmpObj, res)

			// Ensure getHashId was called as expected
			expect(context.getHashId).toHaveBeenCalledTimes(2)
			expect(context.getHashId).toHaveBeenNthCalledWith(1, 'blueprint9_part8_piece_eid1_0')
			expect(context.getHashId).toHaveBeenNthCalledWith(2, 'blueprint9_part8_piece_eid2_0')

			// Ensure no ids were duplicates
			const ids = _.map(res, (obj) => obj._id).sort()
			expect(ids).toEqual(expectedIds.sort())
		})

		test('piece with content', () => {
			const jobContext = setupDefaultJobEnvironment()
			const context = getContext(jobContext)

			const piece = literal<IBlueprintPiece>({
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
								deviceType: TSR.DeviceType.HYPERDECK,
							},
						}),
					],
				},
				lifespan: PieceLifespan.OutOnRundownEnd,
			})

			const res = postProcessPieces(
				jobContext,
				context,
				[piece],
				protectString('blueprint9'),
				context._rundown._id,
				protectString('segment8'),
				protectString('part6')
			)
			expect(res).toHaveLength(1)
			expect(res).toMatchObject([_.omit(piece, '_id')])

			const tlObjId = res[0].content.timelineObjects[0].id
			expect(tlObjId).not.toEqual('')
		})
	})
})
