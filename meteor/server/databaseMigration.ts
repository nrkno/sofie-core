import {
	parseVersion,
	getCoreSystem,
	compareVersions,
	setCoreSystemVersion,
	Version
} from '../lib/collections/CoreSystem'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { getHash } from './lib'
import {
	MigrationMethods,
	MigrationStepInputFilteredResult,
	MigrationStepInput,
	MigrationStepInputResult,
	GetMigrationStatusResultNoNeed,
	GetMigrationStatusResultMigrationNeeded,
	RunMigrationResult
} from '../lib/api/migration'
import { setMeteorMethods } from './methods'
import { logger } from '../lib/logging'
import { Optional } from '../lib/lib'

/** The current database version, x.y.z */
export const CURRENT_SYSTEM_VERSION = '1.0.0'
/** In the beginning, there was the database, and the database was with Sofie, and the database was Sofie.
 * And Sofie said: The version of the database is to be GENESIS_SYSTEM_VERSION so that the migration scripts will run.
 */
export const GENESIS_SYSTEM_VERSION = '0.0.0'

export interface MigrationStepBase {
	/** Unique id for this step */
	id: string
	/** If this step overrides another step. Note: It's only possible to override steps in previous versions */
	overrideSteps?: Array<string>

	/** The validate function determines whether the step is to be applied
	 * (it can for example check that some value in the database is present)
	 * The function should return falsy if step is fullfilled (ie truthy if migrate function should be applied, return value could then be a string describing why)
	 * The function is also run after the migration-script has been applied (and should therefore return false if all is good)
	 */
	validate: (afterMigration: boolean) => boolean | string

	/** If true, this step can be run automatically, without prompting for user input */
	canBeRunAutomatically: boolean
	/** The migration script. This is the script that performs the updates.
	 * Input to the function is the result from the user prompt (for manual steps)
	 * The miggration script is optional, and may be omitted if the user is expected to perform the update manually
	 * @param result Input from the user query
	 */
	migrate?: (input: MigrationStepInputFilteredResult) => void
	/** Query user for input, used in manual steps */
	input?: Array<MigrationStepInput> | (() => Array<MigrationStepInput>)
}
export interface MigrationStep extends MigrationStepBase {
	/** The version this Step applies to */
	version: string
}
interface MigrationStepInternal extends MigrationStep {
	_rank: number,
	_version: Version,
	_validateResult: string | boolean
}

const systemMigrationSteps: Array<MigrationStep> = []

/**
 * Add new system Migration step
 * @param step
 */
export function addMigrationStep (step: MigrationStep) {
	systemMigrationSteps.push(step)
}
/**
 * Convenience method to add multiple steps of the same version
 * @param version
 * @param steps
 */
export function addMigrationSteps (version: string, steps: Array<MigrationStepBase>) {
	_.each(steps, (step) => {
		addMigrationStep(_.extend(step, {
			version: version
		}))
	})
}

export function prepareMigration (targetVersionStr?: string, baseVersionStr?: string) {

	let databaseSystem = getCoreSystem()
	if (!databaseSystem) throw new Meteor.Error(500, 'System version not set up')

	let baseVersion = parseVersion(baseVersionStr || databaseSystem.version)
	let targetVersion = parseVersion(targetVersionStr || CURRENT_SYSTEM_VERSION)

	// Discover applcable migration steps:
	let allMigrationSteps: Array<MigrationStepInternal> = []
	let rank: number = 0

	_.each(systemMigrationSteps, (step) => {
		allMigrationSteps.push(_.extend(step, {
			_rank: rank++,
			_version: parseVersion(step.version)
		}))
	})
	// TODO: add steps generated from blueprint here

	// Sort, smallest version first:
	allMigrationSteps.sort((a, b) => {
		let i = compareVersions(a._version, b._version)
		if (i !== 0) return i
		// Keep ranking within version:
		if (a._rank > b._rank) return 1
		if (a._rank < b._rank) return -1
		return 0
	})

	// console.log('allMigrationSteps', allMigrationSteps)

	let automaticStepCount: number = 0
	let manualStepCount: number = 0
	let ignoredStepCount: number = 0

	// Filter steps:
	let overrideIds: {[id: string]: true} = {}
	let migrationSteps: {[id: string]: MigrationStepInternal} = {}
	_.each(allMigrationSteps, (step: MigrationStepInternal) => {

		if (migrationSteps[step.id]) throw new Meteor.Error(500, `Error: MigrationStep.id must be unique: "${step.id}"`)
		if (!step.canBeRunAutomatically && (!step.input || (_.isArray(step.input) && !step.input.length))) throw new Meteor.Error(500, `MigrationStep "${step.id}" is manual, but no input is provided`)

		let stepVersion = step._version
		if (
			compareVersions(stepVersion, baseVersion) > 0 && // step version is larger than database version
			compareVersions(stepVersion, targetVersion) <= 0 // // step version is less than (or equal) to system version
		) {
			// Step is in play

			// Check if the step can be applied:
			step._validateResult = step.validate(false)
			if (step._validateResult) {

				if (step.overrideSteps) {
					// Override / delete other steps
					_.each(step.overrideSteps, (overrideId: string) => {
						delete migrationSteps[overrideId]
					})
				}
				migrationSteps[step.id] = step
			} else {
				// No need to run step
				ignoredStepCount++
			}
		} else {
			// Step is not applicable
		}
	})

	// console.log('migrationSteps', migrationSteps)

	// check if there are any manual steps:
	// (this makes an automatic migration impossible)

	let manualInputs: Array<MigrationStepInput> = []
	let stepsHash: Array<string> = []
	_.each(migrationSteps, (step: MigrationStepInternal, id: string) => {
		stepsHash.push(step.id)
		if (!step.canBeRunAutomatically) {
			manualStepCount++

			if (step.input) {
				let input: Array<MigrationStepInput> = []
				if (_.isArray(step.input)) {
					input = []
					_.each(step.input, (i) => {
						input.push(_.clone(i))
					})
				} else if (_.isFunction(step.input)) {
					input = step.input()
				}
				if (input.length) {
					_.each(input, (i) => {

						if (i.label && _.isString(step._validateResult)) {
							i.label = (i.label + '').replace(/\$validation/g, step._validateResult)
						}
						if (i.description && _.isString(step._validateResult)) {
							i.description = (i.description + '').replace(/\$validation/g, step._validateResult)
						}
						manualInputs.push(_.extend({}, i, {
							stepId: step.id
						}))
					})
				}
			}
		} else {
			automaticStepCount++
		}
	})

	let hash = getHash(stepsHash.join(','))

	return {
		hash:				hash,
		baseVersion:		baseVersion.toString(),
		targetVersion:		targetVersion.toString(),
		steps: 				_.values(migrationSteps),
		automaticStepCount: automaticStepCount,
		manualStepCount: 	manualStepCount,
		ignoredStepCount: 	ignoredStepCount,
		manualInputs: 		manualInputs
	}
}

export function runMigration (
	baseVersionStr: string,
	targetVersionStr: string,
	hash: string,
	inputResults: Array<MigrationStepInputResult>
): RunMigrationResult {
	let baseVersion = parseVersion(baseVersionStr)
	let targetVersion = parseVersion(targetVersionStr)

	logger.info(`Migration: Starting, from "${baseVersion.toString()}" to "${targetVersion.toString()}".`)

	// Verify the input:
	let migration = prepareMigration(targetVersionStr, baseVersionStr)

	let manualInputsWithUserPrompt = _.filter(migration.manualInputs, (manualInput) => {
		return !!(manualInput.stepId && manualInput.attribute)
	})
	if (migration.hash !== hash) throw new Meteor.Error(500, `Migration input hash differ from expected: "${hash}", "${migration.hash}"`)
	if (manualInputsWithUserPrompt.length !== inputResults.length ) throw new Meteor.Error(500, `Migration manualInput lengths differ from expected: "${inputResults.length}", "${migration.manualInputs.length}"`)

	logger.info(`Migration: ${migration.automaticStepCount} automatic and ${migration.manualStepCount} steps (${migration.ignoredStepCount} ignored).`)

	logger.debug(inputResults)

	let warningMessages: Array<string> = []

	_.each(migration.steps, (step: MigrationStep) => {

		try {
			// Prepare input from user
			let stepInput: MigrationStepInputFilteredResult = {}
			_.each(inputResults, (ir) => {
				if (ir.stepId === step.id) {
					stepInput[ir.attribute] = ir.value
				}
			})

			// Run the migration script
			if (step.migrate) {
				step.migrate(stepInput)
			}

			// After migration, run the validation again
			// Since the migration should be done by now, the validate should return true
			let validateMessage: string | boolean = step.validate(true)
			if (validateMessage) {
				// Something's not right
				let msg = `Step "${step.id}": Something went wrong, validation didn't approve of the changes. The changes have been applied, but might need to be confirmed.`
				if (validateMessage !== true && _.isString(validateMessage)) {
					msg += ` (Validation error: ${validateMessage})`
				}
				warningMessages.push(msg)
			}
		} catch (e) {
			logger.error(`Error in Migration step ${step.id}: ${e}`)
			warningMessages.push(`Internal server error in step ${step.id}`)
		}
	})

	let migrationCompleted: boolean = false

	if (!warningMessages.length) {
		// if there are no warning messages, we can complete the migration right away
		updateDatabaseVersion(targetVersionStr)
		migrationCompleted = true
	}

	_.each(warningMessages, (str) => {
		logger.warn(`Migration: ${str}`)
	})
	logger.info(`Migration: end`)
	return {
		migrationCompleted: migrationCompleted,
		warnings: warningMessages
	}
}
export function updateDatabaseVersion (targetVersionStr: string) {
	let targetVersion = parseVersion(targetVersionStr)
	setCoreSystemVersion(targetVersion.toString())
}

export function updateDatabaseVersionToSystem () {
	updateDatabaseVersion(CURRENT_SYSTEM_VERSION)
}

function getMigrationStatus (): GetMigrationStatusResultMigrationNeeded | GetMigrationStatusResultNoNeed {
	let system = getCoreSystem()
	if (!system) throw new Meteor.Error(500, 'CoreSystem not found')

	let databaseVersion = parseVersion(system.version)
	let systemVersion = parseVersion(CURRENT_SYSTEM_VERSION)

	let versionDifference: boolean = false

	if (compareVersions(databaseVersion, systemVersion) !== 0) {
		versionDifference = true

		let migration = prepareMigration()

		return {
			databaseVersion:	 		databaseVersion.toString(),
			systemVersion:		 		systemVersion.toString(),
			migrationNeeded:	 		true,

			migration: {
				canDoAutomaticMigration:	migration.manualStepCount === 0,

				manualInputs:				migration.manualInputs,
				hash:						migration.hash,
				baseVersion: 				migration.baseVersion,
				targetVersion: 				migration.targetVersion,

				automaticStepCount: 		migration.automaticStepCount,
				manualStepCount: 			migration.manualStepCount,
				ignoredStepCount: 			migration.ignoredStepCount
			}
		}
	} else {
		return {
			databaseVersion: databaseVersion.toString(),
			systemVersion: systemVersion.toString(),
			migrationNeeded: false
		}
	}

}
function forceMigration (targetVersionStr: string) {
	logger.info(`Force migration to "${targetVersionStr}"`)
	return updateDatabaseVersion (targetVersionStr)
}

let methods = {}
methods[MigrationMethods.getMigrationStatus] = getMigrationStatus
methods[MigrationMethods.runMigration] = runMigration
methods[MigrationMethods.forceMigration] = forceMigration
methods['debug_setVersion'] = (version: string) => {
	return updateDatabaseVersion (version)
}

setMeteorMethods(methods)
