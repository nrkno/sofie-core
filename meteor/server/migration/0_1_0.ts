import * as _ from 'underscore'
import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
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
				config: [],
				_runningOrderVersionHash: '',
			})
		}
	},
	ensureCollectionProperty('StudioInstallations', {}, 'name', null, 'text', 'Studio $id: Name',
		'Enter the Name of the Studio "$id"'),
	ensureCollectionProperty('StudioInstallations', {}, 'mappings', {}),
	ensureCollectionProperty('StudioInstallations', {}, 'config', []),

	ensureStudioConfig('atemSSrcBackground', null, 'text', 'Studio $id config: atemSSrcBackground',
		'Enter the file path to ATEM SuperSource Background, example: "/opt/playout-gateway/static/atem-mp/split_overlay.rgba"', undefined, 'studio exists'),
	ensureStudioConfig('atemSSrcBackground2', null, 'text', 'Studio $id config: atemSSrcBackground2',
		'Enter the file path to ATEM SuperSource Background 2, example: "/opt/playout-gateway/static/atem-mp/teknisk_feil.rgba"', undefined, 'studio exists'),

	{
		id: 'Playout-gateway exists',
		canBeRunAutomatically: false,
		dependOnResultFrom: 'studio exists',
		validate: () => {
			let studios = StudioInstallations.find().fetch()
			let missing: string | boolean = false
			_.each(studios, (studio: StudioInstallation) => {
				const dev = PeripheralDevices.findOne({
					type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
					studioInstallationId: studio._id
				})
				if (!dev) {
					missing = `Playout-device is missing on ${studio._id}`
				}
			})

			return missing
		},
		// Note: No migrate() function, user must fix this him/herself
		input: [{
			label: 'Playout-device not set up for all studios',
			description: 'Start up the Playout-gateway and make sure it\'s connected to Sofie',
			inputType: null,
			attribute: null
		}]
	},
	{
		id: 'Mos-gateway exists',
		canBeRunAutomatically: false,
		dependOnResultFrom: 'studio exists',
		validate: () => {
			let studios = StudioInstallations.find().fetch()
			let missing: string | boolean = false
			_.each(studios, (studio: StudioInstallation) => {
				const dev = PeripheralDevices.findOne({
					type: PeripheralDeviceAPI.DeviceType.MOSDEVICE,
					studioInstallationId: studio._id
				})
				if (!dev) {
					missing = `Mos-device is missing on ${studio._id}`
				}
			})

			return missing
		},
		// Note: No migrate() function, user must fix this him/herself
		input: [{
			label: 'Mos-device not set up for all studios',
			description: 'Start up the Mos-gateway and make sure it\'s connected to Sofie',
			inputType: null,
			attribute: null
		}]
	}

])
