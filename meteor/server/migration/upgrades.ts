import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { BlueprintId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
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
import { profiler } from '../api/profiler'
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
	// const studio = (await Studios.findOneAsync(studioId, {
	// 	projection: {
	// 		_id: 1,
	// 	},
	// })) as Pick<Studio, '_id'> | undefined
	// if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)
	// const queuedJob = await QueueStudioJob(StudioJobs.BlueprintValidateConfigForStudio, studioId, undefined)
	// const span = profiler.startSpan('queued-job')
	// try {
	// 	const res = await queuedJob.complete
	// 	// explicitly await before returning
	// 	return res
	// } finally {
	// 	span?.end()
	// }
	throw new Error('Not implemented!')
}

export async function runUpgradeForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void> {
	// const studio = (await Studios.findOneAsync(studioId, {
	// 	projection: {
	// 		_id: 1,
	// 	},
	// })) as Pick<Studio, '_id'> | undefined
	// if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)
	// const queuedJob = await QueueStudioJob(StudioJobs.BlueprintUpgradeForStudio, studioId, undefined)
	// const span = profiler.startSpan('queued-job')
	// try {
	// 	const res = await queuedJob.complete
	// 	// explicitly await before returning
	// 	return res
	// } finally {
	// 	span?.end()
	// }
	throw new Error('Not implemented!')
}
