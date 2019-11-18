import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { setupEmptyEnvironment, setupMockPeripheralDevice } from '../../../__mocks__/helpers/database'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { getCoreSystem, ICoreSystem, GENESIS_SYSTEM_VERSION } from '../../../lib/collections/CoreSystem'
import { CURRENT_SYSTEM_VERSION } from '../databaseMigration'
import { MigrationMethods, RunMigrationResult, GetMigrationStatusResult } from '../../../lib/api/migration'
import { literal } from '../../../lib/lib'
import { MigrationStepInputResult } from 'tv-automation-sofie-blueprints-integration'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { Studios } from '../../../lib/collections/Studios'

require('../api.ts') // include in order to create the Meteor methods needed

// Include all migration scripts:
const normalizedPath = require('path').join(__dirname, '../')
require('fs').readdirSync(normalizedPath).forEach((fileName) => {
	if (fileName.match(/\d+_\d+_\d+\.ts/)) { // x_y_z.ts
		require('../' + fileName)
	}
})

describe('Test ingest actions for rundowns and segments', () => {

	beforeAll(() => {
		setupEmptyEnvironment()
	})
	function getSystem () {
		return getCoreSystem() as ICoreSystem
	}
	function userInput (migrationStatus: GetMigrationStatusResult, userInput?: {[key: string]: any}): MigrationStepInputResult[] {
		return _.compact(_.map(migrationStatus.migration.manualInputs, (manualInput) => {
			if (
				manualInput.stepId &&
				manualInput.attribute
			) {
				return literal<MigrationStepInputResult>({
					stepId: manualInput.stepId,
					attribute: manualInput.attribute,
					value: userInput && userInput[manualInput.stepId]
				})
			}
		}))
	}

	testInFiber('System migrations, initial setup', () => {

		expect(getSystem().version).toEqual(GENESIS_SYSTEM_VERSION)

		const migrationStatus0: GetMigrationStatusResult = Meteor.call(MigrationMethods.getMigrationStatus)

		expect(migrationStatus0).toMatchObject({
			migrationNeeded: true,

			migration: {
				canDoAutomaticMigration: true,
				// manualInputs: [],
				hash: expect.stringContaining(''),
				automaticStepCount: expect.any(Number),
				manualStepCount: 0,
				ignoredStepCount: expect.any(Number),
				partialMigration: true
				// chunks: expect.any(Array)
			}
		})
		expect(migrationStatus0.migration.automaticStepCount).toBeGreaterThanOrEqual(1)

		const migrationResult0: RunMigrationResult = Meteor.call(MigrationMethods.runMigration,
			migrationStatus0.migration.chunks,
			migrationStatus0.migration.hash,
			userInput(migrationStatus0)
		)

		expect(migrationResult0).toMatchObject({
			migrationCompleted: false,
			partialMigration: true,
			warnings: expect.any(Array),
			snapshot: expect.any(String)
		})

		const studios = Studios.find().fetch() // Created in the migration step before
		expect(studios).toHaveLength(1)
		const studio = studios[0]

		// Connect a Playout-gateway to the system:
		setupMockPeripheralDevice(
			PeripheralDeviceAPI.DeviceCategory.PLAYOUT,
			PeripheralDeviceAPI.DeviceType.PLAYOUT,
			PeripheralDeviceAPI.SUBTYPE_PROCESS,
			studio
		)

		// Continue with migration:
		const migrationStatus1: GetMigrationStatusResult = Meteor.call(MigrationMethods.getMigrationStatus)
		expect(migrationStatus1.migrationNeeded).toEqual(true)
		expect(migrationStatus1.migration.automaticStepCount).toBeGreaterThanOrEqual(1)

		const migrationResult1: RunMigrationResult = Meteor.call(MigrationMethods.runMigration,
			migrationStatus1.migration.chunks,
			migrationStatus1.migration.hash,
			userInput(migrationStatus1, {
				'CoreSystem.storePath': 'mock',
				'Studios.settings.mediaPreviewsUrl': 'mock',
				'Studios.settings.sofieUrl': 'http://localhost',
				'Studios.settings.slackEvaluationUrls': 'mock',
				'Studios.settings.supportedMediaFormats': '1920x1080i5000, 1280x720, i5000, i5000tff'
			})
		)
		expect(migrationResult1).toMatchObject({
			migrationCompleted: true,
			// partialMigration: true,
			warnings: expect.any(Array),
			snapshot: expect.any(String)
		})

		expect(getSystem().version).toEqual(CURRENT_SYSTEM_VERSION)

	})
})
