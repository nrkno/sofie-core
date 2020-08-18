import { MigrationStepInputResult } from 'tv-automation-sofie-blueprints-integration'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { MigrationAPIMethods, MigrationChunk, NewMigrationAPI, RunMigrationResult } from '../../lib/api/migration'
import { check, Match } from '../../lib/check'
import { makePromise } from '../../lib/lib'
import { registerClassToMeteorMethods } from '../methods'
import { SystemWriteAccess } from '../security/system'
import * as Migrations from './databaseMigration'

function getMigrationStatus(context: MethodContext) {
	SystemWriteAccess.migrations(context)
	return Migrations.getMigrationStatus()
}
function runMigration(
	context: MethodContext,
	chunks: Array<MigrationChunk>,
	hash: string,
	inputResults: Array<MigrationStepInputResult>,
	isFirstOfPartialMigrations?: boolean
): RunMigrationResult {
	check(chunks, Array)
	check(hash, String)
	check(inputResults, Array)
	check(isFirstOfPartialMigrations, Match.Optional(Boolean))

	SystemWriteAccess.migrations(context)

	return Migrations.runMigration(chunks, hash, inputResults, isFirstOfPartialMigrations)
}
function forceMigration(context: MethodContext, chunks: Array<MigrationChunk>) {
	check(chunks, Array)
	SystemWriteAccess.migrations(context)
	return Migrations.forceMigration(chunks)
}
function resetDatabaseVersions(context: MethodContext) {
	SystemWriteAccess.migrations(context)
	return Migrations.resetDatabaseVersions()
}

class ServerMigrationAPI extends MethodContextAPI implements NewMigrationAPI {
	getMigrationStatus() {
		return makePromise(() => getMigrationStatus(this))
	}
	runMigration(
		chunks: Array<MigrationChunk>,
		hash: string,
		inputResults: Array<MigrationStepInputResult>,
		isFirstOfPartialMigrations?: boolean
	) {
		return makePromise(() => runMigration(this, chunks, hash, inputResults, isFirstOfPartialMigrations))
	}
	forceMigration(chunks: Array<MigrationChunk>) {
		return makePromise(() => forceMigration(this, chunks))
	}
	resetDatabaseVersions() {
		return makePromise(() => resetDatabaseVersions(this))
	}
}
registerClassToMeteorMethods(MigrationAPIMethods, ServerMigrationAPI, false)
