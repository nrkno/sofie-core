import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import { logger } from '../../logging'
import { MediaObject, MediaObjects } from '../../../lib/collections/MediaObjects'
import { setMeteorMethods, Methods, wrapMethods } from '../../methods'

export namespace MediaScannerIntegration {
	export function getMediaObjectRevisions (id, token, collectionId: string) {
		logger.debug('getMediaObjectRevisions')
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

		if (peripheralDevice.studioInstallationId) {
			return _.map(MediaObjects.find({
				studioId: peripheralDevice.studioInstallationId,
				collectionId: collectionId
			}).fetch(), (mo: MediaObject) => {
				return {
					id: 	mo.objId,
					rev: 	mo._rev
				}
			})
		} else {
			throw new Meteor.Error(400, 'Device "' + peripheralDevice._id + '" has no studioInstallation')
		}
	}
	export function updateMediaObject (id, token, collectionId: string, objId, doc: MediaObject | null) {
		// logger.debug('updateMediaObject')
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

		let _id = collectionId + '_' + objId
		if (_.isNull(doc)) {
			MediaObjects.remove(_id)
		} else if (doc) {
			let doc2 = _.extend(doc, {
				studioId: peripheralDevice.studioInstallationId,
				collectionId: collectionId,
				objId: objId,
				_id: _id
			})
			// logger.debug(doc2)
			MediaObjects.upsert(_id, {$set: doc2})
		} else {
			throw new Meteor.Error(400, 'missing doc argument')
		}
	}
}

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.getMediaObjectRevisions] = (deviceId, deviceToken, collectionId: string,) => {
	return MediaScannerIntegration.getMediaObjectRevisions(deviceId, deviceToken, collectionId)
}
methods[PeripheralDeviceAPI.methods.updateMediaObject] = (deviceId, deviceToken, collectionId: string, id: string, doc: MediaObject | null) => {
	return MediaScannerIntegration.updateMediaObject(deviceId, deviceToken, collectionId, id, doc)
}
// Apply methods:
setMeteorMethods(wrapMethods(methods))
