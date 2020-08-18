import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { MethodContext } from '../../../lib/api/methods'
import {
	MediaWorkFlowRevision,
	MediaWorkFlowStepRevision,
	PeripheralDeviceAPI,
} from '../../../lib/api/peripheralDevice'
import { check, Match } from '../../../lib/check'
import { MediaWorkFlow, MediaWorkFlowId, MediaWorkFlows } from '../../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowStep, MediaWorkFlowStepId, MediaWorkFlowSteps } from '../../../lib/collections/MediaWorkFlowSteps'
import { PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'
import { logger } from '../../logging'
import { checkAccessAndGetPeripheralDevice } from '../ingest/lib'

export namespace MediaManagerIntegration {
	export function getMediaWorkFlowStepRevisions(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string
	): MediaWorkFlowStepRevision[] {
		logger.debug('getMediaWorkFlowStepRevisions')
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)

		if (peripheralDevice.studioId) {
			return _.map(
				MediaWorkFlowSteps.find({
					studioId: peripheralDevice.studioId,
				}).fetch(),
				(ws: MediaWorkFlowStep) => {
					return {
						_id: ws._id,
						_rev: ws._rev,
					}
				}
			)
		} else {
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')
		}
	}

	export function getMediaWorkFlowRevisions(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string
	): MediaWorkFlowRevision[] {
		logger.debug('getMediaWorkFlowRevisions')
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)

		if (peripheralDevice.studioId) {
			return _.map(
				MediaWorkFlows.find({
					studioId: peripheralDevice.studioId,
				}).fetch(),
				(wf: MediaWorkFlow) => {
					return {
						_id: wf._id,
						_rev: wf._rev,
					}
				}
			)
		} else {
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')
		}
	}

	export function updateMediaWorkFlow(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		workFlowId: MediaWorkFlowId,
		obj: MediaWorkFlow | null
	): void {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		if (peripheralDevice.type !== PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER)
			throw new Meteor.Error(
				400,
				`Device "${peripheralDevice._id}".type is "${peripheralDevice.type}", should be MEDIA_MANAGER `
			)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')

		check(workFlowId, String)
		check(obj, Match.Maybe(Object))

		if (obj) {
			check(obj._id, String)
			obj.deviceId = peripheralDevice._id
			obj.studioId = peripheralDevice.studioId

			MediaWorkFlows.upsert(workFlowId, obj)

			if (obj.finished && !obj.success) {
				logger.info('mm job failed')
			} else if (obj.finished && obj.success) {
				logger.info('mm job success')
			}
		} else {
			MediaWorkFlows.remove(workFlowId)

			MediaWorkFlowSteps.remove({
				workFlowId: workFlowId,
			})
		}
	}

	export function updateMediaWorkFlowStep(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		stepId: MediaWorkFlowStepId,
		obj: MediaWorkFlowStep | null
	): void {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		if (peripheralDevice.type !== PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER)
			throw new Meteor.Error(
				400,
				`Device "${peripheralDevice._id}".type is "${peripheralDevice.type}", should be MEDIA_MANAGER `
			)
		if (!peripheralDevice.studioId)
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studio')

		check(stepId, String)
		check(obj, Match.Maybe(Object))

		if (obj) {
			check(obj._id, String)
			check(obj.workFlowId, String)

			const workflow = MediaWorkFlows.findOne(obj.workFlowId)

			if (!workflow) throw new Meteor.Error(404, `Workflow "${obj.workFlowId}" not found`)

			obj.workFlowId = workflow._id
			obj.deviceId = peripheralDevice._id
			obj.studioId = peripheralDevice.studioId

			MediaWorkFlowSteps.upsert(stepId, obj)
		} else {
			MediaWorkFlowSteps.remove(stepId)
		}
	}
}
