import {
	getCoreSystem,
	CoreSystem,
	SYSTEM_ID,
	getCoreSystemCursor,
	parseVersion,
	Version,
	stripVersion
} from '../lib/collections/CoreSystem'
import { getCurrentTime } from '../lib/lib'
import { Meteor } from 'meteor/meteor'
import {
	CURRENT_SYSTEM_VERSION,
	GENESIS_SYSTEM_VERSION
} from './migration/databaseMigration'
import { setSystemStatus, StatusCode, removeSystemStatus } from './systemStatus'
import { Blueprints, Blueprint } from '../lib/collections/Blueprints'
import * as _ from 'underscore'
import { ShowStyleBases } from '../lib/collections/ShowStyleBases'
import { StudioInstallations } from '../lib/collections/StudioInstallations'
import { logger } from './logging'
const PackageInfo = require('../package.json')

function initializeCoreSystem () {
	let system = getCoreSystem()
	if (!system) {
		let version = parseVersion(GENESIS_SYSTEM_VERSION)
		CoreSystem.insert({
			_id: SYSTEM_ID,
			created: getCurrentTime(),
			modified: getCurrentTime(),
			version: version.toString(),
			previousVersion: null,
			storePath: '' // to be filled in later
		})
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

let blueprints: {[id: string]: true} = {}

function checkDatabaseVersions () {
	// Core system

	let databaseSystem = getCoreSystem()
	if (!databaseSystem) {
		setSystemStatus('databaseVersion', { statusCode: StatusCode.BAD, messages: ['Database not set up'] })
	} else {

		let dbVersion = databaseSystem.version ? parseVersion(databaseSystem.version) : null
		let currentVersion = parseVersion(CURRENT_SYSTEM_VERSION)

		setSystemStatus('databaseVersion', checkDatabaseVersion(currentVersion, dbVersion, 'to fix, run migration', 'core', 'database'))

		// Blueprints:
		let blueprintIds: {[id: string]: true} = {}
		Blueprints.find().forEach((blueprint) => {
			if (blueprint.code) {
				blueprintIds[blueprint._id] = true

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

				let studioIds: {[studioId: string]: true} = {}
				ShowStyleBases.find({
					blueprintId: blueprint._id
				}).forEach((showStyleBase) => {

					if (o.statusCode === StatusCode.GOOD) {
						o = checkDatabaseVersion(
							blueprint.blueprintVersion ? parseVersion(blueprint.blueprintVersion) : null,
							parseVersion(blueprint.databaseVersion.showStyle[showStyleBase._id] || '0.0.0'),
							'to fix, run migration',
							'blueprint',
							'database'
						)
					}

					StudioInstallations.find({
						supportedShowStyleBase: showStyleBase._id
					}).forEach((studio) => {
						if (!studioIds[studio._id]) { // only run once per blueprint and studio
							studioIds[studio._id] = true

							if (o.statusCode === StatusCode.GOOD) {
								o = checkDatabaseVersion(
									blueprint.blueprintVersion ? parseVersion(blueprint.blueprintVersion) : null,
									parseVersion(blueprint.databaseVersion.studio[studio._id] || '0.0.0'),
									'to fix, run migration',
									'blueprint',
									'database'
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
function checkDatabaseVersion (currentVersion: Version | null, dbVersion: Version | null, fixMessage: string, meName: string, theyName: string) {
	if (dbVersion) {
		if (currentVersion) {
			if (dbVersion.major !== currentVersion.major) {
				return {
					statusCode: StatusCode.BAD,
					messages: [`Version mismatch (major version differ): ${meName} version: ${currentVersion.toString()}, ${theyName} version: ${dbVersion.toString()}` + (fixMessage ? ` (${fixMessage})` : '')]
				}
			} else if (dbVersion.minor !== currentVersion.minor) {
				return {
					statusCode: StatusCode.WARNING_MAJOR,
					messages: [`Version mismatch (minor version differ): ${meName} version: ${currentVersion.toString()}, ${theyName} version: ${dbVersion.toString()}` + (fixMessage ? ` (${fixMessage})` : '')]
				}
			} else if (dbVersion.patch !== currentVersion.patch) {
				return {
					statusCode: StatusCode.WARNING_MINOR,
					messages: [`Version mismatch (patch differ): ${meName} version: ${currentVersion.toString()}, ${theyName} version: ${dbVersion.toString()}` + (fixMessage ? ` (${fixMessage})` : '')]
				}
			} else if (dbVersion.label !== currentVersion.label) {
				return {
					statusCode: StatusCode.WARNING_MINOR,
					messages: [`Version mismatch (label differ): ${meName} version: ${currentVersion.toString()}, ${theyName} version: ${dbVersion.toString()}` + (fixMessage ? ` (${fixMessage})` : '')]
				}
			} else {
				return {
					statusCode: StatusCode.GOOD,
					messages: [`${meName} version: ${currentVersion.toString()}`]
				}
			}
		} else {
			return {
				statusCode: StatusCode.FATAL,
				messages: [`${meName} version missing`]
			}
		}
	} else {
		return {
			statusCode: StatusCode.FATAL,
			messages: [`${theyName} version missing`]
		}
	}
}

function checkBlueprintCompability (blueprint: Blueprint) {
	if (!PackageInfo.dependencies) throw new Meteor.Error(500, `Package.dependencies not set`)

	let integrationVersionStr = stripVersion(PackageInfo.dependencies['tv-automation-sofie-blueprints-integration'])
	let TSRTypesVersionStr = stripVersion(PackageInfo.dependencies['timeline-state-resolver-types'])

	let systemStatusId = 'blueprintCompability_' + blueprint._id

	let integrationStatus = checkDatabaseVersion(
		parseVersion(blueprint.integrationVersion || '0.0.0'),
		parseVersion(integrationVersionStr),
		'Blueprint has to be updated',
		'blueprint',
		'core'
	)
	let tsrStatus = checkDatabaseVersion(
		parseVersion(blueprint.TSRVersion || '0.0.0'),
		parseVersion(TSRTypesVersionStr),
		'Blueprint has to be updated',
		'blueprint',
		'core'
	)

	let coreStatus: {
		statusCode: StatusCode;
		messages: string[];
	} | undefined = undefined
	if (blueprint.minimumCoreVersion) {
		coreStatus = checkDatabaseVersion(
			parseVersion(blueprint.minimumCoreVersion),
			parseVersion(CURRENT_SYSTEM_VERSION),
			'Blueprint does not support this version of core',
			'minimum core',
			'current core'
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
export function getRelevantSystemVersions (): {[name: string]: string} {
	const versions: {[name: string]: string} = {}

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
			'@types/request',
			'amqplib',
			'body-parser',
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
			'jquery',
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
			'react-contextmenu',
			'react-datepicker',
			'react-dom',
			'react-escape',
			'react-hotkeys',
			'react-i18next',
			'react-lottie',
			'react-moment',
			'react-router-dom',
			'react-timer-hoc',
			'safer-eval',
			'smpte-timecode',
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
		_.each(names, (name) => {
			versions[name] = dependencies[name]
		})
		versions['core'] = PackageInfo.version // package version

	} else logger.error(`Core package dependencies missing`)
	return versions
}
function startupMessage () {
	logger.info(`Core starting up`)
	logger.info(`Core system version: "${CURRENT_SYSTEM_VERSION}"`)

	logger.info(`Core package version: "${PackageInfo.version}"`)

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
