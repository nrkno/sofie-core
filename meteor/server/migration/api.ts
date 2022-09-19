import { check, Match } from '../../lib/check'
import { registerClassToMeteorMethods } from '../methods'
import { MigrationChunk, NewMigrationAPI, RunMigrationResult, MigrationAPIMethods } from '../../lib/api/migration'
import * as Migrations from './databaseMigration'
import { MigrationStepInputResult } from '@sofie-automation/blueprints-integration'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { SystemWriteAccess } from '../security/system'

async function getMigrationStatus(context: MethodContext) {
	await SystemWriteAccess.migrations(context)
	return Migrations.getMigrationStatus()
}
async function runMigration(
	context: MethodContext,
	chunks: Array<MigrationChunk>,
	hash: string,
	inputResults: Array<MigrationStepInputResult>,
	isFirstOfPartialMigrations?: boolean | null
): Promise<RunMigrationResult> {
	check(chunks, Array)
	check(hash, String)
	check(inputResults, Array)
	check(isFirstOfPartialMigrations, Match.Maybe(Boolean))

	await SystemWriteAccess.migrations(context)

	return Migrations.runMigration(chunks, hash, inputResults, isFirstOfPartialMigrations || false)
}
async function forceMigration(context: MethodContext, chunks: Array<MigrationChunk>) {
	check(chunks, Array)
	await SystemWriteAccess.migrations(context)

	return Migrations.forceMigration(chunks)
}
async function resetDatabaseVersions(context: MethodContext) {
	await SystemWriteAccess.migrations(context)

	return Migrations.resetDatabaseVersions()
}

class ServerMigrationAPI extends MethodContextAPI implements NewMigrationAPI {
	async getMigrationStatus() {
		return getMigrationStatus(this)
	}
	async runMigration(
		chunks: Array<MigrationChunk>,
		hash: string,
		inputResults: Array<MigrationStepInputResult>,
		isFirstOfPartialMigrations?: boolean | null
	) {
		return runMigration(this, chunks, hash, inputResults, isFirstOfPartialMigrations)
	}
	async forceMigration(chunks: Array<MigrationChunk>) {
		return forceMigration(this, chunks)
	}
	async resetDatabaseVersions() {
		return resetDatabaseVersions(this)
	}
}
registerClassToMeteorMethods(MigrationAPIMethods, ServerMigrationAPI, false)
