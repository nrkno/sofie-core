
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

export interface MigrationStepInput {
	stepId?: string // automatically filled in later
	label: string
	description?: string
	inputType: 'text' | 'multiline' | 'int' | 'checkbox' | 'dropdown' | 'switch' | null // EditAttribute types, null = dont display edit field
	attribute: string | null
	defaultValue?: any
}
export interface MigrationStepInputResult {
	stepId: string
	attribute: string
	value: any
}
export interface MigrationStepInputFilteredResult {
	[attribute: string]: any
}

export interface RunMigrationResult {
	migrationCompleted: boolean
	partialMigration: boolean
	warnings: Array<string>
	snapshot: string
}
