import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { ensureCollectionProperty, ensureStudioConfig } from './lib'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

// 0.1.0: These are the "default" migration steps
addMigrationSteps( '0.1.0', [
	{
		id: 'studio exists',
		canBeRunAutomatically: true,
		validate: () => {
			if (!StudioInstallations.findOne()) return 'No StudioInstallation found'
			return false
		},
		migrate: () => {
			// create default studio
			logger.info(`Migration: Add default studio`)
			StudioInstallations.insert({
				_id: 'studio0',
				name: 'Default studio',
				defaultShowStyleVariant: '',
				supportedShowStyleBase: [],
				settings: {
					mediaPreviewsUrl: '',
					sofieUrl: ''
				},
				mappings: {},
				config: []
			})
		}
	},
	ensureCollectionProperty('StudioInstallations', {}, 'name', null, 'text', 'Studio $id: Name',
		'Enter the Name of the Studio "$id"'),
	ensureCollectionProperty('StudioInstallations', {}, 'mappings', {}),
	ensureCollectionProperty('StudioInstallations', {}, 'config', []),
	{
		id: 'playoutDevice exists',
		canBeRunAutomatically: true,
		validate: () => {
			if (!PeripheralDevices.findOne({
				type: PeripheralDeviceAPI.DeviceType.PLAYOUT
			})) return 'No Playout-device found'
			return false
		},
		// Note: No migrate() function, user must fix this him/herself
		input: [{
			label: 'Sofie needs at least one playout-device',
			description: 'Start up and connect with at least one Playout-gateway',
			inputType: null,
			attribute: null
		}]
	},
	// ---------------------------------------------------------------
	// ---------------------------------------------------------------
	// To be moved into Blueprints:
	// ---------------------------------------------------------------
	// ---------------------------------------------------------------
	ensureStudioConfig('atemSSrcBackground', null, 'text', 'Studio $id config: atemSSrcBackground',
		'Enter the file path to ATEM SuperSource Background, example: "/opt/playout-gateway/static/atem-mp/split_overlay.rgba"'),
	ensureStudioConfig('atemSSrcBackground2', null, 'text', 'Studio $id config: atemSSrcBackground2',
		'Enter the file path to ATEM SuperSource Background 2, example: "/opt/playout-gateway/static/atem-mp/teknisk_feil.rgba"'),

	{
		id: 'Playout-gateway exists',
		canBeRunAutomatically: false,
		validate: () => {
			if (!PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.PLAYOUT})) return 'Playout-gateway not found'
			return false
		},
		// Note: No migrate() function, user must fix this him/herself
		input: [{
			label: 'Playout-device 0 not set up',
			description: 'Start up the Playout-gateway and make sure it\'s connected to Sofie',
			inputType: null,
			attribute: null
		}]
	},
	{
		id: 'Mos-gateway exists',
		canBeRunAutomatically: false,
		validate: () => {
			if (!PeripheralDevices.findOne({type: PeripheralDeviceAPI.DeviceType.MOSDEVICE})) return 'Mos-gateway not found'
			return false
		},
		// Note: No migrate() function, user must fix this him/herself
		input: [{
			label: 'Mos-device 0 not set up',
			description: 'Start up the Mos-gateway and make sure it\'s connected to Sofie',
			inputType: null,
			attribute: null
		}]
	},

])
