import {
	getCoreSystem,
	CoreSystem,
	SYSTEM_ID,
	getCoreSystemCursor,
	parseVersion,
	Version,
	parseRange,
	stripVersion,
	VersionRange,
	GENESIS_SYSTEM_VERSION
} from '../lib/collections/CoreSystem'
import { getCurrentTime, unprotectString } from '../lib/lib'
import { Meteor } from 'meteor/meteor'
import {
	CURRENT_SYSTEM_VERSION,
	prepareMigration,
	runMigration
} from './migration/databaseMigration'
import { setSystemStatus, StatusCode, removeSystemStatus } from './systemStatus/systemStatus'
import { Blueprints, Blueprint } from '../lib/collections/Blueprints'
import * as _ from 'underscore'
import { ShowStyleBases } from '../lib/collections/ShowStyleBases'
import { Studios } from '../lib/collections/Studios'
import { logger } from './logging'
import * as semver from 'semver'
const PackageInfo = require('../package.json')
const BlueprintIntegrationPackageInfo = require('../node_modules/tv-automation-sofie-blueprints-integration/package.json')

export { PackageInfo }

function initializeCoreSystem () {
	let system = getCoreSystem()
	if (!system) {
		// At this point, we probably have a system that is as fresh as it gets

		let version = parseVersion(GENESIS_SYSTEM_VERSION)
		CoreSystem.insert({
			_id: SYSTEM_ID,
			created: getCurrentTime(),
			modified: getCurrentTime(),
			version: version,
			previousVersion: null,
			storePath: '', // to be filled in later
			serviceMessages: {}
		})

		// Check what migration has to provide:
		let migration = prepareMigration(true)
		if (
			migration.migrationNeeded &&
			migration.manualStepCount === 0 &&
			migration.chunks.length <= 1
		) {
			// Since we've determined that the migration can be done automatically, and we have a fresh system, just do the migration automatically:
			runMigration(migration.chunks, migration.hash, [])
		}
	}

	// Monitor database changes:
	let systemCursor = getCoreSystemCursor()
	systemCursor.observeChanges({
		added: checkDatabaseVersions,
		changed: checkDatabaseVersions,
		removed: checkDatabaseVersions
	})

	let blueprintsCursor = Blueprints.find({})
	blueprintsCursor.observeChanges({
		added: checkDatabaseVersions,
		changed: checkDatabaseVersions,
		removed: checkDatabaseVersions
	})

	checkDatabaseVersions()
}

let blueprints: { [id: string]: true } = {}

function checkDatabaseVersions () {
	// Core system

	let databaseSystem = getCoreSystem()
	if (!databaseSystem) {
		setSystemStatus('databaseVersion', { statusCode: StatusCode.BAD, messages: ['Database not set up'] })
	} else {

		let dbVersion = databaseSystem.version ? parseVersion(databaseSystem.version) : null
		let currentVersion = parseVersion(CURRENT_SYSTEM_VERSION)

		setSystemStatus('databaseVersion', checkDatabaseVersion(currentVersion, dbVersion, 'to fix, run migration', 'core', 'system database'))

		// Blueprints:
		let blueprintIds: { [id: string]: true } = {}
		Blueprints.find().forEach((blueprint) => {
			if (blueprint.code) {
				blueprintIds[unprotectString(blueprint._id)] = true

				// @ts-ignore
				if (!blueprint.databaseVersion || _.isString(blueprint.databaseVersion)) blueprint.databaseVersion = {}
				if (!blueprint.databaseVersion.showStyle) blueprint.databaseVersion.showStyle = {}
				if (!blueprint.databaseVersion.studio) blueprint.databaseVersion.studio = {}

				let o: {
					statusCode: StatusCode
					messages: string[]
				} = {
					statusCode: StatusCode.BAD,
					messages: []
				}

				let studioIds: { [studioId: string]: true } = {}
				ShowStyleBases.find({
					blueprintId: blueprint._id
				}).forEach((showStyleBase) => {

					if (o.statusCode === StatusCode.GOOD) {
						o = checkDatabaseVersion(
							blueprint.blueprintVersion ? parseVersion(blueprint.blueprintVersion) : null,
							parseRange(blueprint.databaseVersion.showStyle[unprotectString(showStyleBase._id)] || '0.0.0'),
							'to fix, run migration',
							'blueprint.blueprintVersion',
							`databaseVersion.showStyle[${showStyleBase._id}]`
						)
					}

					Studios.find({
						supportedShowStyleBase: showStyleBase._id
					}).forEach((studio) => {
						if (!studioIds[unprotectString(studio._id)]) { // only run once per blueprint and studio
							studioIds[unprotectString(studio._id)] = true

							if (o.statusCode === StatusCode.GOOD) {
								o = checkDatabaseVersion(
									blueprint.blueprintVersion ? parseVersion(blueprint.blueprintVersion) : null,
									parseRange(blueprint.databaseVersion.studio[unprotectString(studio._id)] || '0.0.0'),
									'to fix, run migration',
									'blueprint.blueprintVersion',
									`databaseVersion.studio[${studio._id}]`
								)
							}
						}
					})
				})
				// setSystemStatus('blueprintVersion_' + blueprint._id, checkDatabaseVersion(
				// 	blueprint.blueprintVersion ? parseVersion(blueprint.blueprintVersion) : null,
				// 	parseVersion(blueprint.databaseVersion || '0.0.0'),
				// 	'to fix, run migration',
				// 	'blueprint',
				// 	'database'
				// ))

				checkBlueprintCompability(blueprint)
				// also check:
				// blueprint.integrationVersion
				// blueprint.TSRVersion
			}
		})
		_.each(blueprints, (_val, id: string) => {
			if (!blueprintIds[id]) {
				removeSystemStatus('blueprintVersion_' + id)
			}
		})
		blueprints = blueprintIds
	}
}
/**
 * Compares two versions and returns a system Status
 * @param currentVersion
 * @param dbVersion
 */
function checkDatabaseVersion (
	currentVersion: Version | null,
	expectVersion: VersionRange | null,
	fixMessage: string,
	meName: string,
	theyName: string
): { statusCode: StatusCode, messages: string[] } {

	if (currentVersion) currentVersion = semver.clean(currentVersion)

	if (expectVersion) {
		if (currentVersion) {

			if (semver.satisfies(currentVersion, expectVersion)) {
				return {
					statusCode: StatusCode.GOOD,
					messages: [`${meName} version: ${currentVersion}`]
				}
			} else {

				const currentV = new semver.SemVer(currentVersion, { includePrerelease: true })

				try {
					const expectV = new semver.SemVer(stripVersion(expectVersion), { includePrerelease: true })

					const message = `Version mismatch: ${meName} version: "${currentVersion}" does not satisfy expected version of ${theyName}: "${expectVersion}"` + (fixMessage ? ` (${fixMessage})` : '')

					if (!expectV || !currentV) {
						return {
							statusCode: StatusCode.BAD,
							messages: [message]
						}
					} else if (expectV.major !== currentV.major) {
						return {
							statusCode: StatusCode.BAD,
							messages: [message]
						}
					} else if (expectV.minor !== currentV.minor) {
						return {
							statusCode: StatusCode.WARNING_MAJOR,
							messages: [message]
						}
					} else if (expectV.patch !== currentV.patch) {
						return {
							statusCode: StatusCode.WARNING_MINOR,
							messages: [message]
						}
					} else if (!_.isEqual(expectV.prerelease, currentV.prerelease)) {
						return {
							statusCode: StatusCode.WARNING_MINOR,
							messages: [message]
						}
					} else {
						return {
							statusCode: StatusCode.BAD,
							messages: [message]
						}
					}
					// the expectedVersion may be a proper range, in which case the new semver.SemVer will throw an error, even though the semver.satisfies check would work.
				} catch (e) {
					const message = `Version mismatch: ${meName} version: "${currentVersion}" does not satisfy expected version range of ${theyName}: "${expectVersion}"` + (fixMessage ? ` (${fixMessage})` : '')

					return {
						statusCode: StatusCode.BAD,
						messages: [message]
					}
				}
			}

		} else {
			return {
				statusCode: StatusCode.FATAL,
				messages: [`Current ${meName} version missing (when comparing with ${theyName})`]
			}
		}
	} else {
		return {
			statusCode: StatusCode.FATAL,
			messages: [`Expected ${theyName} version missing (when comparing with ${meName})`]
		}
	}
}

function checkBlueprintCompability (blueprint: Blueprint) {
	if (!PackageInfo.dependencies) throw new Meteor.Error(500, `Package.dependencies not set`)

	let systemStatusId = 'blueprintCompability_' + blueprint._id

	let integrationStatus = checkDatabaseVersion(
		parseVersion(blueprint.integrationVersion || '0.0.0'),
		parseRange(PackageInfo.dependencies['tv-automation-sofie-blueprints-integration']),
		'Blueprint has to be updated',
		'blueprint.integrationVersion',
		'core.tv-automation-sofie-blueprints-integration'
	)
	let tsrStatus = checkDatabaseVersion(
		parseVersion(blueprint.TSRVersion || '0.0.0'),
		parseRange(BlueprintIntegrationPackageInfo.dependencies['timeline-state-resolver-types']),
		'Blueprint has to be updated',
		'blueprint.TSRVersion',
		'core.timeline-state-resolver-types'
	)
	let coreStatus: {
		statusCode: StatusCode;
		messages: string[];
	} | undefined = undefined
	if (blueprint.minimumCoreVersion) {
		coreStatus = checkDatabaseVersion(
			parseVersion(CURRENT_SYSTEM_VERSION),
			parseRange(blueprint.minimumCoreVersion),
			'Blueprint does not support this version of core',
			'blueprint.minimumCoreVersion',
			'core system'
		)
	}

	if (coreStatus && coreStatus.statusCode >= StatusCode.WARNING_MAJOR) {
		coreStatus.messages[0] = 'Core version: ' + coreStatus.messages[0]
		setSystemStatus(systemStatusId, coreStatus)
	} else if (tsrStatus && tsrStatus.statusCode >= StatusCode.WARNING_MAJOR) {
		tsrStatus.messages[0] = 'Core - TSR library version: ' + tsrStatus.messages[0]
		setSystemStatus(systemStatusId, tsrStatus)
	} else if (integrationStatus.statusCode >= StatusCode.WARNING_MAJOR) {
		integrationStatus.messages[0] = 'Integration version: ' + integrationStatus.messages[0]
		setSystemStatus(systemStatusId, integrationStatus)
	} else if (integrationStatus.statusCode >= StatusCode.WARNING_MAJOR) {
		integrationStatus.messages[0] = 'Integration version: ' + integrationStatus.messages[0]
		setSystemStatus(systemStatusId, integrationStatus)
	} else {
		setSystemStatus(systemStatusId, {
			statusCode: StatusCode.GOOD,
			messages: ['Versions match']
		})
	}
}
export function getRelevantSystemVersions (): { [name: string]: string } {
	const versions: { [name: string]: string } = {}

	let dependencies: any = PackageInfo.dependencies
	if (dependencies) {

		let names = _.keys(dependencies)
		// Omit system libraries
		let omitNames = [
			'@babel/runtime',
			'@fortawesome/fontawesome',
			'@fortawesome/fontawesome-free-solid',
			'@fortawesome/react-fontawesome',
			'@nrk/core-icons',
			'@slack/client',
			'@types/amqplib',
			'@types/body-parser',
			'@types/semver',
			'@types/react-circular-progressbar',
			'@types/request',
			'amqplib',
			'body-parser',
			'caller-module',
			'chai',
			'classnames',
			'core-js',
			'element-resize-event',
			'fast-clone',
			'html-entities',
			'i18next',
			'i18next-browser-languagedetector',
			'i18next-xhr-backend',
			'indexof',
			'lottie-web',
			'meteor-node-stubs',
			'moment',
			'ntp-client',
			'object-path',
			'prop-types',
			'query-string',
			'rc-tooltip',
			'react',
			'react-bootstrap',
			'react-circular-progressbar',
			'react-contextmenu',
			'react-datepicker',
			'react-dom',
			'react-escape',
			'react-hotkeys',
			'react-i18next',
			'react-intersection-observer',
			'react-lottie',
			'react-moment',
			'react-router-dom',
			'react-timer-hoc',
			'safer-eval',
			'semver',
			'timecode',
			'soap',
			'underscore',
			'velocity-animate',
			'velocity-react',
			'winston',
			'xml2json',
		]
		names = _.filter(names, (name) => {
			return omitNames.indexOf(name) === -1
		})

		let sanitizeVersion = v => {
			if (v.match(/git/i)) {
				return '0.0.0'
			} else {
				return v
			}
		}

		_.each(names, (name) => {
			versions[name] = sanitizeVersion(dependencies[name])
		})
		versions['core'] = PackageInfo.versionExtended || PackageInfo.version // package version
		versions['timeline-state-resolver-types'] = BlueprintIntegrationPackageInfo.dependencies['timeline-state-resolver-types']

	} else logger.error(`Core package dependencies missing`)
	return versions
}
function startupMessage () {
	if (!Meteor.isTest) {
		console.log('process started') // This is a message all Sofie processes log upon startup
	}

	logger.info(`Core starting up`)
	logger.info(`Core system version: "${CURRENT_SYSTEM_VERSION}"`)

	logger.info(`Core package version: "${PackageInfo.versionExtended || PackageInfo.version}"`)

	const versions = getRelevantSystemVersions()
	_.each(versions, (version, name) => {
		logger.info(`Core package ${name} version: "${version}"`)
	})

}

Meteor.startup(() => {
	if (Meteor.isServer) {
		startupMessage()
		initializeCoreSystem()
	}
})
