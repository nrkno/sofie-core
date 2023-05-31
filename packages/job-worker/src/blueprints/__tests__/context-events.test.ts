import * as _ from 'underscore'
import { IBlueprintSegmentDB, IBlueprintPieceInstance } from '@sofie-automation/blueprints-integration'
import {
	PartEventContext,
	OnTimelineGenerateContext,
	RundownDataChangedEventContext,
	RundownTimingEventContext,
} from '../context'
import { PartInstanceId, PieceInstanceInfiniteId, PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionInfo, DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { wrapPartToTemporaryInstance } from '../../__mocks__/partinstance'
import { ReadonlyDeep } from 'type-fest'
import { convertPartInstanceToBlueprints } from '../context/lib'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { ProcessedShowStyleCompound } from '../../jobs'

describe('Test blueprint api context', () => {
	async function generateSparsePieceInstances(rundown: DBRundown) {
		const playlistActivationId = protectString('active')

		const parts = await jobContext.mockCollections.Parts.findFetch({ rundownId: rundown._id })
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]

			// make into a partInstance
			await jobContext.mockCollections.PartInstances.insertOne({
				_id: protectString(`${part._id}_instance`),
				playlistActivationId: playlistActivationId,
				segmentPlayoutId: protectString(part.segmentId + '_1'),
				rundownId: part.rundownId,
				segmentId: part.segmentId,
				takeCount: i,
				rehearsal: false,
				part,
			})

			const count = ((i + 2) % 4) + 1 // Some consistent randomness
			for (let o = 0; o < count; o++) {
				await jobContext.mockCollections.PieceInstances.insertOne({
					_id: protectString(`${part._id}_piece${o}`),
					rundownId: rundown._id,
					playlistActivationId: playlistActivationId,
					partInstanceId: protectString(`${part._id}_instance`),
					piece: {
						_id: protectString(`${part._id}_piece_inner${o}`),
						rundownId: rundown._id,
						partId: part._id,
						content: {
							index: o,
						},
						timelineObjectsString: EmptyPieceTimelineObjectsBlob,
					},
				} as any)
			}
		}
	}

	let jobContext: MockJobContext
	let showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
	beforeEach(async () => {
		jobContext = setupDefaultJobEnvironment()

		showStyle = await setupMockShowStyleCompound(jobContext)
	})

	describe('PartEventContext', () => {
		test('get part', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext, showStyle)

			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			const playlist = (await jobContext.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()

			const showStyleConfig = jobContext.getShowStyleBlueprintConfig(showStyle)

			const mockPart = {
				_id: protectString('not-a-real-part'),
			}

			const tmpPart = wrapPartToTemporaryInstance(protectString('active'), mockPart as DBPart)
			const context = new PartEventContext(
				'fake',
				jobContext.studio,
				jobContext.getStudioBlueprintConfig(),
				showStyle,
				showStyleConfig,
				rundown,
				tmpPart
			)
			expect(context.studio).toBeTruthy()

			expect(context.part).toEqual(convertPartInstanceToBlueprints(tmpPart))
		})
	})

	describe('RundownDataChangedEventContext', () => {
		async function getContext(rundown: DBRundown) {
			const playlist = (await jobContext.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()

			return new RundownDataChangedEventContext(
				jobContext,
				{
					name: 'as-run',
					identifier: unprotectString(rundown._id),
				},
				showStyle,
				rundown
			)
		}

		test('formatDateAsTimecode', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			const context = await getContext(rundown)

			const d = new Date('2019-01-01 18:33:34:896')
			expect(context.formatDateAsTimecode(d.getTime())).toEqual('18:33:34:22')
		})

		test('formatDurationAsTimecode', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			const context = await getContext(rundown)

			expect(context.formatDurationAsTimecode(0)).toEqual('00:00:00:00')
			expect(context.formatDurationAsTimecode(10000)).toEqual('00:00:10:00')
			expect(context.formatDurationAsTimecode(12345678)).toEqual('03:25:45:16')
		})
	})

	describe('RundownTimingEventContext', () => {
		async function getContext(
			rundown: DBRundown,
			previousPartInstance: DBPartInstance | undefined,
			partInstance: DBPartInstance,
			nextPartInstance: DBPartInstance | undefined
		) {
			const playlist = (await jobContext.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()

			return new RundownTimingEventContext(
				jobContext,
				{
					name: 'as-run',
					identifier: unprotectString(rundown._id),
				},
				showStyle,
				rundown,
				previousPartInstance,
				partInstance,
				nextPartInstance
			)
		}

		test('getFirstPartInstanceInRundown', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const context = await getContext(rundown, undefined, partInstance, undefined)
			await expect(context.getFirstPartInstanceInRundown()).resolves.toMatchObject({
				_id: partInstance._id,
			})

			// look for a different playlistActivationId
			partInstance.playlistActivationId = protectString('something-else')

			const context2 = await getContext(rundown, undefined, partInstance, undefined)
			await expect(context2.getFirstPartInstanceInRundown()).rejects.toThrow('No PartInstances found for Rundown')
		})

		test('getFirstPartInstanceInRundown - allowUntimed', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			await jobContext.mockCollections.PartInstances.update(partInstance._id, {
				$set: {
					'part.untimed': true,
				},
			})

			const secondPartInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
				_id: { $ne: partInstance._id },
			})) as DBPartInstance
			expect(secondPartInstance).toBeTruthy()
			expect(secondPartInstance.playlistActivationId).toBe(partInstance.playlistActivationId)

			const context = await getContext(rundown, undefined, partInstance, undefined)
			// Get the 'timed' partInstance
			await expect(context.getFirstPartInstanceInRundown()).resolves.toMatchObject({
				_id: secondPartInstance._id,
			})

			// Get the 'untimed' partInstance
			await expect(context.getFirstPartInstanceInRundown(true)).resolves.toMatchObject({
				_id: partInstance._id,
			})
		})

		test('getPartInstancesInSegmentPlayoutId', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			// Check what was generated
			const context = await getContext(rundown, undefined, partInstance, undefined)
			await expect(
				context.getPartInstancesInSegmentPlayoutId(convertPartInstanceToBlueprints(partInstance))
			).resolves.toHaveLength(2)

			// Insert a new instance, and try again
			await jobContext.mockCollections.PartInstances.insertOne({
				...partInstance,
				_id: getRandomId(),
				segmentPlayoutId: protectString('new segment'),
			})

			await expect(
				context.getPartInstancesInSegmentPlayoutId(convertPartInstanceToBlueprints(partInstance))
			).resolves.toHaveLength(2)
		})

		test('getPieceInstances', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const pieceInstance = (await jobContext.mockCollections.PieceInstances.findOne({
				rundownId,
			})) as PieceInstance
			expect(pieceInstance).toBeTruthy()

			// Check what was generated
			const context = await getContext(rundown, undefined, partInstance, undefined)
			await expect(
				context.getPieceInstances(unprotectString(pieceInstance.partInstanceId))
			).resolves.toHaveLength(3)

			// mark one of the piece as different activation
			await jobContext.mockCollections.PieceInstances.update(pieceInstance._id, {
				$set: { playlistActivationId: protectString('another activation') },
			})

			// should now be less
			await expect(
				context.getPieceInstances(unprotectString(pieceInstance.partInstanceId))
			).resolves.toHaveLength(2)
		})

		test('getSegment - no id', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const context = await getContext(rundown, undefined, partInstance, undefined)

			await expect(
				// @ts-expect-error
				context.getSegment()
			).resolves.toBeUndefined()
		})
		test('getSegment - unknown id', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const context = await getContext(rundown, undefined, partInstance, undefined)

			await expect(context.getSegment('not-a-real-segment')).resolves.toBeUndefined()
		})
		test('getSegment - good', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const context = await getContext(rundown, undefined, partInstance, undefined)

			const segment = (await context.getSegment(`${rundown._id}_segment1`)) as IBlueprintSegmentDB
			expect(segment).toBeTruthy()
			expect(segment._id).toEqual(`${rundown._id}_segment1`)
		})
		test('getSegment - good with event segmentId', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const context = await getContext(rundown, undefined, partInstance, undefined)

			const segment = (await context.getSegment(`${rundown._id}_segment2`)) as IBlueprintSegmentDB
			expect(segment).toBeTruthy()
			expect(segment._id).toEqual(`${rundown._id}_segment2`)
		})
	})

	describe('OnTimelineGenerateContext', () => {
		const getSessionId = (n: number): string => `session#${n}`
		async function getContext(
			rundown: DBRundown,
			previousPartInstance: DBPartInstance | undefined,
			currentPartInstance: DBPartInstance | undefined,
			nextPartInstance: DBPartInstance | undefined
		) {
			const playlist = (await jobContext.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()

			const context = new OnTimelineGenerateContext(
				jobContext.studio,
				jobContext.getStudioBlueprintConfig(),
				showStyle,
				jobContext.getShowStyleBlueprintConfig(showStyle),
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

		function getAllKnownSessions(context: OnTimelineGenerateContext): ABSessionInfo[] {
			const sessions: ABSessionInfo[] = (context as any)._knownSessions
			expect(sessions).toBeTruthy()

			return sessions.map((s) => _.omit<ABSessionInfo & { keep?: boolean }, 'keep'>(s, 'keep'))
		}
		// function overwriteKnownSessions(context: TimelineEventContext, sessions: ABSessionInfo[]): void {
		// 	const context2 = context as any
		// 	context2._knownSessions = sessions
		// }
		function createPieceInstance(
			context: OnTimelineGenerateContext,
			partInstanceId: PartInstanceId | string,
			infiniteInstanceId?: PieceInstanceInfiniteId
		): IBlueprintPieceInstance {
			// This defines only the minimum required values for the method we are calling
			const pieceInstance = {
				_id: getRandomId(),
				partInstanceId,
				infinite: infiniteInstanceId ? { infiniteInstanceId } : undefined,
			} as any

			context.trackPieceInstances([pieceInstance])

			return pieceInstance
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
		function createPartInstance(id: string, partId: string, rank: number): DBPartInstance {
			// This defines only the minimum required values for the method we are calling
			return {
				_id: id,
				part: {
					_id: partId,
					_rank: rank,
				},
			} as any
		}

		test('getPieceABSessionId - knownSessions basic', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			// No sessions
			{
				const context = await getContext(rundown, undefined, undefined, undefined)
				expect(context.knownSessions).toEqual([])
			}

			// some sessions
			{
				const sessions: ABSessionInfo[] = [{ id: 'abc', name: 'no' }]
				// Mod the sessions to be returned by knownSessions
				const moddedSessions = sessions.map((s) => ({ ...s, keep: true }))
				await jobContext.mockCollections.RundownPlaylists.update(rundown.playlistId, {
					$set: {
						trackedAbSessions: moddedSessions,
					},
				})
				const context = await getContext(rundown, undefined, undefined, undefined)
				expect(context.knownSessions).toEqual(sessions)
			}
		})

		test('getPieceABSessionId - bad parameters', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			{
				const context = await getContext(rundown, undefined, undefined, undefined)

				const piece1 = createPieceInstance(context, undefined as any)
				expect(() => context.getPieceABSessionId(piece1, 'name0')).toThrow(
					'Missing partInstanceId in call to getPieceABSessionId'
				)

				const piece2 = createPieceInstance(context, 'defdef')
				expect(() => context.getPieceABSessionId(piece2, 'name0')).toThrow(
					'Unknown partInstanceId in call to getPieceABSessionId'
				)
			}

			{
				const tmpPartInstance = createPartInstance('abcdef', 'aaa', 1)
				const context = await getContext(rundown, undefined, undefined, tmpPartInstance)

				const piece0 = createPieceInstance(context, 'defdef')
				expect(() => context.getPieceABSessionId(piece0, 'name0')).toThrow(
					'Unknown partInstanceId in call to getPieceABSessionId'
				)

				const piece1 = createPieceInstance(context, 'abcdef')
				expect(context.getPieceABSessionId(piece1, 'name0')).toBeTruthy()
			}
		})

		test('getPieceABSessionId - normal session', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const currentPartInstance = createPartInstance('12345', 'bbb', 0)
			const context = await getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			// Get the id
			const piece0 = createPieceInstance(context, nextPartInstance._id)
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

			const piece1 = createPieceInstance(context, nextPartInstance._id)
			expect(context.getPieceABSessionId(piece1, 'name0')).toEqual(expectedSessions[0].id)
			expect(getAllKnownSessions(context)).toEqual(expectedSessions)
			expect(context.knownSessions).toHaveLength(1)

			// Try for the other part
			const piece2 = createPieceInstance(context, currentPartInstance._id)
			expect(context.getPieceABSessionId(piece2, 'name0')).not.toEqual(expectedSessions[0].id)
			expect(context.knownSessions).toHaveLength(2)

			// Or another name
			expect(context.getPieceABSessionId(piece1, 'name1')).not.toEqual(expectedSessions[0].id)
			expect(context.knownSessions).toHaveLength(3)
		})

		test('getPieceABSessionId - existing normal sessions', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
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
			await jobContext.mockCollections.RundownPlaylists.update(rundown.playlistId, {
				$set: {
					trackedAbSessions: expectedSessions,
				},
			})

			const context = await getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			// Reuse the ids
			const piece0 = createPieceInstance(context, currentPartInstance._id)
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual(expectedSessions[0].id)
			expect(getAllKnownSessions(context)).toEqual(expectedSessions)
			expect(context.knownSessions).toHaveLength(1)

			const piece1 = createPieceInstance(context, currentPartInstance._id)
			expect(context.getPieceABSessionId(piece1, 'name1')).toEqual(expectedSessions[1].id)
			expect(getAllKnownSessions(context)).toEqual(expectedSessions)
			expect(context.knownSessions).toHaveLength(2)

			const piece2 = createPieceInstance(context, nextPartInstance._id)
			expect(context.getPieceABSessionId(piece2, 'name0')).toEqual(expectedSessions[2].id)
			expect(getAllKnownSessions(context)).toEqual(expectedSessions)
			expect(context.knownSessions).toHaveLength(3)
		})

		test('getPieceABSessionId - continue normal session from previous part', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const currentPartInstance = createPartInstance('12345', 'bbb', 0)

			const context = await getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			const sessionId = getSessionId(0)
			const piece0 = createPieceInstance(context, currentPartInstance._id)
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual(sessionId)
			expect(context.knownSessions).toHaveLength(1)

			const piece2 = createPieceInstance(context, nextPartInstance._id)
			expect(context.getPieceABSessionId(piece2, 'name0')).toEqual(sessionId)
			expect(context.knownSessions).toHaveLength(1)
		})

		test('getPieceABSessionId - promote lookahead session from previous part', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
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
			await jobContext.mockCollections.RundownPlaylists.update(rundown.playlistId, {
				$set: {
					trackedAbSessions: lookaheadSessions,
				},
			})

			const context = await getContext(rundown, previousPartInstance, currentPartInstance, undefined)

			// lookahead0 is for us
			const piece0 = createPieceInstance(context, currentPartInstance._id)
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual('lookahead0')
			expect(context.knownSessions).toHaveLength(1)

			// lookahead1 is for us
			const piece1 = createPieceInstance(context, currentPartInstance._id)
			expect(context.getPieceABSessionId(piece1, 'name1')).toEqual('lookahead1')
			expect(context.knownSessions).toHaveLength(2)

			// lookahead2 is not for us, so we shouldnt get it
			const sessionId = getSessionId(0)
			const piece2 = createPieceInstance(context, currentPartInstance._id)
			expect(context.getPieceABSessionId(piece2, 'name2')).toEqual(sessionId)
			expect(context.knownSessions).toHaveLength(3)
		})

		test('getPieceABSessionId - infinite sessions', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			const nextPartInstance = createPartInstance('abcdef', 'aaa', 1)
			const currentPartInstance = createPartInstance('12345', 'bbb', 10)

			const context = await getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			// Start a new infinite session
			const sessionId0 = getSessionId(0)
			const infinite0 = protectString('infinite0')
			const piece0 = createPieceInstance(context, currentPartInstance._id, infinite0)
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual(sessionId0)
			expect(context.knownSessions).toHaveLength(1)

			// Double check the reuslt
			expect(context.getPieceABSessionId(piece0, 'name0')).toEqual(sessionId0)
			expect(context.knownSessions).toHaveLength(1)

			// Normal piece in the same part gets different id
			const sessionId1 = getSessionId(1)
			const piece1 = createPieceInstance(context, currentPartInstance._id)
			expect(context.getPieceABSessionId(piece1, 'name0')).toEqual(sessionId1)
			expect(context.knownSessions).toHaveLength(2)

			// Span session to a part with a lower rank
			const piece2 = createPieceInstance(context, nextPartInstance._id, infinite0)
			expect(context.getPieceABSessionId(piece2, 'name0')).toEqual(sessionId0)
			expect(context.knownSessions).toHaveLength(2)
		})

		test('getTimelineObjectAbSessionId - bad parameters', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			const context = await getContext(rundown, undefined, undefined, undefined)

			// no session needed
			expect(context.getTimelineObjectAbSessionId({} as any, 'name0')).toBeUndefined()

			// unknown partInstance
			const obj1 = createTimelineObject('abcd')
			expect(context.getTimelineObjectAbSessionId(obj1, 'name0')).toBeUndefined()
		})

		function generateGetTimelineObjectAbSessionIdSessions(
			currentPartInstance: DBPartInstance,
			nextPartInstance: DBPartInstance,
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
			]
		}

		test('getTimelineObjectAbSessionId - normal', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
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
			await jobContext.mockCollections.RundownPlaylists.update(rundown.playlistId, {
				$set: {
					trackedAbSessions: existingSessions,
				},
			})

			const context = await getContext(rundown, undefined, currentPartInstance, nextPartInstance)

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

		test('getTimelineObjectAbSessionId - lookahead', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
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
			await jobContext.mockCollections.RundownPlaylists.update(rundown.playlistId, {
				$set: {
					trackedAbSessions: [...existingSessions],
				},
			})

			const context = await getContext(rundown, undefined, currentPartInstance, nextPartInstance)

			// no session if no partId
			const obj1 = createTimelineObject(null, undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj1, 'name0')).toBeUndefined()
			expect(context.knownSessions).toHaveLength(0)

			// existing 'distant' lookahead session
			const obj2 = createTimelineObject(unprotectString(distantPartId), undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj2, 'name2')).toEqual('lookahead2')
			expect(context.knownSessions).toHaveLength(1)

			// new 'distant' lookahead session
			const obj2a = createTimelineObject(unprotectString(distantPartId), undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj2a, 'name0')).toEqual(getSessionId(0))
			expect(context.knownSessions).toHaveLength(2)
			existingSessions.push({
				id: getSessionId(0),
				lookaheadForPartId: distantPartId,
				name: 'name0',
			})

			// current partInstance session
			const obj3 = createTimelineObject(currentPartInstance._id, undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj3, 'name1')).toEqual('current1')
			expect(context.knownSessions).toHaveLength(3)

			// next partInstance session
			const obj4 = createTimelineObject(nextPartInstance._id, undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj4, 'name0')).toEqual('next0')
			expect(context.knownSessions).toHaveLength(4)

			// next partInstance new session
			const obj5 = createTimelineObject(nextPartInstance._id, undefined, true)
			expect(context.getTimelineObjectAbSessionId(obj5, 'name1')).toEqual(getSessionId(1))
			expect(context.knownSessions).toHaveLength(5)

			existingSessions.push({
				id: getSessionId(1),
				lookaheadForPartId: nextPartInstance.part._id,
				name: 'name1',
				partInstanceIds: [nextPartInstance._id],
			})

			// Ensure the sessions havent changed
			expect(getAllKnownSessions(context)).toEqual(existingSessions)
		})

		test('getTimelineObjectAbSessionId - lookahead2', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
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
			await jobContext.mockCollections.RundownPlaylists.update(rundown.playlistId, {
				$set: {
					trackedAbSessions: [...existingSessions],
				},
			})

			const context = await getContext(rundown, undefined, currentPartInstance, nextPartInstance)

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
