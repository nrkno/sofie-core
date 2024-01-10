import { MediaWorkFlow } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlows'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { MediaWorkFlowContentAccess } from '../security/peripheralDevice'
import { BasicAccessContext } from '../security/organization'
import { MediaWorkFlows, PeripheralDevices } from '../collections'
import { executePeripheralDeviceFunction } from './peripheralDevice/executeFunction'

export namespace MediaManagerAPI {
	export async function restartAllWorkflows(access: BasicAccessContext): Promise<void> {
		const devices: Array<Pick<PeripheralDevice, '_id'>> = await PeripheralDevices.findFetchAsync(
			access.organizationId ? { organizationId: access.organizationId } : {},
			{
				fields: {
					_id: 1,
				},
			}
		)
		const workflows: Array<Pick<MediaWorkFlow, 'deviceId'>> = await MediaWorkFlows.findFetchAsync(
			{
				deviceId: { $in: devices.map((d) => d._id) },
			},
			{
				fields: {
					deviceId: 1,
				},
			}
		)

		const deviceIds = Array.from(new Set(workflows.map((w) => w.deviceId)))

		await Promise.all(
			deviceIds.map(async (deviceId) => executePeripheralDeviceFunction(deviceId, 'restartAllWorkflows'))
		)
	}
	export async function abortAllWorkflows(access: BasicAccessContext): Promise<void> {
		const devices: Array<Pick<PeripheralDevice, '_id'>> = await PeripheralDevices.findFetchAsync(
			access.organizationId ? { organizationId: access.organizationId } : {},
			{
				fields: {
					_id: 1,
				},
			}
		)
		const workflows: Array<Pick<MediaWorkFlow, 'deviceId'>> = await MediaWorkFlows.findFetchAsync(
			{
				deviceId: { $in: devices.map((d) => d._id) },
			},
			{
				fields: {
					deviceId: 1,
				},
			}
		)

		const deviceIds = Array.from(new Set(workflows.map((w) => w.deviceId)))

		await Promise.all(
			deviceIds.map(async (deviceId) => executePeripheralDeviceFunction(deviceId, 'abortAllWorkflows'))
		)
	}

	export async function restartWorkflow(access: MediaWorkFlowContentAccess): Promise<void> {
		const workflow = access.mediaWorkFlow
		await executePeripheralDeviceFunction(workflow.deviceId, 'restartWorkflow', workflow._id)
	}
	export async function abortWorkflow(access: MediaWorkFlowContentAccess): Promise<void> {
		const workflow = access.mediaWorkFlow
		await executePeripheralDeviceFunction(workflow.deviceId, 'abortWorkflow', workflow._id)
	}
	export async function prioritizeWorkflow(access: MediaWorkFlowContentAccess): Promise<void> {
		const workflow = access.mediaWorkFlow
		await executePeripheralDeviceFunction(workflow.deviceId, 'prioritizeWorkflow', workflow._id)
	}
}
