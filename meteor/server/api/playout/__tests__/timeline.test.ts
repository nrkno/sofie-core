import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { fixSnapshot } from '../../../../__mocks__/helpers/snapshot'
import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupMockPeripheralDevice,
} from '../../../../__mocks__/helpers/database'
import { Rundowns, Rundown, RundownCollectionUtil, RundownId } from '../../../../lib/collections/Rundowns'
import '../api'
import {
	deserializeTimelineBlob,
	Timeline,
	TimelineComplete,
	TimelineEnableExt,
} from '../../../../lib/collections/Timeline'
import { ServerPlayoutAPI } from '../playout'
import { updateTimeline } from '../timeline'
import {
	RundownPlaylists,
	RundownPlaylist,
	RundownPlaylistId,
	RundownPlaylistCollectionUtil,
} from '../../../../lib/collections/RundownPlaylists'
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
	setupRundownBase,
} from './helpers/rundowns'
import { PartInstance, PartInstanceId } from '../../../../lib/collections/PartInstances'
import { getPartGroupId, getPieceGroupId } from '../../../../lib/rundown/timeline'
import { literal, normalizeArrayToMap, protectString, unprotectString } from '../../../../lib/lib'
import { PieceInstance, PieceInstances } from '../../../../lib/collections/PieceInstances'
import { IBlueprintPieceType, PieceLifespan, Time } from '@sofie-automation/blueprints-integration'
import { Part, PartId } from '../../../../lib/collections/Parts'
import { ServerPlayoutAdLibAPI } from '../adlib'
import { AdLibPiece } from '../../../../lib/collections/AdLibPieces'
import { RundownAPI } from '../../../../lib/api/rundown'

function DEFAULT_ACCESS(rundownPlaylistID: RundownPlaylistId): VerifiedRundownPlaylistContentAccess {
	const playlist = RundownPlaylists.findOne(rundownPlaylistID) as RundownPlaylist
	expect(playlist).toBeTruthy()
	return { userId: null, organizationId: null, studioId: null, playlist: playlist, cred: {} }
}

interface PartTimelineTimings {
	previousPart: TimelineEnableExt | null
	currentPieces: { [id: string]: TimelineEnableExt | TimelineEnableExt[] | null }
	currentInfinitePieces: {
		[id: string]: {
			partGroup: TimelineEnableExt | TimelineEnableExt[]
			pieceGroup: TimelineEnableExt | TimelineEnableExt[]
		} | null
	}
	previousOutTransition: TimelineEnableExt | TimelineEnableExt[] | null | undefined
}

/**
 * Check the timings of objects in the timeline to an expected result
 * Note: this ensures that every piece for the currentPartInstance is accounted for in the expected result
 */
async function checkTimingsRaw(
	rundownId: RundownId,
	timeline: TimelineComplete | undefined,
	currentPartInstance: PartInstance,
	previousPartInstance: PartInstance | undefined,
	expectedTimings: PartTimelineTimings
) {
	const timelineObjs = timeline ? deserializeTimelineBlob(timeline?.timelineBlob) : []
	const objs = normalizeArrayToMap(timelineObjs, 'id')

	// previous part group
	const prevPartTlObj = previousPartInstance ? objs.get(getPartGroupId(previousPartInstance)) : undefined
	if (expectedTimings.previousPart) {
		expect(prevPartTlObj).toBeTruthy()
		expect(prevPartTlObj?.enable).toMatchObject(expectedTimings.previousPart)
	} else {
		expect(prevPartTlObj).toBeFalsy()
	}

	// current part group is assumed to start at now

	// Current pieces
	const currentPieces = await PieceInstances.findFetchAsync({
		partInstanceId: currentPartInstance._id,
	})
	const targetCurrentPieces: PartTimelineTimings['currentPieces'] = {}
	const targetCurrentInfinitePieces: PartTimelineTimings['currentInfinitePieces'] = {}
	for (const piece of currentPieces) {
		let entryId = unprotectString(piece.piece._id)
		if (entryId.startsWith(unprotectString(rundownId)))
			entryId = entryId.substring(unprotectString(rundownId).length + 1)

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
	expect(targetCurrentPieces).toEqual(expectedTimings.currentPieces)
	expect(targetCurrentInfinitePieces).toEqual(expectedTimings.currentInfinitePieces)

	if (previousPartInstance) {
		// Previous pieces
		const previousPieces = await PieceInstances.findFetchAsync({
			partInstanceId: previousPartInstance._id,
		})
		let previousOutTransition: PartTimelineTimings['previousOutTransition']
		for (const piece of previousPieces) {
			if (piece.piece.pieceType === IBlueprintPieceType.OutTransition) {
				if (previousOutTransition !== undefined) throw new Error('Too many out transition pieces were found')

				const pieceObj = objs.get(getPieceGroupId(piece))
				previousOutTransition = pieceObj?.enable ?? null
			}
		}
		expect(previousOutTransition).toEqual(expectedTimings.previousOutTransition)
	} else {
		expect(expectedTimings.previousOutTransition).toBeFalsy()
	}
}

/** Perform a take and check the the selected part ids are as expected */
async function doTakePart(
	playlistId: RundownPlaylistId,
	expectedPreviousPartId: PartId | null,
	expectedCurrentPartId: PartId | null,
	expectedNextPartId: PartId | null
) {
	await ServerPlayoutAPI.takeNextPart(DEFAULT_ACCESS(playlistId), playlistId)

	const playlist = RundownPlaylists.findOne(playlistId) as RundownPlaylist
	expect(playlist).toBeTruthy()

	const { currentPartInstance, nextPartInstance, previousPartInstance } =
		RundownPlaylistCollectionUtil.getSelectedPartInstances(playlist)

	if (expectedCurrentPartId) {
		expect(currentPartInstance).toBeTruthy()
		expect(currentPartInstance!.part._id).toEqual(expectedCurrentPartId)
	} else {
		expect(currentPartInstance).toBeFalsy()
	}

	if (expectedPreviousPartId) {
		expect(previousPartInstance).toBeTruthy()
		expect(previousPartInstance!.part._id).toEqual(expectedPreviousPartId)
	} else {
		expect(previousPartInstance).toBeFalsy()
	}

	if (expectedNextPartId) {
		expect(nextPartInstance).toBeTruthy()
		expect(nextPartInstance!.part._id).toEqual(expectedNextPartId)
	} else {
		expect(nextPartInstance).toBeFalsy()
	}

	return { currentPartInstance, nextPartInstance, previousPartInstance }
}

/** Perform an activate and check the next part id is as expected */
async function doActivatePlaylist(playlistId: RundownPlaylistId, nextPartId: PartId) {
	await ServerPlayoutAPI.activateRundownPlaylist(DEFAULT_ACCESS(playlistId), playlistId, false)

	const playlist = RundownPlaylists.findOne(playlistId) as RundownPlaylist
	expect(playlist).toBeTruthy()

	const { currentPartInstance, nextPartInstance } = RundownPlaylistCollectionUtil.getSelectedPartInstances(playlist)
	expect(currentPartInstance).toBeFalsy()
	expect(nextPartInstance).toBeTruthy()
	expect(nextPartInstance!.part._id).toEqual(nextPartId)
	expect(playlist).toMatchObject({
		activationId: expect.stringMatching(/^randomId/),
		rehearsal: false,
		currentPartInstanceId: null,
		// nextPartInstanceId: parts[0]._id,
	})
}

/** Perform an activate and check the selected part ids are cleared */
async function doDeactivatePlaylist(playlistId: RundownPlaylistId) {
	await ServerPlayoutAPI.deactivateRundownPlaylist(DEFAULT_ACCESS(playlistId), playlistId)

	const playlist = RundownPlaylists.findOne(playlistId) as RundownPlaylist
	expect(playlist).toBeTruthy()

	// Ensure this is defined to something, for the jest matcher
	playlist.activationId = playlist.activationId ?? undefined

	expect(playlist).toMatchObject({
		activationId: undefined,
		currentPartInstanceId: null,
		nextPartInstanceId: null,
	})
}

/** perform an update of the timeline */
async function doUpdateTimeline(playlistId: RundownPlaylistId, forceNowToTime?: Time) {
	await runPlayoutOperationWithCache(
		null,
		'updateTimeline',
		playlistId,
		PlayoutLockFunctionPriority.USER_PLAYOUT,
		null,
		async (cache) => {
			await updateTimeline(cache, forceNowToTime)
		}
	)
}

interface SelectedPartInstances {
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
	previousPartInstance: PartInstance | undefined
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

		const parts = RundownCollectionUtil.getParts(getRundown0())

		expect(getPlaylist0()).toMatchObject({
			activationId: undefined,
			rehearsal: false,
		})

		// Prepare and activate in rehersal:
		await doActivatePlaylist(playlistId0, parts[0]._id)

		// Take the first Part:
		await doTakePart(playlistId0, null, parts[0]._id, parts[1]._id)

		// Regenerate the timeline, and check it against snapshot
		await doUpdateTimeline(playlistId0)
		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()

		// Regenerate the timeline, with a now time, and check it against snapshot
		await doUpdateTimeline(playlistId0, 100 * 1000)
		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()

		// Deactivate rundown:
		await doDeactivatePlaylist(playlistId0)

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
	})

	function testTransitionTimings(
		name: string,
		customRundownFactory: (
			env: DefaultEnvironment,
			playlistId: RundownPlaylistId,
			rundownId: RundownId
		) => RundownId,
		checkFcn: (
			rundownId: RundownId,
			timeline: null,
			currentPartInstance: PartInstance,
			previousPartInstance: PartInstance,
			checkTimings: (timings: PartTimelineTimings) => Promise<void>
		) => Promise<void>,
		timeout?: number
	) {
		testInFiber(
			name,
			async () =>
				runTimelineTimings(
					customRundownFactory,
					async (playlistId, rundownId, parts, getPartInstances, checkTimings) => {
						// Take the first Part:
						await doTakePart(playlistId, null, parts[0]._id, parts[1]._id)

						// Take the second Part:
						await doTakePart(playlistId, parts[0]._id, parts[1]._id, null)

						// Run the result check
						const { currentPartInstance, previousPartInstance } = getPartInstances()
						await checkFcn(rundownId, null, currentPartInstance!, previousPartInstance!, checkTimings)
					}
				),
			timeout
		)
	}

	async function runTimelineTimings(
		customRundownFactory: (
			env: DefaultEnvironment,
			playlistId: RundownPlaylistId,
			rundownId: RundownId
		) => RundownId,
		fcn: (
			playlistId: RundownPlaylistId,
			rundownId: RundownId,
			parts: Part[],
			getPartInstances: () => SelectedPartInstances,
			checkTimings: (timings: PartTimelineTimings) => Promise<void>
		) => Promise<void>
	) {
		const { rundownId: rundownId0, playlistId: playlistId0 } = setupDefaultRundownPlaylist(
			env,
			undefined,
			customRundownFactory
		)
		expect(rundownId0).toBeTruthy()
		expect(playlistId0).toBeTruthy()

		const rundown = Rundowns.findOne(rundownId0) as Rundown
		expect(rundown).toBeTruthy()

		{
			const playlist = RundownPlaylists.findOne(playlistId0) as RundownPlaylist
			expect(playlist).toBeTruthy()

			// Ensure this is defined to something, for the jest matcher
			playlist.activationId = playlist.activationId ?? undefined

			expect(playlist).toMatchObject({
				activationId: undefined,
				rehearsal: false,
			})
		}

		const parts = RundownCollectionUtil.getParts(rundown)

		// Prepare and activate in rehersal:
		await doActivatePlaylist(playlistId0, parts[0]._id)

		const getPartInstances = () => {
			const playlist = RundownPlaylists.findOne(playlistId0) as RundownPlaylist
			expect(playlist).toBeTruthy()
			return RundownPlaylistCollectionUtil.getSelectedPartInstances(playlist)
		}

		const checkTimings = async (timings: PartTimelineTimings) => {
			// Check the calculated timings
			const timeline = Timeline.findOne(env.studio._id)
			expect(timeline).toBeTruthy()

			// console.log('objs', JSON.stringify(timeline?.timeline?.map((o) => o.id) || [], undefined, 4))

			await doUpdateTimeline(playlistId0)

			const { currentPartInstance, previousPartInstance } = getPartInstances()
			return checkTimingsRaw(rundownId0, timeline, currentPartInstance!, previousPartInstance, timings)
		}

		// Run the required steps
		await fcn(playlistId0, rundownId0, parts, getPartInstances, checkTimings)

		// Deactivate rundown:
		await doDeactivatePlaylist(playlistId0)

		expect(fixSnapshot(Timeline.find().fetch())).toMatchSnapshot()
	}

	describe('In transitions', () => {
		testTransitionTimings(
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

		testTransitionTimings(
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

		testTransitionTimings(
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

		testTransitionTimings(
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

		testTransitionTimings(
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

		testTransitionTimings(
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

		testTransitionTimings(
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

		testInFiber('inTransition is disabled during hold', async () =>
			runTimelineTimings(
				setupRundownWithInTransitionEnableHold,
				async (playlistId, _rundownId, parts, getPartInstances, checkTimings) => {
					// Take the first Part:
					await doTakePart(playlistId, null, parts[0]._id, parts[1]._id)

					// activate hold mode
					await ServerPlayoutAPI.activateHold(DEFAULT_ACCESS(playlistId), playlistId)

					await doTakePart(playlistId, parts[0]._id, parts[1]._id, null)

					const { currentPartInstance } = getPartInstances()
					await checkTimings({
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
			)
		)

		testTransitionTimings(
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
		testTransitionTimings(
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

		testTransitionTimings(
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

		testTransitionTimings(
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

		testTransitionTimings(
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

		testInFiber('outTransition is disabled during hold', async () =>
			runTimelineTimings(
				setupRundownWithOutTransitionEnableHold,
				async (playlistId, _rundownId, parts, getPartInstances, checkTimings) => {
					// Take the first Part:
					await doTakePart(playlistId, null, parts[0]._id, parts[1]._id)

					// activate hold mode
					await ServerPlayoutAPI.activateHold(DEFAULT_ACCESS(playlistId), playlistId)

					await doTakePart(playlistId, parts[0]._id, parts[1]._id, null)

					const { currentPartInstance } = getPartInstances()
					await checkTimings({
						previousPart: { end: `#${getPartGroupId(currentPartInstance!)}.start + 500` }, // note: this seems odd, but the pieces are delayed to compensate
						currentPieces: {
							piece010: { start: 500 }, // note: Offset matches extension of previous partGroup
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})
				}
			)
		)
	})

	describe('Adlib pieces', () => {
		async function doStartAdlibPiece(
			playlistId: RundownPlaylistId,
			currentPartInstance: PartInstance,
			adlibSource: AdLibPiece
		) {
			await runPlayoutOperationWithCache(
				null,
				'updateTimeline',
				playlistId,
				PlayoutLockFunctionPriority.USER_PLAYOUT,
				null,
				async (cache) => {
					const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId) as Rundown
					expect(rundown).toBeTruthy()

					await ServerPlayoutAdLibAPI.innerStartOrQueueAdLibPiece(
						cache,
						rundown,
						false,
						currentPartInstance,
						adlibSource
					)
				}
			)
		}

		async function doSimulatePiecePlaybackTimings(
			playlistId: RundownPlaylistId,
			currentPartInstance: PartInstance,
			adlibbedPieceId: string,
			time: Time
		) {
			const pieceInstance = PieceInstances.findOne({
				partInstanceId: currentPartInstance!._id,
				'piece._id': adlibbedPieceId,
			}) as PieceInstance
			expect(pieceInstance).toBeTruthy()

			await ServerPlayoutAPI.timelineTriggerTimeForStudioId(env.studio._id, [
				{
					id: getPieceGroupId(pieceInstance),
					time: time,
				},
			])

			await doUpdateTimeline(playlistId)
		}

		//
		testInFiber('Current part with preroll', async () =>
			runTimelineTimings(
				(env: DefaultEnvironment, playlistId: RundownPlaylistId, rundownId: RundownId): RundownId => {
					setupRundownBase(
						env,
						playlistId,
						rundownId,
						{},
						{
							piece0: { prerollDuration: 500 },
							piece1: { prerollDuration: 50, sourceLayerId: env.showStyleBase.sourceLayers[3]._id },
						}
					)

					return rundownId
				},
				async (playlistId, _rundownId, parts, getPartInstances, checkTimings) => {
					// Take the only Part:
					await doTakePart(playlistId, null, parts[0]._id, null)

					// Should look normal for now
					await checkTimings({
						previousPart: null,
						currentPieces: {
							piece000: { start: 0 }, // This one gave the preroll
							piece001: { start: 450 },
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})

					const { currentPartInstance } = getPartInstances()
					expect(currentPartInstance).toBeTruthy()

					// Insert an adlib piece
					await doStartAdlibPiece(
						playlistId,
						currentPartInstance!,
						literal<AdLibPiece>({
							_id: protectString('adlib1'),
							rundownId: currentPartInstance!.rundownId,
							status: RundownAPI.PieceStatusCode.OK,
							externalId: 'fake',
							name: 'Adlibbed piece',
							lifespan: PieceLifespan.WithinPart,
							sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
							outputLayerId: env.showStyleBase.outputLayers[0]._id,
							content: {
								timelineObjects: [],
							},
							_rank: 0,
						})
					)

					const adlibbedPieceId = 'randomId9017'

					// The adlib should be starting at 'now'
					await checkTimings({
						previousPart: null,
						currentPieces: {
							piece000: {
								start: 0, // This one gave the preroll
								end: `#piece_group_${currentPartInstance!._id}_${
									currentPartInstance!.rundownId
								}_piece000_cap_now.start`,
							},
							piece001: { start: 450 },
							[adlibbedPieceId]: {
								// Our adlibbed piece
								start: 'now',
							},
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})

					const pieceOffset = 12560
					// Simulate the piece timing confirmation from playout-gateway
					await doSimulatePiecePlaybackTimings(playlistId, currentPartInstance!, adlibbedPieceId, pieceOffset)

					// Now we have a concrete time
					await checkTimings({
						previousPart: null,
						currentPieces: {
							piece000: {
								start: 0, // This one gave the preroll
								end: pieceOffset, // This is expected to match the start of the adlib
							},
							piece001: { start: 450 },
							[adlibbedPieceId]: {
								// Our adlibbed piece
								start: pieceOffset,
							},
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})
				}
			)
		)

		testInFiber('Current part with preroll and adlib preroll', async () =>
			runTimelineTimings(
				(env: DefaultEnvironment, playlistId: RundownPlaylistId, rundownId: RundownId): RundownId => {
					setupRundownBase(
						env,
						playlistId,
						rundownId,
						{},
						{
							piece0: { prerollDuration: 500 },
							piece1: { prerollDuration: 50, sourceLayerId: env.showStyleBase.sourceLayers[3]._id },
						}
					)

					return rundownId
				},
				async (playlistId, _rundownId, parts, getPartInstances, checkTimings) => {
					// Take the only Part:
					await doTakePart(playlistId, null, parts[0]._id, null)

					// Should look normal for now
					await checkTimings({
						previousPart: null,
						currentPieces: {
							piece000: { start: 0 }, // This one gave the preroll
							piece001: { start: 450 },
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})

					const { currentPartInstance } = getPartInstances()
					expect(currentPartInstance).toBeTruthy()

					// Insert an adlib piece
					await doStartAdlibPiece(
						playlistId,
						currentPartInstance!,
						literal<AdLibPiece>({
							_id: protectString('adlib1'),
							rundownId: currentPartInstance!.rundownId,
							status: RundownAPI.PieceStatusCode.OK,
							externalId: 'fake',
							name: 'Adlibbed piece',
							lifespan: PieceLifespan.WithinPart,
							sourceLayerId: env.showStyleBase.sourceLayers[0]._id,
							outputLayerId: env.showStyleBase.outputLayers[0]._id,
							content: {
								timelineObjects: [],
							},
							_rank: 0,
							prerollDuration: 340,
						})
					)

					const adlibbedPieceId = 'randomId9017'

					// The adlib should be starting at 'now'
					await checkTimings({
						previousPart: null,
						currentPieces: {
							piece000: {
								start: 0, // This one gave the preroll
								end: `#piece_group_${currentPartInstance!._id}_${adlibbedPieceId}.start + 340`,
							},
							piece001: { start: 450 },
							[adlibbedPieceId]: {
								// Our adlibbed piece
								start: 'now',
							},
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})

					const pieceOffset = 12560
					// Simulate the piece timing confirmation from playout-gateway
					await doSimulatePiecePlaybackTimings(playlistId, currentPartInstance!, adlibbedPieceId, pieceOffset)

					// Now we have a concrete time
					await checkTimings({
						previousPart: null,
						currentPieces: {
							piece000: {
								start: 0, // This one gave the preroll
								end: pieceOffset + 340,
							},
							piece001: { start: 450 },
							[adlibbedPieceId]: {
								// Our adlibbed piece
								start: pieceOffset,
							},
						},
						currentInfinitePieces: {},
						previousOutTransition: undefined,
					})
				}
			)
		)
	})
})
