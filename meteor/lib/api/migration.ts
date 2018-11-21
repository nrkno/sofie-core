import { MigrationStepInput } from 'tv-automation-sofie-blueprints-integration'

export enum MigrationMethods {
	'getMigrationStatus' 	= 'migration.getMigrationStatus',
	'runMigration' 			= 'migration.runMigration',
	'forceMigration' 		= 'migration.forceMigration'
}
export interface GetMigrationStatusResult {
	databaseVersion: string
	databasePreviousVersion: string | null
	systemVersion: string
	migrationNeeded: boolean
}
export interface GetMigrationStatusResultNoNeed extends GetMigrationStatusResult {
	migrationNeeded: false
}
export interface GetMigrationStatusResultMigrationNeeded extends GetMigrationStatusResult {
	migrationNeeded: true

	migration: {
		canDoAutomaticMigration: boolean
		manualInputs: Array<MigrationStepInput>
		hash: string
		baseVersion: string
		targetVersion: string
		automaticStepCount: number
		manualStepCount: number
		ignoredStepCount: number
		partialMigration: boolean
	}
}

export interface RunMigrationResult {
	migrationCompleted: boolean
	partialMigration: boolean
	warnings: Array<string>
	snapshot: string
}
