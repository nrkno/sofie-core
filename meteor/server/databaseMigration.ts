import {
	parseVersion,
	getCoreSystem,
	compareVersions,
	setCoreSystemVersion
} from '../lib/collections/CoreSystem'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { getHash } from './lib'

/** The current database version, x.y.z */
export const CURRENT_SYSTEM_VERSION = '1.1.1'

export interface MigrationStep {
	/** Unique id for this step */
	id: string
	/** The version this Step applies to */
	version: string
	/** If this step overrides another step. Note: It's only possible to override steps in previous versions */
	overrideSteps: Array<string>

	/** The validate function determines whether the step is to be applied
	 * (it can for example check that some value in the database is present)
	 * The function should return true if step is applicable
	 * The function is also run after the migration-script has been applied (and should therefore return false if all is good)
	 */
	validate: (afterMigration: boolean) => boolean

	/** If true, the step can be run automatically, without prompting for user input */
	canBeRunAutomatically: boolean
	/** The migration script. (This is the script that performs the updates)
	 * Input to the function is the result from the user prompt (for manual steps)
	 */
	migrate: (result: MigrationStepInputFilteredResult) => void
	/** For manual steps */
	input?: Array<MigrationStepInput>
}
export interface MigrationStepInput {
	stepId?: string // automatically filled in later
	label: string
	description?: string
	inputType: string // enum
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

export function fetchMigrationSteps (targetVersionStr?: string, baseVersionStr?: string) {

	let databaseSystem = getCoreSystem()
	if (!databaseSystem) throw new Meteor.Error(500, 'System version not set up')

	let baseVersion = parseVersion(baseVersionStr || databaseSystem.version)
	let targetVersion = parseVersion(targetVersionStr || CURRENT_SYSTEM_VERSION)

	// Discover applcable migration steps:
	let allMigrationSteps: Array<MigrationStep> = []

	// TODO: fetch migrationSteps here

	// Sort, smallest version first:
	allMigrationSteps.sort((a, b) => {
		return compareVersions(parseVersion(a.version), parseVersion(a.version))
	})

	// Filter steps:
	let overrideIds: {[id: string]: true} = {}
	let migrationSteps: {[id: string]: MigrationStep} = {}
	_.each(allMigrationSteps, (step: MigrationStep) => {

		if (migrationSteps[step.id]) throw new Meteor.Error(500, `Error: MigrationStep.id must be unique: "${step.id}"`)
		if (!step.canBeRunAutomatically && (!step.input || !step.input.length)) throw new Meteor.Error(500, `MigrationStep "${step.id}" is manual, but no input is provided`)

		let stepVersion = parseVersion(step.version)
		if (
			compareVersions(stepVersion, baseVersion) > 0 && // step version is larger than database version
			compareVersions(stepVersion, targetVersion) <= 0 // // step version is less than (or equal) to system version
		) {
			// Step is in play

			// Check if the step can be applied:
			if (step.validate(false)) {
				if (step.overrideSteps) {
					// Override / delete other steps
					_.each(step.overrideSteps, (overrideId: string) => {
						delete migrationSteps[overrideId]
					})
				}
				migrationSteps[step.id] = step
			}
		} else {
			// Step is not applicable, do nothing
		}
	})

	// check if there are any manual steps:
	// (this makes an automatic migration impossible)
	let automaticStepCount: number = 0
	let manualStepCount: number = 0

	let manualInputs: Array<MigrationStepInput> = []
	let stepsHash: Array<string> = []
	_.each(migrationSteps, (step: MigrationStep, id: string) => {
		stepsHash.push(step.id)
		if (step.input && step.input.length) {
			_.each(step.input, (i) => {
				manualInputs.push(_.extend({}, i, {
					stepId: step.id
				}))
			})
		}
		if (!step.canBeRunAutomatically) {
			manualStepCount++
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
		manualInputs: 		manualInputs
	}
}

export function runMigration (
	baseVersionStr: string,
	targetVersionStr: string,
	hash: string,
	inputResults: Array<MigrationStepInputResult>
) {
	let baseVersion = parseVersion(baseVersionStr)
	let targetVersion = parseVersion(targetVersionStr)

	// Verify the input:
	let migration = fetchMigrationSteps(targetVersionStr, baseVersionStr)

	if (migration.hash !== hash) throw new Meteor.Error(500, `Migration input hash differ from expected: "${hash}", "${migration.hash}"`)
	if (migration.manualInputs.length !== inputResults.length ) throw new Meteor.Error(500, `Migration manualInput lengths differ from expected: "${inputResults.length}", "${migration.manualInputs.length}"`)

	let warningMessages: Array<string> = []

	_.each(migration.steps, (step: MigrationStep) => {

		// Prepare input from user
		let stepInput: MigrationStepInputFilteredResult = {}
		_.each(inputResults, (ir) => {
			if (ir.stepId === step.id) {
				stepInput[ir.attribute] = ir.value
			}
		})

		// Run the migration script
		step.migrate(stepInput)

		// After migration, run the validation again
		// Since the migration should be done by now, the validate should return false
		if (step.validate(true)) {
			// Something's not right
			warningMessages.push(`Step "${step.id}": Something went wrong, validation didn't approve of the changes. The changes have been applied, but might need to be confirmed.`)
		}
	})

	let migrationDone: boolean = false

	if (!warningMessages.length) {
		// if there are no warning messages, we can complete the migration right away
		updateDatabaseVersion(targetVersionStr)
		migrationDone = true
	}

	return {
		migrationDone: migrationDone,
		warnings: warningMessages
	}
}
export function updateDatabaseVersion (targetVersionStr: string) {
	let targetVersion = parseVersion(targetVersionStr)
}

export function updateDatabaseVersionToSystem () {
	updateDatabaseVersion(CURRENT_SYSTEM_VERSION)
}
