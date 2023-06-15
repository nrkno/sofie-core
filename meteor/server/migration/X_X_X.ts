import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { PeripheralDevices, RundownPlaylists, Studios } from '../collections'
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
import { JSONBlobStringify, JSONSchema, TSR } from '@sofie-automation/blueprints-integration'

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

enum OldDeviceType {
	ABSTRACT = 0,
	CASPARCG = 1,
	ATEM = 2,
	LAWO = 3,
	HTTPSEND = 4,
	PANASONIC_PTZ = 5,
	TCPSEND = 6,
	HYPERDECK = 7,
	PHAROS = 8,
	OSC = 9,
	HTTPWATCHER = 10,
	SISYFOS = 11,
	QUANTEL = 12,
	VIZMSE = 13,
	SINGULAR_LIVE = 14,
	SHOTOKU = 15,
	VMIX = 20,
	OBS = 21,
	SOFIE_CHEF = 22,
	TELEMETRICS = 23,
	TRICASTER = 24,
	MULTI_OSC = 25,
}

const oldDeviceTypeToNewMapping = {
	[OldDeviceType.ABSTRACT]: TSR.DeviceType.ABSTRACT,
	[OldDeviceType.CASPARCG]: TSR.DeviceType.CASPARCG,
	[OldDeviceType.ATEM]: TSR.DeviceType.ATEM,
	[OldDeviceType.LAWO]: TSR.DeviceType.LAWO,
	[OldDeviceType.HTTPSEND]: TSR.DeviceType.HTTPSEND,
	[OldDeviceType.PANASONIC_PTZ]: TSR.DeviceType.PANASONIC_PTZ,
	[OldDeviceType.TCPSEND]: TSR.DeviceType.TCPSEND,
	[OldDeviceType.HYPERDECK]: TSR.DeviceType.HYPERDECK,
	[OldDeviceType.PHAROS]: TSR.DeviceType.PHAROS,
	[OldDeviceType.OSC]: TSR.DeviceType.OSC,
	[OldDeviceType.HTTPWATCHER]: TSR.DeviceType.HTTPWATCHER,
	[OldDeviceType.SISYFOS]: TSR.DeviceType.SISYFOS,
	[OldDeviceType.QUANTEL]: TSR.DeviceType.QUANTEL,
	[OldDeviceType.VIZMSE]: TSR.DeviceType.VIZMSE,
	[OldDeviceType.SINGULAR_LIVE]: TSR.DeviceType.SINGULAR_LIVE,
	[OldDeviceType.SHOTOKU]: TSR.DeviceType.SHOTOKU,
	[OldDeviceType.VMIX]: TSR.DeviceType.VMIX,
	[OldDeviceType.OBS]: TSR.DeviceType.OBS,
	[OldDeviceType.SOFIE_CHEF]: TSR.DeviceType.SOFIE_CHEF,
	[OldDeviceType.TELEMETRICS]: TSR.DeviceType.TELEMETRICS,
	[OldDeviceType.TRICASTER]: TSR.DeviceType.TRICASTER,
	[OldDeviceType.MULTI_OSC]: TSR.DeviceType.MULTI_OSC,
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

	{
		id: `RundownPlaylist move nextPartManual to nextPartInfo.manuallySelected`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await RundownPlaylists.countDocuments({
				nextPartManual: { $exists: true },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const playlists = await RundownPlaylists.findFetchAsync({
				nextPartManual: { $exists: true },
			})

			for (const playlist of playlists) {
				const nextPartManual = !!(playlist as any).nextPartManual
				await RundownPlaylists.mutableCollection.updateAsync(playlist._id, {
					$set: playlist.nextPartInfo
						? {
								'nextPartInfo.manuallySelected': nextPartManual,
						  }
						: undefined,
					$unset: {
						nextPartManual: 1,
					},
				})
			}
		},
	},

	{
		id: `PeripheralDevice ensure deviceConfigSchema and subdeviceManifest exists`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await PeripheralDevices.countDocuments({
				parentDeviceId: { $exists: false },
				$or: [
					{
						'configManifest.deviceConfigSchema': {
							$exists: false,
						},
					},
					{
						'configManifest.subdeviceManifest': {
							$exists: false,
						},
					},
				],
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			await PeripheralDevices.updateAsync(
				{
					parentDeviceId: { $exists: false },
					$or: [
						{
							'configManifest.deviceConfigSchema': {
								$exists: false,
							},
						},
						{
							'configManifest.subdeviceManifest': {
								$exists: false,
							},
						},
					],
				},
				{
					$set: {
						configManifest: {
							deviceConfigSchema: JSONBlobStringify<JSONSchema>({}),
							subdeviceManifest: {},
						},
					},
				},
				{
					multi: true,
				}
			)
		},
	},

	{
		id: `Studio playoutDevices ensure new DeviceType values`,
		canBeRunAutomatically: true,
		dependOnResultFrom: 'Studio move playout-gateway subdevices',
		validate: async () => {
			const studios = await Studios.findFetchAsync({})
			const objectCount = studios.filter(
				(studio) =>
					studio.peripheralDeviceSettings.playoutDevices.overrides.filter(
						(override) =>
							override.op === 'set' &&
							(typeof (override.value as StudioPlayoutDevice).options.type as any) === 'number'
					).length
			).length

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({})
			for (const studio of studios) {
				const newOverrides: SomeObjectOverrideOp[] = []
				for (const override of studio.peripheralDeviceSettings.playoutDevices.overrides) {
					if (
						override.op === 'set' &&
						typeof (override.value as StudioPlayoutDevice).options.type === 'number'
					) {
						const value = override.value as StudioPlayoutDevice
						newOverrides.push(
							literal<ObjectOverrideSetOp>({
								op: 'set',
								path: override.path,
								value: literal<StudioIngestDevice>({
									...value,
									options: {
										...value.options,
										type: oldDeviceTypeToNewMapping[value.options.type] ?? TSR.DeviceType.ABSTRACT,
									},
								}),
							})
						)
					} else {
						newOverrides.push(override)
					}
				}

				await Studios.updateAsync(studio._id, {
					$set: {
						[`peripheralDeviceSettings.playoutDevices.overrides`]: newOverrides,
					},
				})
			}
		},
	},

	{
		id: `Studio mappings ensure new DeviceType values`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({})
			const objectCount = studios.filter(
				(studio) =>
					studio.mappingsWithOverrides.overrides.filter(
						(override) => override.op === 'set' && typeof override.value.device === 'number'
					).length > 0
			).length

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({})
			for (const studio of studios) {
				const newOverrides: SomeObjectOverrideOp[] = []
				for (const override of studio.mappingsWithOverrides.overrides) {
					if (override.op === 'set' && typeof (override.value as TSR.Mapping<any, any>).device === 'number') {
						const value = override.value as TSR.Mapping<any, any>
						newOverrides.push(
							literal<ObjectOverrideSetOp>({
								op: 'set',
								path: override.path,
								value: literal<TSR.Mapping<any, any>>({
									...value,
									device: oldDeviceTypeToNewMapping[value.device] ?? TSR.DeviceType.ABSTRACT,
								}),
							})
						)
					} else {
						newOverrides.push(override)
					}
				}

				await Studios.updateAsync(studio._id, {
					$set: {
						[`mappingsWithOverrides.overrides`]: newOverrides,
					},
				})
			}
		},
	},
])
