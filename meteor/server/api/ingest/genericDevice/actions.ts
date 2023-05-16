import { Meteor } from 'meteor/meteor'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { TriggerReloadDataResponse } from '../../../../lib/api/userActions'
import { stringifyError } from '../../../../lib/lib'
import { logger } from '../../../logging'
import * as _ from 'underscore'
import { IngestRundown } from '@sofie-automation/blueprints-integration'
import { runIngestOperation } from '../lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { DEFAULT_NRCS_TIMEOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'
import { executePeripheralDeviceFunctionWithCustomTimeout } from '../../peripheralDevice/executeFunction'

export namespace GenericDeviceActions {
	export async function reloadRundown(
		peripheralDevice: PeripheralDevice,
		rundown: Pick<Rundown, '_id' | 'studioId' | 'externalId'>
	): Promise<TriggerReloadDataResponse> {
		logger.info('reloadRundown ' + rundown._id)

		try {
			const ingestRundown: IngestRundown | null = await executePeripheralDeviceFunctionWithCustomTimeout(
				peripheralDevice._id,
				DEFAULT_NRCS_TIMEOUT_TIME + 1000,
				{ functionName: 'triggerReloadRundown', args: [rundown.externalId] }
			)

			if (ingestRundown === null) {
				logger.info('triggerReloadRundown reply with null')
				// a null-reply means that the device will asynchronously send data updates later:
				return TriggerReloadDataResponse.WORKING
			} else {
				logger.info('triggerReloadRundown reply ' + ingestRundown.externalId)
				logger.debug(ingestRundown)

				if (ingestRundown.externalId !== rundown.externalId) {
					throw new Meteor.Error(
						500,
						`Bad response from device "${peripheralDevice._id}": Expected ingestRundown "${rundown.externalId}", got "${ingestRundown.externalId}"`
					)
				}

				await runIngestOperation(rundown.studioId, IngestJobs.UpdateRundown, {
					rundownExternalId: ingestRundown.externalId,
					peripheralDeviceId: peripheralDevice._id,
					ingestRundown: ingestRundown,
					isCreateAction: true,
				})

				return TriggerReloadDataResponse.COMPLETED
			}
		} catch (err) {
			if (_.isString(err) && err.match(/rundown does not exist/i)) {
				// Don't throw an error, instead return MISSING value
				return TriggerReloadDataResponse.MISSING
			} else {
				logger.error(`Error in GenericDeviceActions.reloadRundown: ${stringifyError(err)}`)
				throw err
			}
		}
	}
}
