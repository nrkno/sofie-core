import '../../../../__mocks__/_extendJest'
import { testInFiber, beforeEachInFiber } from '../../../../__mocks__/helpers/jest'
import {
	DefaultEnvironment,
	setupDefaultStudioEnvironment,
	setupDefaultRundownPlaylist,
	packageBlueprint,
} from '../../../../__mocks__/helpers/database'
import { ServerPlayoutAPI } from '../playout'
import { ActionExecutionContext, ActionPartChange } from '../../blueprints/context'
import { Rundown, Rundowns, RundownId } from '../../../../lib/collections/Rundowns'
import { RundownPlaylistId, RundownPlaylist, RundownPlaylists } from '../../../../lib/collections/RundownPlaylists'
import { PartInstances } from '../../../../lib/collections/PartInstances'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { Blueprints, BlueprintId } from '../../../../lib/collections/Blueprints'
import { BLUEPRINT_CACHE_CONTROL } from '../../blueprints/cache'
import { ShowStyleBlueprintManifest, BlueprintManifestType } from 'tv-automation-sofie-blueprints-integration'

jest.mock('../../playout/infinites')
import { syncPlayheadInfinitesForNextPartInstance } from '../../playout/infinites'
type TsyncPlayheadInfinitesForNextPartInstance = jest.MockedFunction<typeof syncPlayheadInfinitesForNextPartInstance>
const syncPlayheadInfinitesForNextPartInstanceMock = syncPlayheadInfinitesForNextPartInstance as TsyncPlayheadInfinitesForNextPartInstance
jest.mock('../../playout/timeline')
import { updateTimeline } from '../../playout/timeline'
type TupdateTimeline = jest.MockedFunction<typeof updateTimeline>
const updateTimelineMock = updateTimeline as TupdateTimeline

describe('Playout API', () => {
	describe('executeAction', () => {
		let env: DefaultEnvironment
		let playlistId: RundownPlaylistId
		let rundownId: RundownId
		let blueprintId: BlueprintId

		beforeEachInFiber(() => {
			BLUEPRINT_CACHE_CONTROL.disable = true

			env = setupDefaultStudioEnvironment()

			const { playlistId: playlistId0, rundownId: rundownId0 } = setupDefaultRundownPlaylist(env)
			playlistId = playlistId0
			rundownId = rundownId0

			ServerPlayoutAPI.activateRundownPlaylist(playlistId, true)
			ServerPlayoutAPI.takeNextPart(playlistId)

			const rundown = Rundowns.findOne(rundownId) as Rundown
			expect(rundown).toBeTruthy()
			const showStyle = ShowStyleBases.findOne(rundown.showStyleBaseId) as ShowStyleBase
			expect(showStyle).toBeTruthy()

			blueprintId = showStyle.blueprintId

			syncPlayheadInfinitesForNextPartInstanceMock.mockClear()
			updateTimelineMock.mockClear()
		})

		afterEach(() => {
			BLUEPRINT_CACHE_CONTROL.disable = false
		})

		testInFiber('invalid parameters', () => {
			// @ts-ignore
			expect(() => ServerPlayoutAPI.executeAction(9, '', '')).toThrowError('Match error: Expected string')
			// @ts-ignore
			expect(() => ServerPlayoutAPI.executeAction('', 9, '')).toThrowError('Match error: Expected string')
		})

		testInFiber('throws errors', () => {
			const actionId = 'some-action'
			const userData = { blobby: true }

			expect(() => ServerPlayoutAPI.executeAction(playlistId, actionId, userData)).toThrowError(
				'ShowStyle blueprint does not support executing actions'
			)

			const BLUEPRINT_TYPE = BlueprintManifestType.SHOWSTYLE

			// Change the blueprint and try again
			Blueprints.update(blueprintId, {
				$set: {
					code: packageBlueprint<ShowStyleBlueprintManifest>(
						{
							// Constants to into code:
							BLUEPRINT_TYPE,
						},
						function(): any {
							return {
								blueprintType: BLUEPRINT_TYPE,
								executeAction: () => {
									throw new Error('action execution threw')
								},
							}
						}
					),
				},
			})
			expect(() => ServerPlayoutAPI.executeAction(playlistId, actionId, userData)).toThrowError(
				'action execution threw'
			)

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(0)
			expect(updateTimelineMock).toHaveBeenCalledTimes(0)
		})

		testInFiber('no changes', () => {
			const BLUEPRINT_TYPE = BlueprintManifestType.SHOWSTYLE
			const STATE_NONE = ActionPartChange.NONE
			const STATE_SAFE = ActionPartChange.SAFE_CHANGE

			Blueprints.update(blueprintId, {
				$set: {
					code: packageBlueprint<ShowStyleBlueprintManifest>(
						{
							// Constants to into code:
							BLUEPRINT_TYPE,
							STATE_NONE,
							STATE_SAFE,
						},
						function(): any {
							return {
								blueprintType: BLUEPRINT_TYPE,
								executeAction: (context0) => {
									const context = context0 as ActionExecutionContext
									if (context.nextPartState !== STATE_NONE)
										throw new Error('nextPartState started wrong')
									if (context.currentPartState !== STATE_NONE)
										throw new Error('nextPartState started wrong')
								},
							}
						}
					),
				},
			})

			const actionId = 'some-action'
			const userData = { blobby: true }
			ServerPlayoutAPI.executeAction(playlistId, actionId, userData)

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(0)
			expect(updateTimelineMock).toHaveBeenCalledTimes(0)
		})

		testInFiber('safe next part', () => {
			const BLUEPRINT_TYPE = BlueprintManifestType.SHOWSTYLE
			const STATE_NONE = ActionPartChange.NONE
			const STATE_SAFE = ActionPartChange.SAFE_CHANGE

			Blueprints.update(blueprintId, {
				$set: {
					code: packageBlueprint<ShowStyleBlueprintManifest>(
						{
							// Constants to into code:
							BLUEPRINT_TYPE,
							STATE_NONE,
							STATE_SAFE,
						},
						function(): any {
							return {
								blueprintType: BLUEPRINT_TYPE,
								executeAction: (context0) => {
									const context = context0 as ActionExecutionContext
									if (context.nextPartState !== STATE_NONE)
										throw new Error('nextPartState started wrong')
									if (context.currentPartState !== STATE_NONE)
										throw new Error('nextPartState started wrong')

									context.nextPartState = STATE_SAFE
								},
							}
						}
					),
				},
			})

			const actionId = 'some-action'
			const userData = { blobby: true }
			ServerPlayoutAPI.executeAction(playlistId, actionId, userData)

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(1)
			expect(updateTimelineMock).toHaveBeenCalledTimes(1)
		})

		testInFiber('safe current part', () => {
			const BLUEPRINT_TYPE = BlueprintManifestType.SHOWSTYLE
			const STATE_NONE = ActionPartChange.NONE
			const STATE_SAFE = ActionPartChange.SAFE_CHANGE

			Blueprints.update(blueprintId, {
				$set: {
					code: packageBlueprint<ShowStyleBlueprintManifest>(
						{
							// Constants to into code:
							BLUEPRINT_TYPE,
							STATE_NONE,
							STATE_SAFE,
						},
						function(): any {
							return {
								blueprintType: BLUEPRINT_TYPE,
								executeAction: (context0) => {
									const context = context0 as ActionExecutionContext
									if (context.nextPartState !== STATE_NONE)
										throw new Error('nextPartState started wrong')
									if (context.currentPartState !== STATE_NONE)
										throw new Error('nextPartState started wrong')

									context.currentPartState = STATE_SAFE
								},
							}
						}
					),
				},
			})

			const actionId = 'some-action'
			const userData = { blobby: true }
			ServerPlayoutAPI.executeAction(playlistId, actionId, userData)

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(1)
			expect(updateTimelineMock).toHaveBeenCalledTimes(1)
		})
	})
})
