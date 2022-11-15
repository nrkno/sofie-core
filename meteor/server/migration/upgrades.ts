import {
	BlueprintConfigCoreConfig,
	BlueprintManifestType,
	ICommonContext,
	NoteSeverity,
	ShowStyleBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { BlueprintId, ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	assertNever,
	getHash,
	getSofieHostUrl,
	normalizeArray,
	normalizeArrayToMap,
} from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { BlueprintValidateConfigForStudioResult, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import {
	GetUpgradeStatusResult,
	GetUpgradeStatusResultShowStyleBase,
	GetUpgradeStatusResultStudio,
} from '../../lib/api/migration'
import { Blueprint, Blueprints } from '../../lib/collections/Blueprints'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Studio, Studios } from '../../lib/collections/Studios'
import { generateTranslation } from '../../lib/lib'
import { evalBlueprint } from '../api/blueprints/cache'
import { profiler } from '../api/profiler'
import { logger } from '../logging'
import { QueueStudioJob } from '../worker/worker'

export async function getUpgradeStatus(): Promise<GetUpgradeStatusResult> {
	const studioUpgrades = await checkStudiosUpgradeStatus()
	const showStyleUpgrades = await checkShowStyleBaseUpgradeStatus()

	return {
		studios: studioUpgrades,
		showStyleBases: showStyleUpgrades,
	}
}

async function checkStudiosUpgradeStatus(): Promise<GetUpgradeStatusResultStudio[]> {
	const result: GetUpgradeStatusResultStudio[] = []

	const studios = (await Studios.findFetchAsync(
		{},
		{
			projection: {
				_id: 1,
				blueprintId: 1,
				blueprintConfigPresetId: 1,
				lastBlueprintConfig: 1,
				blueprintConfigWithOverrides: 1,
				name: 1,
			},
		}
	)) as Array<StudioForUpgradeCheck>

	const studioBlueprints = (await Blueprints.findFetchAsync(
		{
			blueprintType: BlueprintManifestType.STUDIO,
			_id: { $in: _.compact(studios.map((st) => st.blueprintId)) },
		},
		{
			projection: {
				_id: 1,
				configPresets: 1,
				blueprintHash: 1,
			},
		}
	)) as Array<BlueprintForUpgradeCheck>

	// Check each studio
	const blueprintsMap = normalizeArrayToMap(studioBlueprints, '_id')
	for (const studio of studios) {
		result.push({
			...checkDocUpgradeStatus(blueprintsMap, studio),
			studioId: studio._id,
			name: studio.name,
		})
	}

	return result
}

async function checkShowStyleBaseUpgradeStatus(): Promise<GetUpgradeStatusResultShowStyleBase[]> {
	const result: GetUpgradeStatusResultShowStyleBase[] = []

	const showStyles = (await ShowStyleBases.findFetchAsync(
		{},
		{
			projection: {
				_id: 1,
				blueprintId: 1,
				blueprintConfigPresetId: 1,
				lastBlueprintConfig: 1,
				blueprintConfigWithOverrides: 1,
				name: 1,
			},
		}
	)) as Array<ShowStyleBaseForUpgradeCheck>

	const showStyleBlueprints = (await Blueprints.findFetchAsync(
		{
			blueprintType: BlueprintManifestType.SHOWSTYLE,
			_id: { $in: _.compact(showStyles.map((st) => st.blueprintId)) },
		},
		{
			projection: {
				_id: 1,
				configPresets: 1,
				blueprintHash: 1,
			},
		}
	)) as Array<BlueprintForUpgradeCheck>

	// Check each studio
	const blueprintsMap = normalizeArrayToMap(showStyleBlueprints, '_id')
	for (const showStyle of showStyles) {
		result.push({
			...checkDocUpgradeStatus(blueprintsMap, showStyle),
			showStyleBaseId: showStyle._id,
			name: showStyle.name,
		})
	}

	return result
}

type StudioForUpgradeCheck = Pick<
	Studio,
	'_id' | 'blueprintId' | 'blueprintConfigPresetId' | 'lastBlueprintConfig' | 'blueprintConfigWithOverrides' | 'name'
>
type ShowStyleBaseForUpgradeCheck = Pick<
	ShowStyleBase,
	'_id' | 'blueprintId' | 'blueprintConfigPresetId' | 'lastBlueprintConfig' | 'blueprintConfigWithOverrides' | 'name'
>
type BlueprintForUpgradeCheck = Pick<Blueprint, '_id' | 'configPresets' | 'blueprintHash'>

function checkDocUpgradeStatus(
	blueprintMap: Map<BlueprintId, BlueprintForUpgradeCheck>,
	doc: StudioForUpgradeCheck | ShowStyleBaseForUpgradeCheck
): Pick<GetUpgradeStatusResultStudio, 'pendingUpgrade' | 'invalidReason'> {
	// Check the blueprintId is valid
	const blueprint = doc.blueprintId ? blueprintMap.get(doc.blueprintId) : null
	if (!blueprint || !blueprint.configPresets) {
		// Studio blueprint is missing/invalid
		return {
			invalidReason: generateTranslation('Invalid blueprint: "{{blueprintId}}"', {
				blueprintId: doc.blueprintId,
			}),
			pendingUpgrade: false,
		}
	}

	// Check the blueprintConfigPresetId is valid
	const configPreset = doc.blueprintConfigPresetId ? blueprint.configPresets[doc.blueprintConfigPresetId] : undefined
	if (!configPreset) {
		return {
			invalidReason: generateTranslation(
				'Invalid config preset for blueprint: "{{configPresetId}}" ({{blueprintId}})',
				{
					configPresetId: doc.blueprintConfigPresetId,
					blueprintId: doc.blueprintId,
				}
			),
			pendingUpgrade: false,
		}
	}

	// Some basic property checks
	let hasPendingUpdate =
		!doc.lastBlueprintConfig ||
		doc.lastBlueprintConfig.blueprintId !== doc.blueprintId ||
		doc.lastBlueprintConfig.blueprintConfigPresetId !== doc.blueprintConfigPresetId ||
		doc.lastBlueprintConfig.blueprintHash !== blueprint.blueprintHash

	if (!hasPendingUpdate && doc.lastBlueprintConfig) {
		// Check if the config blob has changed since last run
		const newConfig = applyAndValidateOverrides(doc.blueprintConfigWithOverrides).obj
		const oldConfig = doc.lastBlueprintConfig.config
		hasPendingUpdate = !_.isEqual(newConfig, oldConfig)
	}

	return {
		pendingUpgrade: hasPendingUpdate,
	}
}

export async function validateConfigForStudio(studioId: StudioId): Promise<BlueprintValidateConfigForStudioResult> {
	const studio = (await Studios.findOneAsync(studioId, {
		projection: {
			_id: 1,
		},
	})) as Pick<Studio, '_id'> | undefined
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)

	const queuedJob = await QueueStudioJob(StudioJobs.BlueprintValidateConfigForStudio, studioId, undefined)

	const span = profiler.startSpan('queued-job')
	try {
		const res = await queuedJob.complete
		// explicitly await before returning
		return res
	} finally {
		span?.end()
	}
}

export async function runUpgradeForStudio(studioId: StudioId): Promise<void> {
	const studio = (await Studios.findOneAsync(studioId, {
		projection: {
			_id: 1,
		},
	})) as Pick<Studio, '_id'> | undefined
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)

	const queuedJob = await QueueStudioJob(StudioJobs.BlueprintUpgradeForStudio, studioId, undefined)

	const span = profiler.startSpan('queued-job')
	try {
		const res = await queuedJob.complete
		// explicitly await before returning
		return res
	} finally {
		span?.end()
	}
}

export async function validateConfigForShowStyleBase(
	showStyleBaseId: ShowStyleBaseId
): Promise<BlueprintValidateConfigForStudioResult> {
	const showStyleBase = (await ShowStyleBases.findOneAsync(showStyleBaseId, {
		projection: {
			_id: 1,
			blueprintId: 1,
			blueprintConfigPresetId: 1,
			blueprintConfigWithOverrides: 1,
		},
	})) as
		| Pick<ShowStyleBase, '_id' | 'blueprintId' | 'blueprintConfigPresetId' | 'blueprintConfigWithOverrides'>
		| undefined
	if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${showStyleBaseId}" not found!`)

	if (!showStyleBase.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	const blueprint = showStyleBase.blueprintId
		? await Blueprints.findOneAsync({
				_id: showStyleBase.blueprintId,
				blueprintType: BlueprintManifestType.SHOWSTYLE,
		  })
		: undefined
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${showStyleBase.blueprintId}" not found!`)

	if (!blueprint.blueprintHash) throw new Error('Blueprint is not valid')

	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest

	if (typeof blueprintManifest.validateConfig !== 'function')
		throw new Error('Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'applyConfig',
		`showStyleBase:${showStyleBaseId},blueprint:${blueprint.blueprintId}`
	)
	const rawBlueprintConfig = applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj

	const messages = blueprintManifest.validateConfig(blueprintContext, rawBlueprintConfig)

	return {
		messages: messages.map((msg) => ({
			level: msg.level,
			message: wrapTranslatableMessageFromBlueprints(msg.message, [blueprint.blueprintId]),
		})),
	}
}

export async function runUpgradeForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void> {
	const showStyleBase = (await ShowStyleBases.findOneAsync(showStyleBaseId, {
		projection: {
			_id: 1,
			blueprintId: 1,
			blueprintConfigPresetId: 1,
			blueprintConfigWithOverrides: 1,
		},
	})) as
		| Pick<ShowStyleBase, '_id' | 'blueprintId' | 'blueprintConfigPresetId' | 'blueprintConfigWithOverrides'>
		| undefined
	if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${showStyleBaseId}" not found!`)

	if (!showStyleBase.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	const blueprint = showStyleBase.blueprintId
		? await Blueprints.findOneAsync({
				_id: showStyleBase.blueprintId,
				blueprintType: BlueprintManifestType.SHOWSTYLE,
		  })
		: undefined
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${showStyleBase.blueprintId}" not found!`)

	if (!blueprint.blueprintHash) throw new Error('Blueprint is not valid')

	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest

	if (typeof blueprintManifest.applyConfig !== 'function')
		throw new Error('Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'applyConfig',
		`showStyleBase:${showStyleBaseId},blueprint:${blueprint.blueprintId}`
	)
	const rawBlueprintConfig = applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj

	const result = blueprintManifest.applyConfig(blueprintContext, rawBlueprintConfig, compileCoreConfigValues())

	await ShowStyleBases.updateAsync(showStyleBaseId, {
		$set: {
			'sourceLayersWithOverrides.defaults': normalizeArray(result.sourceLayers, '_id'),
			'outputLayersWithOverrides.defaults': normalizeArray(result.outputLayers, '_id'),
			lastBlueprintConfig: {
				blueprintHash: blueprint.blueprintHash,
				blueprintId: blueprint.blueprintId,
				blueprintConfigPresetId: showStyleBase.blueprintConfigPresetId,
				config: rawBlueprintConfig,
			},
		},
	})

	// TODO - triggered actions
}

/** TODO - below is copied from job-worker */

function compileCoreConfigValues(): BlueprintConfigCoreConfig {
	return {
		hostUrl: getSofieHostUrl(),
	}
}

class CommonContext implements ICommonContext {
	private readonly _contextIdentifier: string
	private readonly _contextName: string

	private hashI = 0
	private hashed: { [hash: string]: string } = {}

	constructor(name: string, identifier: string) {
		this._contextIdentifier = identifier
		this._contextName = name
	}
	getHashId(str: string, isNotUnique?: boolean): string {
		if (!str) str = 'hash' + this.hashI++

		if (isNotUnique) {
			str = str + '_' + this.hashI++
		}

		const id = getHash(this._contextIdentifier + '_' + str.toString())
		this.hashed[id] = str
		return id
	}
	unhashId(hash: string): string {
		return this.hashed[hash] || hash
	}

	logDebug(message: string): void {
		logger.debug(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logInfo(message: string): void {
		logger.info(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logWarning(message: string): void {
		logger.warn(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logError(message: string): void {
		logger.error(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	protected logNote(message: string, type: NoteSeverity): void {
		if (type === NoteSeverity.ERROR) {
			this.logError(message)
		} else if (type === NoteSeverity.WARNING) {
			this.logWarning(message)
		} else if (type === NoteSeverity.INFO) {
			this.logInfo(message)
		} else {
			assertNever(type)
			this.logDebug(message)
		}
	}
}
