import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Blueprints } from '../../lib/collections/Blueprints'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { PeripheralDevices, PeripheralDeviceType } from '../../lib/collections/PeripheralDevices'

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
					if (!subdev0) return
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
])
