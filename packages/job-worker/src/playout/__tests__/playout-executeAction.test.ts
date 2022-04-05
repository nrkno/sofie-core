import { RundownPlaylistId, AdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import { activateRundownPlaylist, executeAction, takeNextPart } from '../playout'
import { ActionPartChange, ActionExecutionContext } from '../../blueprints/context/adlibActions'
import * as Infinites from '../../playout/infinites'
import * as TakeApi from '../../playout/take'

const syncPlayheadInfinitesForNextPartInstanceMock = jest.spyOn(Infinites, 'syncPlayheadInfinitesForNextPartInstance')
const takeNextPartMock = jest.spyOn(TakeApi, 'takeNextPartInnerSync')

jest.mock('../timeline/generate')
import { updateTimeline } from '../timeline/generate'
type TupdateTimeline = jest.MockedFunction<typeof updateTimeline>
const updateTimelineMock = updateTimeline as TupdateTimeline

describe('Playout API', () => {
	describe('executeAction', () => {
		let context: MockJobContext
		let playlistId: RundownPlaylistId

		beforeEach(async () => {
			context = setupDefaultJobEnvironment()

			await setupMockShowStyleCompound(context)

			const { playlistId: playlistId0 } = await setupDefaultRundownPlaylist(context)
			playlistId = playlistId0

			await activateRundownPlaylist(context, {
				playlistId: playlistId,
				rehearsal: true,
			})
			await takeNextPart(context, {
				playlistId: playlistId,
				fromPartInstanceId: null,
			})

			syncPlayheadInfinitesForNextPartInstanceMock.mockClear()
			updateTimelineMock.mockClear()
			takeNextPartMock.mockClear()
		})

		test('throws errors', async () => {
			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }

			await expect(
				executeAction(context, {
					playlistId: playlistId,
					actionDocId: actionDocId,
					actionId: actionId,
					userData: userData,
				})
			).rejects.toMatchUserError(UserErrorMessage.ActionsNotSupported)

			context.updateShowStyleBlueprint({
				executeAction: async () => {
					throw new Error('action execution threw')
				},
			})

			// await supressLogging(async () => {
			await expect(executeAction(context, { playlistId, actionDocId, actionId, userData })).rejects.toThrowError(
				'action execution threw'
			)
			// })

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(0)
			expect(updateTimelineMock).toHaveBeenCalledTimes(0)
		})

		test('no changes', async () => {
			context.updateShowStyleBlueprint({
				executeAction: async (context0) => {
					const context = context0 as ActionExecutionContext
					if (context.nextPartState !== ActionPartChange.NONE) throw new Error('nextPartState started wrong')
					if (context.currentPartState !== ActionPartChange.NONE)
						throw new Error('nextPartState started wrong')
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			await executeAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(0)
			expect(updateTimelineMock).toHaveBeenCalledTimes(0)
		})

		test('safe next part', async () => {
			context.updateShowStyleBlueprint({
				executeAction: async (context0) => {
					const context = context0 as ActionExecutionContext
					if (context.nextPartState !== ActionPartChange.NONE) throw new Error('nextPartState started wrong')
					if (context.currentPartState !== ActionPartChange.NONE)
						throw new Error('nextPartState started wrong')

					context.nextPartState = ActionPartChange.SAFE_CHANGE
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			await executeAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(1)
			expect(updateTimelineMock).toHaveBeenCalledTimes(1)
		})

		test('safe current part', async () => {
			context.updateShowStyleBlueprint({
				executeAction: async (context0) => {
					const context = context0 as ActionExecutionContext
					if (context.nextPartState !== ActionPartChange.NONE) throw new Error('nextPartState started wrong')
					if (context.currentPartState !== ActionPartChange.NONE)
						throw new Error('nextPartState started wrong')

					context.currentPartState = ActionPartChange.SAFE_CHANGE
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			await executeAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(syncPlayheadInfinitesForNextPartInstanceMock).toHaveBeenCalledTimes(1)
			expect(updateTimelineMock).toHaveBeenCalledTimes(1)
		})

		test('take after execute (true)', async () => {
			takeNextPartMock.mockImplementationOnce(async () => Promise.resolve())

			context.updateShowStyleBlueprint({
				executeAction: async (context) => {
					await context.takeAfterExecuteAction(true)
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			await executeAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(takeNextPartMock).toHaveBeenCalledTimes(1)
		})

		test('take after execute (false)', async () => {
			takeNextPartMock.mockImplementationOnce(async () => Promise.resolve())

			context.updateShowStyleBlueprint({
				executeAction: async (context) => {
					await context.takeAfterExecuteAction(false)
				},
			})

			const actionDocId: AdLibActionId = protectString('action-id')
			const actionId = 'some-action'
			const userData = { blobby: true }
			await executeAction(context, {
				playlistId,
				actionDocId,
				actionId,
				userData,
			})

			expect(takeNextPartMock).toHaveBeenCalledTimes(0)
		})
	})
})
