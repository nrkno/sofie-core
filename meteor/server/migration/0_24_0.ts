import { addMigrationSteps } from './databaseMigration'
import * as _ from 'underscore'
import { Blueprints } from '../../lib/collections/Blueprints'
import { BlueprintManifestType } from 'tv-automation-sofie-blueprints-integration'

// 0.24.0 (Release 9)
addMigrationSteps('0.24.0', [
	{ // Ensure blueprints have type set
		id: 'blueprints have blueprintType',
		canBeRunAutomatically: true,
		validate: () => {
			const blueprintCount = Blueprints.find({
				$and: [
					{ code: { $exists: true } },
					{ code: { $not: { $eq: '' } } },
				],
				blueprintType: { $exists: false }
			}).count()
			if (blueprintCount > 0) return 'Blueprints need to be migrated to have blueprintType'
			return false
		},
		migrate: () => {
			Blueprints.update({
				$and: [
					{ code: { $exists: true } },
					{ code: { $not: { $eq: '' } } },
				],
				blueprintType: { $exists: false }
			}, {
				$set: {
					blueprintType: BlueprintManifestType.SHOWSTYLE
				}
			}, {
				multi: true
			})
		}
	}
])
