import {
	getCoreSystem,
	CoreSystem,
	SYSTEM_ID,
	getCoreSystemCursor,
	parseVersion,
	parseRange,
	GENESIS_SYSTEM_VERSION,
	parseCoreIntegrationCompatabilityRange,
	compareSemverVersions,
	isPrerelease,
} from '../lib/collections/CoreSystem'
import { getCurrentTime, unprotectString, waitForPromiseAll } from '../lib/lib'
import { Meteor } from 'meteor/meteor'
import { prepareMigration, runMigration } from './migration/databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './migration/currentSystemVersion'
import { setSystemStatus, removeSystemStatus } from './systemStatus/systemStatus'
import { Blueprints, Blueprint } from '../lib/collections/Blueprints'
import * as _ from 'underscore'
import { ShowStyleBases } from '../lib/collections/ShowStyleBases'
import { Studios, StudioId } from '../lib/collections/Studios'
import { logger, LogLevel, setLogLevel } from './logging'
import { findMissingConfigs } from './api/blueprints/config'
import { ShowStyleVariants } from '../lib/collections/ShowStyleVariants'
const PackageInfo = require('../package.json')
// import Agent from 'meteor/kschingiz:meteor-elastic-apm'
// import { profiler } from './api/profiler'
import { TMP_TSR_VERSION, StatusCode } from '@sofie-automation/blueprints-integration'
import { createShowStyleCompound } from './api/showStyles'
import { fetchShowStyleBasesLight, fetchStudiosLight } from '../lib/collections/optimizations'

export { PackageInfo }

function initializeCoreSystem() {
	const system = getCoreSystem()
	if (!system) {
		// At this point, we probably have a system that is as fresh as it gets

		const version = parseVersion(GENESIS_SYSTEM_VERSION)
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
			cron: {
				casparCGRestart: {
					enabled: true,
				},
			},
		})

		// Check what migration has to provide:
		const migration = prepareMigration(true)
		if (migration.migrationNeeded && migration.manualStepCount === 0 && migration.chunks.length <= 1) {
			// Since we've determined that the migration can be done automatically, and we have a fresh system, just do the migration automatically:
			runMigration(migration.chunks, migration.hash, [])
		}
	}

	// Monitor database changes:
	const systemCursor = getCoreSystemCursor()
	systemCursor.observeChanges({
		added: onCoreSystemChanged,
		changed: onCoreSystemChanged,
		removed: onCoreSystemChanged,
	})

	const observeBlueprintChanges = () => {
		checkDatabaseVersions()
		queueCheckBlueprintsConfig()
	}

	const blueprintsCursor = Blueprints.find({}, { fields: { code: 0 } })
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
	logger.debug('checkDatabaseVersions...')

	const databaseSystem = getCoreSystem()
	if (!databaseSystem) {
		setSystemStatus('databaseVersion', { statusCode: StatusCode.BAD, messages: ['Database not set up'] })
	} else {
		const dbVersion = parseVersion(databaseSystem.version)
		const currentVersion = parseVersion(CURRENT_SYSTEM_VERSION)

		setSystemStatus(
			'databaseVersion',
			compareSemverVersions(currentVersion, dbVersion, false, 'to fix, run migration', 'core', 'system database')
		)

		// Blueprints:
		const blueprintIds: { [id: string]: true } = {}
		Blueprints.find(
			{},
			{
				fields: {
					code: 0, // Optimization, reduce bandwidth because the .code property is large
				},
			}
		).forEach((blueprint) => {
			if (blueprint.hasCode) {
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

				const studioIds: { [studioId: string]: true } = {}
				fetchShowStyleBasesLight({
					blueprintId: blueprint._id,
				}).forEach((showStyleBase) => {
					if (o.statusCode === StatusCode.GOOD) {
						o = compareSemverVersions(
							parseVersion(blueprint.blueprintVersion),
							parseRange(blueprint.databaseVersion.showStyle[unprotectString(showStyleBase._id)]),
							false,
							'to fix, run migration',
							'blueprint version',
							`showStyle "${showStyleBase._id}" migrations`
						)
					}

					// TODO - is this correct for the current relationships? What about studio blueprints?
					fetchStudiosLight({
						supportedShowStyleBase: showStyleBase._id,
					}).forEach((studio) => {
						if (!studioIds[unprotectString(studio._id)]) {
							// only run once per blueprint and studio
							studioIds[unprotectString(studio._id)] = true

							if (o.statusCode === StatusCode.GOOD) {
								o = compareSemverVersions(
									parseVersion(blueprint.blueprintVersion),
									parseRange(blueprint.databaseVersion.studio[unprotectString(studio._id)]),
									false,
									'to fix, run migration',
									'blueprint version',
									`studio "${studio._id}]" migrations`
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
	logger.debug('checkDatabaseVersions done!')
}
function onCoreSystemChanged() {
	checkDatabaseVersions()
	updateLoggerLevel(false)
}

const integrationVersionRange = parseCoreIntegrationCompatabilityRange(PackageInfo.version)
const integrationVersionAllowPrerelease = isPrerelease(PackageInfo.version)

function checkBlueprintCompability(blueprint: Blueprint) {
	const systemStatusId = 'blueprintCompability_' + blueprint._id

	if (blueprint.disableVersionChecks) {
		setSystemStatus(systemStatusId, {
			statusCode: StatusCode.GOOD,
			messages: ['Version checks have been disabled'],
		})
	} else {
		const integrationStatus = compareSemverVersions(
			parseVersion(blueprint.integrationVersion),
			parseRange(integrationVersionRange),
			integrationVersionAllowPrerelease,
			'Blueprint has to be updated',
			'blueprint.integrationVersion',
			'@sofie-automation/blueprints-integration'
		)

		if (integrationStatus.statusCode >= StatusCode.WARNING_MAJOR) {
			integrationStatus.messages[0] = 'Integration version: ' + integrationStatus.messages[0]
			setSystemStatus(systemStatusId, integrationStatus)
		} else {
			setSystemStatus(systemStatusId, {
				statusCode: StatusCode.GOOD,
				messages: ['Versions match'],
			})
		}
	}
}

let checkBlueprintsConfigTimeout: number | undefined
let checkBlueprintsConfigRunning = false
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
function checkBlueprintsConfig() {
	if (checkBlueprintsConfigRunning) {
		// already running, queue for later
		queueCheckBlueprintsConfig()
		return
	}
	checkBlueprintsConfigRunning = true

	logger.debug('checkBlueprintsConfig start')

	try {
		const blueprintIds: { [id: string]: true } = {}

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
	} finally {
		checkBlueprintsConfigRunning = false

		logger.debug('checkBlueprintsConfig done!')
	}
}
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

let SYSTEM_VERSIONS: { [name: string]: string } | undefined
export function getRelevantSystemVersions(): { [name: string]: string } {
	if (SYSTEM_VERSIONS) {
		return SYSTEM_VERSIONS
	}
	const versions: { [name: string]: string } = {}

	const dependencies: any = PackageInfo.dependencies
	if (dependencies) {
		const libNames: string[] = ['mos-connection', 'superfly-timeline']

		const getRealVersion = async (name: string, fallback: string): Promise<string> => {
			try {
				const pkgInfo = require(name + '/package.json')
				return pkgInfo.version
			} catch (e) {
				logger.warn(`Failed to read version of package "${name}": ${e}`)
				return parseVersion(fallback)
			}
		}

		waitForPromiseAll([
			...libNames.map(async (name) => {
				versions[name] = await getRealVersion(name, dependencies[name])
			}),
		])
		versions['core'] = PackageInfo.versionExtended || PackageInfo.version // package version
		versions['timeline-state-resolver-types'] = TMP_TSR_VERSION
	} else {
		logger.error(`Core package dependencies missing`)
	}

	SYSTEM_VERSIONS = versions
	return versions
}
function startupMessage() {
	if (!Meteor.isTest) {
		console.log('process started') // This is a message all Sofie processes log upon startup

		logger.info(`Core starting up`)
		logger.info(`Core system version: "${CURRENT_SYSTEM_VERSION}"`)

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
	if (Meteor.isTest) {
		return
	}

	// attempt init elastic APM

	// Note: meteor-elastic-apm has been temporarily disabled due to being incompatible Meteor 2.3
	// See https://github.com/Meteor-Community-Packages/meteor-elastic-apm/pull/61
	//
	// const system = getCoreSystem()
	// const { APM_HOST, APM_SECRET, KIBANA_INDEX, APP_HOST } = process.env

	// if (APM_HOST && system && system.apm) {
	// 	logger.info(`APM agent starting up`)
	// 	Agent.start({
	// 		serviceName: KIBANA_INDEX || 'tv-automation-server-core',
	// 		hostname: APP_HOST,
	// 		serverUrl: APM_HOST,
	// 		secretToken: APM_SECRET,
	// 		active: system.apm.enabled,
	// 		transactionSampleRate: system.apm.transactionSampleRate,
	// 		disableMeteorInstrumentations: ['methods', 'http-out', 'session', 'async', 'metrics'],
	// 	})
	// 	profiler.setActive(system.apm.enabled || false)
	// } else {
	// 	logger.info(`APM agent inactive`)
	// 	Agent.start({
	// 		serviceName: 'tv-automation-server-core',
	// 		active: false,
	// 		disableMeteorInstrumentations: ['methods', 'http-out', 'session', 'async', 'metrics'],
	// 	})
	// }
}
function updateLoggerLevel(startup: boolean) {
	const coreSystem = getCoreSystem()

	if (coreSystem) {
		setLogLevel(coreSystem.logLevel || LogLevel.SILLY, startup)
	} else {
		logger.error('updateLoggerLevel: CoreSystem not found')
	}
}

Meteor.startup(() => {
	if (Meteor.isServer) {
		startupMessage()
		updateLoggerLevel(true)
		initializeCoreSystem()
		startInstrumenting()
	}
})
