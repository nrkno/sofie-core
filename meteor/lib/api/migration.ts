import { MigrationStepInput } from 'tv-automation-sofie-blueprints-integration'
import { Version } from '../collections/CoreSystem'

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
		automaticStepCount: number
		manualStepCount: number
		ignoredStepCount: number
		partialMigration: boolean
		chunks: Array<MigrationChunk>
	}
}

export interface RunMigrationResult {
	migrationCompleted: boolean
	partialMigration: boolean
	warnings: Array<string>
	snapshot: string
}
export enum MigrationStepType {
	CORE = 'core',
	STUDIO = 'studio',
	SHOWSTYLE = 'showstyle'
}
export interface MigrationChunk {
	sourceType: MigrationStepType
	sourceName: string
	_dbVersion: Version  // database version
	_targetVersion: Version  // target version
}
