import { MediaWorkFlows, MediaWorkFlowId } from '../../lib/collections/MediaWorkFlows'
import { Meteor } from 'meteor/meteor'
import { waitForPromise, check } from '../../lib/lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'

export namespace MediaManagerAPI {

	export function restartAllWorkflows () {
		const workflows = MediaWorkFlows.find().fetch()
		const devices = workflows.reduce((memo, workflow) => {
			if (memo.indexOf(workflow.deviceId) < 0) {
				memo.push(workflow.deviceId)
			}
			return memo
		}, [] as PeripheralDeviceId[])
		waitForPromise(Promise.all(devices.map((deviceId) => {
			return new Promise((resolve, reject) => {
				PeripheralDeviceAPI.executeFunction(deviceId, (err, res) => {
					if (err) reject(err)
					else resolve()
				}, 'restartAllWorkflows')
			})
		})))
	}
	export function abortAllWorkflows () {
		const workflows = MediaWorkFlows.find().fetch()
		const devices = workflows.reduce((memo, workflow) => {
			if (memo.indexOf(workflow.deviceId) < 0) {
				memo.push(workflow.deviceId)
			}
			return memo
		}, [] as PeripheralDeviceId[])
		waitForPromise(Promise.all(devices.map((deviceId) => {
			return new Promise((resolve, reject) => {
				PeripheralDeviceAPI.executeFunction(deviceId, (err, res) => {
					if (err) reject(err)
					else resolve()
				}, 'abortAllWorkflows')
			})
		})))
	}

	export function restartWorkflow (workflowId: MediaWorkFlowId): any {
		check(workflowId, String)

		const workflow = MediaWorkFlows.findOne(workflowId)
		if (!workflow) throw new Meteor.Error(404, `MediaWorkFlow "${workflowId}" not found`)

		waitForPromise(new Promise((resolve, reject) => {
			PeripheralDeviceAPI.executeFunction(workflow.deviceId, (err, res) => {
				if (err) reject(err)
				else resolve()
			}, 'restartWorkflow', workflow._id)
		}))
	}
	export function abortWorkflow (workflowId: MediaWorkFlowId): any {
		check(workflowId, String)

		const workflow = MediaWorkFlows.findOne(workflowId)
		if (!workflow) throw new Meteor.Error(404, `MediaWorkFlow "${workflowId}" not found`)

		waitForPromise(new Promise((resolve, reject) => {
			PeripheralDeviceAPI.executeFunction(workflow.deviceId, (err, res) => {
				if (err) reject(err)
				else resolve()
			}, 'abortWorkflow', workflow._id)
		}))
	}
	export function prioritizeWorkflow (workflowId: MediaWorkFlowId): any {
		check(workflowId, String)

		const workflow = MediaWorkFlows.findOne(workflowId)
		if (!workflow) throw new Meteor.Error(404, `MediaWorkFlow "${workflowId}" not found`)

		waitForPromise(new Promise((resolve, reject) => {
			PeripheralDeviceAPI.executeFunction(workflow.deviceId, (err, res) => {
				if (err) reject(err)
				else resolve()
			}, 'prioritizeWorkflow', workflow._id)
		}))
	}
}
