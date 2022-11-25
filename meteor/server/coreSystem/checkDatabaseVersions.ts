import { StatusCode } from '@sofie-automation/blueprints-integration'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import _ from 'underscore'
import { Blueprint, Blueprints } from '../../lib/collections/Blueprints'
import {
	getCoreSystem,
	parseVersion,
	compareSemverVersions,
	parseRange,
	isPrerelease,
	parseCoreIntegrationCompatabilityRange,
} from '../../lib/collections/CoreSystem'
import { fetchShowStyleBasesLight } from '../../lib/collections/optimizations'
import { Studios, Studio } from '../../lib/collections/Studios'
import { waitForPromise } from '../../lib/lib'
import { logger } from '../logging'
import { CURRENT_SYSTEM_VERSION } from '../migration/currentSystemVersion'
import { setSystemStatus, removeSystemStatus } from '../systemStatus/systemStatus'

const PackageInfo = require('../../package.json')
const integrationVersionRange = parseCoreIntegrationCompatabilityRange(PackageInfo.version)
const integrationVersionAllowPrerelease = isPrerelease(PackageInfo.version)

let lastDatabaseVersionBlueprintIds: { [id: string]: true } = {}
export function checkDatabaseVersions() {
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

				if (!blueprint.databaseVersion || _.isString(blueprint.databaseVersion))
					blueprint.databaseVersion = { showStyle: {}, studio: {}, system: undefined }
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
				waitForPromise(
					fetchShowStyleBasesLight({
						blueprintId: blueprint._id,
					})
				).forEach((showStyleBase) => {
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
					Studios.find(
						{ supportedShowStyleBase: showStyleBase._id },
						{
							fields: { _id: 1 },
						}
					).forEach((studio: Pick<Studio, '_id'>) => {
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
