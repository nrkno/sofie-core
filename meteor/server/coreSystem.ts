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
	GENESIS_SYSTEM_VERSION,
} from '../lib/collections/CoreSystem'
import { getCurrentTime, unprotectString } from '../lib/lib'
import { Meteor } from 'meteor/meteor'
import { prepareMigration, runMigration } from './migration/databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './migration/currentSystemVersion'
import { setSystemStatus, StatusCode, removeSystemStatus } from './systemStatus/systemStatus'
import { Blueprints, Blueprint } from '../lib/collections/Blueprints'
import * as _ from 'underscore'
import { ShowStyleBases } from '../lib/collections/ShowStyleBases'
import { Studios, StudioId } from '../lib/collections/Studios'
import { logger } from './logging'
import * as semver from 'semver'
import { findMissingConfigs } from './api/blueprints/config'
import { ShowStyleVariants, createShowStyleCompound } from '../lib/collections/ShowStyleVariants'
import { syncFunction } from './codeControl'
const PackageInfo = require('../package.json')
const BlueprintIntegrationPackageInfo = require('../node_modules/tv-automation-sofie-blueprints-integration/package.json')
import Agent from 'meteor/kschingiz:meteor-elastic-apm'
import { profiler } from './api/profiler'

export { PackageInfo }

function initializeCoreSystem() {
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
			serviceMessages: {},
			apm: {
				enabled: false,
				transactionSampleRate: -1,
			},
		})

		// Check what migration has to provide:
		let migration = prepareMigration(true)
		if (migration.migrationNeeded && migration.manualStepCount === 0 && migration.chunks.length <= 1) {
			// Since we've determined that the migration can be done automatically, and we have a fresh system, just do the migration automatically:
			runMigration(migration.chunks, migration.hash, [])
		}
	}

	// Monitor database changes:
	let systemCursor = getCoreSystemCursor()
	systemCursor.observeChanges({
		added: checkDatabaseVersions,
		changed: checkDatabaseVersions,
		removed: checkDatabaseVersions,
	})

	const observeBlueprintChanges = () => {
		checkDatabaseVersions()
		queueCheckBlueprintsConfig()
	}

	const blueprintsCursor = Blueprints.find({})
	blueprintsCursor.observeChanges({
		added: observeBlueprintChanges,
		changed: observeBlueprintChanges,
		removed: observeBlueprintChanges,
	})

	const studiosCursor = Studios.find({})
	studiosCursor.observeChanges({
		added: queueCheckBlueprintsConfig,
		changed: queueCheckBlueprintsConfig,
		removed: queueCheckBlueprintsConfig,
	})

	const showStyleBaseCursor = ShowStyleBases.find({})
	showStyleBaseCursor.observeChanges({
		added: queueCheckBlueprintsConfig,
		changed: queueCheckBlueprintsConfig,
		removed: queueCheckBlueprintsConfig,
	})

	const showStyleVariantCursor = ShowStyleVariants.find({})
	showStyleVariantCursor.observeChanges({
		added: queueCheckBlueprintsConfig,
		changed: queueCheckBlueprintsConfig,
		removed: queueCheckBlueprintsConfig,
	})

	checkDatabaseVersions()
}

let lastDatabaseVersionBlueprintIds: { [id: string]: true } = {}
function checkDatabaseVersions() {
	// Core system

	let databaseSystem = getCoreSystem()
	if (!databaseSystem) {
		setSystemStatus('databaseVersion', { statusCode: StatusCode.BAD, messages: ['Database not set up'] })
	} else {
		let dbVersion = databaseSystem.version ? parseVersion(databaseSystem.version) : null
		let currentVersion = parseVersion(CURRENT_SYSTEM_VERSION)

		setSystemStatus(
			'databaseVersion',
			checkDatabaseVersion(currentVersion, dbVersion, 'to fix, run migration', 'core', 'system database')
		)

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
					messages: [],
				}

				let studioIds: { [studioId: string]: true } = {}
				ShowStyleBases.find({
					blueprintId: blueprint._id,
				}).forEach((showStyleBase) => {
					if (o.statusCode === StatusCode.GOOD) {
						o = checkDatabaseVersion(
							blueprint.blueprintVersion ? parseVersion(blueprint.blueprintVersion) : null,
							parseRange(
								blueprint.databaseVersion.showStyle[unprotectString(showStyleBase._id)] || '0.0.0'
							),
							'to fix, run migration',
							'blueprint.blueprintVersion',
							`databaseVersion.showStyle[${showStyleBase._id}]`
						)
					}

					// TODO - is this correct for the current relationships? What about studio blueprints?
					Studios.find({
						supportedShowStyleBase: showStyleBase._id,
					}).forEach((studio) => {
						if (!studioIds[unprotectString(studio._id)]) {
							// only run once per blueprint and studio
							studioIds[unprotectString(studio._id)] = true

							if (o.statusCode === StatusCode.GOOD) {
								o = checkDatabaseVersion(
									blueprint.blueprintVersion ? parseVersion(blueprint.blueprintVersion) : null,
									parseRange(
										blueprint.databaseVersion.studio[unprotectString(studio._id)] || '0.0.0'
									),
									'to fix, run migration',
									'blueprint.blueprintVersion',
									`databaseVersion.studio[${studio._id}]`
								)
							}
						}
					})
				})

				checkBlueprintCompability(blueprint)
			}
		})
		_.each(lastDatabaseVersionBlueprintIds, (_val, id: string) => {
			if (!blueprintIds[id]) {
				removeSystemStatus('blueprintVersion_' + id)
			}
		})
		lastDatabaseVersionBlueprintIds = blueprintIds
	}
}
/**
 * Compares two versions and returns a system Status
 * @param currentVersion
 * @param dbVersion
 */
function checkDatabaseVersion(
	currentVersion: Version | null,
	expectVersion: VersionRange | null,
	fixMessage: string,
	meName: string,
	theyName: string
): { statusCode: StatusCode; messages: string[] } {
	if (currentVersion) currentVersion = semver.clean(currentVersion)

	if (expectVersion) {
		if (currentVersion) {
			if (semver.satisfies(currentVersion, expectVersion)) {
				return {
					statusCode: StatusCode.GOOD,
					messages: [`${meName} version: ${currentVersion}`],
				}
			} else {
				const currentV = new semver.SemVer(currentVersion, { includePrerelease: true })

				try {
					const expectV = new semver.SemVer(stripVersion(expectVersion), { includePrerelease: true })

					const message =
						`Version mismatch: ${meName} version: "${currentVersion}" does not satisfy expected version of ${theyName}: "${expectVersion}"` +
						(fixMessage ? ` (${fixMessage})` : '')

					if (!expectV || !currentV) {
						return {
							statusCode: StatusCode.BAD,
							messages: [message],
						}
					} else if (expectV.major !== currentV.major) {
						return {
							statusCode: StatusCode.BAD,
							messages: [message],
						}
					} else if (expectV.minor !== currentV.minor) {
						return {
							statusCode: StatusCode.WARNING_MAJOR,
							messages: [message],
						}
					} else if (expectV.patch !== currentV.patch) {
						return {
							statusCode: StatusCode.WARNING_MINOR,
							messages: [message],
						}
					} else if (!_.isEqual(expectV.prerelease, currentV.prerelease)) {
						return {
							statusCode: StatusCode.WARNING_MINOR,
							messages: [message],
						}
					} else {
						return {
							statusCode: StatusCode.BAD,
							messages: [message],
						}
					}
					// the expectedVersion may be a proper range, in which case the new semver.SemVer will throw an error, even though the semver.satisfies check would work.
				} catch (e) {
					const message =
						`Version mismatch: ${meName} version: "${currentVersion}" does not satisfy expected version range of ${theyName}: "${expectVersion}"` +
						(fixMessage ? ` (${fixMessage})` : '')

					return {
						statusCode: StatusCode.BAD,
						messages: [message],
					}
				}
			}
		} else {
			return {
				statusCode: StatusCode.FATAL,
				messages: [`Current ${meName} version missing (when comparing with ${theyName})`],
			}
		}
	} else {
		return {
			statusCode: StatusCode.FATAL,
			messages: [`Expected ${theyName} version missing (when comparing with ${meName})`],
		}
	}
}

function checkBlueprintCompability(blueprint: Blueprint) {
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
	let coreStatus:
		| {
				statusCode: StatusCode
				messages: string[]
		  }
		| undefined = undefined
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
	} else {
		setSystemStatus(systemStatusId, {
			statusCode: StatusCode.GOOD,
			messages: ['Versions match'],
		})
	}
}

let checkBlueprintsConfigTimeout: number | undefined
function queueCheckBlueprintsConfig() {
	const RATE_LIMIT = 10000

	// We want to rate limit this. It doesn't matter if it is delayed, so lets do that to keep it simple
	if (!checkBlueprintsConfigTimeout) {
		checkBlueprintsConfigTimeout = Meteor.setTimeout(() => {
			checkBlueprintsConfigTimeout = undefined

			checkBlueprintsConfig()
		}, RATE_LIMIT)
	}
}

let lastBlueprintConfigIds: { [id: string]: true } = {}
const checkBlueprintsConfig = syncFunction(function checkBlueprintsConfig() {
	let blueprintIds: { [id: string]: true } = {}

	// Studios
	_.each(Studios.find({}).fetch(), (studio) => {
		const blueprint = Blueprints.findOne(studio.blueprintId)
		if (!blueprint) return

		const diff = findMissingConfigs(blueprint.studioConfigManifest, studio.blueprintConfig)
		const systemStatusId = `blueprintConfig_${blueprint._id}_studio_${studio._id}`
		setBlueprintConfigStatus(systemStatusId, diff, studio._id)
		blueprintIds[systemStatusId] = true
	})

	// ShowStyles
	_.each(ShowStyleBases.find({}).fetch(), (showBase) => {
		const blueprint = Blueprints.findOne(showBase.blueprintId)
		if (!blueprint || !blueprint.showStyleConfigManifest) return

		const variants = ShowStyleVariants.find({
			showStyleBaseId: showBase._id,
		}).fetch()

		const allDiffs: string[] = []

		_.each(variants, (variant) => {
			const compound = createShowStyleCompound(showBase, variant)
			if (!compound) return

			const diff = findMissingConfigs(blueprint.showStyleConfigManifest, compound.blueprintConfig)
			if (diff && diff.length) {
				allDiffs.push(`Variant ${variant._id}: ${diff.join(', ')}`)
			}
		})
		const systemStatusId = `blueprintConfig_${blueprint._id}_showStyle_${showBase._id}`
		setBlueprintConfigStatus(systemStatusId, allDiffs)
		blueprintIds[systemStatusId] = true
	})

	// Check for removed
	_.each(lastBlueprintConfigIds, (_val, id: string) => {
		if (!blueprintIds[id]) {
			removeSystemStatus(id)
		}
	})
	lastBlueprintConfigIds = blueprintIds
}, 'checkBlueprintsConfig')
function setBlueprintConfigStatus(systemStatusId: string, diff: string[], studioId?: StudioId) {
	if (diff && diff.length > 0) {
		setSystemStatus(systemStatusId, {
			studioId: studioId,
			statusCode: StatusCode.WARNING_MAJOR,
			messages: [`Config is missing required fields: ${diff.join(', ')}`],
		})
	} else {
		setSystemStatus(systemStatusId, {
			studioId: studioId,
			statusCode: StatusCode.GOOD,
			messages: ['Config is valid'],
		})
	}
}

export function getRelevantSystemVersions(): { [name: string]: string } {
	const versions: { [name: string]: string } = {}

	let dependencies: any = PackageInfo.dependencies
	if (dependencies) {
		let names = _.keys(dependencies)
		// Omit system libraries
		let omitNames = [
			'@babel/runtime',
			'@fortawesome/fontawesome',
			'@fortawesome/free-solid-svg-icons',
			'@fortawesome/fontawesome-free-solid',
			'@fortawesome/fontawesome-svg-core',
			'@fortawesome/react-fontawesome',
			'@nrk/core-icons',
			'@popperjs/core',
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
			'concurrently',
			'core-js',
			'element-resize-event',
			'fast-clone',
			'html-entities',
			'i18next',
			'i18next-browser-languagedetector',
			'i18next-xhr-backend',
			'immutability-helper',
			'indexof',
			'lottie-web',
			'meteor-node-stubs',
			'moment',
			'mousetrap',
			'ntp-client',
			'object-path',
			'prop-types',
			'query-string',
			'rc-tooltip',
			'react',
			'react-circular-progressbar',
			'react-contextmenu',
			'react-datepicker',
			'react-dom',
			'react-escape',
			'react-hotkeys',
			'react-i18next',
			'react-intersection-observer',
			'@crello/react-lottie',
			'react-dnd',
			'react-dnd-html5-backend',
			'react-moment',
			'react-router-dom',
			'react-timer-hoc',
			'react-popper',
			'vm2',
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

		let sanitizeVersion = (v) => {
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
		versions['timeline-state-resolver-types'] =
			BlueprintIntegrationPackageInfo.dependencies['timeline-state-resolver-types']
	} else logger.error(`Core package dependencies missing`)
	return versions
}
function startupMessage() {
	if (!Meteor.isTest) {
		console.log('process started') // This is a message all Sofie processes log upon startup

		logger.info(`Core starting up`)
		logger.info(`Core system version: "${CURRENT_SYSTEM_VERSION}"`)

		logger.info(`Core package version: "${PackageInfo.versionExtended || PackageInfo.version}"`)

		// @ts-ignore
		if (global.gc) {
			logger.info(`Manual garbage-collection is enabled`)
		} else {
			logger.warn(
				`Enable garbage-collection by passing --expose_gc to node in prod or set SERVER_NODE_OPTIONS=--expose_gc in dev`
			)
		}

		const versions = getRelevantSystemVersions()
		_.each(versions, (version, name) => {
			logger.info(`Core package ${name} version: "${version}"`)
		})
	}
}

function startInstrumenting() {
	// attempt init elastic APM
	const system = getCoreSystem()
	const { APM_HOST, APM_SECRET, KIBANA_INDEX, APP_HOST } = process.env

	if (APM_HOST && system && system.apm) {
		logger.info(`APM agent starting up`)
		Agent.start({
			serviceName: KIBANA_INDEX || 'tv-automation-server-core',
			hostname: APP_HOST,
			serverUrl: APM_HOST,
			secretToken: APM_SECRET,
			active: system.apm.enabled,
			transactionSampleRate: system.apm.transactionSampleRate,
			disableMeteorInstrumentations: ['methods', 'http-out', 'session', 'async', 'metrics'],
		})
		profiler.setActive(system.apm.enabled || false)
	} else {
		logger.info(`APM agent inactive`)
		Agent.start({
			serviceName: 'tv-automation-server-core',
			active: false,
			disableMeteorInstrumentations: ['methods', 'http-out', 'session', 'async', 'metrics'],
		})
	}
}

Meteor.startup(() => {
	if (Meteor.isServer) {
		startupMessage()
		initializeCoreSystem()
		startInstrumenting()
	}
})
