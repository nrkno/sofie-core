
export enum MigrationMethods {
	'getMigrationStatus' 	= 'coreSystem.getMigrationStatus',
	'runMigration' 			= 'coreSystem.runMigration',
	'forceMigration' 		= 'coreSystem.forceMigration'
}
export interface GetMigrationStatusResult {
	databaseVersion: string
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
	}
}

export interface MigrationStepInput {
	stepId?: string // automatically filled in later
	label: string
	description?: string
	inputType: 'text' | 'multiline' | 'int' | 'checkbox' | 'dropdown' | 'switch' // EditAttribute types
	attribute: string
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
	migrationCompleted: boolean,
	warnings: Array<string>
}
