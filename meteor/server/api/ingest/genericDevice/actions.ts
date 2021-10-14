import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { TriggerReloadDataResponse } from '../../../../lib/api/userActions'
import { waitForPromise, WrapAsyncCallback } from '../../../../lib/lib'
import { logger } from '../../../logging'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import * as _ from 'underscore'
import { IngestRundown } from '@sofie-automation/blueprints-integration'
import { runIngestOperation } from '../lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'

export namespace GenericDeviceActions {
	export const reloadRundown: (peripheralDevice: PeripheralDevice, rundown: Rundown) => TriggerReloadDataResponse =
		Meteor.wrapAsync(function reloadRundown(
			peripheralDevice: PeripheralDevice,
			rundown: Rundown,
			cb: WrapAsyncCallback<TriggerReloadDataResponse>
		): void {
			logger.info('reloadRundown ' + rundown._id)

			PeripheralDeviceAPI.executeFunctionWithCustomTimeout(
				peripheralDevice._id,
				(err: Error, ingestRundown: IngestRundown | null) => {
					if (err) {
						if (_.isString(err) && err.match(/rundown does not exist/i)) {
							// Don't throw an error, instead return MISSING value
							cb(null, TriggerReloadDataResponse.MISSING)
						} else {
							logger.error('Error in GenericDeviceActions.reloadRundown', err)
							cb(err)
						}
					} else {
						try {
							if (ingestRundown === null) {
								logger.info('triggerReloadRundown reply with null')
								// a null-reply means that the device will asynchronously send data updates later:
								cb(null, TriggerReloadDataResponse.WORKING)
							} else {
								logger.info('triggerReloadRundown reply ' + ingestRundown.externalId)
								logger.debug(ingestRundown)

								if (ingestRundown.externalId !== rundown.externalId) {
									throw new Meteor.Error(
										500,
										`Bad response from device "${peripheralDevice._id}": Expected ingestRundown "${rundown.externalId}", got "${ingestRundown.externalId}"`
									)
								}

								waitForPromise(
									runIngestOperation(rundown.studioId, IngestJobs.UpdateRundown, {
										rundownExternalId: ingestRundown.externalId,
										peripheralDeviceId: peripheralDevice._id,
										ingestRundown: ingestRundown,
										isCreateAction: true,
									})
								)

								cb(null, TriggerReloadDataResponse.COMPLETED)
							}
						} catch (e) {
							cb(e)
						}
					}
				},
				10 * 1000, // 10 seconds, sometimes the NRCS is pretty slow in returning a response
				'triggerReloadRundown',
				rundown.externalId
			)
		})
}
