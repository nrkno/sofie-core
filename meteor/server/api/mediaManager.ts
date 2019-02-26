import { MediaWorkFlows } from '../../lib/collections/MediaWorkFlows'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { waitForPromise } from '../../lib/lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

export namespace MediaManagerAPI {

	export function restartWorkflow (workflowId: string) {
		check(workflowId, String)

		const workflow = MediaWorkFlows.findOne(workflowId)
		if (!workflow) throw new Meteor.Error(404, `MediaWorkFlow "${workflowId}" not found`)

		return waitForPromise(new Promise((resolve, reject) => {
			PeripheralDeviceAPI.executeFunction(workflow.deviceId, (err, res) => {
				if (err) reject(err)
				else resolve(res)
			}, 'restartWorkflow', workflow._id)
		}))
	}
	export function abortWorkflow (workflowId: string) {
		check(workflowId, String)

		const workflow = MediaWorkFlows.findOne(workflowId)
		if (!workflow) throw new Meteor.Error(404, `MediaWorkFlow "${workflowId}" not found`)

		return waitForPromise(new Promise((resolve, reject) => {
			PeripheralDeviceAPI.executeFunction(workflow.deviceId, (err, res) => {
				if (err) reject(err)
				else resolve(res)
			}, 'abortWorkflow', workflow._id)
		}))
	}
}
