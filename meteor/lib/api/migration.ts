import { MigrationStepInput, MigrationStepInputResult } from '@sofie-automation/blueprints-integration'
import { BlueprintId, ShowStyleBaseId, SnapshotId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'

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

	getUpgradeStatus(): Promise<GetUpgradeStatusResult>
	validateConfigForStudio(studioId: StudioId): Promise<BlueprintValidateConfigForStudioResult>
	runUpgradeForStudio(studioId: StudioId): Promise<void>
	validateConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<BlueprintValidateConfigForStudioResult>
	runUpgradeForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
}

export enum MigrationAPIMethods {
	'getMigrationStatus' = 'migration.getMigrationStatus',
	'runMigration' = 'migration.runMigration',
	'forceMigration' = 'migration.forceMigration',
	'resetDatabaseVersions' = 'migration.resetDatabaseVersions',

	'getUpgradeStatus' = 'migration.getUpgradeStatus',
	'validateConfigForStudio' = 'migration.validateConfigForStudio',
	'runUpgradeForStudio' = 'migration.runUpgradeForStudio',
	'validateConfigForShowStyleBase' = 'migration.validateConfigForShowStyleBase',
	'runUpgradeForShowStyleBase' = 'migration.runUpgradeForShowStyleBase',
}

export interface GetUpgradeStatusResultStudio {
	studioId: StudioId
	name: string

	invalidReason?: ITranslatableMessage

	changes: ITranslatableMessage[]
}
export interface GetUpgradeStatusResultShowStyleBase {
	showStyleBaseId: ShowStyleBaseId
	name: string

	invalidReason?: ITranslatableMessage

	changes: ITranslatableMessage[]
}

export interface GetUpgradeStatusResult {
	studios: GetUpgradeStatusResultStudio[]
	showStyleBases: GetUpgradeStatusResultShowStyleBase[]
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
	SYSTEM = 'system',
	STUDIO = 'studio',
	SHOWSTYLE = 'showstyle',
}
export interface MigrationChunk {
	sourceType: MigrationStepType
	sourceName: string
	blueprintId?: BlueprintId // blueprint id
	sourceId?: ShowStyleBaseId | StudioId | 'system' // id in blueprint databaseVersions
	_dbVersion: string // database version
	_targetVersion: string // target version
	_steps: Array<string> // ref to step that use it
}
