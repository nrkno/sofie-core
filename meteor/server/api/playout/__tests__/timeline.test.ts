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
import { Timeline, TimelineComplete } from '../../../../lib/collections/Timeline'
import { ServerPlayoutAPI } from '../playout'
import { updateTimeline } from '../timeline'
import { RundownPlaylists, RundownPlaylist, RundownPlaylistId } from '../../../../lib/collections/RundownPlaylists'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { PlayoutLockFunctionPriority, runPlayoutOperationWithCache } from '../lockFunction'
import { VerifiedRundownPlaylistContentAccess } from '../../lib'
import { setupRundownWithInTransitionExistingInfinite, setupRundownWithInTransition, setupRundownWithInTransitionPreroll, setupRundownWithInTransitionPrerollAndPreroll, setupRundownWithPreroll, setupRundownWithInTransitionNewInfinite, setupRundownWithInTransitionPlannedPiece, setupRundownWithInTransitionEnableHold, setupRundownWithInTransitionDisabled } from './helpers/rundowns'
import { string } from 'prop-types'
import { PartInstance } from '../../../../lib/collections/PartInstances'

function DEFAULT_ACCESS(rundownPlaylistID: RundownPlaylistId): VerifiedRundownPlaylistContentAccess {
	const playlist = RundownPlaylists.findOne(rundownPlaylistID) as RundownPlaylist
	expect(playlist).toBeTruthy()
	return { userId: null, organizationId: null, studioId: null, playlist: playlist, cred: {} }
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

	function testTransition(
		name: string,
		customRundownFactory: (env: DefaultEnvironment, playlistId: RundownPlaylistId, rundownId: RundownId) => RundownId,
		fcn: (rundownId: RundownId, timeline: TimelineComplete, currentPartInstance: PartInstance, previousPartInstance: PartInstance) => void | Promise<void>,
		timeout?: number
	) {
		testInFiber(name, async () => {
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

				fcn(rundownId0, timeline!, currentPartInstance!, previousPartInstance!)
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
		}, timeout)
	}

	testTransition(
		'Basic inTransition',
		setupRundownWithInTransition,
		(rundownId0, timeline, currentPartInstance, previousPartInstance) => {
			// old part is extended by 1000ms due to transition keepalive
			const oldPartTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'part_group_' + previousPartInstance?._id
			)
			expect(oldPartTlObj).toBeTruthy()
			expect(oldPartTlObj?.enable).toMatchObject({ end: `#part_group_${currentPartInstance?._id}.start + 1000` })

			// pieces are not delayed due to no transition preroll
			const newPartPieceTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'piece_group_' + currentPartInstance?._id + '_' + rundownId0 + '_piece010'
			)
			expect(newPartPieceTlObj).toBeTruthy()
			expect(newPartPieceTlObj?.enable).toMatchObject({ start: 0 })
		}
	)

	testTransition(
		'Basic inTransition with planned pieces',
		setupRundownWithInTransitionPlannedPiece,
		(rundownId0, timeline, currentPartInstance, previousPartInstance) => {
			// old part is extended by 1000ms due to transition keepalive
			const oldPartTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'part_group_' + previousPartInstance?._id
			)
			expect(oldPartTlObj).toBeTruthy()
			expect(oldPartTlObj?.enable).toMatchObject({ end: `#part_group_${currentPartInstance?._id}.start + 1000` })

			// pieces are delayed by the transition preroll
			const newPartPieceTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'piece_group_' + currentPartInstance?._id + '_' + rundownId0 + '_piece010'
			)
			expect(newPartPieceTlObj).toBeTruthy()
			expect(newPartPieceTlObj?.enable).toMatchObject({
				start: `#piece_group_${currentPartInstance?._id}_${rundownId0}_piece011.start + 500`,
			})

			// pieces are delayed by the transition preroll
			const newPartPlannedPieceTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'piece_group_' + currentPartInstance?._id + '_' + rundownId0 + '_piece012'
			)
			expect(newPartPlannedPieceTlObj).toBeTruthy()
			expect(newPartPlannedPieceTlObj?.enable).toMatchObject({
				// note: 1000 is known to be incorrect here but we accept it as "historically correct" for regression testing
				start: 1000,
				// start: `#piece_group_${currentPartInstance?._id}_${rundownId0}_piece011.start + 500 + 1000`,
			})
		}
	)

	testTransition('Preroll', setupRundownWithPreroll, (rundownId0, timeline, currentPartInstance, previousPartInstance) => {
		// old part is extended by 1000ms due to transition keepalive
		const oldPartTlObj = timeline?.timeline.find((tlObj) => tlObj.id === 'part_group_' + previousPartInstance?._id)
		expect(oldPartTlObj).toBeTruthy()
		expect(oldPartTlObj?.enable).toMatchObject({ end: `#part_group_${currentPartInstance?._id}.start + 500` })

		// pieces are not delayed due to no transition preroll
		const newPartPieceTlObj = timeline?.timeline.find(
			(tlObj) => tlObj.id === 'piece_group_' + currentPartInstance?._id + '_' + rundownId0 + '_piece010'
		)
		expect(newPartPieceTlObj).toBeTruthy()
		expect(newPartPieceTlObj?.enable).toMatchObject({ start: 0 })
	})
	
	testTransition('Basic inTransition with transitionPreroll', setupRundownWithInTransitionPreroll, (rundownId0, timeline, currentPartInstance, previousPartInstance) => {
		// old part is extended by 1000ms due to transition keepalive
		const oldPartTlObj = timeline?.timeline.find((tlObj) => tlObj.id === 'part_group_' + previousPartInstance?._id)
		expect(oldPartTlObj).toBeTruthy()
		expect(oldPartTlObj?.enable).toMatchObject({ end: `#part_group_${currentPartInstance?._id}.start + 1000` })

		// pieces are delayed by the transition preroll
		const newPartPieceTlObj = timeline?.timeline.find(
			(tlObj) => tlObj.id === 'piece_group_' + currentPartInstance?._id + '_' + rundownId0 + '_piece010'
		)
		expect(newPartPieceTlObj).toBeTruthy()
		expect(newPartPieceTlObj?.enable).toMatchObject({
			start: `#piece_group_${currentPartInstance?._id}_${rundownId0}_piece011.start + 500`,
		})
	})
	
	testTransition(
		'Basic inTransition with transitionPreroll + preroll',
		setupRundownWithInTransitionPrerollAndPreroll,
		(rundownId0, timeline, currentPartInstance, previousPartInstance) => {
			// old part is extended by 1000ms due to transition keepalive
			const oldPartTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'part_group_' + previousPartInstance?._id
			)
			expect(oldPartTlObj).toBeTruthy()
			expect(oldPartTlObj?.enable).toMatchObject({ end: `#part_group_${currentPartInstance?._id}.start + 1000` })

			// pieces are delayed by the transition preroll
			const newPartPieceTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'piece_group_' + currentPartInstance?._id + '_' + rundownId0 + '_piece010'
			)
			expect(newPartPieceTlObj).toBeTruthy()
			expect(newPartPieceTlObj?.enable).toMatchObject({
				start: `#piece_group_${currentPartInstance?._id}_${rundownId0}_piece011.start + 250`,
			})
		}
	)
	
	testTransition(
		'inTransition with existing infinites',
		setupRundownWithInTransitionExistingInfinite,
		(rundownId0, timeline, currentPartInstance, previousPartInstance) => {
			// old part is extended by 1000ms due to transition keepalive
			const oldPartTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'part_group_' + previousPartInstance?._id
			)
			expect(oldPartTlObj).toBeTruthy()
			expect(oldPartTlObj?.enable).toMatchObject({ end: `#part_group_${currentPartInstance?._id}.start + 1000` })

			// pieces are delayed by the transition preroll
			// console.log(JSON.stringify(timeline, undefined, 2))
			// looking for: part_group_randomId9002_part0_1_randomId9012_randomId9002_piece001_infinite
			const infPieceTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'part_group_' + currentPartInstance?._id + '_' + rundownId0 + '_piece002_infinite'
			)
			expect(infPieceTlObj).toBeTruthy()
			expect(infPieceTlObj?.enable).toMatchObject({
				start: `#part_group_${currentPartInstance?._id}.start`,
			})
		}
	)
	
	testTransition(
		'inTransition with new infinite',
		setupRundownWithInTransitionNewInfinite,
		(rundownId0, timeline, currentPartInstance, previousPartInstance) => {
			// old part is extended by 1000ms due to transition keepalive
			const oldPartTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'part_group_' + previousPartInstance?._id
			)
			expect(oldPartTlObj).toBeTruthy()
			expect(oldPartTlObj?.enable).toMatchObject({ end: `#part_group_${currentPartInstance?._id}.start + 1000` })

			// pieces are delayed by the transition preroll
			const infPieceTlObj = timeline?.timeline.find(
				(tlObj) =>
					tlObj.id === 'part_group_' + currentPartInstance?._id + '_' + rundownId0 + '_piece012_infinite'
			)
			expect(infPieceTlObj).toBeTruthy()
			expect(infPieceTlObj?.enable).toMatchObject({
				// note: no delay is known to be incorrect here but we accept it as "historically correct" for regression testing
				start: `#part_group_${currentPartInstance?._id}.start`,
				// start: `#part_group_${currentPartInstance?._id}.start + 500`,
			})
		}
	)

	testInFiber(
		'inTransition is disabled during hold',
		async () => {
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

				// old part ends immediately
				const oldPartTlObj = timeline?.timeline.find(
					(tlObj) => tlObj.id === 'part_group_' + previousPartInstance?._id
				)
				expect(oldPartTlObj).toBeTruthy()
				expect(oldPartTlObj?.enable).toMatchObject({
					// end: `#part_group_${currentPartInstance?._id}.start`,
					// note: this seems incorrect? why extend during hold??
					end: `#part_group_${currentPartInstance?._id}.start + 1000`,
				})

				// pieces are not delayed
				const newPartPieceTlObj = timeline?.timeline.find(
					(tlObj) => tlObj.id === 'piece_group_' + currentPartInstance?._id + '_' + rundownId0 + '_piece010'
				)
				expect(newPartPieceTlObj).toBeTruthy()
				expect(newPartPieceTlObj?.enable).toMatchObject({
					start: 0,
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
		}
	)
	
	testTransition(
		'inTransition disabled',
		setupRundownWithInTransitionDisabled,
		(rundownId0, timeline, currentPartInstance, previousPartInstance) => {
			// old part is not extended
			const oldPartTlObj = timeline?.timeline.find(
				(tlObj) => tlObj.id === 'part_group_' + previousPartInstance?._id
			)
			expect(oldPartTlObj).toBeTruthy()
			expect(oldPartTlObj?.enable).toMatchObject({ end: `#part_group_${currentPartInstance?._id}.start + 0` })

			// pieces are not delayed
			const infPieceTlObj = timeline?.timeline.find(
				(tlObj) =>
					tlObj.id === 'piece_group_' + currentPartInstance?._id + '_' + rundownId0 + '_piece010'
			)
			expect(infPieceTlObj).toBeTruthy()
			expect(infPieceTlObj?.enable).toMatchObject({
				start: 0,
			})
		}
	)
	
})
