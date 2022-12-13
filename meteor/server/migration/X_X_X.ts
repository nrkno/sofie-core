import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
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

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	// Add some migrations!
])
