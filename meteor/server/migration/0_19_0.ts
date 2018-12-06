import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { ensureCollectionProperty } from './lib'
import { ShowStyleBases, IBlueprintRuntimeArgumentsItem } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { ShowStyles } from './deprecatedDataTypes/0_18_0'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { Blueprints } from '../../lib/collections/Blueprints'
import * as _ from 'underscore'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { Random } from 'meteor/random'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

// 0.19.0 is a BIG refactoring
addMigrationSteps( '0.19.0', [
	{ // Create showStyleBase (migrate from studioInstallation)
		id: 'showStyleBase exists',
		canBeRunAutomatically: true,
		dependOnResultFrom: 'studio exists',
		validate: () => {
			if (!ShowStyleBases.findOne()) return 'No ShowStyleBase found'
			return false
		},
		migrate: () => {
			// maybe copy from studioInstallation?
			let studios = StudioInstallations.find().fetch()
			let showStyles = ShowStyles.find().fetch()
			if (studios.length === 1) {
				let studio = studios[0]

				let showstyle: any = showStyles.length === 1 ? showStyles[0] : {}

				let id = showstyle.id || 'show0'
				ShowStyleBases.insert({
					_id: id,
					name: showstyle.name || 'Default showstyle',
					blueprintId: '',
					// @ts-ignore
					outputLayers: studio.outputLayers,
					// @ts-ignore
					sourceLayers: studio.sourceLayers,
					// @ts-ignore
					hotkeyLegend: studio.hotkeyLegend,
					config: []
				})

				const variantId = Random.id()
				ShowStyleVariants.insert({
					_id: variantId,
					name: 'Default variant',
					showStyleBaseId: id,
					config: []
				})

				if (!studio.supportedShowStyleBase || studio.supportedShowStyleBase.length === 0) {
					StudioInstallations.update(studio._id, {$set: {
						supportedShowStyleBase: [id],
						defaultShowStyleVariant: variantId
					}})
				}
			} else {
				// create default ShowStyleBase:
				logger.info(`Migration: Add default ShowStyleBase`)
				ShowStyleBases.insert({
					_id: 'show0',
					name: 'Default showstyle',
					blueprintId: '',
					outputLayers: [],
					sourceLayers: [],
					config: []
				})

				ShowStyleVariants.insert({
					_id: Random.id(),
					name: 'Default variant',
					showStyleBaseId: 'show0',
					config: []
				})
			}
		}
	},
	ensureCollectionProperty('ShowStyleBases', {}, 'outputLayers', []),
	ensureCollectionProperty('ShowStyleBases', {}, 'sourceLayers', []),
	ensureCollectionProperty('ShowStyleBases', {}, 'config', []),
	ensureCollectionProperty('ShowStyleBases', {}, 'runtimeArguments', []),
	{
		id: 'Move runningOrderArguments from StudioInstallation into ShowStyleBase',
		canBeRunAutomatically: true,
		validate: () => {
			const si = StudioInstallations.find().fetch()
			let result: string | boolean = false
			si.forEach((siItem) => {
				if ((siItem as any).runtimeArguments && (siItem as any).runtimeArguments.length > 0) {
					result = `Running Order Arguments set in a Studio Installation "${siItem._id}"`
				}
			})
			return result
		},
		migrate: () => {
			const si = StudioInstallations.find().fetch()
			let result: string | undefined = undefined
			si.forEach((siItem) => {
				if ((siItem as any).runtimeArguments) {
					if ((siItem as any).runtimeArguments.length > 0) {
						const defaultShowStyleVariant = siItem.defaultShowStyleVariant
						if (!defaultShowStyleVariant) {
							result = `Default show style variant not set in "${siItem._id}"`
							return
						}

						const ssv = ShowStyleVariants.findOne(defaultShowStyleVariant)
						if (!ssv) {
							result = `Default Show Style Variant "${defaultShowStyleVariant}" for Studio "${siItem._id}" not found`
							return
						}

						const ssb = ShowStyleBases.findOne(ssv.showStyleBaseId)
						if (!ssb) {
							result = `Default Show Style Variant "${defaultShowStyleVariant}" Base "${ssv.showStyleBaseId}" not found`
							return
						}
						ssb.runtimeArguments = ssb.runtimeArguments || []; // HAHA: typeScript fails on this, thinking its a function call without the semicolon

						(siItem as any).runtimeArguments.forEach((item) => {
							const bItem: IBlueprintRuntimeArgumentsItem = item
							const exisitng = ssb.runtimeArguments.find((ssbItem) => {
								return ssbItem.hotkeys === item.hotkeys && ssbItem.label === item.label && ssbItem.property === item.property && ssbItem.value === item.value
							})
							if (!exisitng) {
								ssb.runtimeArguments.push(item)
							}
						})

						ShowStyleBases.update(ssb._id, {
							$set: {
								runtimeArguments: ssb.runtimeArguments
							}
						})
					}

					// No result set means no errors and the runtimeArguments can be removed from SI
					if (!result) {
						StudioInstallations.update(siItem._id, {
							$unset: {
								runtimeArguments: 1
							}
						})
					}
				}
			})
			return result
		}
	},
	// { // Create showStyleVariant
	// 	id: 'showStyleVariant exists',
	// 	canBeRunAutomatically: true,
	// 	validate: () => {
	// 		const showStyles = ShowStyleBases.find().fetch()
	// 		const missing = showStyles.find(s => {
	// 			return !ShowStyleVariants.findOne({ showStyleBaseId: s._id })
	// 		})
	// 		if (missing) return 'No ShowStyleVariant found for ' + missing._id
	// 		return false
	// 	},
	// 	migrate: () => {
	// 		const showStyles = ShowStyleBases.find().fetch()
	// 		_.each(showStyles, s => {
	// 			const variant = ShowStyleVariants.findOne({ showStyleBaseId: s._id })
	// 			if (variant) return

	// 			logger.info(`Migration: Add default ShowStyleVariant for ${s._id}`)
	// 			let id = Random.id()
	// 			ShowStyleVariants.insert({
	// 				_id: id,
	// 				name: 'Default variant',
	// 				showStyleBaseId: s._id,
	// 				config: []
	// 			})
	// 		})
	// 	}
	// },
	{
		id: 'studioInstallation has valid defaultShowStyleVariant',
		canBeRunAutomatically: true,
		dependOnResultFrom: 'showStyleBase exists',
		validate: () => {
			const studios = StudioInstallations.find().fetch()
			const missing: string | boolean = false
			_.each(studios, s => {
				if (!s.defaultShowStyleVariant) return `Studio "${s.name || s._id}" is missing default ShowStyleVariant`

				const variant = ShowStyleVariants.findOne(s.defaultShowStyleVariant)
				if (!variant) return `Studio "${s.name || s._id}" has invalid default ShowStyleVariant`
			})

			return missing
		},
		migrate () {
			const studios = StudioInstallations.find().fetch()

			_.each(studios, s => {
				if (s.supportedShowStyleBase.length === 0) return

				const variant = ShowStyleVariants.findOne({
					_id: {
						$in: s.supportedShowStyleBase
					}
				})
				if (variant) {
					StudioInstallations.update(s._id, {$set: {
						defaultShowStyleVariant: variant._id
					}})
				}
			})
		}
	},
	ensureCollectionProperty('ShowStyleVariants', {}, 'config', []),

	{ // Ensure rundowns have showStyleBaseId and showStyleVariandId set
		id: 'runningOrders have showStyleBaseId and showStyleVariantId',
		canBeRunAutomatically: true,
		validate: () => {
			const ros = RunningOrders.find({
				$or: [
					{ showStyleBaseId: { $exists: false } },
					{ showStyleVariantId: { $exists: false } }
				]
			}).fetch()
			if (ros.length > 0) return 'Running orders need to be migrated to new ShowStyleBase and ShowStyleVariant'
			return false
		},
		migrate: () => {
			const ros = RunningOrders.find({
				$or: [
					{ showStyleBaseId: { $exists: false } },
					{ showStyleVariantId: { $exists: false } }
				]
			}).fetch()

			let fail: string | undefined = undefined

			ros.forEach((item) => {
				let showStyleBase = ShowStyleBases.findOne((item as any).showStyleId) || ShowStyleBases.findOne('show0') || ShowStyleBases.findOne()
				if (showStyleBase) {
					let showStyleVariant = ShowStyleVariants.findOne({
						showStyleBaseId: showStyleBase._id
					})

					if (showStyleVariant) {
						logger.info(`Migration: Switch RunningOrder "${item._id}" from showStyle to showStyleBase and showStyleVariant`)

						RunningOrders.update(item._id, {
							$set: {
								showStyleBaseId: showStyleBase._id,
								showStyleVariantId: showStyleVariant._id
							}
						})
					} else {
						fail = `Migrating RO "${item._id}" failed, because a suitable showStyleVariant could not be found.`
					}
				} else {
					fail = `Migrating RO "${item._id}" failed, because a suitable showStyleBase could not be found.`
				}
			})
		}
	},

	ensureCollectionProperty('StudioInstallations', {}, 'settings', {}),
	ensureCollectionProperty('StudioInstallations', {}, 'defaultShowStyleVariant', null, undefined, 'Default ShowStyleVariant',
		'Go to the studio settings and set the Default ShowStyleVariant', undefined, 'studio exists'),

	{ // migrate from config.media_previews_url to settings.mediaPreviewsUrl
		id: 'studio.settings.mediaPreviewsUrl from config',
		canBeRunAutomatically: true,
		dependOnResultFrom: 'studio exists',
		validate: () => {
			let validate: boolean | string = false
			StudioInstallations.find().forEach((studio) => {
				if (!studio.settings || !studio.settings.mediaPreviewsUrl) {

					if (studio.getConfigValue('media_previews_url')) {
						validate = `mediaPreviewsUrl not set on studio ${studio._id}`
					}

				}
			})
			return validate
		},
		migrate: () => {
			StudioInstallations.find().forEach((studio) => {
				if (!studio.settings || !studio.settings.mediaPreviewsUrl) {
					let value = studio.getConfigValue('media_previews_url')
					if (value) {
						// Update the studio
						StudioInstallations.update(studio._id, {
							$set: {
								'settings.mediaPreviewsUrl': value
							},
							$pull: {
								config: {
									_id: 'media_previews_url'
								}
							}
						})

					}
				}
			})
		}
	},
	{ // migrate from config.sofie_url to settings.sofieUrl
		id: 'studio.settings.sofieUrl from config',
		canBeRunAutomatically: true,
		dependOnResultFrom: 'studio exists',
		validate: () => {
			let validate: boolean | string = false
			StudioInstallations.find().forEach((studio) => {
				if (!studio.settings || !studio.settings.sofieUrl) {

					if (studio.getConfigValue('sofie_url')) {
						validate = `sofieUrl not set on studio ${studio._id}`
					}

				}
			})
			return validate
		},
		migrate: () => {
			StudioInstallations.find().forEach((studio) => {
				if (!studio.settings || !studio.settings.sofieUrl) {
					let value = studio.getConfigValue('sofie_url')
					if (value) {
						// Update the studio
						StudioInstallations.update(studio._id, {
							$set: {
								'settings.sofieUrl': value
							},
							$pull: {
								config: {
									_id: 'sofie_url'
								}
							}
						})

					}
				}
			})
		}
	},
	ensureCollectionProperty('StudioInstallations', {}, 'supportedShowStyleBase', []),
	ensureCollectionProperty('StudioInstallations', {}, 'settings.mediaPreviewsUrl', null, 'text', 'Media previews URL',
		'Enter the URL to the media previews provider, example: http://10.0.1.100:8000/', undefined, 'studio.settings.mediaPreviewsUrl from config'),
	ensureCollectionProperty('StudioInstallations', {}, 'settings.sofieUrl', null, 'text', 'Sofie URL',
		'Enter the URL to the Sofie Core (that\'s what\'s in your browser URL), example: http://sofie-tv-automation.com', undefined, 'studio.settings.sofieUrl from config'),

	{ // Blueprint.databaseVersion
		id: 'blueprint.databaseVersion',
		canBeRunAutomatically: true,
		validate: () => {
			let validate: boolean | string = false
			Blueprints.find({}).forEach((blueprint) => {
				if (!blueprint.databaseVersion || _.isString(blueprint.databaseVersion)) validate = true
			})
			return validate
		},
		migrate: () => {
			Blueprints.find({}).forEach((blueprint) => {
				if (!blueprint.databaseVersion || _.isString(blueprint.databaseVersion)) {
					Blueprints.update(blueprint._id, {$set: {
						databaseVersion: {
							showStyle: {},
							studio: {}
						}
					}})
				}
			})
		}
	},

	{ // remove studioInstallationId from child peripheral devices
		id: 'peripheraldevice.studioInstallationId with parentDeviceId',
		canBeRunAutomatically: true,
		validate: () => {
			const devCount = PeripheralDevices.find({
				studioInstallationId: { $exists: true },
				parentDeviceId: { $exists: true }
			}).count()

			if (devCount > 0) {
				return 'Some child PeripheralDevices with studioInstallationId set'
			}
			return false
		},
		migrate: () => {
			PeripheralDevices.update({
				studioInstallationId: { $exists: true },
				parentDeviceId: { $exists: true }
			}, {
				$unset: {
					studioInstallationId: true
				}
			}, {
				multi: true
			})
		}
	},
])
