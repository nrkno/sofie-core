import { StatusCode } from '@sofie-automation/blueprints-integration'
import { BlueprintId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { Blueprint } from '../../lib/collections/Blueprints'
import { Blueprints, ShowStyleBases, Studios } from '../collections'
import {
	parseVersion,
	compareSemverVersions,
	parseRange,
	isPrerelease,
	parseCoreIntegrationCompatabilityRange,
} from '../../lib/collections/CoreSystem'
import { ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { Studio } from '../../lib/collections/Studios'
import { lazyIgnore } from '../../lib/lib'
import { logger } from '../logging'
import { CURRENT_SYSTEM_VERSION } from '../migration/currentSystemVersion'
import { setSystemStatus, removeSystemStatus } from '../systemStatus/systemStatus'
import { getCoreSystemAsync } from './collection'

const PackageInfo = require('../../package.json')
const integrationVersionRange = parseCoreIntegrationCompatabilityRange(PackageInfo.version)
const integrationVersionAllowPrerelease = isPrerelease(PackageInfo.version)

function getBlueprintCompatabilityMessageId(id: BlueprintId) {
	return `blueprintCompability_${id}`
}

const MESSAGE_KEY_DATABASE_VERSION = 'databaseVersion'

let lastDatabaseVersionBlueprintIds = new Set<BlueprintId>()
export function checkDatabaseVersions(): void {
	lazyIgnore(
		'coreSystem.checkDatabaseVersions',
		async () => {
			// Core system
			logger.debug('checkDatabaseVersions...')

			const databaseSystem = await getCoreSystemAsync()
			if (!databaseSystem) {
				setSystemStatus(MESSAGE_KEY_DATABASE_VERSION, {
					statusCode: StatusCode.BAD,
					messages: ['Database not set up'],
				})
			} else {
				const dbVersion = parseVersion(databaseSystem.version)
				const currentVersion = parseVersion(CURRENT_SYSTEM_VERSION)

				setSystemStatus(
					MESSAGE_KEY_DATABASE_VERSION,
					compareSemverVersions(
						currentVersion,
						dbVersion,
						false,
						'to fix, run migration',
						'core',
						'system database'
					)
				)

				// Blueprints:
				const blueprintIds = new Set<BlueprintId>()
				const blueprints = (await Blueprints.findFetchAsync(
					{},
					{
						fields: {
							_id: 1,
							blueprintVersion: 1,
							databaseVersion: 1,
							hasCode: 1,
							disableVersionChecks: 1,
							integrationVersion: 1,
						},
					}
				)) as Array<
					Pick<
						Blueprint,
						| '_id'
						| 'blueprintVersion'
						| 'databaseVersion'
						| 'hasCode'
						| 'disableVersionChecks'
						| 'integrationVersion'
					>
				>

				for (const blueprint of blueprints) {
					if (blueprint.hasCode) {
						blueprintIds.add(blueprint._id)

						if (!blueprint.databaseVersion || typeof blueprint.databaseVersion === 'string')
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

						const checkedStudioIds = new Set<StudioId>()

						const showStylesForBlueprint = (await ShowStyleBases.findFetchAsync(
							{ blueprintId: blueprint._id },
							{
								fields: { _id: 1 },
							}
						)) as Array<Pick<ShowStyleBase, '_id'>>
						for (const showStyleBase of showStylesForBlueprint) {
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

							const studiosForShowStyleBase = (await Studios.findFetchAsync(
								{ supportedShowStyleBase: showStyleBase._id },
								{
									fields: { _id: 1 },
								}
							)) as Array<Pick<Studio, '_id'>>
							for (const studio of studiosForShowStyleBase) {
								if (!checkedStudioIds.has(studio._id)) {
									// only run once per blueprint and studio
									checkedStudioIds.add(studio._id)

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
							}
						}

						checkBlueprintCompability(blueprint)
					}
				}

				// Ensure old blueprints are removed
				for (const id of lastDatabaseVersionBlueprintIds) {
					if (blueprintIds.has(id)) {
						removeSystemStatus(getBlueprintCompatabilityMessageId(id))
					}
				}
				lastDatabaseVersionBlueprintIds = blueprintIds
			}
			logger.debug('checkDatabaseVersions done!')
		},
		100
	)
}

function checkBlueprintCompability(blueprint: Pick<Blueprint, '_id' | 'disableVersionChecks' | 'integrationVersion'>) {
	const systemStatusId = getBlueprintCompatabilityMessageId(blueprint._id)

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
