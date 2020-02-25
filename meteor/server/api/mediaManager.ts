import { MediaWorkFlows, MediaWorkFlowId } from '../../lib/collections/MediaWorkFlows'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { waitForPromise } from '../../lib/lib'
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
		return waitForPromise(Promise.all(devices.map((deviceId) => {
			return new Promise((resolve, reject) => {
				PeripheralDeviceAPI.executeFunction(deviceId, (err, res) => {
					if (err) reject(err)
					else resolve(res)
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
		return waitForPromise(Promise.all(devices.map((deviceId) => {
			return new Promise((resolve, reject) => {
				PeripheralDeviceAPI.executeFunction(deviceId, (err, res) => {
					if (err) reject(err)
					else resolve(res)
				}, 'abortAllWorkflows')
			})
		})))
	}

	export function restartWorkflow (workflowId: MediaWorkFlowId) {
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
	export function abortWorkflow (workflowId: MediaWorkFlowId) {
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
	export function prioritizeWorkflow (workflowId: MediaWorkFlowId) {
		check(workflowId, String)

		const workflow = MediaWorkFlows.findOne(workflowId)
		if (!workflow) throw new Meteor.Error(404, `MediaWorkFlow "${workflowId}" not found`)

		return waitForPromise(new Promise((resolve, reject) => {
			PeripheralDeviceAPI.executeFunction(workflow.deviceId, (err, res) => {
				if (err) reject(err)
				else resolve(res)
			}, 'prioritizeWorkflow', workflow._id)
		}))
	}
}
