import {
	parseVersion,
	getCoreSystem,
	compareVersions,
	setCoreSystemVersion,
	Version
} from '../../lib/collections/CoreSystem'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { getHash } from '../lib'
import {
	MigrationMethods,
	GetMigrationStatusResultNoNeed,
	GetMigrationStatusResultMigrationNeeded,
	RunMigrationResult,
	MigrationChunk,
	MigrationStepType
} from '../../lib/api/migration'
import {
	MigrationStepInput,
	MigrationStepInputResult,
	MigrationStepInputFilteredResult,
	MigrationStep,
	MigrationStepBase,
	MigrationContextStudio,
	ValidateFunctionCore,
	MigrateFunctionCore
} from 'tv-automation-sofie-blueprints-integration'
import { setMeteorMethods } from '../methods'
import { logger } from '../../lib/logging'
import { Optional } from '../../lib/lib'
import { storeSystemSnapshot } from '../api/snapshot'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Blueprints } from '../../lib/collections/Blueprints'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { evalBlueprints } from '../api/blueprints'

/** The current database version, x.y.z
 * 0.16.0: Release 3 (2018-10-26)
 * 0.17.0: Release 3.1 (2018-11-14)
 * 0.18.0: Release 4 (TBD)
 * 0.19.0: Release 5 (TBD)
 */
export const CURRENT_SYSTEM_VERSION = '0.19.0'

/** In the beginning, there was the database, and the database was with Sofie, and the database was Sofie.
 * And Sofie said: The version of the database is to be GENESIS_SYSTEM_VERSION so that the migration scripts will run.
 */
export const GENESIS_SYSTEM_VERSION = '0.0.0'

/**
 * These versions are not supported anymore (breaking changes occurred after these version)
 */
export const UNSUPPORTED_VERSIONS = [
	// 0.18.0 to 0.19.0: Major refactoring, (ShowStyles was split into ShowStyleBase &
	//    ShowStyleVariant, configs & layers wheremoved from studio to ShowStyles)
	'0.18.0'
]

export function isVersionSupported (version: Version) {
	let isSupported: boolean = true
	_.each(UNSUPPORTED_VERSIONS, (uv) => {
		if (compareVersions(version, parseVersion(uv)) <= 0) {
			isSupported = false
		}
	})
	return isSupported
}

interface MigrationStepInternal extends MigrationStep {
	chunk: MigrationChunk
	_rank: number
	_version: Version // step version
	_validateResult: string | boolean
}

const coreMigrationSteps: Array<MigrationStep> = []

/**
 * Add new system Migration step
 * @param step
 */
export function addMigrationStep (step: MigrationStep) {
	coreMigrationSteps.push(step)
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

	// Discover applicable migration steps:
	let allMigrationSteps: Array<MigrationStepInternal> = []
	let migrationChunks: Array<MigrationChunk> = []
	let rank: number = 0

	// Collect migration steps from core system:
	let chunk: MigrationChunk = {
		sourceType:				MigrationStepType.CORE,
		sourceName:				'system',
		_dbVersion: 			parseVersion(baseVersionStr || databaseSystem.version),
		_targetVersion: 		parseVersion(targetVersionStr || CURRENT_SYSTEM_VERSION)
	}
	migrationChunks.push(chunk)

	_.each(coreMigrationSteps, (step) => {
		allMigrationSteps.push({
			id:						step.id,
			overrideSteps:			step.overrideSteps,
			validate:				step.validate,
			canBeRunAutomatically:	step.canBeRunAutomatically,
			migrate:				step.migrate,
			input:					step.input,
			dependOnResultFrom:		step.dependOnResultFrom,
			version: 				step.version,
			_version: 				parseVersion(step.version),
			_validateResult: 		false, // to be set later
			_rank: 					rank++,
			chunk: 					chunk
		})
	})
	// Collect migration steps from blueprints:

	Blueprints.find({}).forEach((blueprint) => {

		let bp = evalBlueprints(blueprint)

		let blueprintTargetVersion = parseVersion(bp.blueprintVersion)

		// @ts-ignore
		if (blueprint.databaseVersion) blueprint.databaseVersion = {}
		if (blueprint.databaseVersion.showStyle) blueprint.databaseVersion.showStyle = {}
		if (blueprint.databaseVersion.studio) blueprint.databaseVersion.studio = {}

		// Find all showStyles that uses this blueprint:
		let showStyleBaseIds: {[showStyleBaseId: string]: true} = {}
		let studioIds: {[studioId: string]: true} = {}
		ShowStyleBases.find({
			blueprintId: blueprint._id
		}).forEach((showStyleBase) => {
			showStyleBaseIds[showStyleBase._id] = true

			let chunk: MigrationChunk = {
				sourceType:				MigrationStepType.SHOWSTYLE,
				sourceName:				'Blueprint ' + blueprint.name + ' for showStyle ' + showStyleBase.name,
				_dbVersion: 			parseVersion(blueprint.databaseVersion.showStyle[showStyleBase._id] || '0.0.0'),
				_targetVersion: 		parseVersion(bp.blueprintVersion)
			}
			migrationChunks.push(chunk)
			// Add show-style migration steps from blueprint:
			_.each(bp.showStyleMigrations, (step) => {
				allMigrationSteps.push(prefixIdsOnStep(blueprint.databaseVersion + '_', {
					id:						step.id,
					overrideSteps:			step.overrideSteps,
					validate:				step.validate,
					canBeRunAutomatically:	step.canBeRunAutomatically,
					migrate:				step.migrate,
					input:					step.input,
					dependOnResultFrom:		step.dependOnResultFrom,
					version: 				step.version,
					_version: 				parseVersion(step.version),
					_validateResult: 		false, // to be set later
					_rank: 					rank++,
					chunk: 					chunk
				}))
			})

			// Find all studios that supports this showStyle
			StudioInstallations.find({
				supportedShowStyleBase: showStyleBase._id
			}).forEach((studio) => {
				if (!studioIds[studio._id]) {
					studioIds[studio._id] = true

					let chunk: MigrationChunk = {
						sourceType:				MigrationStepType.STUDIO,
						sourceName:				'Blueprint ' + blueprint.name + ' for studio ' + studio.name,
						_dbVersion: 			parseVersion(blueprint.databaseVersion.studio[studio._id] || '0.0.0'),
						_targetVersion: 		parseVersion(bp.blueprintVersion)
					}
					migrationChunks.push(chunk)
					// Add studio migration steps from blueprint:
					_.each(bp.showStyleMigrations, (step) => {
						allMigrationSteps.push(prefixIdsOnStep(blueprint.databaseVersion + '_', {
							id:						step.id,
							overrideSteps:			step.overrideSteps,
							validate:				step.validate,
							canBeRunAutomatically:	step.canBeRunAutomatically,
							migrate:				step.migrate,
							input:					step.input,
							dependOnResultFrom:		step.dependOnResultFrom,
							version: 				step.version,
							_version: 				parseVersion(step.version),
							_validateResult: 		false, // to be set later
							_rank: 					rank++,
							chunk: 					chunk
						}))
					})
				}
			})
		})
	})

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

	let partialMigration: boolean = false

	// Filter steps:
	let overrideIds: {[id: string]: true} = {}
	let migrationSteps: {[id: string]: MigrationStepInternal} = {}
	let ignoredSteps: {[id: string]: true} = {}
	_.each(allMigrationSteps, (step: MigrationStepInternal) => {
		if (!step.canBeRunAutomatically && (!step.input || (_.isArray(step.input) && !step.input.length))) throw new Meteor.Error(500, `MigrationStep "${step.id}" is manual, but no input is provided`)

		if (partialMigration) return
		let stepVersion = step._version
		if (
			compareVersions(stepVersion, step.chunk._dbVersion) > 0 && // step version is larger than database version
			compareVersions(stepVersion, step.chunk._targetVersion) <= 0 // // step version is less than (or equal) to system version
		) {
			// Step is in play

			if (step.overrideSteps) {
				// Override / delete other steps
				_.each(step.overrideSteps, (overrideId: string) => {
					delete migrationSteps[overrideId]
					if (ignoredSteps[overrideId]) {
						delete ignoredSteps[overrideId]
						ignoredStepCount--
					}
				})
			}

			if (migrationSteps[step.id] || ignoredSteps[step.id]) throw new Meteor.Error(500, `Error: MigrationStep.id must be unique: "${step.id}"`)

			// Check if the step can be applied:
			let validate = step.validate as ValidateFunctionCore
			step._validateResult = validate(false)
			if (step._validateResult) {

				if (step.dependOnResultFrom) {
					if (ignoredSteps[step.dependOnResultFrom]) {
						// dependent step was ignored, continue then
					} else if (migrationSteps[step.dependOnResultFrom]) {
						// we gotta pause here
						partialMigration = true
						return
					}
				}

				migrationSteps[step.id] = step
			} else {
				// No need to run step
				ignoredSteps[step.id] = true
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
		chunks: 			migrationChunks,
		steps: 				_.values(migrationSteps),
		automaticStepCount: automaticStepCount,
		manualStepCount: 	manualStepCount,
		ignoredStepCount: 	ignoredStepCount,
		manualInputs: 		manualInputs,
		partialMigration: 	partialMigration
	}
}
function prefixIdsOnStep (prefix: string, step: MigrationStepInternal): MigrationStepInternal {
	step.id = prefix + step.id
	if (step.overrideSteps) {
		step.overrideSteps = _.map(step.overrideSteps, (override) => {
			return prefix + override
		})
	}
	return step
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

	let warningMessages: Array<string> = []

	// First, take a system snapshot:
	let system = getCoreSystem()
	let snapshotId: string = ''
	if (system && system.storePath) {
		try {
			snapshotId = storeSystemSnapshot(null, `Automatic, taken before migration from "${baseVersion.toString()}" to "${targetVersion.toString()}"`)
		} catch (e) {
			warningMessages.push(`Error when taking snapshot:${e.toString()}`)
			logger.error(e)
		}
	}

	logger.info(`Migration: ${migration.automaticStepCount} automatic and ${migration.manualStepCount} steps (${migration.ignoredStepCount} ignored).`)

	logger.debug(inputResults)

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
			let migrate = step.migrate as MigrateFunctionCore
			if (migrate) {
				migrate(stepInput)
			}

			// After migration, run the validation again
			// Since the migration should be done by now, the validate should return true
			let validate = step.validate as ValidateFunctionCore
			let validateMessage: string | boolean = validate(true)
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
			logger.error(e.stack ? e.stack : e.toString())
			warningMessages.push(`Internal server error in step ${step.id}`)
		}
	})

	let migrationCompleted: boolean = false

	if (!migration.partialMigration) {
		if (!warningMessages.length) {
			// if there are no warning messages, we can complete the migration right away
			updateDatabaseVersion(targetVersionStr)
			migrationCompleted = true
		}
	}

	_.each(warningMessages, (str) => {
		logger.warn(`Migration: ${str}`)
	})
	logger.info(`Migration: end`)
	return {
		migrationCompleted: migrationCompleted,
		partialMigration: migration.partialMigration,
		warnings: warningMessages,
		snapshot: snapshotId
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
			databasePreviousVersion:	system.previousVersion,
			systemVersion:		 		systemVersion.toString(),
			migrationNeeded:	 		true,

			migration: {
				canDoAutomaticMigration:	migration.manualStepCount === 0,

				manualInputs:				migration.manualInputs,
				hash:						migration.hash,
				chunks:						migration.chunks,

				automaticStepCount: 		migration.automaticStepCount,
				manualStepCount: 			migration.manualStepCount,
				ignoredStepCount: 			migration.ignoredStepCount,
				partialMigration: 			migration.partialMigration
			}
		}
	} else {
		return {
			databaseVersion: 			databaseVersion.toString(),
			databasePreviousVersion:	system.previousVersion,
			systemVersion: 				systemVersion.toString(),
			migrationNeeded: 			false
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
