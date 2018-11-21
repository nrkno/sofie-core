import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { SourceLayerType, LookaheadMode } from 'tv-automation-sofie-blueprints-integration'
import { RunningOrderAPI } from '../../lib/api/runningOrder'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import {
	ChannelFormat,
	MappingCasparCG,
	TimelineObjCCGRecord, TimelineContentTypeCasparCg, TimelineObjCCGInput,
	DeviceType as PlayoutDeviceType
} from 'timeline-state-resolver-types'
import { ensureCollectionProperty, ensureStudioConfig } from './lib'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { ShowStyles } from './deprecatedDataTypes/0_18_0'
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
				if (!studio.supportedShowStyleBase) {
					StudioInstallations.update(studio._id, {$set: {
						supportedShowStyleBase: [id]
					}})
				}
				// if (!studio.defaultShowStyleVariant) {
				// 	StudioInstallations.update(studio._id, {$set: {
				// 		defaultShowStyleVariant: id
				// 	}})
				// }
			} else {
				// create default ShowStyleBase:
				logger.info(`Migration: Add default ShowStyleBase`)
				ShowStyleBases.insert({
					_id: 'show0',
					name: 'Default showstyle',
					blueprintId: '',
					outputLayers: [
						{
							_id: 'studio0-pgm0',
							_rank: 0,
							name: 'PGM',
							isPGM: true,
						},
						{
							_id: 'studio0-monitor0',
							_rank: 1,
							name: 'Skjerm',
							isPGM: false,
						}
					],
					sourceLayers: [
						{
							_id: 'studio0-lower-third0',
							_rank: 10,
							name: 'Super',
							type: SourceLayerType.LOWER_THIRD,
							unlimited: true,
							onPGMClean: false
						},
						{
							_id: 'studio0-split0',
							_rank: 15,
							name: 'Split',
							type: SourceLayerType.SPLITS,
							unlimited: false,
							onPGMClean: true,
						},
						{
							_id: 'studio0-graphics0',
							_rank: 20,
							name: 'GFX',
							type: SourceLayerType.GRAPHICS,
							unlimited: true,
							onPGMClean: false
						},
						{
							_id: 'studio0-live-speak0',
							_rank: 50,
							name: 'STK',
							type: SourceLayerType.LIVE_SPEAK,
							unlimited: true,
							onPGMClean: false
						},
						{
							_id: 'studio0-remote0',
							_rank: 60,
							name: 'RM1',
							type: SourceLayerType.REMOTE,
							unlimited: false,
							onPGMClean: true,
							isRemoteInput: true
						},
						{
							_id: 'studio0-vt0',
							_rank: 80,
							name: 'VB',
							type: SourceLayerType.VT,
							unlimited: true,
							onPGMClean: true,
						},
						{
							_id: 'studio0-mic0',
							_rank: 90,
							name: 'Mic',
							type: SourceLayerType.MIC,
							unlimited: false,
							onPGMClean: true,
						},
						{
							_id: 'studio0-camera0',
							_rank: 100,
							name: 'Kam',
							type: SourceLayerType.CAMERA,
							unlimited: false,
							onPGMClean: true,
						},
					],
					config: []
				})
			}
		}
	},
	ensureCollectionProperty('ShowStyleBases', {}, 'outputLayers', []),
	ensureCollectionProperty('ShowStyleBases', {}, 'sourceLayers', []),
	ensureCollectionProperty('ShowStyleBases', {}, 'config', []),

	{ // Create showStyleVariant
		id: 'showStyleVariant exists',
		canBeRunAutomatically: true,
		validate: () => {
			if (!ShowStyleVariants.findOne()) return 'No ShowStyleVariant found'
			return false
		},
		migrate: () => {
			let showStyleBase = ShowStyleBases.findOne('show0') || ShowStyleBases.findOne()
			if (showStyleBase) {
				// create default ShowStyleVariant:
				logger.info(`Migration: Add default ShowStyleVariant`)
				let id = Random.id()
				ShowStyleVariants.insert({
					_id: id,
					name: 'Default variant',
					showStyleBaseId: showStyleBase._id,
					config: []
				})

				let studios = StudioInstallations.find().fetch()
				if (studios.length === 1) {
					StudioInstallations.update(studios[0]._id, {$set: {
						defaultShowStyleVariant: id
					}})
				}
			}
		}
	},
	ensureCollectionProperty('ShowStyleVariants', {}, 'config', []),

	ensureCollectionProperty('StudioInstallations', {}, 'settings', {}),
	ensureCollectionProperty('StudioInstallations', {}, 'defaultShowStyleVariant', null, undefined, 'Default ShowStyleVariant',
		'Go to the studio settings and set the Default ShowStyleVariant'),

	{ // migrate from config.media_previews_url to settings.mediaPreviewsUrl
		id: 'studio.settings.mediaPreviewsUrl from config',
		canBeRunAutomatically: true,
		validate: () => {
			let validate: false | string = false
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
		validate: () => {
			let validate: false | string = false
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
	ensureCollectionProperty('StudioInstallations', {}, 'settings.mediaPreviewsUrl', null, 'text', 'Media previews URL',
		'Enter the URL to the media previews provider, example: http://10.0.1.100:8000/', undefined, 'studio.settings.mediaPreviewsUrl from config'),
	ensureCollectionProperty('StudioInstallations', {}, 'settings.sofieUrl', null, 'text', 'Sofie URL',
		'Enter the URL to the Sofie Core (that\'s what\'s in your browser URL), example: http://sofie-tv-automation.com', undefined, 'studio.settings.sofieUrl from config'),

])
