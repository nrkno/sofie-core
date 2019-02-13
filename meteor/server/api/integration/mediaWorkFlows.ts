import * as _ from 'underscore'
import { check, Match } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { logger } from '../../logging'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import { MediaWorkFlows, MediaWorkFlow } from '../../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowSteps, MediaWorkFlowStep } from '../../../lib/collections/MediaWorkFlowSteps'
import { setMeteorMethods, Methods, wrapMethods } from '../../methods'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'

export namespace MediaManagerIntegration {

	export function getMediaWorkFlowStepRevisions (id: string, token: string) {
		logger.debug('getMediaWorkFlowStepRevisions')
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

		if (peripheralDevice.studioInstallationId) {
			return _.map(MediaWorkFlowSteps.find({
				studioInstallationId: peripheralDevice.studioInstallationId
			}).fetch(), (ws: MediaWorkFlowStep) => {
				return {
					_id: ws._id,
					_rev: ws._rev
				}
			})
		} else {
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studioInstallation')
		}
	}

	export function getMediaWorkFlowRevisions (id: string, token: string) {
		logger.debug('getMediaWorkFlowRevisions')
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

		if (peripheralDevice.studioInstallationId) {
			return _.map(MediaWorkFlows.find({
				studioInstallationId: peripheralDevice.studioInstallationId
			}).fetch(), (wf: MediaWorkFlow) => {
				return {
					_id: wf._id,
					_rev: wf._rev
				}
			})
		} else {
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studioInstallation')
		}
	}

	export function updateMediaWorkFlow (id: string, token: string, docId: string, obj: MediaWorkFlow | null) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice.studioInstallationId) throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studioInstallation')

		check(docId, String)
		check(obj, Match.Maybe(Object))

		if (obj) {
			check(obj._id, String)
			obj.studioInstallationId = peripheralDevice.studioInstallationId

			MediaWorkFlows.upsert(docId, obj)
		} else {
			MediaWorkFlows.remove(docId)
		}
	}

	export function updateMediaWorkFlowStep (id: string, token: string, docId: string, obj: MediaWorkFlowStep | null) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice.studioInstallationId) throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studioInstallation')

		check(docId, String)
		check(obj, Match.Maybe(Object))

		if (obj) {
			check(obj._id, String)
			obj.studioInstallationId = peripheralDevice.studioInstallationId

			MediaWorkFlowSteps.upsert(docId, obj)
		} else {
			MediaWorkFlowSteps.remove(docId)
		}
	}
}

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.getMediaWorkFlowRevisions] = (deviceId: string, deviceToken: string) => {
	return MediaManagerIntegration.getMediaWorkFlowRevisions(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.getMediaWorkFlowStepRevisions] = (deviceId: string, deviceToken: string) => {
	return MediaManagerIntegration.getMediaWorkFlowStepRevisions(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.updateMediaWorkFlow] = (deviceId: string, deviceToken: string, docId: string, obj: MediaWorkFlow | null) => {
	return MediaManagerIntegration.updateMediaWorkFlow(deviceId, deviceToken, docId, obj)
}
methods[PeripheralDeviceAPI.methods.updateMediaWorkFlowStep] = (deviceId: string, deviceToken: string, docId: string, obj: MediaWorkFlowStep | null) => {
	return MediaManagerIntegration.updateMediaWorkFlowStep(deviceId, deviceToken, docId, obj)
}
// Apply methods:
setMeteorMethods(wrapMethods(methods))
