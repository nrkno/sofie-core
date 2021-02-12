import * as _ from 'underscore'
import {
	setupDefaultStudioEnvironment,
	setupMockStudio,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
} from '../../../../__mocks__/helpers/database'
import { getHash, protectString, unprotectString, waitForPromise } from '../../../../lib/lib'
import { Studio, Studios } from '../../../../lib/collections/Studios'
import {
	LookaheadMode,
	IBlueprintAsRunLogEventContent,
	IBlueprintSegmentDB,
	TSR,
	IBlueprintPartInstance,
	IBlueprintPieceInstance,
	ConfigManifestEntryType,
	BlueprintManifestType,
	ConfigManifestEntry,
	SomeBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import {
	CommonContext,
	StudioContext,
	ShowStyleContext,
	PartEventContext,
	AsRunEventContext,
	TimelineEventContext,
} from '../context'
import { ConfigRef } from '../config'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import {
	createShowStyleCompound,
	getShowStyleCompoundForRundown,
	ShowStyleCompound,
	ShowStyleVariant,
	ShowStyleVariants,
} from '../../../../lib/collections/ShowStyleVariants'
import { Rundowns, Rundown, RundownId } from '../../../../lib/collections/Rundowns'
import { DBPart, PartId } from '../../../../lib/collections/Parts'
import { AsRunLogEvent, AsRunLog } from '../../../../lib/collections/AsRunLog'
import {
	wrapPartToTemporaryInstance,
	PartInstances,
	PartInstanceId,
	PartInstance,
} from '../../../../lib/collections/PartInstances'
import { PieceInstances, PieceInstanceInfiniteId } from '../../../../lib/collections/PieceInstances'
import { SegmentId } from '../../../../lib/collections/Segments'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { Blueprints } from '../../../../lib/collections/Blueprints'
import { RundownPlaylist, RundownPlaylists, ABSessionInfo } from '../../../../lib/collections/RundownPlaylists'
import { generateFakeBlueprint } from './lib'
import { OnGenerateTimelineObjExt } from '../../../../lib/collections/Timeline'

describe('Test blueprint api context', () => {
	function generateSparsePieceInstances(rundown: Rundown) {
		_.each(rundown.getParts(), (part, i) => {
			// make into a partInstance
			PartInstances.insert({
				_id: protectString(`${part._id}_instance`),
				playlistActivationId: protectString('active'),
				rundownId: part.rundownId,
				segmentId: part.segmentId,
				takeCount: i,
				rehearsal: false,
				part,
			})

			const count = ((i + 2) % 4) + 1 // Some consistent randomness
			for (let i = 0; i < count; i++) {
				PieceInstances.insert({
					_id: protectString(`${part._id}_piece${i}`),
					rundownId: rundown._id,
					partInstanceId: protectString(`${part._id}_instance`),
					piece: {
						_id: protectString(`${part._id}_piece_inner${i}`),
						rundownId: rundown._id,
						partId: part._id,
						content: {
							index: i,
						},
					},
				} as any)
			}
		})
	}

	let env: DefaultEnvironment
	beforeAll(() => {
		env = setupDefaultStudioEnvironment()
	})

	describe('CommonContext', () => {
		testInFiber('no param', () => {
			const context = new CommonContext({ name: 'name', identifier: 'pre' })

			const res = context.getHashId(undefined as any)
			expect(res).toEqual(getHash('pre_hash0'))
			expect(context.unhashId(res)).toEqual('hash0')
		})
		testInFiber('no param + notUnique', () => {
			const context = new CommonContext({ name: 'name', identifier: 'pre' })

			const res = context.getHashId(undefined as any, true)
			expect(res).toEqual(getHash('pre_hash0_1'))
			expect(context.unhashId(res)).toEqual('hash0_1')
		})
		testInFiber('empty param', () => {
			const context = new CommonContext({ name: 'name', identifier: 'pre' })

			const res = context.getHashId('')
			expect(res).toEqual(getHash('pre_hash0'))
			expect(context.unhashId(res)).toEqual('hash0')

			const res2 = context.getHashId('')
			expect(res2).toEqual(getHash('pre_hash1'))
			expect(context.unhashId(res2)).toEqual('hash1')

			expect(res2).not.toEqual(res)
		})
		testInFiber('string', () => {
			const context = new CommonContext({ name: 'name', identifier: 'pre' })

			const res = context.getHashId('something')
			expect(res).toEqual(getHash('pre_something'))
			expect(context.unhashId(res)).toEqual('something')

			const res2 = context.getHashId('something')
			expect(res2).toEqual(getHash('pre_something'))
			expect(context.unhashId(res2)).toEqual('something')

			expect(res2).toEqual(res)
		})
		testInFiber('string + notUnique', () => {
			const context = new CommonContext({ name: 'name', identifier: 'pre' })

			const res = context.getHashId('something', true)
			expect(res).toEqual(getHash('pre_something_0'))
			expect(context.unhashId(res)).toEqual('something_0')

			const res2 = context.getHashId('something', true)
			expect(res2).toEqual(getHash('pre_something_1'))
			expect(context.unhashId(res2)).toEqual('something_1')

			expect(res2).not.toEqual(res)
		})
	})

	describe('StudioContext', () => {
		function mockStudio() {
			const manifest = () => ({
				blueprintType: 'studio' as BlueprintManifestType.STUDIO,
				blueprintVersion: '0.0.0',
				integrationVersion: '0.0.0',
				TSRVersion: '0.0.0',

				studioConfigManifest: [
					{
						id: 'abc',
						name: '',
						description: '',
						type: 'boolean' as ConfigManifestEntryType.BOOLEAN,
						defaultVal: false,
						required: false,
					},
					{
						id: '123',
						name: '',
						description: '',
						type: 'string' as ConfigManifestEntryType.STRING,
						defaultVal: '',
						required: false,
					},
				] as ConfigManifestEntry[],

				studioMigrations: [],
				getBaseline: () => [],
				getShowStyleId: () => null,
			})
			const blueprint = generateFakeBlueprint('', BlueprintManifestType.STUDIO, manifest)
			return setupMockStudio({
				settings: {
					sofieUrl: 'testUrl',
					mediaPreviewsUrl: '',
				},
				mappings: {
					abc: {
						deviceId: 'abc',
						device: TSR.DeviceType.ABSTRACT,
						lookahead: LookaheadMode.PRELOAD,
					},
				},
				blueprintConfig: { abc: true, '123': 'val2', notInManifest: 'val3' },
				blueprintId: Blueprints.insert(blueprint),
			})
		}

		testInFiber('getStudio', () => {
			const studio = mockStudio()
			const context = new StudioContext({ name: 'studio', identifier: unprotectString(studio._id) }, studio)

			expect(context.studio).toEqual(studio)
		})
		testInFiber('getStudioConfig', () => {
			const studio = mockStudio()
			const context = new StudioContext({ name: 'studio', identifier: unprotectString(studio._id) }, studio)

			expect(context.getStudioConfig()).toEqual({
				SofieHostURL: 'testUrl', // Injected
				abc: true,
				'123': 'val2',
			})
		})
		testInFiber('getStudioConfigRef', () => {
			const studio = mockStudio()
			const context = new StudioContext({ name: 'studio', identifier: unprotectString(studio._id) }, studio)

			const getStudioConfigRef = jest.spyOn(ConfigRef, 'getStudioConfigRef')
			getStudioConfigRef.mockImplementation(() => {
				return 'configVal1'
			})

			try {
				expect(context.getStudioConfigRef('conf1')).toEqual('configVal1')

				expect(getStudioConfigRef).toHaveBeenCalledTimes(1)
				expect(getStudioConfigRef).toHaveBeenCalledWith(studio._id, 'conf1')
			} finally {
				getStudioConfigRef.mockRestore()
			}
		})

		testInFiber('getStudioMappings', () => {
			const studio = mockStudio()
			const context = new StudioContext({ name: 'studio', identifier: unprotectString(studio._id) }, studio)

			expect(context.getStudioMappings()).toEqual({
				abc: {
					deviceId: 'abc',
					device: TSR.DeviceType.ABSTRACT,
					lookahead: LookaheadMode.PRELOAD,
				},
			})
		})
	})

	describe('ShowStyleContext', () => {
		function mockStudio() {
			return setupMockStudio({
				mappings: {
					abc: {
						deviceId: 'abc',
						device: TSR.DeviceType.ABSTRACT,
						lookahead: LookaheadMode.PRELOAD,
					},
				},
			})
		}

		function getContext(
			studio: Studio,
			contextName?: string,
			rundownId?: RundownId,
			segmentId?: SegmentId,
			partId?: PartId
		) {
			const showStyleVariant = ShowStyleVariants.findOne() as ShowStyleVariant
			expect(showStyleVariant).toBeTruthy()

			const manifest = () => ({
				blueprintType: 'showstyle' as BlueprintManifestType.SHOWSTYLE,
				blueprintVersion: '0.0.0',
				integrationVersion: '0.0.0',
				TSRVersion: '0.0.0',

				showStyleConfigManifest: [
					{
						id: 'one',
						name: '',
						description: '',
						type: 'boolean' as ConfigManifestEntryType.BOOLEAN,
						defaultVal: false,
						required: false,
					},
					{
						id: 'two',
						name: '',
						description: '',
						type: 'string' as ConfigManifestEntryType.STRING,
						defaultVal: '',
						required: false,
					},
					{
						id: 'three',
						name: '',
						description: '',
						type: 'number' as ConfigManifestEntryType.NUMBER,
						defaultVal: 0,
						required: false,
					},
					{
						id: 'four.a',
						name: '',
						description: '',
						type: 'string' as ConfigManifestEntryType.STRING,
						defaultVal: '',
						required: false,
					},
					{
						id: 'four.b',
						name: '',
						description: '',
						type: 'table' as ConfigManifestEntryType.TABLE,
						defaultVal: [],
						required: false,
						columns: [
							{
								id: 'x',
								name: '',
								description: '',
								type: 'number' as ConfigManifestEntryType.NUMBER,
								required: false,
								defaultVal: 0,
								rank: 0,
							},
						],
					},
					{
						id: 'four.c',
						name: '',
						description: '',
						type: 'number' as ConfigManifestEntryType.NUMBER,
						defaultVal: 0,
						required: false,
					},
				] as ConfigManifestEntry[],
				showStyleMigrations: [],
				getRundown: () => null,
				getSegment: () => null,
				getShowStyleVariantId: () => null,
			})
			const showStyleBase = ShowStyleBases.findOne() as ShowStyleBase
			expect(showStyleBase).toBeTruthy()
			const blueprint = generateFakeBlueprint(
				unprotectString(showStyleBase!.blueprintId),
				BlueprintManifestType.SHOWSTYLE,
				(manifest as any) as () => SomeBlueprintManifest
			)
			Blueprints.update(blueprint._id, blueprint)

			const showStyleCompund = createShowStyleCompound(showStyleBase, showStyleVariant) as ShowStyleCompound
			expect(showStyleCompund).toBeTruthy()

			return new ShowStyleContext(
				{
					name: contextName || 'N/A',
					identifier: `rundownId=${rundownId},segmentId=${segmentId}`,
				},
				studio,
				showStyleCompund
			)
		}

		testInFiber('getShowStyleConfig', () => {
			const studio = mockStudio()
			const context = getContext(studio)

			// Set some config
			ShowStyleVariants.update(context.showStyleCompound.showStyleVariantId, {
				$set: {
					blueprintConfig: {
						one: true,
						two: 'val2',
						four: {
							a: 'abc',
							b: [
								{ _id: '0', x: 789 },
								{ _id: '1', x: 567 },
							],
						},
					},
				},
			})
			ShowStyleBases.update(context.showStyleCompound._id, {
				$set: {
					blueprintConfig: {
						two: 'default',
						three: 765,
						four: {
							a: 'xyz',
							b: [
								{ _id: '0', x: 123 },
								{ _id: '1', x: 456 },
								{ _id: '2', x: 789 },
							],
							c: 1234,
						},
					},
				},
			})

			const context2 = getContext(studio)
			expect(context2.getShowStyleConfig()).toEqual({
				one: true,
				two: 'val2',
				three: 765,
				four: {
					a: 'abc',
					b: [
						{ _id: '0', x: 789 },
						{ _id: '1', x: 567 },
					],
					c: 1234,
				},
			})
		})

		testInFiber('getShowStyleConfigRef', () => {
			const studio = mockStudio()
			const context = getContext(studio)

			const getShowStyleConfigRef = jest.spyOn(ConfigRef, 'getShowStyleConfigRef')
			getShowStyleConfigRef.mockImplementation(() => {
				return 'configVal1'
			})

			try {
				expect(context.getShowStyleConfigRef('conf1')).toEqual('configVal1')

				expect(getShowStyleConfigRef).toHaveBeenCalledTimes(1)
				expect(getShowStyleConfigRef).toHaveBeenCalledWith(
					context.showStyleCompound.showStyleVariantId,
					'conf1'
				)
			} finally {
				getShowStyleConfigRef.mockRestore()
			}
		})
	})

	describe('SegmentUserContext', () => {
		// TODO?
	})

	describe('PartEventContext', () => {
		testInFiber('get part', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const playlist = RundownPlaylists.findOne(rundown.playlistId) as RundownPlaylist
			expect(playlist).toBeTruthy()

			const studio = Studios.findOne(rundown.studioId) as Studio
			expect(studio).toBeTruthy()

			const showStyle = waitForPromise(getShowStyleCompoundForRundown(rundown)) as ShowStyleCompound
			expect(showStyle).toBeTruthy()

			const mockPart = {
				_id: protectString('not-a-real-part'),
			}

			const tmpPart = wrapPartToTemporaryInstance(protectString('active'), mockPart as DBPart)
			const context = new PartEventContext('fake', studio, showStyle, rundown, tmpPart)
			expect(context.studio).toBeTruthy()

			expect(context.part).toEqual(tmpPart)
		})
	})

	describe('AsRunEventContext', () => {
		function getContext(rundown: Rundown, event?: Partial<AsRunLogEvent>) {
			const mockEvent: AsRunLogEvent = {
				_id: protectString(`${rundown._id}_tmp`),
				timestamp: Date.now(),
				rundownId: rundown._id,
				studioId: rundown.studioId,
				rehersal: false,
				content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				...event,
			}

			const playlist = RundownPlaylists.findOne(rundown.playlistId) as RundownPlaylist
			expect(playlist).toBeTruthy()

			const studio = Studios.findOne(rundown.studioId) as Studio
			expect(studio).toBeTruthy()

			const showStyle = waitForPromise(getShowStyleCompoundForRundown(rundown)) as ShowStyleCompound
			expect(showStyle).toBeTruthy()

			return new AsRunEventContext(
				{
					name: 'as-run',
					identifier: unprotectString(mockEvent._id),
				},
				studio,
				showStyle,
				rundown,
				mockEvent
			)
		}
		testInFiber('getAllAsRunEvents', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const playlist = RundownPlaylists.findOne(rundown.playlistId) as RundownPlaylist
			expect(playlist).toBeTruthy()

			const studio = Studios.findOne(rundown.studioId) as Studio
			expect(studio).toBeTruthy()

			const showStyle = waitForPromise(getShowStyleCompoundForRundown(rundown)) as ShowStyleCompound
			expect(showStyle).toBeTruthy()

			const mockEvent: AsRunLogEvent = {
				_id: protectString(`${rundown._id}_tmp`),
				timestamp: Date.now(),
				rundownId: rundown._id,
				studioId: rundown.studioId,
				rehersal: false,
				content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
			}

			const context = new AsRunEventContext(
				{
					name: 'as-run',
					identifier: unprotectString(mockEvent._id),
				},
				studio,
				showStyle,
				rundown,
				mockEvent
			)
			expect(context.studio).toBeTruthy()
			expect(context.asRunEvent).toEqual(mockEvent)

			// Should be no events yet
			expect(context.getAllAsRunEvents()).toHaveLength(0)

			AsRunLog.insert({
				_id: protectString(`${rundown._id}_event1`),
				timestamp: Date.now() - 1000,
				rundownId: rundown._id,
				studioId: rundown.studioId,
				rehersal: true,
				content: IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
			})
			AsRunLog.insert(mockEvent)
			AsRunLog.insert({
				_id: protectString(`${rundown._id}_event2`),
				timestamp: Date.now() - 2000,
				rundownId: rundown._id,
				studioId: rundown.studioId,
				rehersal: true,
				content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
			})

			// Should now be some
			const events = context.getAllAsRunEvents()
			expect(events).toHaveLength(3)
			expect(_.pluck(events, '_id')).toEqual([
				`${rundown._id}_event2`,
				`${rundown._id}_event1`,
				`${rundown._id}_tmp`,
			])
		})

		testInFiber('getSegments', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Should be some defaults
			expect(_.pluck(context.getSegments(), '_id')).toEqual([
				`${rundown._id}_segment0`,
				`${rundown._id}_segment1`,
				`${rundown._id}_segment2`,
			])
		})

		testInFiber('getSegment - no id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			try {
				// Event doesnt have a segment id
				context.getSegment()
				// Should not get here
				expect(false).toBeTruthy()
			} catch (e) {
				expect(e.message).toEqual('Match error: Expected string, got undefined')
			}
		})
		testInFiber('getSegment - empty id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			try {
				context.getSegment('')
				// Should not get here
				expect(false).toBeTruthy()
			} catch (e) {
				expect(e.message).toEqual('Match error: Expected string, got undefined')
			}
		})
		testInFiber('getSegment - unknown id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			expect(context.getSegment('not-a-real-segment')).toBeUndefined()
		})
		testInFiber('getSegment - good', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			const segment = context.getSegment(`${rundown._id}_segment1`) as IBlueprintSegmentDB
			expect(segment).toBeTruthy()
			expect(segment._id).toEqual(`${rundown._id}_segment1`)
		})
		testInFiber('getSegment - empty id with event segmentId', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, {
				segmentId: protectString(`${rundown._id}_segment0`),
			})

			const segment = context.getSegment('') as IBlueprintSegmentDB
			expect(segment).toBeTruthy()
			expect(segment._id).toEqual(`${rundown._id}_segment0`)
		})
		testInFiber('getSegment - good with event segmentId', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, {
				segmentId: protectString(`${rundown._id}_segment1`),
			})

			const segment = context.getSegment(`${rundown._id}_segment2`) as IBlueprintSegmentDB
			expect(segment).toBeTruthy()
			expect(segment._id).toEqual(`${rundown._id}_segment2`)
		})

		testInFiber('getParts', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()
			generateSparsePieceInstances(rundown)

			const context = getContext(rundown)

			// Should be some defaults
			expect(_.pluck(context.getParts(), '_id')).toEqual([
				`${rundown._id}_part0_0`,
				`${rundown._id}_part0_1`,
				`${rundown._id}_part1_0`,
				`${rundown._id}_part1_1`,
				`${rundown._id}_part1_2`,
			])
		})

		testInFiber('getPartInstance - no id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()
			generateSparsePieceInstances(rundown)

			const context = getContext(rundown)

			try {
				// Event doesnt have a segment id
				context.getPartInstance()
				// Should not get here
				expect(false).toBeTruthy()
			} catch (e) {
				expect(e.message).toEqual('Match error: Expected string, got undefined')
			}
		})
		testInFiber('getPartInstance - empty id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()
			generateSparsePieceInstances(rundown)

			const context = getContext(rundown)

			try {
				context.getPartInstance('')
				// Should not get here
				expect(false).toBeTruthy()
			} catch (e) {
				expect(e.message).toEqual('Match error: Expected string, got undefined')
			}
		})
		testInFiber('getPartInstance - unknown id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()
			generateSparsePieceInstances(rundown)

			const context = getContext(rundown)

			expect(context.getPartInstance('not-a-real-part')).toBeUndefined()
		})
		testInFiber('getPartInstance - good', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()
			generateSparsePieceInstances(rundown)

			const context = getContext(rundown)

			const part = context.getPartInstance(`${rundown._id}_part1_0_instance`) as IBlueprintPartInstance
			expect(part).toBeTruthy()
			expect(part._id).toEqual(`${rundown._id}_part1_0_instance`)
		})
		testInFiber('getPartInstance - empty id with event partId', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()
			generateSparsePieceInstances(rundown)

			const context = getContext(rundown, {
				partInstanceId: protectString(`${rundown._id}_part1_1_instance`),
			})

			const part = context.getPartInstance('') as IBlueprintPartInstance
			expect(part).toBeTruthy()
			expect(part._id).toEqual(`${rundown._id}_part1_1_instance`)
		})
		testInFiber('getPartInstance - good with event partId', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()
			generateSparsePieceInstances(rundown)

			const context = getContext(rundown, {
				partInstanceId: protectString(`${rundown._id}_part1_2_instance`),
			})

			const part = context.getPartInstance(`${rundown._id}_part0_1_instance`) as IBlueprintPartInstance
			expect(part).toBeTruthy()
			expect(part._id).toEqual(`${rundown._id}_part0_1_instance`)
		})

		testInFiber('getPieceInstances - good', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieceInstances(rundown)

			const part = PartInstances.find({ rundownId: rundown._id }).fetch()[3]
			expect(part).toBeTruthy()

			// Should be some defaults
			expect(_.pluck(context.getPieceInstances(unprotectString(part._id)), '_id')).toEqual([
				`${rundown._id}_part1_1_piece0`,
				`${rundown._id}_part1_1_piece1`,
			])
		})
		testInFiber('getPieceInstances - bad id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieceInstances(rundown)

			// Should be some defaults
			expect(context.getPieceInstances('not-a-real-part')).toHaveLength(0)
		})
		testInFiber('getPieceInstances - empty id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieceInstances(rundown)

			// Should be some defaults
			expect(context.getPieceInstances('')).toHaveLength(0)
		})

		testInFiber('getPieceInstance - no id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieceInstances(rundown)

			expect(context.getPieceInstance()).toBeUndefined()
		})
		testInFiber('getPieceInstance - empty id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieceInstances(rundown)

			expect(context.getPieceInstance('')).toBeUndefined()
		})
		testInFiber('getPieceInstance - unknown id', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieceInstances(rundown)

			expect(context.getPieceInstance('not-a-real-piece')).toBeUndefined()
		})
		testInFiber('getPieceInstance - good', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieceInstances(rundown)

			const piece = context.getPieceInstance(`${rundown._id}_part0_1_piece3`) as IBlueprintPieceInstance
			expect(piece).toBeTruthy()
			expect(piece._id).toEqual(`${rundown._id}_part0_1_piece3`)
		})
		testInFiber('getPieceInstance - empty id with event pieceId', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, {
				pieceInstanceId: protectString(`${rundown._id}_part0_1_piece2`),
			})

			// Generate some pieces
			generateSparsePieceInstances(rundown)

			const piece = context.getPieceInstance('') as IBlueprintPieceInstance
			expect(piece).toBeTruthy()
			expect(piece._id).toEqual(`${rundown._id}_part0_1_piece2`)
		})
		testInFiber('getPieceInstance - good with event pieceId', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, {
				pieceInstanceId: protectString(`${rundown._id}_part0_1_piece2`),
			})

			// Generate some pieces
			generateSparsePieceInstances(rundown)

			const piece = context.getPieceInstance(`${rundown._id}_part1_2_piece0`) as IBlueprintPieceInstance
			expect(piece).toBeTruthy()
			expect(piece._id).toEqual(`${rundown._id}_part1_2_piece0`)
		})

		testInFiber('formatDateAsTimecode', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			const d = new Date('2019-01-01 18:33:34:896')
			expect(context.formatDateAsTimecode(d.getTime())).toEqual('18:33:34:22')
		})

		testInFiber('formatDurationAsTimecode', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			expect(context.formatDurationAsTimecode(0)).toEqual('00:00:00:00')
			expect(context.formatDurationAsTimecode(10000)).toEqual('00:00:10:00')
			expect(context.formatDurationAsTimecode(12345678)).toEqual('03:25:45:16')
		})
	})

	describe('TimelineEventContext', () => {
		const getSessionId = (n: number): string => `session#${n}`
		function getContext(
			rundown: Rundown,
			previousPartInstance: PartInstance | undefined,
			currentPartInstance: PartInstance | undefined,
			nextPartInstance: PartInstance | undefined
		) {
			const playlist = RundownPlaylists.findOne(rundown.playlistId) as RundownPlaylist
			expect(playlist).toBeTruthy()

			const studio = Studios.findOne(rundown.studioId) as Studio
			expect(studio).toBeTruthy()

			const showStyle = waitForPromise(getShowStyleCompoundForRundown(rundown)) as ShowStyleCompound
			expect(showStyle).toBeTruthy()

			const context = new TimelineEventContext(
				studio,
				showStyle,
				playlist,
				rundown,
				previousPartInstance,
				currentPartInstance,
				nextPartInstance
			)

			let nextId = 0
			context.getNewSessionId = () => getSessionId(nextId++)

			return context
		}

		function getAllKnownSessions(context: TimelineEventContext): ABSessionInfo[] {
			const sessions: ABSessionInfo[] = (context as any)._knownSessions
			expect(sessions).toBeTruthy()

			return sessions.map((s) => _.omit(s, 'keep'))
		}
		function overwriteKnownSessions(context: TimelineEventContext, sessions: ABSessionInfo[]): void {
			;(context as any)._knownSessions = sessions
		}
		function createPieceInstance(
			partInstanceId: PartInstanceId | string,
			infiniteInstanceId?: PieceInstanceInfiniteId
		): IBlueprintPieceInstance {
			// This defines only the minimum required values for the method we are calling
			return {
				// _id: id,
				partInstanceId,
				infinite: infiniteInstanceId ? { infiniteInstanceId } : undefined,
			} as any
		}
		function createTimelineObject(
			partInstanceId: PartInstanceId | string | null,
			infinitePieceInstanceId?: PieceInstanceInfiniteId,
			isLookahead?: boolean
		): OnGenerateTimelineObjExt {
			// This defines only the minimum required values for the method we are calling
			return {
				partInstanceId,
				infinitePieceInstanceId,
				isLookahead: !!isLookahead,
			} as any
		}
		function createPartInstance(id: string, partId: string, rank: number): PartInstance {
			// This defines only the minimum required values for the method we are calling
			return {
				_id: id,
				part: {
					_id: partId,
					_rank: rank,
				},
			} as any
		}

		testInFiber('getPieceABSessionId - knownSessions basic', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			// No sessions
			{
				const context = getContext(rundown, undefined, undefined, undefined)
				expect(context.knownSessions).toEqual([])
			}

			// some sessions
			{
				const sessions: ABSessionInfo[] = [{ id: 'abc', name: 'no' }]
				// Mod the sessions to be returned by knownSessions
				const moddedSessions = sessions.map((s) => ({ ...s, keep: true }))
				RundownPlaylists.update(rundown.playlistId, {
					$set: {
						trackedAbSessions: moddedSessions,
					},
				})
				const context = getContext(rundown, undefined, undefined, undefined)
				expect(context.knownSessions).toEqual(sessions)
			}
		})

		testInFiber('getPieceABSessionId - bad parameters', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			{
				const context = getContext(rundown, undefined, undefined, undefined)

				const piece1 = createPieceInstance(undefined as any)
				expect(() => context.getPieceABSessionId(piece1, 'name0')).toThrow(
					'Missing partInstanceId in call to getPieceABSessionId'
				)

				const piece2 = createPieceInstance('defdef')
				expect(() => context.getPieceABSessionId(piece2, 'name0')).toThrow(
					'Unknown partInstanceId in call to getPieceABSessionId'
				)
			}

			{
				const tmpPartInstance = createPartInstance('abcdef', 'aaa', 1)
				const context = getContext(rundown, undefined, undefined, tmpPartInstance)

				const piece0 = createPieceInstance('defdef')
				expect(() => context.getPieceABSessionId(piece0, 'name0')).toThrow(
					'Unknown partInstanceId in call to getPieceABSessionId'
				)

				const piece1 = createPieceInstance('abcdef')
				expect(context.getPieceABSessionId(piece1, 'name0')).toBeTruthy()
			}
		})

		testInFiber('getPieceABSessionId - normal session', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const currentPartInstance = createPartInstance('12345', 'bbb', 0)
			const context = getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			// Get the id
			const piece0 = createPieceInstance(nextPartInstance._id)
			const expectedSessions: ABSessionInfo[] = [
				{
					id: getSessionId(0),
					infiniteInstanceId: undefined,
					name: 'name0',
					partInstanceIds: [nextPartInstance._id],
				},
			]
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual(expectedSessions[0].id)
			expect(getAllKnownSessions(context)).toEqual(expectedSessions)
			expect(context.knownSessions).toHaveLength(1)

			// Should get the same id again
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual(expectedSessions[0].id)
			expect(getAllKnownSessions(context)).toEqual(expectedSessions)
			expect(context.knownSessions).toHaveLength(1)

			const piece1 = createPieceInstance(nextPartInstance._id)
			expect(context.getPieceABSessionId(piece1, 'name0')).toEqual(expectedSessions[0].id)
			expect(getAllKnownSessions(context)).toEqual(expectedSessions)
			expect(context.knownSessions).toHaveLength(1)

			// Try for the other part
			const piece2 = createPieceInstance(currentPartInstance._id)
			expect(context.getPieceABSessionId(piece2, 'name0')).not.toEqual(expectedSessions[0].id)
			expect(context.knownSessions).toHaveLength(2)

			// Or another name
			expect(context.getPieceABSessionId(piece1, 'name1')).not.toEqual(expectedSessions[0].id)
			expect(context.knownSessions).toHaveLength(3)
		})

		testInFiber('getPieceABSessionId - existing normal sessions', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const currentPartInstance = createPartInstance('12345', 'bbb', 0)

			const expectedSessions: ABSessionInfo[] = [
				{
					id: 'current0',
					name: 'name0',
					partInstanceIds: [currentPartInstance._id],
				},
				{
					id: 'current1',
					name: 'name1',
					partInstanceIds: [currentPartInstance._id],
				},
				{
					id: 'next0',
					name: 'name0',
					partInstanceIds: [nextPartInstance._id],
				},
			]
			RundownPlaylists.update(rundown.playlistId, {
				$set: {
					trackedAbSessions: expectedSessions,
				},
			})

			const context = getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			// Reuse the ids
			const piece0 = createPieceInstance(currentPartInstance._id)
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual(expectedSessions[0].id)
			expect(getAllKnownSessions(context)).toEqual(expectedSessions)
			expect(context.knownSessions).toHaveLength(1)

			const piece1 = createPieceInstance(currentPartInstance._id)
			expect(context.getPieceABSessionId(piece1, 'name1')).toEqual(expectedSessions[1].id)
			expect(getAllKnownSessions(context)).toEqual(expectedSessions)
			expect(context.knownSessions).toHaveLength(2)

			const piece2 = createPieceInstance(nextPartInstance._id)
			expect(context.getPieceABSessionId(piece2, 'name0')).toEqual(expectedSessions[2].id)
			expect(getAllKnownSessions(context)).toEqual(expectedSessions)
			expect(context.knownSessions).toHaveLength(3)
		})

		testInFiber('getPieceABSessionId - continue normal session from previous part', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const currentPartInstance = createPartInstance('12345', 'bbb', 0)

			const context = getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			const sessionId = getSessionId(0)
			const piece0 = createPieceInstance(currentPartInstance._id)
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual(sessionId)
			expect(context.knownSessions).toHaveLength(1)

			const piece2 = createPieceInstance(nextPartInstance._id)
			expect(context.getPieceABSessionId(piece2, 'name0')).toEqual(sessionId)
			expect(context.knownSessions).toHaveLength(1)
		})

		testInFiber('getPieceABSessionId - promote lookahead session from previous part', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const previousPartInstance = createPartInstance('abcdef', 'aaa', 0)
			const currentPartInstance = createPartInstance('12345', 'bbb', 1)
			const distantPartId: PartId = protectString('future-part')

			const lookaheadSessions: ABSessionInfo[] = [
				{
					id: 'lookahead0',
					name: 'name0',
					lookaheadForPartId: currentPartInstance.part._id,
					partInstanceIds: [currentPartInstance._id],
				},
				{
					id: 'lookahead1',
					name: 'name1',
					lookaheadForPartId: currentPartInstance.part._id,
					partInstanceIds: undefined,
				},
				{
					id: 'lookahead2',
					name: 'name2',
					lookaheadForPartId: distantPartId,
					partInstanceIds: undefined,
				},
			]
			RundownPlaylists.update(rundown.playlistId, {
				$set: {
					trackedAbSessions: lookaheadSessions,
				},
			})

			const context = getContext(rundown, previousPartInstance, currentPartInstance, undefined)

			// lookahead0 is for us
			const piece0 = createPieceInstance(currentPartInstance._id)
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual('lookahead0')
			expect(context.knownSessions).toHaveLength(1)

			// lookahead1 is for us
			const piece1 = createPieceInstance(currentPartInstance._id)
			expect(context.getPieceABSessionId(piece1, 'name1')).toEqual('lookahead1')
			expect(context.knownSessions).toHaveLength(2)

			// lookahead2 is not for us, so we shouldnt get it
			const sessionId = getSessionId(0)
			const piece2 = createPieceInstance(currentPartInstance._id)
			expect(context.getPieceABSessionId(piece2, 'name2')).toEqual(sessionId)
			expect(context.knownSessions).toHaveLength(3)
		})

		testInFiber('getPieceABSessionId - infinite sessions', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const currentPartInstance = createPartInstance('12345', 'bbb', 10)

			const context = getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			// Start a new infinite session
			const sessionId0 = getSessionId(0)
			const infinite0 = protectString('infinite0')
			const piece0 = createPieceInstance(currentPartInstance._id, infinite0)
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual(sessionId0)
			expect(context.knownSessions).toHaveLength(1)

			// Double check the reuslt
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual(sessionId0)
			expect(context.knownSessions).toHaveLength(1)

			// Normal piece in the same part gets different id
			const sessionId1 = getSessionId(1)
			const piece1 = createPieceInstance(currentPartInstance._id)
			expect(context.getPieceABSessionId(piece1, 'name0')).toEqual(sessionId1)
			expect(context.knownSessions).toHaveLength(2)

			// Span session to a part with a lower rank
			const piece2 = createPieceInstance(nextPartInstance._id, infinite0)
			expect(context.getPieceABSessionId(piece2, 'name0')).toEqual(sessionId0)
			expect(context.knownSessions).toHaveLength(2)
		})

		testInFiber('getTimelineObjectAbSessionId - bad parameters', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, undefined, undefined, undefined)

			// no session needed
			expect(context.getTimelineObjectAbSessionId({} as any, 'name0')).toBeUndefined()

			// unknown partInstance
			const obj1 = createTimelineObject('abcd')
			expect(context.getTimelineObjectAbSessionId(obj1, 'name0')).toBeUndefined()
		})

		function generateGetTimelineObjectAbSessionIdSessions(
			currentPartInstance: PartInstance,
			nextPartInstance: PartInstance,
			distantPartId: PartId,
			infinite0: PieceInstanceInfiniteId,
			infinite1: PieceInstanceInfiniteId
		): ABSessionInfo[] {
			return [
				{
					id: 'current0',
					name: 'name0',
					partInstanceIds: [currentPartInstance._id],
				},
				{
					id: 'current1',
					name: 'name1',
					partInstanceIds: [currentPartInstance._id],
				},
				{
					id: 'next0',
					name: 'name0',
					partInstanceIds: [nextPartInstance._id],
				},
				{
					id: 'lookahead0',
					name: 'name0',
					lookaheadForPartId: currentPartInstance.part._id,
					partInstanceIds: [currentPartInstance._id],
				},
				{
					id: 'lookahead1',
					name: 'name1',
					lookaheadForPartId: currentPartInstance.part._id,
					partInstanceIds: undefined,
				},
				{
					id: 'lookahead2',
					name: 'name2',
					lookaheadForPartId: distantPartId,
					partInstanceIds: undefined,
				},
				{
					id: 'inf0',
					name: 'name0',
					infiniteInstanceId: infinite0,
				},
				{
					id: 'inf1',
					name: 'name0',
					infiniteInstanceId: infinite1,
				},
				// TODO infinite
			]
		}

		testInFiber('getTimelineObjectAbSessionId - normal', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const currentPartInstance = createPartInstance('12345', 'bbb', 10)

			const existingSessions = generateGetTimelineObjectAbSessionIdSessions(
				currentPartInstance,
				createPartInstance('unknown', 'unknwon1', 9),
				protectString('nope'),
				protectString('infinite0'),
				protectString('infinite1')
			)
			RundownPlaylists.update(rundown.playlistId, {
				$set: {
					trackedAbSessions: existingSessions,
				},
			})

			const context = getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			// no session recorded for partInstance
			const obj1 = createTimelineObject(nextPartInstance._id)
			expect(context.getTimelineObjectAbSessionId(obj1, 'name0')).toBeUndefined()

			// partInstance with session
			const obj2 = createTimelineObject(currentPartInstance._id)
			expect(context.getTimelineObjectAbSessionId(obj2, 'name0')).toEqual('current0')
			expect(context.getTimelineObjectAbSessionId(obj2, 'name1')).toEqual('current1')

			// // define a session now
			// overwriteKnownSessions(context, [{
			// 	{
			// 		id: 'current0',
			// 		name: 'name0',
			// 		partInstanceIds: [currentPartInstance._id],
			// 	},
			// }])

			// Ensure the sessions havent changed
			expect(getAllKnownSessions(context)).toEqual(existingSessions)
		})

		testInFiber('getTimelineObjectAbSessionId - lookahead', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const currentPartInstance = createPartInstance('12345', 'bbb', 10)

			const distantPartId: PartId = protectString('distant0')
			const existingSessions = generateGetTimelineObjectAbSessionIdSessions(
				currentPartInstance,
				nextPartInstance,
				distantPartId,
				protectString('infinite0'),
				protectString('infinite1')
			)
			RundownPlaylists.update(rundown.playlistId, {
				$set: {
					trackedAbSessions: [...existingSessions],
				},
			})

			const context = getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			// no session if no partId
			const obj1 = createTimelineObject(null, undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj1, 'name0')).toBeUndefined()
			expect(context.knownSessions).toHaveLength(0)

			// existing 'distant' lookahead session
			const obj2 = createTimelineObject(unprotectString(distantPartId), undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj2, 'name0')).toEqual('lookahead2')
			expect(context.knownSessions).toHaveLength(1)

			// current partInstance session
			const obj3 = createTimelineObject(currentPartInstance._id, undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj3, 'name1')).toEqual('current1')
			expect(context.knownSessions).toHaveLength(2)

			// next partInstance session
			const obj4 = createTimelineObject(nextPartInstance._id, undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj4, 'name0')).toEqual('next0')
			expect(context.knownSessions).toHaveLength(3)

			// next partInstance new session
			const obj5 = createTimelineObject(nextPartInstance._id, undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj5, 'name1')).toEqual(getSessionId(0))
			expect(context.knownSessions).toHaveLength(4)
			existingSessions.push({
				id: getSessionId(0),
				lookaheadForPartId: nextPartInstance.part._id,
				name: 'name1',
				partInstanceIds: [nextPartInstance._id],
			})

			// Ensure the sessions havent changed
			expect(getAllKnownSessions(context)).toEqual(existingSessions)
		})

		testInFiber('getTimelineObjectAbSessionId - lookahead', () => {
			const { rundownId } = setupDefaultRundownPlaylist(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const currentPartInstance = createPartInstance('12345', 'bbb', 10)

			const distantPartId: PartId = protectString('distant0')
			const infinite0: PieceInstanceInfiniteId = protectString('infinite0')
			const infinite1: PieceInstanceInfiniteId = protectString('infinite1')
			const existingSessions = generateGetTimelineObjectAbSessionIdSessions(
				currentPartInstance,
				nextPartInstance,
				distantPartId,
				infinite0,
				infinite1
			)
			RundownPlaylists.update(rundown.playlistId, {
				$set: {
					trackedAbSessions: [...existingSessions],
				},
			})

			const context = getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			const obj1 = createTimelineObject(currentPartInstance._id, infinite0)
			expect(context.getTimelineObjectAbSessionId(obj1, 'name0')).toEqual('inf0')
			expect(context.knownSessions).toHaveLength(1)

			const obj2 = createTimelineObject(null, infinite1)
			expect(context.getTimelineObjectAbSessionId(obj2, 'name0')).toEqual('inf1')
			expect(context.knownSessions).toHaveLength(2)

			const obj3 = createTimelineObject(null, protectString('fake'))
			expect(context.getTimelineObjectAbSessionId(obj3, 'name0')).toBeUndefined()
			expect(context.knownSessions).toHaveLength(2)

			// Ensure the sessions havent changed
			expect(getAllKnownSessions(context)).toEqual(existingSessions)
		})
	})
})
