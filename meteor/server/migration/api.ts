import { check, Match } from 'meteor/check';
import { setMeteorMethods, Methods } from '../methods';
import { MigrationMethods, MigrationChunk } from '../../lib/api/migration';
import {
	getMigrationStatus,
	runMigration,
	forceMigration,
	resetDatabaseVersions
} from './databaseMigration';
import { MigrationStepInputResult } from 'tv-automation-sofie-blueprints-integration';

const methods: Methods = {};
methods[MigrationMethods.getMigrationStatus] = () => {
	return getMigrationStatus();
};
methods[MigrationMethods.runMigration] = (
	chunks: Array<MigrationChunk>,
	hash: string,
	inputResults: Array<MigrationStepInputResult>,
	isFirstOfPartialMigrations?: boolean
) => {
	check(chunks, Array);
	check(hash, String);
	check(inputResults, Array);
	check(isFirstOfPartialMigrations, Match.Optional(Boolean));

	return runMigration(chunks, hash, inputResults, isFirstOfPartialMigrations);
};
methods[MigrationMethods.forceMigration] = (chunks: Array<MigrationChunk>) => {
	check(chunks, Array);

	return forceMigration(chunks);
};
methods[MigrationMethods.resetDatabaseVersions] = () => {
	return resetDatabaseVersions();
};

setMeteorMethods(methods);
