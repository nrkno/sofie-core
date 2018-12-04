import {
	ensureStudioConfig,
	ensureDeviceVersion
} from './lib'
import { addMigrationSteps } from './databaseMigration'
import { getCoreSystem, setCoreSystemStorePath } from '../../lib/collections/CoreSystem'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

// 0.16.0: Release 3
addMigrationSteps( '0.16.0', [
	// Todo: Mos-gateway version
	// Todo: Playout-gateway version
	// Todo: Blueprints version

	ensureStudioConfig('slack_evaluation', null, 'text', 'Studio $id config: slack_evaluation',
		'Enter the URL to the Slack webhook (example: "https://hooks.slack.com/services/WEBHOOKURL"', undefined, 'studio exists'),

	{
		id: 'CoreSystem.storePath',
		canBeRunAutomatically: false,
		validate: () => {
			let system = getCoreSystem()
			if (!system) return 'CoreSystem not found!'
			if (!system.storePath) return 'CoreSystem.storePath not set!'
			if (!_.isString(system.storePath)) return 'CoreSystem.storePath must be a string!'
			if (system.storePath.slice(-1) === '/') return 'CoreSystem.storePath must not end with "/"!'
			return false
		},
		migrate: (input) => {
			setCoreSystemStorePath(input.storePath)
		},
		input: [{
			label: 'File path for persistant storage',
			description: 'Enter the file path for the persistant storage (example "/mnt/drive/sofie")',
			inputType: 'text',
			attribute: 'storePath'
		}]
	},

	ensureDeviceVersion('ensureVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOSDEVICE, '_process', '0.1.1')
])
