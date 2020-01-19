import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import { logger } from '../../logging'
import { MediaObject, MediaObjects } from '../../../lib/collections/MediaObjects'
import { setMeteorMethods, Methods } from '../../../lib/methods'
import { PeripheralDevices, PeripheralDevice, getStudioIdFromDevice } from '../../../lib/collections/PeripheralDevices'

export namespace MediaScannerIntegration {
	export function getMediaObjectRevisions (id: string, token: string, collectionId: string) {
		// logger.debug('getMediaObjectRevisions')
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)


		const studioId = getStudioIdFromDevice(peripheralDevice)


		if (studioId) {
			return _.map(MediaObjects.find({
				studioId: studioId,
				collectionId: collectionId
			}).fetch(), (mo: MediaObject) => {
				return {
					id: 	mo.objId,
					rev: 	mo._rev
				}
			})
		} else {
			throw new Meteor.Error(400, 'getMediaObjectRevisions: Device "' + peripheralDevice._id + '" has no studio')
		}
	}
	export function updateMediaObject (id: string, token: string, collectionId: string, objId: string, doc: MediaObject | null) {
		// logger.debug('updateMediaObject')
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

		const studioId = getStudioIdFromDevice(peripheralDevice)

		let _id = collectionId + '_' + objId
		if (_.isNull(doc)) {
			MediaObjects.remove(_id)
		} else if (doc) {
			if (doc.mediaId !== doc.mediaId.toUpperCase()) throw new Meteor.Error(400, 'mediaId must only use uppercase characters')
			let doc2 = _.extend(doc, {
				studioId: studioId,
				collectionId: collectionId,
				objId: objId,
				_id: _id
			})
			// logger.debug(doc2)
			MediaObjects.upsert(_id, { $set: doc2 })
		} else {
			throw new Meteor.Error(400, 'missing doc argument')
		}
	}
}

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.getMediaObjectRevisions] = (deviceId: string, deviceToken: string, collectionId: string,) => {
	return MediaScannerIntegration.getMediaObjectRevisions(deviceId, deviceToken, collectionId)
}
methods[PeripheralDeviceAPI.methods.updateMediaObject] = (deviceId: string, deviceToken: string, collectionId: string, id: string, doc: MediaObject | null) => {
	return MediaScannerIntegration.updateMediaObject(deviceId, deviceToken, collectionId, id, doc)
}
// Apply methods:
setMeteorMethods(methods)
