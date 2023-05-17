import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { PeripheralDevices, Studios } from '../collections'
import { assertNever, clone, literal } from '@sofie-automation/corelib/dist/lib'
import {
	MappingExt,
	StudioIngestDevice,
	StudioInputDevice,
	StudioPlayoutDevice,
	StudioRouteSet,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import _ from 'underscore'
import { Studio } from '../../lib/collections/Studios'
import {
	wrapDefaultObject,
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

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
		validate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				type: PeripheralDeviceType.MOS,
				'settings.device': { $exists: true },
			})
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
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				type: PeripheralDeviceType.MOS,
				'settings.device': { $exists: true },
			})
			for (const obj of objects) {
				const newDevices: any = clone(obj.settings['devices'] || {})

				for (const [id, subdev] of Object.entries<any>(newDevices)) {
					if (!subdev) continue

					const newdev = subdev.options ? subdev : { options: subdev }
					delete newdev.options.type
					newdev.type = 'default'

					newDevices[id] = newdev
				}

				await PeripheralDevices.updateAsync(obj._id, {
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
		validate: async () => {
			const studios = await Studios.findFetchAsync({ mappingsWithOverrides: { $exists: true } })

			for (const studio of studios) {
				const newOverrides = convertMappingsOverrideOps(studio)
				if (newOverrides) {
					return `object needs to be updated`
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ mappingsWithOverrides: { $exists: true } })

			for (const studio of studios) {
				// Note: we can ignore the defaults of the mappings, as they will be replaced by an updated blueprint

				const newOverrides = convertMappingsOverrideOps(studio)

				if (newOverrides) {
					await Studios.updateAsync(studio._id, {
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
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				const newOverrides = convertRouteSetMappings(studio)
				if (newOverrides) {
					return `object needs to be updated`
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSets: { $exists: true } })

			for (const studio of studios) {
				const newRouteSets = convertRouteSetMappings(studio)

				if (newRouteSets) {
					await Studios.updateAsync(studio._id, {
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
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				category: PeripheralDeviceCategory.INGEST,
				nrcsName: { $exists: false },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				category: PeripheralDeviceCategory.INGEST,
				nrcsName: { $exists: false },
			})
			for (const device of objects) {
				let nrcsName = ''

				if (device.type === PeripheralDeviceType.MOS) {
					nrcsName = 'ENPS'
				} else if (device.type === PeripheralDeviceType.INEWS) {
					nrcsName = 'iNews'
				} else if (device.type === PeripheralDeviceType.SPREADSHEET) {
					nrcsName = 'Google Sheet'
				}

				await PeripheralDevices.updateAsync(device._id, {
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
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				documentationUrl: { $exists: false },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				documentationUrl: { $exists: false },
			})
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
				} else if (device.type === PeripheralDeviceType.LIVE_STATUS) {
					documentationUrl = 'https://nrkno.github.io/sofie-core/'
				} else {
					assertNever(device.type)
				}

				await PeripheralDevices.updateAsync(device._id, {
					$set: {
						documentationUrl: documentationUrl,
					},
				})
			}
		},
	},

	{
		id: `Studio ensure peripheralDeviceSettings field`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await Studios.countDocuments({
				peripheralDeviceSettings: { $exists: false },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await Studios.findFetchAsync({
				peripheralDeviceSettings: { $exists: false },
			})
			for (const studio of objects) {
				await Studios.updateAsync(studio._id, {
					$set: {
						peripheralDeviceSettings: {
							playoutDevices: wrapDefaultObject({}),
							ingestDevices: wrapDefaultObject({}),
							inputDevices: wrapDefaultObject({}),
						},
					},
				})
			}
		},
	},

	{
		id: `Studio move playout-gateway subdevices`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				category: PeripheralDeviceCategory.PLAYOUT,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				category: PeripheralDeviceCategory.PLAYOUT,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})
			for (const device of objects) {
				if (!device.studioId) continue

				const newOverrides: SomeObjectOverrideOp[] = []

				for (const [id, subDevice] of Object.entries<unknown>(device.settings?.['devices'] || {})) {
					newOverrides.push(
						literal<ObjectOverrideSetOp>({
							op: 'set',
							path: id,
							value: literal<StudioPlayoutDevice>({
								peripheralDeviceId: device._id,
								options: subDevice as any,
							}),
						})
					)
				}

				await Studios.updateAsync(device.studioId, {
					$set: {
						[`peripheralDeviceSettings.playoutDevices.overrides`]: newOverrides,
					},
				})

				await PeripheralDevices.updateAsync(device._id, {
					$unset: {
						'settings.devices': 1,
					},
				})
			}
		},
	},
	{
		id: `Studio move ingest subdevices`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				category: PeripheralDeviceCategory.INGEST,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				category: PeripheralDeviceCategory.INGEST,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})
			for (const device of objects) {
				if (!device.studioId) continue

				const newOverrides: SomeObjectOverrideOp[] = []

				for (const [id, subDevice] of Object.entries<unknown>(device.settings?.['devices'] || {})) {
					newOverrides.push(
						literal<ObjectOverrideSetOp>({
							op: 'set',
							path: id,
							value: literal<StudioIngestDevice>({
								peripheralDeviceId: device._id,
								options: subDevice as any,
							}),
						})
					)
				}

				await Studios.updateAsync(device.studioId, {
					$set: {
						[`peripheralDeviceSettings.ingestDevices.overrides`]: newOverrides,
					},
				})

				await PeripheralDevices.updateAsync(device._id, {
					$unset: {
						'settings.devices': 1,
					},
				})
			}
		},
	},
	{
		id: `Studio move input subdevices`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				category: PeripheralDeviceCategory.TRIGGER_INPUT,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await PeripheralDevices.findFetchAsync({
				category: PeripheralDeviceCategory.TRIGGER_INPUT,
				studioId: { $exists: true },
				'settings.devices': { $exists: true },
			})
			for (const device of objects) {
				if (!device.studioId) continue

				const newOverrides: SomeObjectOverrideOp[] = []

				for (const [id, subDevice] of Object.entries<unknown>(device.settings?.['devices'] || {})) {
					newOverrides.push(
						literal<ObjectOverrideSetOp>({
							op: 'set',
							path: id,
							value: literal<StudioInputDevice>({
								peripheralDeviceId: device._id,
								options: subDevice as any,
							}),
						})
					)
				}

				await Studios.updateAsync(device.studioId, {
					$set: {
						[`peripheralDeviceSettings.inputDevices.overrides`]: newOverrides,
					},
				})

				await PeripheralDevices.updateAsync(device._id, {
					$unset: {
						'settings.devices': 1,
					},
				})
			}
		},
	},

	{
		id: `PeripheralDevice cleanup unused properties on child devices`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				parentDeviceId: { $exists: true },
				// One of:
				configManifest: { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			await PeripheralDevices.updateAsync(
				{ parentDeviceId: { $exists: true } },
				{
					$unset: {
						configManifest: 1,
					},
				},
				{
					multi: true,
				}
			)
		},
	},
])
