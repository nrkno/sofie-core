import { check, Match } from '../../lib/check'
import { registerClassToMeteorMethods } from '../methods'
import {
	MigrationChunk,
	NewMigrationAPI,
	MigrationAPIMethods,
	BlueprintFixUpConfigMessage,
} from '../../lib/api/migration'
import * as Migrations from './databaseMigration'
import { MigrationStepInputResult } from '@sofie-automation/blueprints-integration'
import { MethodContextAPI } from '../../lib/api/methods'
import { SystemWriteAccess } from '../security/system'
import {
	fixupConfigForShowStyleBase,
	fixupConfigForStudio,
	ignoreFixupConfigForShowStyleBase,
	ignoreFixupConfigForStudio,
	runUpgradeForShowStyleBase,
	runUpgradeForStudio,
	validateConfigForShowStyleBase,
	validateConfigForStudio,
} from './upgrades'
import { ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'

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

	async fixupConfigForStudio(studioId: StudioId): Promise<BlueprintFixUpConfigMessage[]> {
		check(studioId, String)

		await SystemWriteAccess.migrations(this)

		return fixupConfigForStudio(studioId)
	}

	async ignoreFixupConfigForStudio(studioId: StudioId): Promise<void> {
		check(studioId, String)

		await SystemWriteAccess.migrations(this)

		return ignoreFixupConfigForStudio(studioId)
	}

	async validateConfigForStudio(studioId: StudioId): Promise<BlueprintValidateConfigForStudioResult> {
		check(studioId, String)

		await SystemWriteAccess.migrations(this)

		return validateConfigForStudio(studioId)
	}

	async runUpgradeForStudio(studioId: StudioId): Promise<void> {
		check(studioId, String)

		await SystemWriteAccess.migrations(this)

		return runUpgradeForStudio(studioId)
	}

	async fixupConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<BlueprintFixUpConfigMessage[]> {
		check(showStyleBaseId, String)

		await SystemWriteAccess.migrations(this)

		return fixupConfigForShowStyleBase(showStyleBaseId)
	}

	async ignoreFixupConfigForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void> {
		check(showStyleBaseId, String)

		await SystemWriteAccess.migrations(this)

		return ignoreFixupConfigForShowStyleBase(showStyleBaseId)
	}

	async validateConfigForShowStyleBase(
		showStyleBaseId: ShowStyleBaseId
	): Promise<BlueprintValidateConfigForStudioResult> {
		check(showStyleBaseId, String)

		await SystemWriteAccess.migrations(this)

		return validateConfigForShowStyleBase(showStyleBaseId)
	}

	async runUpgradeForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void> {
		check(showStyleBaseId, String)

		await SystemWriteAccess.migrations(this)

		return runUpgradeForShowStyleBase(showStyleBaseId)
	}
}
registerClassToMeteorMethods(MigrationAPIMethods, ServerMigrationAPI, false)
