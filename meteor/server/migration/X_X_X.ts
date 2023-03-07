import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { Blueprints, PeripheralDevices, ShowStyleVariants, Studios } from '../collections'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { MappingExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { PeripheralDeviceType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import _ from 'underscore'
import { Studio } from '../../lib/collections/Studios'

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
	for (const routeSet of Object.values(newRouteSets)) {
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
		id: 'Add missing ranks to ShowStyleVariants',
		canBeRunAutomatically: true,
		validate: () => {
			return (
				ShowStyleVariants.find({
					_rank: { $exists: false },
				}).count() > 0
			)
		},
		migrate: () => {
			// This version introduces ShowStyleVariant sorting, this means we need to create them now
			ShowStyleVariants.find({
				_rank: { $exists: false },
			}).forEach((variant: ShowStyleVariant, index: number) => {
				ShowStyleVariants.upsert(variant._id, {
					$set: {
						_rank: index,
					},
				})
			})
		},
	},

	{
		id: `Blueprints ensure blueprintHash is set`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = Blueprints.find({ blueprintHash: { $exists: false } }).count()
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = Blueprints.find({ blueprintHash: { $exists: false } }).fetch()
			for (const obj of objects) {
				Blueprints.update(obj._id, {
					$set: {
						blueprintHash: getRandomId(),
					},
				})
			}
		},
	},

	{
		id: `Mos gateway fix up config`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = PeripheralDevices.find({ type: PeripheralDeviceType.MOS }).fetch()
			const badObject = objects.find(
				(device) =>
					!!Object.values(device.settings?.['devices'] ?? {}).find(
						(subdev: any) => !subdev?.type || !subdev?.options
					)
			)

			if (badObject) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: () => {
			const objects = PeripheralDevices.find({ type: PeripheralDeviceType.MOS }).fetch()
			for (const obj of objects) {
				const newDevices: any = clone(obj.settings['devices'] || {})

				for (const [id, subdev0] of Object.entries(newDevices)) {
					if (!subdev0) continue
					const subdev = subdev0 as any

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
])
