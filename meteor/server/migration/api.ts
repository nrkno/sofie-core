import { check, Match } from '../../lib/check'
import { registerClassToMeteorMethods } from '../methods'
import { MigrationChunk, NewMigrationAPI, MigrationAPIMethods, GetUpgradeStatusResult } from '../../lib/api/migration'
import * as Migrations from './databaseMigration'
import { MigrationStepInputResult } from '@sofie-automation/blueprints-integration'
import { MethodContextAPI } from '../../lib/api/methods'
import { SystemWriteAccess } from '../security/system'
import { getUpgradeStatus, runUpgradeForStudio } from './upgrades'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

class ServerMigrationAPI extends MethodContextAPI implements NewMigrationAPI {
	async getMigrationStatus() {
		await SystemWriteAccess.migrations(this)
		return Migrations.getMigrationStatus()
	}

	async runMigration(
		chunks: Array<MigrationChunk>,
		hash: string,
		inputResults: Array<MigrationStepInputResult>,
		isFirstOfPartialMigrations?: boolean | null
	) {
		check(chunks, Array)
		check(hash, String)
		check(inputResults, Array)
		check(isFirstOfPartialMigrations, Match.Maybe(Boolean))

		await SystemWriteAccess.migrations(this)

		return Migrations.runMigration(chunks, hash, inputResults, isFirstOfPartialMigrations || false)
	}

	async forceMigration(chunks: Array<MigrationChunk>) {
		check(chunks, Array)
		await SystemWriteAccess.migrations(this)

		return Migrations.forceMigration(chunks)
	}

	async resetDatabaseVersions() {
		await SystemWriteAccess.migrations(this)

		return Migrations.resetDatabaseVersions()
	}

	async getUpgradeStatus(): Promise<GetUpgradeStatusResult> {
		await SystemWriteAccess.migrations(this)

		return getUpgradeStatus()
	}

	async runUpgradeForStudio(studioId: StudioId): Promise<void> {
		check(studioId, String)

		await SystemWriteAccess.migrations(this)

		return runUpgradeForStudio(studioId)
	}
}
registerClassToMeteorMethods(MigrationAPIMethods, ServerMigrationAPI, false)
