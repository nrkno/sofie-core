import * as _ from 'underscore'
import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { Studios, Studio } from '../../lib/collections/Studios'
import { ensureCollectionProperty } from './lib'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

// 0.1.0: These are the "default" migration steps
addMigrationSteps('0.1.0', [
	{
		id: 'studio exists',
		canBeRunAutomatically: true,
		validate: () => {
			if (!Studios.findOne()) return 'No Studio found'
			return false
		},
		migrate: () => {
			// create default studio
			logger.info(`Migration: Add default studio`)
			Studios.insert({
				_id: 'studio0',
				name: 'Default studio',
				supportedShowStyleBase: [],
				settings: {
					mediaPreviewsUrl: '',
					sofieUrl: ''
				},
				mappings: {},
				config: [],
				_rundownVersionHash: '',
			})
		}
	},
	ensureCollectionProperty('Studios', {}, 'name', null, 'text', 'Studio $id: Name',
		'Enter the Name of the Studio "$id"'),
	ensureCollectionProperty('Studios', {}, 'mappings', {}),
	ensureCollectionProperty('Studios', {}, 'config', []),

	{
		id: 'Playout-gateway exists',
		canBeRunAutomatically: false,
		dependOnResultFrom: 'studio exists',
		validate: () => {
			let studios = Studios.find().fetch()
			let missing: string | boolean = false
			_.each(studios, (studio: Studio) => {
				const dev = PeripheralDevices.findOne({
					type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
					studioId: studio._id
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
	// {	// @todo: make more flexible in the future
	// 	id: 'Mos-gateway exists',
	// 	canBeRunAutomatically: false,
	// 	dependOnResultFrom: 'studio exists',
	// 	validate: () => {
	// 		let studios = Studios.find().fetch()
	// 		let missing: string | boolean = false
	// 		_.each(studios, (studio: Studio) => {
	// 			const dev = PeripheralDevices.findOne({
	// 				type: PeripheralDeviceAPI.DeviceType.INEWS,
	// 				studioId: studio._id
	// 			})
	// 			if (!dev) {
	// 				missing = `Mos-device is missing on ${studio._id}`
	// 			}
	// 		})

	// 		return missing
	// 	},
	// 	// Note: No migrate() function, user must fix this him/herself
	// 	input: [{
	// 		label: 'Mos-device not set up for all studios',
	// 		description: 'Start up the Mos-gateway and make sure it\'s connected to Sofie',
	// 		inputType: null,
	// 		attribute: null
	// 	}]
	// }
])
