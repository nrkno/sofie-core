import {
	BlueprintConfigCoreConfig,
	BlueprintManifestType,
	ConfigManifestEntry,
	ICommonContext,
	IShowStyleConfigPreset,
	IStudioConfigPreset,
	ITranslatableMessage,
	NoteSeverity,
	ShowStyleBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { BlueprintHash } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BlueprintId, ShowStyleBaseId, StudioId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	assertNever,
	Complete,
	getHash,
	getRandomId,
	getSofieHostUrl,
	literal,
	normalizeArray,
	normalizeArrayToMap,
	objectPathGet,
} from '@sofie-automation/corelib/dist/lib'
import {
	applyAndValidateOverrides,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
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
import { DBTriggeredActions, TriggeredActions } from '../../lib/collections/TriggeredActions'
import { generateTranslation } from '../../lib/lib'
import { evalBlueprint } from '../api/blueprints/cache'
import { profiler } from '../api/profiler'
import { logger } from '../logging'
import { QueueStudioJob } from '../worker/worker'
import type { AnyBulkWriteOperation } from 'mongodb'

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
				studioConfigPresets: 1,
				studioConfigManifest: 1,
				blueprintHash: 1,
			},
		}
	)) as Array<StudioBlueprintForUpgradeCheck>

	// Check each studio
	const blueprintsMap = normalizeArrayToMap(
		studioBlueprints.map((doc) =>
			literal<BlueprintMapEntry>({
				_id: doc._id,
				configPresets: doc.studioConfigPresets,
				configManifest: doc.studioConfigManifest,
				blueprintHash: doc.blueprintHash,
			})
		),
		'_id'
	)
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
				showStyleConfigPresets: 1,
				showStyleConfigManifest: 1,
				blueprintHash: 1,
			},
		}
	)) as Array<ShowStyleBlueprintForUpgradeCheck>

	// Check each studio
	const blueprintsMap = normalizeArrayToMap(
		showStyleBlueprints.map((doc) =>
			literal<BlueprintMapEntry>({
				_id: doc._id,
				configPresets: doc.showStyleConfigPresets,
				configManifest: doc.showStyleConfigManifest,
				blueprintHash: doc.blueprintHash,
			})
		),
		'_id'
	)
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
type StudioBlueprintForUpgradeCheck = Pick<
	Blueprint,
	'_id' | 'studioConfigPresets' | 'studioConfigManifest' | 'blueprintHash'
>
type ShowStyleBlueprintForUpgradeCheck = Pick<
	Blueprint,
	'_id' | 'showStyleConfigPresets' | 'showStyleConfigManifest' | 'blueprintHash'
>

interface BlueprintMapEntry {
	_id: BlueprintId
	configPresets: Record<string, IStudioConfigPreset> | Record<string, IShowStyleConfigPreset> | undefined
	configManifest: ConfigManifestEntry[] | undefined
	blueprintHash: BlueprintHash | undefined
}

function checkDocUpgradeStatus(
	blueprintMap: Map<BlueprintId, BlueprintMapEntry>,
	doc: StudioForUpgradeCheck | ShowStyleBaseForUpgradeCheck
): Pick<GetUpgradeStatusResultStudio, 'invalidReason' | 'changes'> {
	// Check the blueprintId is valid
	const blueprint = doc.blueprintId ? blueprintMap.get(doc.blueprintId) : null
	if (!blueprint || !blueprint.configPresets) {
		// Studio blueprint is missing/invalid
		return {
			invalidReason: generateTranslation('Invalid blueprint: "{{blueprintId}}"', {
				blueprintId: doc.blueprintId,
			}),
			changes: [],
		}
	}

	// Check the blueprintConfigPresetId is valid
	const configPreset = doc.blueprintConfigPresetId ? blueprint.configPresets[doc.blueprintConfigPresetId] : undefined
	if (!configPreset) {
		return {
			invalidReason: generateTranslation(
				'Invalid config preset for blueprint: "{{configPresetId}}" ({{blueprintId}})',
				{
					configPresetId: doc.blueprintConfigPresetId ?? '',
					blueprintId: doc.blueprintId,
				}
			),
			changes: [],
		}
	}

	const changes: ITranslatableMessage[] = []

	// Some basic property checks
	if (!doc.lastBlueprintConfig) {
		changes.push(generateTranslation('Config has not been applied before'))
	} else if (doc.lastBlueprintConfig.blueprintId !== doc.blueprintId) {
		changes.push(
			generateTranslation('Blueprint has been changed. From "{{ oldValue }}", to "{{ newValue }}"', {
				oldValue: doc.lastBlueprintConfig.blueprintId,
				newValue: doc.blueprintId,
			})
		)
	} else if (doc.lastBlueprintConfig.blueprintConfigPresetId !== doc.blueprintConfigPresetId) {
		changes.push(
			generateTranslation(
				'Blueprint config preset has been changed. From "{{ oldValue }}", to "{{ newValue }}"',
				{
					oldValue: doc.lastBlueprintConfig.blueprintConfigPresetId,
					newValue: doc.blueprintConfigPresetId,
				}
			)
		)
	} else if (doc.lastBlueprintConfig.blueprintHash !== blueprint.blueprintHash) {
		changes.push(generateTranslation('Blueprint has a new version'))
	}

	if (doc.lastBlueprintConfig) {
		// Check if the config blob has changed since last run
		const newConfig = applyAndValidateOverrides(doc.blueprintConfigWithOverrides).obj
		const oldConfig = doc.lastBlueprintConfig.config

		// Do a simple check, in case we miss the change when comparing the manifest properties
		if (!_.isEqual(newConfig, oldConfig)) {
			changes.push(generateTranslation('Blueprint config has changed'))

			// also do a deeper diff
			if (blueprint.configManifest) {
				for (const entry of blueprint.configManifest) {
					const oldValue = objectPathGet(oldConfig, entry.id)
					const newValue = objectPathGet(newConfig, entry.id)

					if (!_.isEqual(newValue, oldValue)) {
						changes.push(
							generateTranslation(
								'Config value "{{ name }}" has changed. From "{{ oldValue }}", to "{{ newValue }}"',
								{
									name: entry.name,
									oldValue,
									newValue,
								}
							)
						)
					}
				}
			}
		}
	}

	return {
		changes,
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
		`showStyleBase:${showStyleBaseId},blueprint:${blueprint._id}`
	)
	const rawBlueprintConfig = applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj

	const messages = blueprintManifest.validateConfig(blueprintContext, rawBlueprintConfig)

	return {
		messages: messages.map((msg) => ({
			level: msg.level,
			message: wrapTranslatableMessageFromBlueprints(msg.message, [blueprint._id]),
		})),
	}
}

export async function runUpgradeForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void> {
	logger.info(`Running upgrade for ShowStyleBase "${showStyleBaseId}"`)

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
				blueprintId: blueprint._id,
				blueprintConfigPresetId: showStyleBase.blueprintConfigPresetId,
				config: rawBlueprintConfig,
			},
		},
	})

	const oldTriggeredActionsArray = await TriggeredActions.findFetchAsync({
		showStyleBaseId: showStyleBaseId,
		blueprintUniqueId: { $ne: null },
	})
	const oldTriggeredActions = normalizeArrayToMap(oldTriggeredActionsArray, 'blueprintUniqueId')

	const newDocIds: TriggeredActionId[] = []
	const bulkOps: AnyBulkWriteOperation<DBTriggeredActions>[] = []

	for (const newTriggeredAction of result.triggeredActions) {
		const oldValue = oldTriggeredActions.get(newTriggeredAction._id)
		if (oldValue) {
			// Update an existing TriggeredAction
			newDocIds.push(oldValue._id)
			bulkOps.push({
				updateOne: {
					filter: {
						_id: oldValue._id,
					},
					update: {
						$set: {
							_rank: newTriggeredAction._rank,
							name: newTriggeredAction.name,
							'triggersWithOverrides.defaults': newTriggeredAction.triggers,
							'actionsWithOverrides.defaults': newTriggeredAction.actions,
						},
					},
				},
			})
		} else {
			// Insert a new TriggeredAction
			const newDocId = getRandomId<TriggeredActionId>()
			newDocIds.push(newDocId)
			bulkOps.push({
				insertOne: {
					document: literal<Complete<DBTriggeredActions>>({
						_id: newDocId,
						_rank: newTriggeredAction._rank,
						name: newTriggeredAction.name,
						showStyleBaseId: showStyleBaseId,
						blueprintUniqueId: newTriggeredAction._id,
						triggersWithOverrides: wrapDefaultObject(newTriggeredAction.triggers),
						actionsWithOverrides: wrapDefaultObject(newTriggeredAction.actions),
						_rundownVersionHash: '',
					}),
				},
			})
		}
	}

	// Remove any removed TriggeredAction
	// Future: should this orphan them or something? Will that cause issues if they get re-added?
	bulkOps.push({
		deleteMany: {
			filter: {
				showStyleBaseId: showStyleBaseId,
				blueprintUniqueId: { $ne: null },
				_id: { $nin: newDocIds },
			},
		},
	})

	await TriggeredActions.bulkWriteAsync(bulkOps)
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
