import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { PeripheralDevices, Studios } from '../collections'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
import { MappingExt, StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import _ from 'underscore'
import { Studio } from '../../lib/collections/Studios'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

const mappingBaseOptions: Array<keyof MappingExt> = [
	'_id' as any,
	'device',
	'deviceId',
	'layerName',
	'lookahead',
	'lookaheadDepth',
	'lookaheadMaxSearchDistance',
]

function convertMappingsOverrideOps(studio: Studio) {
	let changed = false

	const newOverrides = clone(studio.mappingsWithOverrides.overrides)

	// Note: we can ignore the defaults of the mappings, as they will be replaced by an updated blueprint

	for (const overrideOp of newOverrides) {
		const parsedOp = overrideOp.path.match(/^([^\.]+).(.+)$/i)
		// eg `casparcg_cg_effects.lookahead`, `casparcg_cg_effects.channel`, `casparcg_cg_effects.options.channel`

		if (!parsedOp && overrideOp.op === 'set' && !overrideOp.value.options) {
			// Op looks to be defining a local mapping, update how it works
			overrideOp.value = {
				..._.pick(overrideOp.value, ...mappingBaseOptions),
				options: _.omit(overrideOp.value, ...mappingBaseOptions),
			}
			changed = true
		} else if (
			parsedOp &&
			!parsedOp[2].startsWith('options.') &&
			!mappingBaseOptions.includes(parsedOp[2] as keyof MappingExt)
		) {
			// Path looks to not be a common property, so adjust
			overrideOp.path = `${parsedOp[1]}.options.${parsedOp[2]}`
			changed = true
		}
	}

	return changed && newOverrides
}

function convertRouteSetMappings(studio: Studio) {
	let changed = false

	const newRouteSets = clone(studio.routeSets || {})
	for (const routeSet of Object.values<StudioRouteSet>(newRouteSets)) {
		for (const route of routeSet.routes) {
			if (route.remapping && !route.remapping.options) {
				// Update the remapping for a route
				route.remapping = {
					..._.pick(route.remapping, ...mappingBaseOptions),
					options: _.omit(route.remapping, ...mappingBaseOptions),
				}
				console.log('new route', route)
				changed = true
			}
		}
	}

	return changed && newRouteSets
}

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	{
		id: `Mos gateway fix up config`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = PeripheralDevices.find({
				type: PeripheralDeviceType.MOS,
				'settings.device': { $exists: true },
			}).fetch()
			const badObject = objects.find(
				(device) =>
					!!Object.values<unknown>(device.settings?.['devices'] ?? {}).find(
						(subdev: any) => !subdev?.type || !subdev?.options
					)
			)

			if (badObject) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: () => {
			const objects = PeripheralDevices.find({
				type: PeripheralDeviceType.MOS,
				'settings.device': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				const newDevices: any = clone(obj.settings['devices'] || {})

				for (const [id, subdev] of Object.entries<any>(newDevices)) {
					if (!subdev) continue

					const newdev = subdev.options ? subdev : { options: subdev }
					delete newdev.options.type
					newdev.type = 'default'

					newDevices[id] = newdev
				}

				PeripheralDevices.update(obj._id, {
					$set: {
						'settings.devices': newDevices,
					},
				})
			}
		},
	},

	{
		id: `Fix up studio mappings`,
		canBeRunAutomatically: true,
		validate: () => {
			const studios = Studios.find({ mappingsWithOverrides: { $exists: true } }).fetch()

			for (const studio of studios) {
				const newOverrides = convertMappingsOverrideOps(studio)
				if (newOverrides) {
					return `object needs to be updated`
				}
			}

			return false
		},
		migrate: () => {
			const studios = Studios.find({ mappingsWithOverrides: { $exists: true } }).fetch()

			for (const studio of studios) {
				// Note: we can ignore the defaults of the mappings, as they will be replaced by an updated blueprint

				const newOverrides = convertMappingsOverrideOps(studio)

				if (newOverrides) {
					Studios.update(studio._id, {
						$set: {
							'mappingsWithOverrides.overrides': newOverrides,
						},
					})
				}
			}
		},
	},

	{
		id: `Fix up studio routesets`,
		canBeRunAutomatically: true,
		validate: () => {
			const studios = Studios.find({ routeSets: { $exists: true } }).fetch()

			for (const studio of studios) {
				const newOverrides = convertRouteSetMappings(studio)
				if (newOverrides) {
					return `object needs to be updated`
				}
			}

			return false
		},
		migrate: () => {
			const studios = Studios.find({ routeSets: { $exists: true } }).fetch()

			for (const studio of studios) {
				const newRouteSets = convertRouteSetMappings(studio)

				if (newRouteSets) {
					Studios.update(studio._id, {
						$set: {
							routeSets: newRouteSets,
						},
					})
				}
			}
		},
	},

	{
		id: `Ingest gateway populate nrcsName`,
		canBeRunAutomatically: true,
		validate: () => {
			const objectCount = PeripheralDevices.find({
				category: PeripheralDeviceCategory.INGEST,
				nrcsName: { $exists: false },
			}).count()

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: () => {
			const objects = PeripheralDevices.find({
				category: PeripheralDeviceCategory.INGEST,
				nrcsName: { $exists: false },
			}).fetch()
			for (const device of objects) {
				let nrcsName = ''

				if (device.type === PeripheralDeviceType.MOS) {
					nrcsName = 'ENPS'
				} else if (device.type === PeripheralDeviceType.INEWS) {
					nrcsName = 'iNews'
				} else if (device.type === PeripheralDeviceType.SPREADSHEET) {
					nrcsName = 'Google Sheet'
				}

				PeripheralDevices.update(device._id, {
					$set: {
						nrcsName: nrcsName,
					},
				})
			}
		},
	},
	{
		id: `PeripheralDevice populate documentationUrl`,
		canBeRunAutomatically: true,
		validate: () => {
			const objectCount = PeripheralDevices.find({
				documentationUrl: { $exists: false },
			}).count()

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: () => {
			const objects = PeripheralDevices.find({
				documentationUrl: { $exists: false },
			}).fetch()
			for (const device of objects) {
				let documentationUrl = ''

				if (device.type === PeripheralDeviceType.MOS) {
					documentationUrl = 'https://github.com/nrkno/sofie-core'
				} else if (device.type === PeripheralDeviceType.SPREADSHEET) {
					documentationUrl = 'https://github.com/SuperFlyTV/spreadsheet-gateway'
				} else if (device.type === PeripheralDeviceType.PLAYOUT) {
					documentationUrl = 'https://github.com/nrkno/sofie-core'
				} else if (device.type === PeripheralDeviceType.MEDIA_MANAGER) {
					documentationUrl = 'https://github.com/nrkno/sofie-media-management'
				} else if (device.type === PeripheralDeviceType.INEWS) {
					documentationUrl = 'https://github.com/olzzon/tv2-inews-ftp-gateway'
				} else if (device.type === PeripheralDeviceType.PACKAGE_MANAGER) {
					documentationUrl = 'https://github.com/nrkno/sofie-package-manager'
				} else if (device.type === PeripheralDeviceType.INPUT) {
					documentationUrl = 'https://github.com/nrkno/sofie-input-gateway'
				} else {
					assertNever(device.type)
				}

				PeripheralDevices.update(device._id, {
					$set: {
						documentationUrl: documentationUrl,
					},
				})
			}
		},
	},

	{
		id: `Studio move package-manager config fields`,
		canBeRunAutomatically: true,
		validate: () => {
			const objectCount = Studios.find({
				peripheralDeviceSettings: { $exists: false },
			}).count()

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: () => {
			const objects = Studios.find({
				peripheralDeviceSettings: { $exists: false },
			}).fetch()
			for (const studio of objects) {
				const studioOld = studio as any
				Studios.update(studio._id, {
					$set: {
						peripheralDeviceSettings: {
							packageContainers: studioOld.packageContainers,
							previewContainerIds: studioOld.previewContainerIds,
							thumbnailContainerIds: studioOld.thumbnailContainerIds,
							playoutDevices: wrapDefaultObject({}),
							ingestSubDevices: wrapDefaultObject({}),
						},
					},
					$unset: {
						packageContainers: 1,
						previewContainerIds: 1,
						thumbnailContainerIds: 1,
					},
				})
			}
		},
	},
])
