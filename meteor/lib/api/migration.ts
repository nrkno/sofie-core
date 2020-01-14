import { MigrationStepInput } from 'tv-automation-sofie-blueprints-integration';

export enum MigrationMethods {
	'getMigrationStatus' = 'migration.getMigrationStatus',
	'runMigration' = 'migration.runMigration',
	'forceMigration' = 'migration.forceMigration',
	'resetDatabaseVersions' = 'migration.resetDatabaseVersions'
}
export interface GetMigrationStatusResult {
	migrationNeeded: boolean;

	migration: {
		canDoAutomaticMigration: boolean;
		manualInputs: Array<MigrationStepInput>;
		hash: string;
		automaticStepCount: number;
		manualStepCount: number;
		ignoredStepCount: number;
		partialMigration: boolean;
		chunks: Array<MigrationChunk>;
	};
}
export interface RunMigrationResult {
	migrationCompleted: boolean;
	partialMigration: boolean;
	warnings: Array<string>;
	snapshot: string;
}
export enum MigrationStepType {
	CORE = 'core',
	STUDIO = 'studio',
	SHOWSTYLE = 'showstyle'
}
export interface MigrationChunk {
	sourceType: MigrationStepType;
	sourceName: string;
	blueprintId?: string; // blueprint id
	sourceId?: string; // id in blueprint databaseVersions
	_dbVersion: string; // database version
	_targetVersion: string; // target version
	_steps: Array<string>; // ref to step that use it
}
