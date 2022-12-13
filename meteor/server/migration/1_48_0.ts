import { addMigrationSteps } from './databaseMigration'
import { TranslationsBundles, TranslationsBundle } from '../../lib/collections/TranslationsBundles'
import { generateTranslationBundleOriginId } from '../api/translationsBundles'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps('1.48.0', [
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
])
