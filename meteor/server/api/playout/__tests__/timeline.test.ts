import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { fixSnapshot } from '../../../../__mocks__/helpers/snapshot'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupMockPeripheralDevice,
} from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown, RundownId } from '../../../../lib/collections/Rundowns'
import '../api'
import { Timeline, TimelineComplete, TimelineEnableExt } from '../../../../lib/collections/Timeline'
import { ServerPlayoutAPI } from '../playout'
import { updateTimeline } from '../timeline'
import { RundownPlaylists, RundownPlaylist, RundownPlaylistId } from '../../../../lib/collections/RundownPlaylists'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { PlayoutLockFunctionPriority, runPlayoutOperationWithCache } from '../lockFunction'
import { VerifiedRundownPlaylistContentAccess } from '../../lib'
import {
	setupRundownWithInTransitionExistingInfinite,
	setupRundownWithInTransition,
	setupRundownWithInTransitionContentDelay,
	setupRundownWithInTransitionContentDelayAndPreroll,
	setupRundownWithPreroll,
	setupRundownWithInTransitionNewInfinite,
	setupRundownWithInTransitionPlannedPiece,
	setupRundownWithInTransitionEnableHold,
	setupRundownWithInTransitionDisabled,
	setupRundownWithOutTransition,
	setupRundownWithOutTransitionAndPreroll,
	setupRundownWithOutTransitionAndPreroll2,
	setupRundownWithOutTransitionAndInTransition,
	setupRundownWithOutTransitionEnableHold,
} from './helpers/rundowns'
import { PartInstance, PartInstanceId } from '../../../../lib/collections/PartInstances'
import { getPartGroupId, getPieceGroupId } from '../../../../lib/rundown/timeline'
import { normalizeArrayToMap, protectString, unprotectString } from '../../../../lib/lib'
import { PieceInstances } from '../../../../lib/collections/PieceInstances'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'

function DEFAULT_ACCESS(rundownPlaylistID: RundownPlaylistId): VerifiedRundownPlaylistContentAccess {
	const playlist = RundownPlaylists.findOne(rundownPlaylistID) as RundownPlaylist
	expect(playlist).toBeTruthy()
	return { userId: null, organizationId: null, studioId: null, playlist: playlist, cred: {} }
}

interface PartTimelineTimings {
	previousPart: TimelineEnableExt
	currentPieces: { [id: string]: TimelineEnableExt | TimelineEnableExt[] | null }
	currentInfinitePieces: {
		[id: string]: {
			partGroup: TimelineEnableExt | TimelineEnableExt[]
			pieceGroup: TimelineEnableExt | TimelineEnableExt[]
		} | null
	}
	previousOutTransition: TimelineEnableExt | TimelineEnableExt[] | null | undefined
}

async function checkTimingsRaw(
	rundownId: RundownId,
	timeline: TimelineComplete | undefined,
	currentPartInstance: PartInstance,
	previousPartInstance: PartInstance,
	timings: PartTimelineTimings
) {
	const objs = normalizeArrayToMap(timeline?.timeline ?? [], 'id')

	// previous part group
	const prevPartTlObj = objs.get(getPartGroupId(previousPartInstance))
	expect(prevPartTlObj).toBeTruthy()
	expect(prevPartTlObj?.enable).toMatchObject(timings.previousPart)

	// current part group is assumed to start at now

	// Current pieces
	const currentPieces = await PieceInstances.findFetchAsync({
		partInstanceId: currentPartInstance._id,
	})
	const targetCurrentPieces: PartTimelineTimings['currentPieces'] = {}
	const targetCurrentInfinitePieces: PartTimelineTimings['currentInfinitePieces'] = {}
	for (const piece of currentPieces) {
		const entryId = unprotectString(piece.piece._id).substring(unprotectString(rundownId).length + 1)

		if (piece.piece.lifespan === PieceLifespan.WithinPart) {
			const pieceObj = objs.get(getPieceGroupId(piece))

			targetCurrentPieces[entryId] = pieceObj ? pieceObj.enable : null
		} else {
			const partGroupId = getPartGroupId(protectString<PartInstanceId>(unprotectString(piece._id))) + '_infinite'
			const partObj = objs.get(partGroupId)
			if (!partObj) {
				targetCurrentInfinitePieces[entryId] = null
			} else {
				const pieceObj = objs.get(getPieceGroupId(piece))

				targetCurrentInfinitePieces[entryId] = {
					partGroup: partObj.enable,
					pieceGroup: pieceObj?.enable ?? [],
				}
			}
		}
	}
	expect(timings.currentPieces).toEqual(targetCurrentPieces)
	expect(timings.currentInfinitePieces).toEqual(targetCurrentInfinitePieces)

	// Previous pieces
	const previousPieces = await PieceInstances.findFetchAsync({
		partInstanceId: previousPartInstance._id,
	})
	let previousOutTransition: PartTimelineTimings['previousOutTransition']
	for (const piece of previousPieces) {
		if (piece.piece.isOutTransition) {
			if (previousOutTransition !== undefined) throw new Error('Too many out transition pieces were found')

			const pieceObj = objs.get(getPieceGroupId(piece))
			previousOutTransition = pieceObj?.enable ?? null
		}
	}
	expect(timings.previousOutTransition).toEqual(previousOutTransition)
}

describe('Timeline', () => {
	let env: DefaultEnvironment
	beforeEach(async () => {
		env = await setupDefaultStudioEnvironment()
	})
	testInFiber('Basic rundown', async () => {
		setupMockPeripheralDevice(
			PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
			PeripheralDeviceAPI.DeviceType.PLAYOUT,
			PeripheralDeviceAPI.SUBTYPE_PROCESS,
			env.studio
		)
		const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(env)
		expect(rundownId0).toBeTruthy()
		expect(playlistId0).toBeTruthy()

		const getRundown0 = () => {
			return Rundowns.findOne(rundownId0) as Rundown
		}
		const getPlaylist0 = () => {
			const playlist = RundownPlaylists.findOne(playlistId0) as RundownPlaylist
			playlist.activationId = playlist.activationId ?? undefined
			return playlist
		}
		expect(getRundown0()).toBeTruthy()
		expect(getPlaylist0()).toBeTruthy()

		const parts = getRundown0().getParts()

		expect(getPlaylist0()).toMatchObject({
			activationId: undefined,
			rehearsal: false,
		})

		{
			// Prepare and activate in rehersal:
			await ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_ACCESS(playlistId0), playlistId0, false)
			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeFalsy()
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance!.part._id).toEqual(parts[0]._id)
			expect(getPlaylist0()).toMatchObject({
				activationId: expect.stringMatching(/^randomId/),
				rehearsal: false,
				currentPartInstanceId: null,
				// nextPartInstanceId: parts[0]._id,
			})
		}

		{
			// Take the first Part:
			await ServerPlayoutAPI.takeNextPart(DEFAULT_ACCESS(playlistId0), playlistId0)
			const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
			expect(currentPartInstance).toBeTruthy()
			expect(nextPartInstance).toBeTruthy()
			expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
			expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
			// expect(getPlaylist0()).toMatchObject({
			// 	currentPartInstanceId: parts[0]._id,
			// 	nextPartInstanceId: parts[1]._id,
			// })
		}

		await runPlayoutOperationWithCache(
			null,
			'updateTimeline',
			getRundown0().playlistId,
			PlayoutLockFunctionPriority.USER_PLAYOUT,
			null,
			async (cache) => {
				await updateTimeline(cache)
			}
		)

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()

		await runPlayoutOperationWithCache(
			null,
			'updateTimeline',
			getRundown0().playlistId,
			PlayoutLockFunctionPriority.USER_PLAYOUT,
			null,
			async (cache) => {
				const currentTime = 100 * 1000
				await updateTimeline(cache, currentTime)
			}
		)

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()

		{
			// Deactivate rundown:
			await ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_ACCESS(playlistId0), playlistId0)
			expect(getPlaylist0()).toMatchObject({
				activationId: undefined,
				currentPartInstanceId: null,
				nextPartInstanceId: null,
			})
		}

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
	})

	describe('In transitions', () => {
		function testTransition(
			name: string,
			customRundownFactory: (
				env: DefaultEnvironment,
				playlistId: RundownPlaylistId,
				rundownId: RundownId
			) => RundownId,
			fcn: (
				rundownId: RundownId,
				timeline: TimelineComplete,
				currentPartInstance: PartInstance,
				previousPartInstance: PartInstance,
				checkTimings: (timings: PartTimelineTimings) => Promise<void>
			) => Promise<void>,
			timeout?: number
		) {
			testInFiber(
				name,
				async () => {
					const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(
						env,
						undefined,
						customRundownFactory
					)
					expect(rundownId0).toBeTruthy()
					expect(playlistId0).toBeTruthy()

					const getRundown0 = () => {
						return Rundowns.findOne(rundownId0) as Rundown
					}
					const getPlaylist0 = () => {
						const playlist = RundownPlaylists.findOne(playlistId0) as RundownPlaylist
						playlist.activationId = playlist.activationId ?? undefined
						return playlist
					}
					expect(getRundown0()).toBeTruthy()
					expect(getPlaylist0()).toBeTruthy()

					const parts = getRundown0().getParts()

					expect(getPlaylist0()).toMatchObject({
						activationId: undefined,
						rehearsal: false,
					})

					{
						// Prepare and activate in rehersal:
						await ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_ACCESS(playlistId0), playlistId0, false)
						const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
						expect(currentPartInstance).toBeFalsy()
						expect(nextPartInstance).toBeTruthy()
						expect(nextPartInstance!.part._id).toEqual(parts[0]._id)
						expect(getPlaylist0()).toMatchObject({
							activationId: expect.stringMatching(/^randomId/),
							rehearsal: false,
							currentPartInstanceId: null,
							// nextPartInstanceId: parts[0]._id,
						})
					}

					{
						// Take the first Part:
						await ServerPlayoutAPI.takeNextPart(DEFAULT_ACCESS(playlistId0), playlistId0)
						const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
						expect(currentPartInstance).toBeTruthy()
						expect(nextPartInstance).toBeTruthy()
						expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
						expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
						// expect(getPlaylist0()).toMatchObject({
						// 	currentPartInstanceId: parts[0]._id,
						// 	nextPartInstanceId: parts[1]._id,
						// })
					}

					{
						// Take the second Part:
						await ServerPlayoutAPI.takeNextPart(DEFAULT_ACCESS(playlistId0), playlistId0)
						const { currentPartInstance, previousPartInstance } = getPlaylist0().getSelectedPartInstances()
						expect(previousPartInstance).toBeTruthy()
						expect(currentPartInstance).toBeTruthy()
						expect(previousPartInstance!.part._id).toEqual(parts[0]._id)
						expect(currentPartInstance!.part._id).toEqual(parts[1]._id)
						// expect(getPlaylist0()).toMatchObject({
						// 	currentPartInstanceId: parts[0]._id,
						// 	nextPartInstanceId: parts[1]._id,
						// })

						await runPlayoutOperationWithCache(
							null,
							'updateTimeline',
							getRundown0().playlistId,
							PlayoutLockFunctionPriority.USER_PLAYOUT,
							null,
							async (cache) => {
								await updateTimeline(cache)
							}
						)

						const timeline = Timeline.findOne(getRundown0().studioId)
						expect(timeline).toBeTruthy()

						const checkTimings = async (timings: PartTimelineTimings) =>
							checkTimingsRaw(rundownId0, timeline, currentPartInstance!, previousPartInstance!, timings)

						await fcn(rundownId0, timeline!, currentPartInstance!, previousPartInstance!, checkTimings)
					}

					{
						// Deactivate rundown:
						await ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_ACCESS(playlistId0), playlistId0)
						expect(getPlaylist0()).toMatchObject({
							activationId: undefined,
							currentPartInstanceId: null,
							nextPartInstanceId: null,
						})
					}

					expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
				},
				timeout
			)
		}

		testTransition(
			'Basic inTransition',
			setupRundownWithInTransition,
			async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended by 1000ms due to transition keepalive
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
					currentPieces: {
						// pieces are delayed by the content delay
						piece010: { start: 0 },
					},
					currentInfinitePieces: {},
					previousOutTransition: undefined,
				})
			}
		)

		testTransition(
			'Basic inTransition with planned pieces',
			setupRundownWithInTransitionPlannedPiece,
			async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended by 1000ms due to transition keepalive
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
					currentPieces: {
						// pieces are delayed by the content delay
						piece010: { start: 500 },
						// transition piece
						piece011: { start: 0 },
						// pieces are delayed by the content delay
						piece012: { start: 1500, duration: 1000 },
					},
					currentInfinitePieces: {},
					previousOutTransition: undefined,
				})
			}
		)

		testTransition(
			'Preroll',
			setupRundownWithPreroll,
			async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended due to preroll
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 500` },
					currentPieces: {
						// main piece
						piece010: { start: 0 },
					},
					currentInfinitePieces: {},
					previousOutTransition: undefined,
				})
			}
		)

		testTransition(
			'Basic inTransition with contentDelay',
			setupRundownWithInTransitionContentDelay,
			async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended due to preroll and transition keepalive
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
					currentPieces: {
						// pieces are delayed by the content delay
						piece010: { start: 500 },
						// transition piece
						piece011: { start: 0 },
					},
					currentInfinitePieces: {},
					previousOutTransition: undefined,
				})
			}
		)

		testTransition(
			'Basic inTransition with contentDelay + preroll',
			setupRundownWithInTransitionContentDelayAndPreroll,
			async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended due to preroll and transition keepalive
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
					currentPieces: {
						// pieces are delayed by the content delay
						piece010: { start: 250 },
						// transition piece
						piece011: { start: 0 },
					},
					currentInfinitePieces: {},
					previousOutTransition: undefined,
				})
			}
		)

		testTransition(
			'inTransition with existing infinites',
			setupRundownWithInTransitionExistingInfinite,
			async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended due to transition keepalive
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
					currentPieces: {
						// pieces are delayed by the content delay
						piece010: { start: 500 },
						// transition piece
						piece011: { start: 0 },
					},
					currentInfinitePieces: {
						piece002: {
							// No delay applied as it started before this part, so should be left untouched
							partGroup: { start: `#part_group_${currentPartInstance?._id}.start` },
							pieceGroup: { start: 0 },
						},
					},
					previousOutTransition: undefined,
				})
			}
		)

		testTransition(
			'inTransition with new infinite',
			setupRundownWithInTransitionNewInfinite,
			async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended due to transition keepalive
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
					currentPieces: {
						// pieces are delayed by the content delay
						piece010: { start: 500 },
						// transition piece
						piece011: { start: 0 },
					},
					currentInfinitePieces: {
						piece012: {
							// Delay get applied to the pieceGroup inside the partGroup
							partGroup: { start: `#${getPartGroupId(currentPartInstance)}.start` },
							pieceGroup: { start: 500 },
						},
					},
					previousOutTransition: undefined,
				})
			}
		)

		testInFiber('inTransition is disabled during hold', async () => {
			const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(
				env,
				undefined,
				setupRundownWithInTransitionEnableHold
			)
			expect(rundownId0).toBeTruthy()
			expect(playlistId0).toBeTruthy()

			const getRundown0 = () => {
				return Rundowns.findOne(rundownId0) as Rundown
			}
			const getPlaylist0 = () => {
				const playlist = RundownPlaylists.findOne(playlistId0) as RundownPlaylist
				playlist.activationId = playlist.activationId ?? undefined
				return playlist
			}
			expect(getRundown0()).toBeTruthy()
			expect(getPlaylist0()).toBeTruthy()

			const parts = getRundown0().getParts()

			expect(getPlaylist0()).toMatchObject({
				activationId: undefined,
				rehearsal: false,
			})

			{
				// Prepare and activate in rehersal:
				await ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_ACCESS(playlistId0), playlistId0, false)
				const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
				expect(currentPartInstance).toBeFalsy()
				expect(nextPartInstance).toBeTruthy()
				expect(nextPartInstance!.part._id).toEqual(parts[0]._id)
				expect(getPlaylist0()).toMatchObject({
					activationId: expect.stringMatching(/^randomId/),
					rehearsal: false,
					currentPartInstanceId: null,
					// nextPartInstanceId: parts[0]._id,
				})
			}

			{
				// Take the first Part:
				await ServerPlayoutAPI.takeNextPart(DEFAULT_ACCESS(playlistId0), playlistId0)
				const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
				expect(currentPartInstance).toBeTruthy()
				expect(nextPartInstance).toBeTruthy()
				expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
				expect(nextPartInstance!.part._id).toEqual(parts[1]._id)

				// activate hold mode
				await ServerPlayoutAPI.activateHold(DEFAULT_ACCESS(playlistId0), playlistId0)
			}

			{
				// Take the second Part:
				await ServerPlayoutAPI.takeNextPart(DEFAULT_ACCESS(playlistId0), playlistId0)
				const { currentPartInstance, previousPartInstance } = getPlaylist0().getSelectedPartInstances()
				expect(previousPartInstance).toBeTruthy()
				expect(currentPartInstance).toBeTruthy()
				expect(previousPartInstance!.part._id).toEqual(parts[0]._id)
				expect(currentPartInstance!.part._id).toEqual(parts[1]._id)

				await runPlayoutOperationWithCache(
					null,
					'updateTimeline',
					getRundown0().playlistId,
					PlayoutLockFunctionPriority.USER_PLAYOUT,
					null,
					async (cache) => {
						await updateTimeline(cache)
					}
				)

				const timeline = Timeline.findOne(getRundown0().studioId)
				expect(timeline).toBeTruthy()

				await checkTimingsRaw(rundownId0, timeline, currentPartInstance!, previousPartInstance!, {
					// old part ends immediately
					previousPart: { end: `#${getPartGroupId(currentPartInstance!)}.start + 0` },
					currentPieces: {
						// pieces are not delayed
						piece010: { start: 0 },
						// no in transition
						piece011: null,
					},
					currentInfinitePieces: {},
					previousOutTransition: undefined,
				})
			}

			{
				// Deactivate rundown:
				await ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_ACCESS(playlistId0), playlistId0)
				expect(getPlaylist0()).toMatchObject({
					activationId: undefined,
					currentPartInstanceId: null,
					nextPartInstanceId: null,
				})
			}

			expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
		})

		testTransition(
			'inTransition disabled',
			setupRundownWithInTransitionDisabled,
			async (_rundownId0, _timeline, currentPartInstance, _previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is not extended
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 0` },
					currentPieces: {
						// pieces are not delayed
						piece010: { start: 0 },
						// no transition piece
						piece011: null,
					},
					currentInfinitePieces: {},
					previousOutTransition: undefined,
				})
			}
		)
	})

	describe('Out transitions', () => {
		function testTransition(
			name: string,
			customRundownFactory: (
				env: DefaultEnvironment,
				playlistId: RundownPlaylistId,
				rundownId: RundownId
			) => RundownId,
			fcn: (
				rundownId: RundownId,
				timeline: TimelineComplete,
				currentPartInstance: PartInstance,
				previousPartInstance: PartInstance,
				checkTimings: (timings: PartTimelineTimings) => Promise<void>
			) => void | Promise<void>,
			timeout?: number
		) {
			testInFiber(
				name,
				async () => {
					const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(
						env,
						undefined,
						customRundownFactory
					)
					expect(rundownId0).toBeTruthy()
					expect(playlistId0).toBeTruthy()
					const getRundown0 = () => {
						return Rundowns.findOne(rundownId0) as Rundown
					}
					const getPlaylist0 = () => {
						const playlist = RundownPlaylists.findOne(playlistId0) as RundownPlaylist
						playlist.activationId = playlist.activationId ?? undefined
						return playlist
					}
					expect(getRundown0()).toBeTruthy()
					expect(getPlaylist0()).toBeTruthy()

					const parts = getRundown0().getParts()

					expect(getPlaylist0()).toMatchObject({
						activationId: undefined,
						rehearsal: false,
					})

					{
						// Prepare and activate in rehersal:
						await ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_ACCESS(playlistId0), playlistId0, false)
						const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
						expect(currentPartInstance).toBeFalsy()
						expect(nextPartInstance).toBeTruthy()
						expect(nextPartInstance!.part._id).toEqual(parts[0]._id)
						expect(getPlaylist0()).toMatchObject({
							activationId: expect.stringMatching(/^randomId/),
							rehearsal: false,
							currentPartInstanceId: null,
							// nextPartInstanceId: parts[0]._id,
						})
					}

					{
						// Take the first Part:
						await ServerPlayoutAPI.takeNextPart(DEFAULT_ACCESS(playlistId0), playlistId0)
						const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
						expect(currentPartInstance).toBeTruthy()
						expect(nextPartInstance).toBeTruthy()
						expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
						expect(nextPartInstance!.part._id).toEqual(parts[1]._id)
						// expect(getPlaylist0()).toMatchObject({
						// 	currentPartInstanceId: parts[0]._id,
						// 	nextPartInstanceId: parts[1]._id,
						// })
					}

					{
						// Take the second Part:
						await ServerPlayoutAPI.takeNextPart(DEFAULT_ACCESS(playlistId0), playlistId0)
						const { currentPartInstance, previousPartInstance } = getPlaylist0().getSelectedPartInstances()
						expect(previousPartInstance).toBeTruthy()
						expect(currentPartInstance).toBeTruthy()
						expect(previousPartInstance!.part._id).toEqual(parts[0]._id)
						expect(currentPartInstance!.part._id).toEqual(parts[1]._id)
						// expect(getPlaylist0()).toMatchObject({
						// 	currentPartInstanceId: parts[0]._id,
						// 	nextPartInstanceId: parts[1]._id,
						// })

						await runPlayoutOperationWithCache(
							null,
							'updateTimeline',
							getRundown0().playlistId,
							PlayoutLockFunctionPriority.USER_PLAYOUT,
							null,
							async (cache) => {
								await updateTimeline(cache)
							}
						)

						const timeline = Timeline.findOne(getRundown0().studioId)
						expect(timeline).toBeTruthy()

						const checkTimings = async (timings: PartTimelineTimings) =>
							checkTimingsRaw(rundownId0, timeline, currentPartInstance!, previousPartInstance!, timings)

						await fcn(rundownId0, timeline!, currentPartInstance!, previousPartInstance!, checkTimings)
					}

					{
						// Deactivate rundown:
						await ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_ACCESS(playlistId0), playlistId0)
						expect(getPlaylist0()).toMatchObject({
							activationId: undefined,
							currentPartInstanceId: null,
							nextPartInstanceId: null,
						})
					}

					expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
				},
				timeout
			)
		}

		testTransition(
			'Basic outTransition',
			setupRundownWithOutTransition,
			async (_rundownId0, _timeline, currentPartInstance, previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended by 1000ms due to transition keepalive
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
					currentPieces: {
						// pieces are delayed by outTransition time
						piece010: { start: 1000 },
					},
					currentInfinitePieces: {},
					// outTransitionPiece is inserted
					previousOutTransition: {
						start: `#${getPartGroupId(previousPartInstance)}.end - 1000`,
					},
				})
			}
		)

		testTransition(
			'outTransition + preroll',
			setupRundownWithOutTransitionAndPreroll,
			async (_rundownId0, _timeline, currentPartInstance, previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended by 1000ms due to transition keepalive
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
					currentPieces: {
						// pieces are delayed by outTransition time
						piece010: { start: 750 }, /// 1000ms out transition, 250ms preroll
					},
					currentInfinitePieces: {},
					// outTransitionPiece is inserted
					previousOutTransition: {
						start: `#${getPartGroupId(previousPartInstance)}.end - 1000`,
					},
				})
			}
		)

		testTransition(
			'outTransition + preroll (2)',
			setupRundownWithOutTransitionAndPreroll2,
			async (_rundownId0, _timeline, currentPartInstance, previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended by 1000ms due to transition keepalive
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 1000` },
					currentPieces: {
						// pieces are delayed by outTransition time
						piece010: { start: 0 }, /// 250ms out transition, 1000ms preroll. preroll takes precedence
					},
					currentInfinitePieces: {},
					// outTransitionPiece is inserted
					previousOutTransition: {
						start: `#${getPartGroupId(previousPartInstance)}.end - 250`,
					},
				})
			}
		)

		testTransition(
			'outTransition + inTransition',
			setupRundownWithOutTransitionAndInTransition,
			async (_rundownId0, _timeline, currentPartInstance, previousPartInstance, checkTimings) => {
				await checkTimings({
					// old part is extended by 1000ms due to transition keepalive
					previousPart: { end: `#${getPartGroupId(currentPartInstance)}.start + 600` }, // 600ms outtransiton & 250ms transition keepalive
					currentPieces: {
						// pieces are delayed by in transition preroll time
						piece010: { start: 650 }, // inTransPieceTlObj + 300 contentDelay
						// in transition is delayed by outTransition time
						piece011: { start: 350, duration: 500 }, // 600 - 250 = 350
					},
					currentInfinitePieces: {},
					// outTransitionPiece is inserted
					previousOutTransition: {
						start: `#${getPartGroupId(previousPartInstance)}.end - 600`,
					},
				})
			}
		)

		testInFiber('outTransition is disabled during hold', async () => {
			const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(
				env,
				undefined,
				setupRundownWithOutTransitionEnableHold
			)
			expect(rundownId0).toBeTruthy()
			expect(playlistId0).toBeTruthy()
			const getRundown0 = () => {
				return Rundowns.findOne(rundownId0) as Rundown
			}
			const getPlaylist0 = () => {
				const playlist = RundownPlaylists.findOne(playlistId0) as RundownPlaylist
				playlist.activationId = playlist.activationId ?? undefined
				return playlist
			}
			expect(getRundown0()).toBeTruthy()
			expect(getPlaylist0()).toBeTruthy()

			const parts = getRundown0().getParts()

			expect(getPlaylist0()).toMatchObject({
				activationId: undefined,
				rehearsal: false,
			})

			{
				// Prepare and activate in rehersal:
				await ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_ACCESS(playlistId0), playlistId0, false)
				const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
				expect(currentPartInstance).toBeFalsy()
				expect(nextPartInstance).toBeTruthy()
				expect(nextPartInstance!.part._id).toEqual(parts[0]._id)
				expect(getPlaylist0()).toMatchObject({
					activationId: expect.stringMatching(/^randomId/),
					rehearsal: false,
					currentPartInstanceId: null,
					// nextPartInstanceId: parts[0]._id,
				})
			}

			{
				// Take the first Part:
				await ServerPlayoutAPI.takeNextPart(DEFAULT_ACCESS(playlistId0), playlistId0)
				const { currentPartInstance, nextPartInstance } = getPlaylist0().getSelectedPartInstances()
				expect(currentPartInstance).toBeTruthy()
				expect(nextPartInstance).toBeTruthy()
				expect(currentPartInstance!.part._id).toEqual(parts[0]._id)
				expect(nextPartInstance!.part._id).toEqual(parts[1]._id)

				// activate hold mode
				await ServerPlayoutAPI.activateHold(DEFAULT_ACCESS(playlistId0), playlistId0)
			}

			{
				// Take the second Part:
				await ServerPlayoutAPI.takeNextPart(DEFAULT_ACCESS(playlistId0), playlistId0)
				const { currentPartInstance, previousPartInstance } = getPlaylist0().getSelectedPartInstances()
				expect(previousPartInstance).toBeTruthy()
				expect(currentPartInstance).toBeTruthy()
				expect(previousPartInstance!.part._id).toEqual(parts[0]._id)
				expect(currentPartInstance!.part._id).toEqual(parts[1]._id)

				await runPlayoutOperationWithCache(
					null,
					'updateTimeline',
					getRundown0().playlistId,
					PlayoutLockFunctionPriority.USER_PLAYOUT,
					null,
					async (cache) => {
						await updateTimeline(cache)
					}
				)

				const timeline = Timeline.findOne(getRundown0().studioId)
				expect(timeline).toBeTruthy()

				await checkTimingsRaw(rundownId0, timeline, currentPartInstance!, previousPartInstance!, {
					previousPart: { end: `#${getPartGroupId(currentPartInstance!)}.start + 500` }, // note: this seems odd, but the pieces are delayed to compensate
					currentPieces: {
						piece010: { start: 500 }, // note: Offset matches extension of previous partGroup
					},
					currentInfinitePieces: {},
					previousOutTransition: undefined,
				})
			}

			{
				// Deactivate rundown:
				await ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_ACCESS(playlistId0), playlistId0)
				expect(getPlaylist0()).toMatchObject({
					activationId: undefined,
					currentPartInstanceId: null,
					nextPartInstanceId: null,
				})
			}

			expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
		})
	})
})
