import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { TranslationsBundles, TranslationsBundle } from '../../lib/collections/TranslationsBundles'
import { generateTranslationBundleOriginId } from '../api/translationsBundles'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { Blueprints } from '../../lib/collections/Blueprints'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'

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
		id: `TranslationBundles originId`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = TranslationsBundles.find({
				blueprintOriginId: { $exists: true },
			}).count()
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = TranslationsBundles.find({
				blueprintOriginId: { $exists: true },
			}).fetch()
			for (const obj0 of objects) {
				const obj = obj0 as TranslationsBundle & { blueprintOriginId: BlueprintId }
				const id = generateTranslationBundleOriginId(obj.blueprintOriginId, 'blueprints')
				TranslationsBundles.update(obj._id, {
					$set: {
						originId: id,
						namespace: unprotectString(id),
					},
					$unset: {
						blueprintOriginId: 1,
					},
				})
			}
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
])
