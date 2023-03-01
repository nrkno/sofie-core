import '../../../../__mocks__/_extendJest'
import { testInFiber } from '../../../../__mocks__/helpers/jest'
import { getCurrentTime, getRandomId, protectString } from '../../../../lib/lib'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../../__mocks__/helpers/database'
import { MediaWorkFlows } from '../../../../lib/collections/MediaWorkFlows'
import { PeripheralDeviceCommands } from '../../../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { MeteorCall } from '../../../../lib/api/methods'
import { MediaWorkFlowId } from '@sofie-automation/corelib/dist/dataModel/Ids'

require('../../client') // include in order to create the Meteor methods needed
require('../../userActions') // include in order to create the Meteor methods needed

describe('User Actions - Media Manager', () => {
	let env: DefaultEnvironment
	function setupMockWorkFlow() {
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
		MediaWorkFlows.insert(workFlow)

		return { workFlow, workFlowId }
	}
	beforeEach(async () => {
		// clean up old peripheral devices and MediaWorkFlows
		PeripheralDevices.remove({
			_id: {
				$exists: true,
			},
		})
		MediaWorkFlows.remove({
			_id: {
				$exists: true,
			},
		})
		env = await setupDefaultStudioEnvironment()
		jest.resetAllMocks()
	})
	testInFiber('Restart workflow', async () => {
		const { workFlowId } = setupMockWorkFlow()

		// should fail if the workflow doesn't exist
		await expect(
			MeteorCall.userAction.mediaRestartWorkflow('', getCurrentTime(), protectString('FAKE_ID'))
		).resolves.toMatchUserRawError(/not found/gi)

		{
			// should execute function on the target device
			let pResolve
			const p = new Promise((resolve) => {
				pResolve = resolve
			})

			setTimeout(() => {
				const functionCall = PeripheralDeviceCommands.find({
					deviceId: env.ingestDevice._id,
					functionName: 'restartWorkflow',
				}).fetch()[0]
				expect(functionCall).toBeTruthy()
				PeripheralDeviceCommands.update(functionCall._id, {
					$set: {
						hasReply: true,
						reply: 'done',
					},
				})
				pResolve()
			}, 50)

			await MeteorCall.userAction.mediaRestartWorkflow('', getCurrentTime(), workFlowId)
			await p
		}
	})
	testInFiber('Abort worfklow', async () => {
		const { workFlowId } = setupMockWorkFlow()

		// should fail if the workflow doesn't exist
		await expect(
			MeteorCall.userAction.mediaAbortWorkflow('', getCurrentTime(), protectString('FAKE_ID'))
		).resolves.toMatchUserRawError(/not found/gi)

		{
			// should execute function on the target device
			let pResolve
			const p = new Promise((resolve) => {
				pResolve = resolve
			})

			setTimeout(() => {
				const functionCall = PeripheralDeviceCommands.find({
					deviceId: env.ingestDevice._id,
					functionName: 'abortWorkflow',
				}).fetch()[0]
				expect(functionCall).toBeTruthy()
				PeripheralDeviceCommands.update(functionCall._id, {
					$set: {
						hasReply: true,
						reply: 'done',
					},
				})
				pResolve()
			}, 50)

			await MeteorCall.userAction.mediaAbortWorkflow('', getCurrentTime(), workFlowId)
			await p
		}
	})
	testInFiber('Prioritize workflow', async () => {
		const { workFlowId } = setupMockWorkFlow()

		// should fail if the workflow doesn't exist
		await expect(
			MeteorCall.userAction.mediaPrioritizeWorkflow('', getCurrentTime(), protectString('FAKE_ID'))
		).resolves.toMatchUserRawError(/not found/gi)

		{
			// should execute function on the target device
			let pResolve
			const p = new Promise((resolve) => {
				pResolve = resolve
			})

			setTimeout(() => {
				const functionCall = PeripheralDeviceCommands.find({
					deviceId: env.ingestDevice._id,
					functionName: 'prioritizeWorkflow',
				}).fetch()[0]
				expect(functionCall).toBeTruthy()
				PeripheralDeviceCommands.update(functionCall._id, {
					$set: {
						hasReply: true,
						reply: 'done',
					},
				})
				pResolve()
			}, 50)

			await MeteorCall.userAction.mediaPrioritizeWorkflow('', getCurrentTime(), workFlowId)
			await p
		}
	})
	testInFiber('Restart all workflows', async () => {
		setupMockWorkFlow()

		{
			// should execute function on all the target devices
			setTimeout(() => {
				const functionCalls = PeripheralDeviceCommands.find({
					functionName: 'restartAllWorkflows',
				}).fetch()
				expect(functionCalls).toHaveLength(1)
				PeripheralDeviceCommands.update(functionCalls[0]._id, {
					$set: {
						hasReply: true,
						reply: 'done',
					},
				})
			}, 50)

			await MeteorCall.userAction.mediaRestartAllWorkflows('', getCurrentTime())
		}
	})
	testInFiber('Abort all workflows', async () => {
		setupMockWorkFlow()

		{
			// should execute function on all the target devices
			setTimeout(() => {
				const functionCalls = PeripheralDeviceCommands.find({
					functionName: 'abortAllWorkflows',
				}).fetch()
				expect(functionCalls).toHaveLength(1)
				PeripheralDeviceCommands.update(functionCalls[0]._id, {
					$set: {
						hasReply: true,
						reply: 'done',
					},
				})
			}, 50)

			await MeteorCall.userAction.mediaAbortAllWorkflows('', getCurrentTime())
		}
	})
})
