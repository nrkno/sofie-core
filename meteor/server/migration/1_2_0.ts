import { addMigrationSteps } from './databaseMigration'
import { ensureCollectionProperty } from './lib'
import { getCoreSystem, setCoreSystemStorePath } from '../../lib/collections/CoreSystem'

// 1.2.0 (Release 14)
addMigrationSteps('1.2.0', [
	{
		id: 'CoreSystem.storePath fix',
		// Fix a bug where CoreSystemPath is the string "undefined", ref (https://github.com/nrkno/tv-automation-server-core/pull/91)
		canBeRunAutomatically: true,
		validate: () => {
			let system = getCoreSystem()
			if (system && system.storePath === 'undefined') {
				return 'CoreSystem.storePath is "undefined"'
			}
			return false
		},
		migrate: () => {
			let system = getCoreSystem()
			if (system && system.storePath === 'undefined') {
				setCoreSystemStorePath(undefined)
			}
		}
	},
])
