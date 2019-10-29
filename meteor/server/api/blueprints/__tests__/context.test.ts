import * as _ from 'underscore'
import { setupDefaultStudioEnvironment, setupMockStudio, setupDefaultRundown, DefaultEnvironment } from '../../../../__mocks__/helpers/database'
import { getHash, literal } from '../../../../lib/lib'
import { Studio } from '../../../../lib/collections/Studios'
import { LookaheadMode, NotesContext as INotesContext, IBlueprintPart, IBlueprintPartDB, IBlueprintAsRunLogEventContent, IBlueprintSegment, IBlueprintSegmentDB, IBlueprintPieceDB } from 'tv-automation-sofie-blueprints-integration'
import { CommonContext, StudioConfigContext, StudioContext, ShowStyleContext, NotesContext, SegmentContext, PartContext, PartEventContext, AsRunEventContext } from '../context'
import { ConfigRef } from '../config'
import { DeviceType } from 'timeline-state-resolver-types'
import { ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant, ShowStyleVariants } from '../../../../lib/collections/ShowStyleVariants'
import { Rundowns, Rundown } from '../../../../lib/collections/Rundowns'
import { DBPart } from '../../../../lib/collections/Parts'
import { AsRunLogEvent, AsRunLog } from '../../../../lib/collections/AsRunLog'
import { IngestDataCache, IngestCacheType } from '../../../../lib/collections/IngestDataCache'
import { Pieces } from '../../../../lib/collections/Pieces'

describe('Test blueprint api context', () => {

	let env: DefaultEnvironment
	beforeAll(() => {
		env = setupDefaultStudioEnvironment()
	})

	describe('CommonContext', () => {
		test('no param', () => {
			const context = new CommonContext('pre')

			const res = context.getHashId(undefined as any)
			expect(res).toEqual(getHash('pre_hash0'))
			expect(context.unhashId(res)).toEqual('hash0')
		})
		test('no param + notUnique', () => {
			const context = new CommonContext('pre')

			const res = context.getHashId(undefined as any, true)
			expect(res).toEqual(getHash('pre_hash0_1'))
			expect(context.unhashId(res)).toEqual('hash0_1')
		})
		test('empty param', () => {
			const context = new CommonContext('pre')

			const res = context.getHashId('')
			expect(res).toEqual(getHash('pre_hash0'))
			expect(context.unhashId(res)).toEqual('hash0')

			const res2 = context.getHashId('')
			expect(res2).toEqual(getHash('pre_hash1'))
			expect(context.unhashId(res2)).toEqual('hash1')

			expect(res2).not.toEqual(res)
		})
		test('string', () => {
			const context = new CommonContext('pre')

			const res = context.getHashId('something')
			expect(res).toEqual(getHash('pre_something'))
			expect(context.unhashId(res)).toEqual('something')

			const res2 = context.getHashId('something')
			expect(res2).toEqual(getHash('pre_something'))
			expect(context.unhashId(res2)).toEqual('something')

			expect(res2).toEqual(res)
		})
		test('string + notUnique', () => {
			const context = new CommonContext('pre')

			const res = context.getHashId('something', true)
			expect(res).toEqual(getHash('pre_something_0'))
			expect(context.unhashId(res)).toEqual('something_0')

			const res2 = context.getHashId('something', true)
			expect(res2).toEqual(getHash('pre_something_1'))
			expect(context.unhashId(res2)).toEqual('something_1')

			expect(res2).not.toEqual(res)
		})
	})

	describe('NotesContext', () => {
		// TODO
	})

	describe('StudioConfigContext', () => {
		function mockStudio () {
			return setupMockStudio({
				settings: {
					sofieUrl: 'testUrl',
					mediaPreviewsUrl: ''
				},
				config: [
					{ _id: 'abc', value: true },
					{ _id: '123', value: 'val2' },
				]
			})
		}

		test('getStudio', () => {
			const studio = mockStudio()
			const context = new StudioConfigContext(studio)

			expect(context.getStudio()).toEqual(studio)
		})
		test('getStudioConfig', () => {
			const studio = mockStudio()
			const context = new StudioConfigContext(studio)

			expect(context.getStudioConfig()).toEqual({
				SofieHostURL: 'testUrl', // Injected
				abc: true,
				'123': 'val2'
			})
		})
		test('getStudioConfigRef', () => {
			const studio = mockStudio()
			const context = new StudioConfigContext(studio)

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
	})

	describe('StudioContext', () => {
		function mockStudio () {
			return setupMockStudio({
				mappings: {
					abc: {
						deviceId: 'abc',
						device: DeviceType.ABSTRACT,
						lookahead: LookaheadMode.PRELOAD
					}
				}
			})
		}

		test('getStudioMappings', () => {
			const studio = mockStudio()
			const context = new StudioContext(studio)

			expect(context.getStudioMappings()).toEqual({
				abc: {
					deviceId: 'abc',
					device: DeviceType.ABSTRACT,
					lookahead: LookaheadMode.PRELOAD
				}
			})
		})
	})

	describe('ShowStyleContext', () => {
		function mockStudio () {
			return setupMockStudio({
				mappings: {
					abc: {
						deviceId: 'abc',
						device: DeviceType.ABSTRACT,
						lookahead: LookaheadMode.PRELOAD
					}
				}
			})
		}

		function getContext (studio: Studio, contextName?: string, rundownId?: string, segmentId?: string, partId?: string) {
			const showStyleVariant = ShowStyleVariants.findOne() as ShowStyleVariant
			expect(showStyleVariant).toBeTruthy()

			return new ShowStyleContext(studio, showStyleVariant.showStyleBaseId, showStyleVariant._id, contextName, rundownId, segmentId, partId)
		}

		test('handleNotesExternally', () => {
			const studio = mockStudio()
			const context = getContext(studio)
			const notesContext = (context as any).notes as NotesContext
			expect(notesContext).toBeTruthy()

			expect(notesContext.handleNotesExternally).toEqual(context.handleNotesExternally)
			expect(notesContext.handleNotesExternally).toBeFalsy()

			// set to true
			context.handleNotesExternally = true
			expect(notesContext.handleNotesExternally).toEqual(context.handleNotesExternally)
			expect(notesContext.handleNotesExternally).toBeTruthy()

			// and back to false
			context.handleNotesExternally = false
			expect(notesContext.handleNotesExternally).toEqual(context.handleNotesExternally)
			expect(notesContext.handleNotesExternally).toBeFalsy()
		})

		test('getShowStyleBase', () => {
			const studio = mockStudio()
			const context = getContext(studio)

			const showStyleBase = context.getShowStyleBase()
			expect(showStyleBase).toBeTruthy()
			expect(showStyleBase._id).toEqual((context as any).showStyleBaseId)
		})

		test('getShowStyleConfig', () => {
			const studio = mockStudio()
			const context = getContext(studio)

			// Set some config
			ShowStyleVariants.update((context as any).showStyleVariantId, {
				$set: {
					config: [
						{ _id: 'one', value: true },
						{ _id: 'two', value: 'val2' }
					]
				}
			})
			ShowStyleBases.update((context as any).showStyleBaseId, {
				$set: {
					config: [
						{ _id: 'two', value: 'default' },
						{ _id: 'three', value: 765 }
					]
				}
			})

			expect(context.getShowStyleConfig()).toEqual({
				one: true,
				two: 'val2',
				three: 765
			})
		})

		test('getShowStyleConfigRef', () => {
			const studio = mockStudio()
			const context = getContext(studio)

			const getShowStyleConfigRef = jest.spyOn(ConfigRef, 'getShowStyleConfigRef')
			getShowStyleConfigRef.mockImplementation(() => {
				return 'configVal1'
			})

			try {
				expect(context.getShowStyleConfigRef('conf1')).toEqual('configVal1')

				expect(getShowStyleConfigRef).toHaveBeenCalledTimes(1)
				expect(getShowStyleConfigRef).toHaveBeenCalledWith((context as any).showStyleVariantId, 'conf1')
			} finally {
				getShowStyleConfigRef.mockRestore()
			}
		})

		class FakeNotesContext implements INotesContext {
			error: (message: string) => void = jest.fn()
			warning: (message: string) => void = jest.fn()
			getNotes: () => any[] = jest.fn(() => [1,2,3])
			getHashId: (originString: string, originIsNotUnique?: boolean | undefined) => string = jest.fn(() => 'hashed')
			unhashId: (hash: string) => string = jest.fn(() => 'unhash')
		}

		test('notes', () => {
			const studio = mockStudio()
			const context = getContext(studio)

			// Fake the notes context
			const fakeNotes = new FakeNotesContext()
			;(context as any).notes = fakeNotes

			context.error('this is an error')
			expect(fakeNotes.error).toHaveBeenCalledTimes(1)
			expect(fakeNotes.error).toHaveBeenCalledWith('this is an error')

			context.warning('this is an warning')
			expect(fakeNotes.warning).toHaveBeenCalledTimes(1)
			expect(fakeNotes.warning).toHaveBeenCalledWith('this is an warning')

			const notes = context.getNotes()
			expect(notes).toEqual([1,2,3])
			expect(fakeNotes.getNotes).toHaveBeenCalledTimes(1)

			const hash = context.getHashId('str 1', false)
			expect(hash).toEqual('hashed')
			expect(fakeNotes.getHashId).toHaveBeenCalledTimes(1)
			expect(fakeNotes.getHashId).toHaveBeenCalledWith('str 1', false)

			const unhash = context.unhashId('str 1')
			expect(unhash).toEqual('unhash')
			expect(fakeNotes.unhashId).toHaveBeenCalledTimes(1)
			expect(fakeNotes.unhashId).toHaveBeenCalledWith('str 1')
		})
	})

	describe('SegmentContext', () => {
		test('getRuntimeArguments empty', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = new SegmentContext(rundown, undefined, {})
			expect(context.getStudio()).toBeTruthy()

			expect(context.getRuntimeArguments('')).toBeUndefined()
			expect(context.getRuntimeArguments('part1')).toBeUndefined()
		})

		test('getRuntimeArguments with data', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = new SegmentContext(rundown, undefined, {
				part1: {
					a: 'b',
					c: 'd'
				},
				part5: {}
			})
			expect(context.getStudio()).toBeTruthy()

			expect(context.getRuntimeArguments('')).toBeUndefined()
			expect(context.getRuntimeArguments('part1')).toEqual({
				a: 'b',
				c: 'd'
			})
			expect(context.getRuntimeArguments('part2')).toBeUndefined()
			expect(context.getRuntimeArguments('part5')).toEqual({})
		})

		test('getRuntimeArguments from parts data', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = new SegmentContext(rundown, undefined, [
				literal<Partial<DBPart>>({
					externalId: 'part1',
					runtimeArguments: {
						a: 'b',
						c: 'd'
					}
				}) as DBPart,
				literal<Partial<DBPart>>({
					externalId: 'part2'
				}) as DBPart,
				literal<Partial<DBPart>>({
					externalId: 'part5',
					runtimeArguments: {}
				}) as DBPart
			])
			expect(context.getStudio()).toBeTruthy()

			expect(context.getRuntimeArguments('')).toBeUndefined()
			expect(context.getRuntimeArguments('part1')).toEqual({
				a: 'b',
				c: 'd'
			})
			expect(context.getRuntimeArguments('part2')).toBeUndefined()
			expect(context.getRuntimeArguments('part5')).toEqual({})
		})
	})

	describe('PartContext', () => {
		test('getRuntimeArguments with data', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = new PartContext(rundown, undefined, {
				a: 'b',
				c: 'd'
			})
			expect(context.getStudio()).toBeTruthy()

			expect(context.getRuntimeArguments()).toEqual({
				a: 'b',
				c: 'd'
			})
		})

		test('getRuntimeArguments', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = new PartContext(rundown, undefined, {})
			expect(context.getStudio()).toBeTruthy()

			expect(context.getRuntimeArguments()).toEqual({})
		})
	})

	describe('PartEventContext', () => {
		test('get part', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const mockPart = {
				_id: 'not-a-real-part'
			}

			const context = new PartEventContext(rundown, undefined, mockPart as IBlueprintPartDB)
			expect(context.getStudio()).toBeTruthy()

			expect(context.part).toEqual(mockPart)
		})
	})

	describe('AsRunEventContext', () => {
		function getContext (rundown: Rundown, event?: Partial<AsRunLogEvent>) {
			const mockEvent: AsRunLogEvent = {
				_id: `${rundown._id}_tmp`,
				timestamp: Date.now(),
				rundownId: rundown._id,
				studioId: rundown.studioId,
				rehersal: false,
				content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				...event
			}

			return new AsRunEventContext(rundown, undefined, mockEvent)
		}
		test('getAllAsRunEvents', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const mockEvent: AsRunLogEvent = {
				_id: `${rundown._id}_tmp`,
				timestamp: Date.now(),
				rundownId: rundown._id,
				studioId: rundown.studioId,
				rehersal: false,
				content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK
			}

			const context = new AsRunEventContext(rundown, undefined, mockEvent)
			expect(context.getStudio()).toBeTruthy()
			expect(context.asRunEvent).toEqual(mockEvent)

			// Should be no events yet
			expect(context.getAllAsRunEvents()).toHaveLength(0)

			AsRunLog.insert({
				_id: `${rundown._id}_event1`,
				timestamp: Date.now() - 1000,
				rundownId: rundown._id,
				studioId: rundown.studioId,
				rehersal: true,
				content: IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK
			})
			AsRunLog.insert(mockEvent)
			AsRunLog.insert({
				_id: `${rundown._id}_event2`,
				timestamp: Date.now() - 2000,
				rundownId: rundown._id,
				studioId: rundown.studioId,
				rehersal: true,
				content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK
			})

			// Should now be some
			const events = context.getAllAsRunEvents()
			expect(events).toHaveLength(3)
			expect(_.pluck(events, '_id')).toEqual([
				`${rundown._id}_event2`,
				`${rundown._id}_event1`,
				`${rundown._id}_tmp`
			])
		})

		test('getSegments', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Should be some defaults
			expect(_.pluck(context.getSegments(), '_id')).toEqual([
				`${rundown._id}_segment0`,
				`${rundown._id}_segment1`,
				`${rundown._id}_segment2`
			])
		})

		test('getSegment - no id', () => {
			const rundownId = setupDefaultRundown(env)
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
		test('getSegment - empty id', () => {
			const rundownId = setupDefaultRundown(env)
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
		test('getSegment - unknown id', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			expect(context.getSegment('not-a-real-segment')).toBeUndefined()
		})
		test('getSegment - good', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			const segment = context.getSegment(`${rundown._id}_segment1`) as IBlueprintSegmentDB
			expect(segment).toBeTruthy()
			expect(segment._id).toEqual(`${rundown._id}_segment1`)
		})
		test('getSegment - empty id with event segmentId', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, {
				segmentId: `${rundown._id}_segment0`
			})

			const segment = context.getSegment('') as IBlueprintSegmentDB
			expect(segment).toBeTruthy()
			expect(segment._id).toEqual(`${rundown._id}_segment0`)
		})
		test('getSegment - good with event segmentId', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, {
				segmentId: `${rundown._id}_segment1`
			})

			const segment = context.getSegment(`${rundown._id}_segment2`) as IBlueprintSegmentDB
			expect(segment).toBeTruthy()
			expect(segment._id).toEqual(`${rundown._id}_segment2`)
		})

		test('getParts', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Should be some defaults
			expect(_.pluck(context.getParts(), '_id')).toEqual([
				`${rundown._id}_part0_0`,
				`${rundown._id}_part0_1`,
				`${rundown._id}_part1_0`,
				`${rundown._id}_part1_1`,
				`${rundown._id}_part1_2`
			])
		})

		test('getPart - no id', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			try {
				// Event doesnt have a segment id
				context.getPart()
				// Should not get here
				expect(false).toBeTruthy()
			} catch (e) {
				expect(e.message).toEqual('Match error: Expected string, got undefined')
			}
		})
		test('getPart - empty id', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			try {
				context.getPart('')
				// Should not get here
				expect(false).toBeTruthy()
			} catch (e) {
				expect(e.message).toEqual('Match error: Expected string, got undefined')
			}
		})
		test('getPart - unknown id', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			expect(context.getPart('not-a-real-part')).toBeUndefined()
		})
		test('getPart - good', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			const part = context.getPart(`${rundown._id}_part1_0`) as IBlueprintPartDB
			expect(part).toBeTruthy()
			expect(part._id).toEqual(`${rundown._id}_part1_0`)
		})
		test('getPart - empty id with event partId', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, {
				partId: `${rundown._id}_part1_1`
			})

			const part = context.getPart('') as IBlueprintPartDB
			expect(part).toBeTruthy()
			expect(part._id).toEqual(`${rundown._id}_part1_1`)
		})
		test('getPart - good with event partId', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, {
				partId: `${rundown._id}_part1_2`
			})

			const part = context.getPart(`${rundown._id}_part0_1`) as IBlueprintPartDB
			expect(part).toBeTruthy()
			expect(part._id).toEqual(`${rundown._id}_part0_1`)
		})

		test('getIngestDataForPart - no part', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			try {
				context.getIngestDataForPart(undefined as any)
				// Should not get here
				expect(false).toBeTruthy()
			} catch (e) {
				expect(e.message).toEqual('Cannot read property \'_id\' of undefined')
			}
		})
		test('getIngestDataForPart - no id', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			try {
				context.getIngestDataForPart({} as any)
				// Should not get here
				expect(false).toBeTruthy()
			} catch (e) {
				expect(e.message).toEqual('Match error: Expected string, got undefined')
			}
		})
		test('getIngestDataForPart - no data', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			const part = rundown.getParts()[3]
			expect(part).toBeTruthy()

			const ingestPart = context.getIngestDataForPart(part)
			expect(ingestPart).toBeUndefined()
		})
		test('getIngestDataForPart - good', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			const part = rundown.getParts()[3]
			expect(part).toBeTruthy()

			IngestDataCache.insert({
				_id: '',
				rundownId: rundown._id,
				segmentId: part.segmentId,
				partId: part._id,
				type: IngestCacheType.PART,
				modified: 0,
				data: {
					fakeData: true
				} as any
			})

			const ingestPart = context.getIngestDataForPart(part)
			expect(ingestPart).toEqual({
				fakeData: true
			})
		})

		test('getIngestDataForRundown - no data', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			const ingestRundown = context.getIngestDataForRundown()
			expect(ingestRundown).toBeUndefined()
		})
		// TODO
		// test('getIngestDataForRundown - good', () => {
		// 	const rundownId = setupDefaultRundown(env)
		// 	const rundown = Rundowns.findOne(rundownId) as Rundown
		// 	expect(rundown).toBeTruthy()

		// 	const context = getContext(rundown)

		// 	const ingestRundown = context.getIngestDataForRundown()
		// 	expect(ingestRundown).toBeUndefined()
		// })

		function generateSparsePieces (rundown: Rundown) {
			_.each(rundown.getParts(), (part, i) => {
				const count = ((i + 2) % 4) + 1 // Some consistent randomness
				for (let i = 0; i < count; i++) {
					const id = `${part._id}_piece${i}`
					Pieces.insert({
						_id: id,
						rundownId: rundown._id,
						partId: part._id,
						content: {
							index: i
						}
					} as any)
				}
			})
		}

		test('getPieces - good', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieces(rundown)

			const part = rundown.getParts()[3]
			expect(part).toBeTruthy()

			// Should be some defaults
			expect(_.pluck(context.getPieces(part._id), '_id')).toEqual([
				`${rundown._id}_part1_1_piece0`,
				`${rundown._id}_part1_1_piece1`
			])
		})
		test('getPieces - bad id', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieces(rundown)

			// Should be some defaults
			expect(context.getPieces('not-a-real-part')).toHaveLength(0)
		})
		test('getPieces - empty id', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieces(rundown)

			// Should be some defaults
			expect(context.getPieces('')).toHaveLength(0)
		})

		test('getPiece - no id', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieces(rundown)

			expect(context.getPiece()).toBeUndefined()
		})
		test('getPiece - empty id', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieces(rundown)

			expect(context.getPiece('')).toBeUndefined()
		})
		test('getPiece - unknown id', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieces(rundown)

			expect(context.getPiece('not-a-real-piece')).toBeUndefined()
		})
		test('getPiece - good', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			// Generate some pieces
			generateSparsePieces(rundown)

			const piece = context.getPiece(`${rundown._id}_part0_1_piece3`) as IBlueprintPieceDB
			expect(piece).toBeTruthy()
			expect(piece._id).toEqual(`${rundown._id}_part0_1_piece3`)
		})
		test('getPiece - empty id with event pieceId', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, {
				pieceId: `${rundown._id}_part0_1_piece2`
			})

			// Generate some pieces
			generateSparsePieces(rundown)

			const piece = context.getPiece('') as IBlueprintPieceDB
			expect(piece).toBeTruthy()
			expect(piece._id).toEqual(`${rundown._id}_part0_1_piece2`)
		})
		test('getPiece - good with event pieceId', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown, {
				pieceId: `${rundown._id}_part0_1_piece2`
			})

			// Generate some pieces
			generateSparsePieces(rundown)

			const piece = context.getPiece(`${rundown._id}_part1_2_piece0`) as IBlueprintPieceDB
			expect(piece).toBeTruthy()
			expect(piece._id).toEqual(`${rundown._id}_part1_2_piece0`)
		})

		test('formatDateAsTimecode', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			expect(context.formatDateAsTimecode(0)).toEqual('00:00:00:00')
			expect(context.formatDateAsTimecode(1571679214880)).toEqual('18:33:34:22')
		})

		test('formatDurationAsTimecode', () => {
			const rundownId = setupDefaultRundown(env)
			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()

			const context = getContext(rundown)

			expect(context.formatDurationAsTimecode(0)).toEqual('00:00:00:00')
			expect(context.formatDurationAsTimecode(10000)).toEqual('00:00:10:00')
			expect(context.formatDurationAsTimecode(12345678)).toEqual('03:25:45:16')
		})
	})

})
