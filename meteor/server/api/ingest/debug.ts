import * as _ from 'underscore'
import { Methods, setMeteorMethods } from '../../methods'

import { handleUpdatedRundown } from './rundownInput'
import { check } from 'meteor/check'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { Meteor } from 'meteor/meteor'
import { loadCachedRundownData } from './ingestCache'
import { PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { logger } from '../../../lib/logging'
import { updateSourceLayerInfinitesAfterPart } from '../playout/infinites'

let methods: Methods = {}

methods['debug_rundownRunBlueprints'] = (rundownId: string, deleteFirst?: boolean) => {
	check(rundownId, String)

	// Note: This function has been (more or less) moved to regenerateRundown()

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, 'Rundown not found')

	const peripheralDevice = PeripheralDevices.findOne(rundown.peripheralDeviceId)
	if (!peripheralDevice) throw new Meteor.Error(404, 'MOS Device not found to be used for mock rundown!')

	const ingestRundown = loadCachedRundownData(rundownId, rundown.externalId)
	if (deleteFirst) rundown.remove()

	handleUpdatedRundown(peripheralDevice, ingestRundown, 'mock')

	logger.info('debug_rundownRunBlueprints: infinites')
	updateSourceLayerInfinitesAfterPart(rundown)

	logger.info('debug_rundownRunBlueprints: done')
}

setMeteorMethods(methods)
