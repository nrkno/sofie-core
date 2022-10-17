import * as _ from 'underscore'
import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { Studios, Studio } from '../../lib/collections/Studios'
import { ensureCollectionPropertyManual } from './lib'
import { PeripheralDevices, PeripheralDeviceType } from '../../lib/collections/PeripheralDevices'
import { getRandomId, protectString } from '../../lib/lib'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

// 0.1.0: These are the "base" migration steps, setting up a default system
export const addSteps = addMigrationSteps('0.1.0', [
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
					sofieUrl: '',
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
		id: 'Assign devices to studio',
		canBeRunAutomatically: true,
		dependOnResultFrom: 'studio exists',
		validate: () => {
			const studios = Studios.find().fetch()
			if (studios.length > 1) {
				return false
			}

			let missing: string | boolean = false
			PeripheralDevices.find({
				parentDeviceId: { $exists: false },
			}).forEach((device) => {
				if (!device.studioId) missing = `Peripheral Device ${device._id} has no studio`
			})
			return missing
		},
		migrate: () => {
			const studios = Studios.find().fetch()
			if (studios.length === 1) {
				const studio = studios[0]

				PeripheralDevices.find({
					parentDeviceId: { $exists: false },
				}).forEach((device) => {
					if (!device.studioId) PeripheralDevices.update(device._id, { $set: { studioId: studio._id } })
				})
			} else {
				throw new Error(
					`Unable to automatically assign Peripheral Devices to a studio, since there are ${studios.length} studios. Please assign them manually`
				)
			}
		},
	},

	{
		id: 'Playout-gateway exists',
		canBeRunAutomatically: false,
		dependOnResultFrom: 'studio exists',
		validate: () => {
			const studios = Studios.find().fetch()
			let missing: string | boolean = false
			_.each(studios, (studio: Studio) => {
				const dev = PeripheralDevices.findOne({
					type: PeripheralDeviceType.PLAYOUT,
					studioId: studio._id,
				})
				if (!dev) {
					missing = `Playout Gateway is missing on ${studio._id}`
				}
			})

			return missing
		},
		// Note: No migrate() function, user must fix this him/herself
		input: [
			{
				label: 'Playout Gateway not set up for all Studios',
				description:
					"Start up the Playout Gateway, make sure it's connected to Sofie and assigned to a Studio.",
				inputType: null,
				attribute: null,
			},
		],
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

	ensureCollectionPropertyManual(
		CollectionName.Studios,
		{},
		'settings.sofieUrl',
		'text',
		'Sofie URL',
		"Enter the URL to the Sofie Core (that's what's in your browser URL,), example: https://xxsofie without trailing" +
			' /; short form server name is OK.',
		undefined
	),

	ensureCollectionPropertyManual(
		CollectionName.Studios,
		{},
		'settings.mediaPreviewsUrl',
		'text',
		'Media Preview Service',
		'Enter the URL to the Media Preview service, example: https://10.0.1.100:8000/. Note that Cross-Origin Resource' +
			' Sharing needs to be enabled for this Sofie installation the Media Preview Service, or the Media Preview ' +
			' Service needs to have the same Origin as Sofie. Read more: ' +
			'https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy',
		undefined
	),

	ensureCollectionPropertyManual(
		CollectionName.Studios,
		{},
		'settings.slackEvaluationUrls',
		'text',
		'Evaluations Slack Integration',
		'Enter the URL for the Slack WebHook (example: "https://hooks.slack.com/services/[WEBHOOKURL]") where Evaluations by Users will be sent',
		undefined
	),

	ensureCollectionPropertyManual(
		CollectionName.Studios,
		{},
		'settings.supportedMediaFormats',
		'text',
		'Media Quality Control',
		'Provide a list of accepted media formats for playback (example: "1920x1080i5000tff,1280x720p5000")',
		undefined
	),
])
