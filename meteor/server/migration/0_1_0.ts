import * as _ from 'underscore'
import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { Studios } from '../../lib/collections/Studios'
import { getRandomId, protectString } from '../../lib/lib'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { getCoreSystem, setCoreSystemStorePath } from '../../lib/collections/CoreSystem'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

// 0.1.0: These are the "base" migration steps, setting up a default system
export const addSteps = addMigrationSteps('0.1.0', [
	{
		id: 'CoreSystem.storePath',
		canBeRunAutomatically: false,
		validate: () => {
			const system = getCoreSystem()
			if (!system) return 'CoreSystem not found!'
			if (!system.storePath) return 'CoreSystem.storePath not set!'
			if (!_.isString(system.storePath)) return 'CoreSystem.storePath must be a string!'
			if (system.storePath.slice(-1) === '/') return 'CoreSystem.storePath must not end with "/"!'
			return false
		},
		migrate: (input) => {
			if (input.storePath) {
				setCoreSystemStorePath(input.storePath)
			}
		},
		input: [
			{
				label: 'File path for persistant storage',
				description: 'Enter the file path for the persistant storage (example "/opt/coredisk")',
				inputType: 'text',
				attribute: 'storePath',
			},
		],
	},

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
				_id: protectString('studio0'),
				name: 'Default studio',
				organizationId: null,
				supportedShowStyleBase: [],
				settings: {
					frameRate: 25,
					mediaPreviewsUrl: '',
				},
				mappingsWithOverrides: wrapDefaultObject({}),
				blueprintConfigWithOverrides: wrapDefaultObject({}),
				_rundownVersionHash: '',
				routeSets: {},
				routeSetExclusivityGroups: {},
				packageContainers: {},
				thumbnailContainerIds: [],
				previewContainerIds: [],
			})
		},
	},

	{
		// Create showStyleBase (migrate from studio)
		id: 'showStyleBase exists',
		canBeRunAutomatically: true,
		dependOnResultFrom: 'studio exists',
		validate: () => {
			if (!ShowStyleBases.findOne()) return 'No ShowStyleBase found'
			return false
		},
		migrate: () => {
			// maybe copy from studio?
			const studios = Studios.find().fetch()
			if (studios.length === 1) {
				const studio = studios[0]

				const id = protectString('show0')
				ShowStyleBases.insert({
					_id: id,
					name: 'Default ShowStyle',
					organizationId: null,
					blueprintId: protectString(''),
					outputLayersWithOverrides: wrapDefaultObject({}),
					sourceLayersWithOverrides: wrapDefaultObject({}),
					hotkeyLegend: [],
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
				})

				const variantId: ShowStyleVariantId = getRandomId()
				ShowStyleVariants.insert({
					_id: variantId,
					name: 'Default Variant',
					showStyleBaseId: id,
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
				})

				if (!studio.supportedShowStyleBase || studio.supportedShowStyleBase.length === 0) {
					Studios.update(studio._id, {
						$set: {
							supportedShowStyleBase: [id],
						},
					})
				}
			} else {
				// create default ShowStyleBase:
				logger.info(`Migration: Add default ShowStyleBase`)

				const id = protectString('show0')
				ShowStyleBases.insert({
					_id: id,
					name: 'Default ShowStyle',
					organizationId: null,
					blueprintId: protectString(''),
					outputLayersWithOverrides: wrapDefaultObject({}),
					sourceLayersWithOverrides: wrapDefaultObject({}),
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
				})

				ShowStyleVariants.insert({
					_id: getRandomId(),
					name: 'Default Variant',
					showStyleBaseId: id,
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
				})
			}
		},
	},
])
