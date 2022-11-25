import {
	getCoreSystem,
	CoreSystem,
	SYSTEM_ID,
	getCoreSystemCursor,
	parseVersion,
	GENESIS_SYSTEM_VERSION,
} from '../../lib/collections/CoreSystem'
import { getCurrentTime, waitForPromise, waitForPromiseAll } from '../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { prepareMigration, runMigration } from '../migration/databaseMigration'
import { CURRENT_SYSTEM_VERSION } from '../migration/currentSystemVersion'
import { Blueprints } from '../../lib/collections/Blueprints'
import * as _ from 'underscore'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Studios } from '../../lib/collections/Studios'
import { getEnvLogLevel, logger, LogLevel, setLogLevel } from '../logging'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
const PackageInfo = require('../../package.json')
// import Agent from 'meteor/kschingiz:meteor-elastic-apm'
// import { profiler } from './api/profiler'
import { TMP_TSR_VERSION } from '@sofie-automation/blueprints-integration'
import { getAbsolutePath } from '../lib'
import * as fs from 'fs/promises'
import path from 'path'
import { queueCheckBlueprintsConfig } from './checkBlueprintsConfig'
import { checkDatabaseVersions } from './checkDatabaseVersions'

export { PackageInfo }

/** Get the store path used to be used for storing snapshots  */
export function getSystemStorePath(): string {
	if (isRunningInJest()) {
		// Override the variable when invoked through Jest
		return '/dev/null'
	}

	const storePath = process.env.SOFIE_STORE_PATH
	if (storePath) return path.resolve(storePath)

	if (Meteor.isDevelopment) {
		// For development, fallback to inside the .meteor folder
		return getAbsolutePath() + '/.meteor/local/sofie-store'
	}

	throw new Meteor.Error(500, 'SOFIE_STORE_PATH must be defined to launch Sofie')
}

export function isRunningInJest(): boolean {
	return !!process.env.JEST_WORKER_ID
}

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

		if (!isRunningInJest()) {
			// Check what migration has to provide:
			const migration = prepareMigration(true)
			if (migration.migrationNeeded && migration.manualStepCount === 0 && migration.chunks.length <= 1) {
				// Since we've determined that the migration can be done automatically, and we have a fresh system, just do the migration automatically:
				runMigration(migration.chunks, migration.hash, [])
			}
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

function onCoreSystemChanged() {
	checkDatabaseVersions()
	updateLoggerLevel(false)
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

		// @ts-expect-error Its not always defined
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
		setLogLevel(coreSystem.logLevel ?? getEnvLogLevel() ?? LogLevel.SILLY, startup)
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

		if (!isRunningInJest()) {
			// Ensure the storepath exists
			const storePath = getSystemStorePath()
			logger.info(`Using storePath: ${storePath}`)
			waitForPromise(fs.mkdir(storePath, { recursive: true }))
		}
	}
})
