import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Blueprints } from '../../lib/collections/Blueprints'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { PeripheralDevices, PeripheralDeviceType } from '../../lib/collections/PeripheralDevices'
import { MappingExt, Studio, Studios } from '../../lib/collections/Studios'
import _ from 'underscore'

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
			console.log('convert op', overrideOp)
			changed = true
		} else if (
			parsedOp &&
			!parsedOp[2].startsWith('options.') &&
			!mappingBaseOptions.includes(parsedOp[2] as keyof MappingExt)
		) {
			// Path looks to not be a common property, so adjust
			overrideOp.path = `${parsedOp[1]}.options.${parsedOp[2]}`
			changed = true
			console.log('convert op2', overrideOp)
		}
	}

	return changed && newOverrides
}

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	// Add some migrations!

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

				// // Update the defaults. This is not necessary, but will help
				// for (const [id, mapping] of Object.entries(newMappings.defaults)) {
				// 	if (!mapping || mapping.options) continue

				// 	const baseOptions: Array<keyof MappingExt> = [
				// 		'device',
				// 		'deviceId',
				// 		'layerName',
				// 		'lookahead',
				// 		'lookaheadDepth',
				// 		'lookaheadMaxSearchDistance',
				// 	]

				// 	newMappings.defaults[id] = {
				// 		..._.pick(mapping, ...baseOptions),
				// 		options: _.omit(mapping, ...baseOptions),
				// 	}
				// }
			}
		},
	},
])
