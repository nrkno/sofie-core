import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { MethodContext } from '../../lib/api/methods'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { check } from '../../lib/check'
import { MediaWorkFlowId, MediaWorkFlows } from '../../lib/collections/MediaWorkFlows'
import { OrganizationId } from '../../lib/collections/Organization'
import { PeripheralDeviceId, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { waitForPromise } from '../../lib/lib'
import { Settings } from '../../lib/Settings'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { OrganizationContentWriteAccess } from '../security/organization'
import { PeripheralDeviceContentWriteAccess } from '../security/peripheralDevice'

export namespace MediaManagerAPI {
	export function restartAllWorkflows(context: MethodContext, organizationId: OrganizationId | null) {
		if (Settings.enableUserAccounts) {
			if (!organizationId) throw new Meteor.Error(400, `parameter organizationId is not set`)
			OrganizationContentWriteAccess.mediaWorkFlows(context, organizationId)
		} else {
			triggerWriteAccessBecauseNoCheckNecessary()
		}

		const devices = PeripheralDevices.find(organizationId ? { organizationId: organizationId } : {}).fetch()
		const workflows = MediaWorkFlows.find({
			deviceId: { $in: _.uniq(_.map(devices, (d) => d._id)) },
		}).fetch()
		const deviceIds = workflows.reduce((memo, workflow) => {
			if (memo.indexOf(workflow.deviceId) < 0) {
				memo.push(workflow.deviceId)
			}
			return memo
		}, [] as PeripheralDeviceId[])
		waitForPromise(
			Promise.all(
				deviceIds.map((deviceId) => {
					return new Promise((resolve, reject) => {
						PeripheralDeviceAPI.executeFunction(
							deviceId,
							(err, res) => {
								if (err) reject(err)
								else resolve()
							},
							'restartAllWorkflows'
						)
					})
				})
			)
		)
	}
	export function abortAllWorkflows(context: MethodContext, organizationId: OrganizationId | null) {
		if (Settings.enableUserAccounts) {
			if (!organizationId) throw new Meteor.Error(400, `parameter organizationId is not set`)
			OrganizationContentWriteAccess.mediaWorkFlows(context, organizationId)
		} else {
			triggerWriteAccessBecauseNoCheckNecessary()
		}

		const devices = PeripheralDevices.find(organizationId ? { organizationId: organizationId } : {}).fetch()
		const workflows = MediaWorkFlows.find({
			deviceId: { $in: _.uniq(_.map(devices, (d) => d._id)) },
		}).fetch()

		const deviceIds = workflows.reduce((memo, workflow) => {
			if (memo.indexOf(workflow.deviceId) < 0) {
				memo.push(workflow.deviceId)
			}
			return memo
		}, [] as PeripheralDeviceId[])
		waitForPromise(
			Promise.all(
				deviceIds.map((deviceId) => {
					return new Promise((resolve, reject) => {
						PeripheralDeviceAPI.executeFunction(
							deviceId,
							(err, res) => {
								if (err) reject(err)
								else resolve()
							},
							'abortAllWorkflows'
						)
					})
				})
			)
		)
	}

	export function restartWorkflow(context: MethodContext, workflowId: MediaWorkFlowId): any {
		check(workflowId, String)

		const access = PeripheralDeviceContentWriteAccess.mediaWorkFlow(context, workflowId)
		const workflow = access.mediaWorkFlow
		if (!workflow) throw new Meteor.Error(404, `MediaWorkFlow "${workflowId}" not found`)

		waitForPromise(
			new Promise((resolve, reject) => {
				PeripheralDeviceAPI.executeFunction(
					workflow.deviceId,
					(err, res) => {
						if (err) reject(err)
						else resolve()
					},
					'restartWorkflow',
					workflow._id
				)
			})
		)
	}
	export function abortWorkflow(context: MethodContext, workflowId: MediaWorkFlowId): any {
		check(workflowId, String)

		const access = PeripheralDeviceContentWriteAccess.mediaWorkFlow(context, workflowId)
		const workflow = access.mediaWorkFlow
		if (!workflow) throw new Meteor.Error(404, `MediaWorkFlow "${workflowId}" not found`)

		waitForPromise(
			new Promise((resolve, reject) => {
				PeripheralDeviceAPI.executeFunction(
					workflow.deviceId,
					(err, res) => {
						if (err) reject(err)
						else resolve()
					},
					'abortWorkflow',
					workflow._id
				)
			})
		)
	}
	export function prioritizeWorkflow(context: MethodContext, workflowId: MediaWorkFlowId): any {
		check(workflowId, String)

		const access = PeripheralDeviceContentWriteAccess.mediaWorkFlow(context, workflowId)
		const workflow = access.mediaWorkFlow
		if (!workflow) throw new Meteor.Error(404, `MediaWorkFlow "${workflowId}" not found`)

		waitForPromise(
			new Promise((resolve, reject) => {
				PeripheralDeviceAPI.executeFunction(
					workflow.deviceId,
					(err, res) => {
						if (err) reject(err)
						else resolve()
					},
					'prioritizeWorkflow',
					workflow._id
				)
			})
		)
	}
}
