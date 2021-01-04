import { MigrationStepInput, MigrationStepInputResult } from '@sofie-automation/blueprints-integration'
import { BlueprintId } from '../collections/Blueprints'
import { ShowStyleBaseId } from '../collections/ShowStyleBases'
import { StudioId } from '../collections/Studios'
import { SnapshotId } from '../collections/Snapshots'

export interface NewMigrationAPI {
	getMigrationStatus(): Promise<GetMigrationStatusResult>
	runMigration(
		chunks: Array<MigrationChunk>,
		hash: string,
		inputResults: Array<MigrationStepInputResult>,
		isFirstOfPartialMigrations?: boolean
	): Promise<RunMigrationResult>
	forceMigration(chunks: Array<MigrationChunk>): Promise<void>
	resetDatabaseVersions(): Promise<void>
}

export enum MigrationAPIMethods {
	'getMigrationStatus' = 'migration.getMigrationStatus',
	'runMigration' = 'migration.runMigration',
	'forceMigration' = 'migration.forceMigration',
	'resetDatabaseVersions' = 'migration.resetDatabaseVersions',
}

export interface GetMigrationStatusResult {
	migrationNeeded: boolean

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
	snapshot: SnapshotId
}
export enum MigrationStepType {
	CORE = 'core',
	STUDIO = 'studio',
	SHOWSTYLE = 'showstyle',
}
export interface MigrationChunk {
	sourceType: MigrationStepType
	sourceName: string
	blueprintId?: BlueprintId // blueprint id
	sourceId?: ShowStyleBaseId | StudioId // id in blueprint databaseVersions
	_dbVersion: string // database version
	_targetVersion: string // target version
	_steps: Array<string> // ref to step that use it
}
