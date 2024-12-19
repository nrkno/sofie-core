import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { CoreSystem, PeripheralDevices, Studios, TriggeredActions } from '../collections'
import {
	convertObjectIntoOverrides,
	ObjectOverrideSetOp,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
	StudioPackageContainer,
	IStudioSettings,
	StudioDeviceSettings,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DEFAULT_CORE_TRIGGER_IDS } from './upgrades/defaultSystemActionTriggers'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { ICoreSystemSettings } from '@sofie-automation/shared-lib/dist/core/model/CoreSystemSettings'
import { logger } from '../logging'
import { literal, unprotectString } from '../lib/tempLib'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	// Add your migration here

	{
		id: `convert routesets to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				routeSets: { $exists: true },
				routeSetsWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				//@ts-expect-error routeSets is not typed as ObjectWithOverrides
				if (studio.routeSets) {
					return 'routesets must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				routeSets: { $exists: true },
				routeSetsWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				//@ts-expect-error routeSets is typed as Record<string, StudioRouteSet>
				const oldRouteSets = studio.routeSets

				const newRouteSets = convertObjectIntoOverrides<StudioRouteSet>(oldRouteSets || {})

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetsWithOverrides: newRouteSets,
					},
					$unset: {
						routeSets: 1,
					},
				})
			}
		},
	},
	{
		id: `add abPlayers object`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetsWithOverrides: { $exists: true } })

			for (const studio of studios) {
				const routeSetsDefaults = studio.routeSetsWithOverrides.defaults as any as Record<
					string,
					StudioRouteSet
				>
				for (const key of Object.keys(routeSetsDefaults)) {
					if (!routeSetsDefaults[key].abPlayers) {
						return 'AB players must be added to routeSetsWithOverrides'
					}
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetsWithOverrides: { $exists: true } })

			for (const studio of studios) {
				const newRouteSetswithOverrides = studio.routeSetsWithOverrides
				for (const key of Object.keys(newRouteSetswithOverrides.defaults)) {
					if (!newRouteSetswithOverrides.defaults[key].abPlayers) {
						newRouteSetswithOverrides.defaults[key].abPlayers = []
					}
				}

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetsWithOverrides: newRouteSetswithOverrides,
					},
				})
			}
		},
	},
	{
		id: `convert routeSetExclusivityGroups to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				routeSetExclusivityGroups: { $exists: true },
				routeSetExclusivityGroupsWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				//@ts-expect-error routeSetExclusivityGroups is not typed as ObjectWithOverrides
				if (studio.routeSetExclusivityGroups) {
					return 'routesets must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				routeSetExclusivityGroups: { $exists: true },
				routeSetExclusivityGroupsWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				//@ts-expect-error routeSets is typed as Record<string, StudioRouteSetExclusivityGroup>
				const oldRouteSetExclusivityGroups = studio.routeSetExclusivityGroups

				const newRouteSetExclusivityGroups = convertObjectIntoOverrides<StudioRouteSetExclusivityGroup>(
					oldRouteSetExclusivityGroups || {}
				)

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetExclusivityGroupsWithOverrides: newRouteSetExclusivityGroups,
					},
					$unset: {
						routeSetExclusivityGroups: 1,
					},
				})
			}
		},
	},
	{
		id: `convert packageContainers to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				packageContainers: { $exists: true },
				packageContainersWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				// @ts-expect-error packageContainers is typed as Record<string, StudioPackageContainer>
				if (studio.packageContainers) {
					return 'packageContainers must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				packageContainers: { $exists: true },
				packageContainersWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				// @ts-expect-error packageContainers is typed as Record<string, StudioPackageContainer>
				const oldPackageContainers = studio.packageContainers

				const newPackageContainers = convertObjectIntoOverrides<StudioPackageContainer>(
					oldPackageContainers || {}
				)

				await Studios.updateAsync(studio._id, {
					$set: {
						packageContainersWithOverrides: newPackageContainers,
					},
					$unset: {
						packageContainers: 1,
					},
				})
			}
		},
	},

	{
		id: 'TriggeredActions.remove old systemwide',
		canBeRunAutomatically: true,
		validate: async () => {
			const coreTriggeredActionsCount = await TriggeredActions.countDocuments({
				showStyleBaseId: null,
				blueprintUniqueId: null,
				_id: { $in: DEFAULT_CORE_TRIGGER_IDS },
			})

			if (coreTriggeredActionsCount > 0) {
				return `System-wide triggered actions needing removal.`
			}

			return false
		},
		migrate: async () => {
			await TriggeredActions.removeAsync({
				showStyleBaseId: null,
				blueprintUniqueId: null,
				_id: { $in: DEFAULT_CORE_TRIGGER_IDS },
			})
		},
	},

	{
		id: `convert studio.settings to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				settings: { $exists: true },
				settingsWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				//@ts-expect-error settings is not typed as ObjectWithOverrides
				if (studio.settings) {
					return 'settings must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				settings: { $exists: true },
				settingsWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				//@ts-expect-error settings is typed as Record<string, StudioRouteSet>
				const oldSettings = studio.settings

				const newSettings = wrapDefaultObject<IStudioSettings>(oldSettings || {})

				await Studios.updateAsync(studio._id, {
					$set: {
						settingsWithOverrides: newSettings,
					},
					$unset: {
						// settings: 1,
					},
				})
			}
		},
	},

	{
		id: `convert CoreSystem.settingsWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const systems = await CoreSystem.findFetchAsync({
				settingsWithOverrides: { $exists: false },
			})

			if (systems.length > 0) {
				return 'settings must be converted to an ObjectWithOverrides'
			}

			return false
		},
		migrate: async () => {
			const systems = await CoreSystem.findFetchAsync({
				settingsWithOverrides: { $exists: false },
			})

			for (const system of systems) {
				const oldSystem = system as ICoreSystem as PartialOldICoreSystem

				const newSettings = wrapDefaultObject<ICoreSystemSettings>({
					cron: {
						casparCGRestart: {
							enabled: false,
						},
						storeRundownSnapshots: {
							enabled: false,
						},
						...oldSystem.cron,
					},
					support: oldSystem.support ?? { message: '' },
					evaluationsMessage: oldSystem.evaluations ?? { enabled: false, heading: '', message: '' },
				})

				await CoreSystem.updateAsync(system._id, {
					$set: {
						settingsWithOverrides: newSettings,
					},
					$unset: {
						cron: 1,
						support: 1,
						evaluations: 1,
					},
				})
			}
		},
	},

	{
		id: 'Ensure CoreSystem.settingsWithOverrides is valid',
		dependOnResultFrom: `convert CoreSystem.settingsWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const systems = await CoreSystem.findFetchAsync({
				$or: [
					{
						'settingsWithOverrides.defaults': { $exists: false },
					},
					{
						'settingsWithOverrides.overrides': { $exists: false },
					},
				],
			})

			if (systems.length > 0) {
				return 'settings must be converted to an ObjectWithOverrides'
			}

			return false
		},
		migrate: async () => {
			const systems = await CoreSystem.findFetchAsync({
				$or: [
					{
						'settingsWithOverrides.defaults': { $exists: false },
					},
					{
						'settingsWithOverrides.overrides': { $exists: false },
					},
				],
			})

			for (const system of systems) {
				const newSettings = wrapDefaultObject<ICoreSystemSettings>({
					cron: {
						casparCGRestart: {
							enabled: false,
						},
						storeRundownSnapshots: {
							enabled: false,
						},
					},
					support: { message: '' },
					evaluationsMessage: { enabled: false, heading: '', message: '' },
				})

				await CoreSystem.updateAsync(system._id, {
					$set: {
						settingsWithOverrides: {
							...newSettings,
							...system.settingsWithOverrides,
						},
					},
				})
			}
		},
	},

	{
		id: `studios create peripheralDeviceSettings.deviceSettings`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				'peripheralDeviceSettings.deviceSettings.defaults': { $exists: false },
			})
			if (studios.length > 0) {
				return 'studio is missing peripheralDeviceSettings.deviceSettings'
			}
			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				'peripheralDeviceSettings.deviceSettings.defaults': { $exists: false },
			})
			for (const studio of studios) {
				await Studios.updateAsync(studio._id, {
					$set: {
						'peripheralDeviceSettings.deviceSettings': {
							// Ensure the object is setup, preserving anything already configured
							...wrapDefaultObject({}),
							...studio.peripheralDeviceSettings.deviceSettings,
						},
					},
				})
			}
		},
	},
	{
		id: `PeripheralDevice populate secretSettingsStatus`,
		canBeRunAutomatically: true,
		dependOnResultFrom: `studios create peripheralDeviceSettings.deviceSettings`,
		validate: async () => {
			const devices = await PeripheralDevices.findFetchAsync({
				secretSettings: { $exists: true },
				settings: { $exists: true },
				secretSettingsStatus: { $exists: false },
			})
			if (devices.length > 0) {
				return 'settings must be moved to the studio'
			}
			return false
		},
		migrate: async () => {
			const devices = await PeripheralDevices.findFetchAsync({
				secretSettings: { $exists: true },
				settings: { $exists: true },
				secretSettingsStatus: { $exists: false },
			})
			for (const device of devices) {
				// @ts-expect-error settings is typed as Record<string, any>
				const oldSettings = device.settings as Record<string, any> | undefined
				await PeripheralDevices.updateAsync(device._id, {
					$set: {
						secretSettingsStatus: {
							credentials: oldSettings?.secretCredentials,
							accessToken: oldSettings?.secretAccessToken,
						},
					},
					$unset: {
						'settings.secretCredentials': 1,
						'settings.secretAccessToken': 1,
					},
				})
			}
		},
	},
	{
		id: `move PeripheralDevice settings to studio`,
		canBeRunAutomatically: true,
		dependOnResultFrom: `PeripheralDevice populate secretSettingsStatus`,
		validate: async () => {
			const devices = await PeripheralDevices.findFetchAsync({
				studioId: { $exists: true },
				settings: { $exists: true },
			})
			if (devices.length > 0) {
				return 'settings must be moved to the studio'
			}
			return false
		},
		migrate: async () => {
			const devices = await PeripheralDevices.findFetchAsync({
				studioId: { $exists: true },
				settings: { $exists: true },
			})
			for (const device of devices) {
				// @ts-expect-error settings is typed as Record<string, any>
				const oldSettings = device.settings
				// @ts-expect-error studioId is typed as StudioId
				const oldStudioId: StudioId = device.studioId
				// Will never happen, but make types match query
				if (!oldSettings || !oldStudioId) {
					logger.warn(`Skipping migration of device ${device._id} as it is missing settings or studioId`)
					continue
				}
				// If the studio is not found, then something is a little broken so skip
				const existingStudio = await Studios.findOneAsync(oldStudioId)
				if (!existingStudio) {
					logger.warn(`Skipping migration of device ${device._id} as the studio ${oldStudioId} is missing`)
					continue
				}
				// Use the device id as the settings id
				const newConfigId = unprotectString(device._id)
				// Compile the new list of overrides
				const newOverrides = [
					...existingStudio.peripheralDeviceSettings.deviceSettings.overrides,
					literal<ObjectOverrideSetOp>({
						op: 'set',
						path: newConfigId,
						value: literal<StudioDeviceSettings>({
							name: device.name,
							options: oldSettings,
						}),
					}),
				]
				await Studios.updateAsync(existingStudio._id, {
					$set: {
						'peripheralDeviceSettings.deviceSettings.overrides': newOverrides,
					},
				})
				await PeripheralDevices.updateAsync(device._id, {
					$set: {
						studioAndConfigId: {
							studioId: oldStudioId,
							configId: newConfigId,
						},
					},
					$unset: {
						settings: 1,
						studioId: 1,
					},
				})
			}
		},
	},
	{
		id: `studios settings create default enableBuckets=true`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				'settingsWithOverrides.defaults.enableBuckets': { $exists: false },
			})
			if (studios.length > 0) {
				return 'studio is missing enableBuckets setting'
			}
			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				'settingsWithOverrides.defaults.enableBuckets': { $exists: false },
			})
			for (const studio of studios) {
				await Studios.updateAsync(studio._id, {
					$set: {
						'settingsWithOverrides.defaults.enableBuckets': true,
					},
				})
			}
		},
	},
	{
		id: `studios settings create default enableEvaluationForm=true`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				'settingsWithOverrides.defaults.enableEvaluationForm': { $exists: false },
			})
			if (studios.length > 0) {
				return 'studio is missing enableEvaluationForm setting'
			}
			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				'settingsWithOverrides.defaults.enableEvaluationForm': { $exists: false },
			})
			for (const studio of studios) {
				await Studios.updateAsync(studio._id, {
					$set: {
						'settingsWithOverrides.defaults.enableEvaluationForm': true,
					},
				})
			}
		},
	},
])

interface PartialOldICoreSystem {
	/** Support info */
	support?: {
		message: string
	}

	evaluations?: {
		enabled: boolean
		heading: string
		message: string
	}

	/** Cron jobs running nightly */
	cron?: {
		casparCGRestart?: {
			enabled: boolean
		}
		storeRundownSnapshots?: {
			enabled: boolean
			rundownNames?: string[]
		}
	}
}
