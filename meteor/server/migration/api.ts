import { check, Match } from 'meteor/check'
import { registerClassToMeteorMethods } from '../methods'
import { MigrationChunk, NewMigrationAPI, RunMigrationResult, MigrationAPIMethods } from '../../lib/api/migration'
import * as Migrations from './databaseMigration'
import { MigrationStepInputResult } from 'tv-automation-sofie-blueprints-integration'
import { makePromise } from '../../lib/lib'

function getMigrationStatus () {
	return Migrations.getMigrationStatus()
}
function runMigration (
	chunks: Array<MigrationChunk>,
	hash: string,
	inputResults: Array<MigrationStepInputResult>,
	isFirstOfPartialMigrations?: boolean
): RunMigrationResult {

	check(chunks, Array)
	check(hash, String)
	check(inputResults, Array)
	check(isFirstOfPartialMigrations, Match.Optional(Boolean))

	return Migrations.runMigration(
		chunks,
		hash,
		inputResults,
		isFirstOfPartialMigrations
	)
}
function forceMigration (chunks: Array<MigrationChunk>) {
	check(chunks, Array)
	return Migrations.forceMigration(chunks)
}
function resetDatabaseVersions () {
	return Migrations.resetDatabaseVersions()
}

class ServerMigrationAPI implements NewMigrationAPI {

	getMigrationStatus () {
		return makePromise(() => getMigrationStatus())
	}
	runMigration (chunks: Array<MigrationChunk>, hash: string, inputResults: Array<MigrationStepInputResult>, isFirstOfPartialMigrations?: boolean) {
		return makePromise(() => runMigration(chunks, hash, inputResults, isFirstOfPartialMigrations))
	}
	forceMigration (chunks: Array<MigrationChunk>) {
		return makePromise(() => forceMigration(chunks))
	}
	resetDatabaseVersions () {
		return makePromise(() => resetDatabaseVersions())
	}
}
registerClassToMeteorMethods(MigrationAPIMethods, ServerMigrationAPI, false)
