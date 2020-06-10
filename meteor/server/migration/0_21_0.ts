import { addMigrationSteps } from './databaseMigration'
import * as _ from 'underscore'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Random } from 'meteor/random'
import { setExpectedVersion } from './lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

// 0.21.0 ( Release 6 )
addMigrationSteps('0.21.0', [
	{
		id: 'showStyleBase runtimeArguments _id',
		canBeRunAutomatically: true,
		validate: () => {
			const styles = ShowStyleBases.find().fetch()
			const invalid = _.find(styles, (s) => _.find(s.runtimeArguments || [], (ra) => ra._id === undefined))
			if (invalid) return 'ShowStyle RuntimeArguments need an id set'
			return false
		},
		migrate: () => {
			const styles = ShowStyleBases.find().fetch()

			_.each(styles, (ss) => {
				_.each(ss.runtimeArguments || [], (ra, i) => {
					if (ra._id === undefined) {
						ra._id = Random.id()

						let upd = {}
						upd[`runtimeArguments.${i}`] = ra

						ShowStyleBases.update(
							{
								_id: ss._id,
							},
							{ $set: upd }
						)
					}
				})
			})
		},
	},
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '0.16.0'),
	setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '0.5.1'),
])
