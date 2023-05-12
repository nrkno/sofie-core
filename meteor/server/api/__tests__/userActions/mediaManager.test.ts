import '../../../../__mocks__/_extendJest'
import { testInFiber, waitUntil } from '../../../../__mocks__/helpers/jest'
import { getCurrentTime, getRandomId, protectString } from '../../../../lib/lib'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../../__mocks__/helpers/database'
import { MeteorCall } from '../../../../lib/api/methods'
import { MediaWorkFlowId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MediaWorkFlows, PeripheralDeviceCommands, PeripheralDevices } from '../../../collections'

require('../../client') // include in order to create the Meteor methods needed
require('../../userActions') // include in order to create the Meteor methods needed

const MAX_WAIT_TIME = 300

describe('User Actions - Media Manager', () => {
	let env: DefaultEnvironment
	async function setupMockWorkFlow() {
		const workFlowId: MediaWorkFlowId = getRandomId()
		const workFlow = {
			_id: workFlowId,
			_rev: '',
			created: getCurrentTime(),
			deviceId: env.ingestDevice._id,
			finished: false,
			priority: 1,
			source: '',
			studioId: env.studio._id,
			success: false,
		}
		await MediaWorkFlows.insertAsync(workFlow)

		return { workFlow, workFlowId }
	}
	beforeEach(async () => {
		// clean up old peripheral devices and MediaWorkFlows
		await PeripheralDevices.removeAsync({
			_id: {
				$exists: true,
			},
		})
		await MediaWorkFlows.removeAsync({
			_id: {
				$exists: true,
			},
		})
		env = await setupDefaultStudioEnvironment()
		jest.resetAllMocks()
	})
	testInFiber('Restart workflow', async () => {
		const { workFlowId } = await setupMockWorkFlow()

		// should fail if the workflow doesn't exist
		await expect(
			MeteorCall.userAction.mediaRestartWorkflow('', getCurrentTime(), protectString('FAKE_ID'))
		).resolves.toMatchUserRawError(/not found/gi)

		{
			// should execute function on the target device
			const p = waitUntil(async () => {
				const functionCall = (
					await PeripheralDeviceCommands.findFetchAsync({
						deviceId: env.ingestDevice._id,
						functionName: 'restartWorkflow',
					})
				)[0]
				expect(functionCall).toBeTruthy()
				await PeripheralDeviceCommands.updateAsync(functionCall._id, {
					$set: {
						hasReply: true,
						reply: 'done',
					},
				})
			}, MAX_WAIT_TIME)

			await MeteorCall.userAction.mediaRestartWorkflow('', getCurrentTime(), workFlowId)
			await p
		}
	})
	testInFiber('Abort worfklow', async () => {
		const { workFlowId } = await setupMockWorkFlow()

		// should fail if the workflow doesn't exist
		await expect(
			MeteorCall.userAction.mediaAbortWorkflow('', getCurrentTime(), protectString('FAKE_ID'))
		).resolves.toMatchUserRawError(/not found/gi)

		{
			// should execute function on the target device

			const p = waitUntil(async () => {
				const functionCall = (
					await PeripheralDeviceCommands.findFetchAsync({
						deviceId: env.ingestDevice._id,
						functionName: 'abortWorkflow',
					})
				)[0]
				expect(functionCall).toBeTruthy()
				await PeripheralDeviceCommands.updateAsync(functionCall._id, {
					$set: {
						hasReply: true,
						reply: 'done',
					},
				})
			}, MAX_WAIT_TIME)

			await MeteorCall.userAction.mediaAbortWorkflow('', getCurrentTime(), workFlowId)
			await p
		}
	})
	testInFiber('Prioritize workflow', async () => {
		const { workFlowId } = await setupMockWorkFlow()

		// should fail if the workflow doesn't exist
		await expect(
			MeteorCall.userAction.mediaPrioritizeWorkflow('', getCurrentTime(), protectString('FAKE_ID'))
		).resolves.toMatchUserRawError(/not found/gi)

		{
			// should execute function on the target device
			const p = waitUntil(async () => {
				const functionCall = (
					await PeripheralDeviceCommands.findFetchAsync({
						deviceId: env.ingestDevice._id,
						functionName: 'prioritizeWorkflow',
					})
				)[0]

				expect(functionCall).toBeTruthy()
				await PeripheralDeviceCommands.updateAsync(functionCall._id, {
					$set: {
						hasReply: true,
						reply: 'done',
					},
				})
			}, MAX_WAIT_TIME)

			await MeteorCall.userAction.mediaPrioritizeWorkflow('', getCurrentTime(), workFlowId)
			await p
		}
	})
	testInFiber('Restart all workflows', async () => {
		await setupMockWorkFlow()

		{
			// should execute function on all the target devices
			const p = waitUntil(async () => {
				const functionCalls = await PeripheralDeviceCommands.findFetchAsync({
					functionName: 'restartAllWorkflows',
				})
				expect(functionCalls).toHaveLength(1)
				await PeripheralDeviceCommands.updateAsync(functionCalls[0]._id, {
					$set: {
						hasReply: true,
						reply: 'done',
					},
				})
			}, MAX_WAIT_TIME)

			await MeteorCall.userAction.mediaRestartAllWorkflows('', getCurrentTime())
			await p
		}
	})
	testInFiber('Abort all workflows', async () => {
		await setupMockWorkFlow()

		{
			// should execute function on all the target devices
			const p = waitUntil(async () => {
				const functionCalls = await PeripheralDeviceCommands.findFetchAsync({
					functionName: 'abortAllWorkflows',
				})
				expect(functionCalls).toHaveLength(1)
				await PeripheralDeviceCommands.updateAsync(functionCalls[0]._id, {
					$set: {
						hasReply: true,
						reply: 'done',
					},
				})
			}, MAX_WAIT_TIME)

			await MeteorCall.userAction.mediaAbortAllWorkflows('', getCurrentTime())
			await p
		}
	})
})
