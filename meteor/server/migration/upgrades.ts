import { BlueprintManifestType, IConfigMessage } from '@sofie-automation/blueprints-integration'
import { BlueprintId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { GetUpgradeStatusResult, GetUpgradeStatusResultStudio } from '../../lib/api/migration'
import { Blueprint, Blueprints } from '../../lib/collections/Blueprints'
import { Studio, Studios } from '../../lib/collections/Studios'
import { generateTranslation } from '../../lib/lib'
import { profiler } from '../api/profiler'
import { QueueStudioJob } from '../worker/worker'

export async function getUpgradeStatus(): Promise<GetUpgradeStatusResult> {
	const studioUpgrades = await checkStudiosUpgradeStatus()

	return {
		studios: studioUpgrades,
		showStyleBases: [],
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
	const studioBlueprintsMap = normalizeArrayToMap(studioBlueprints, '_id')
	for (const studio of studios) {
		result.push({
			...checkStudioUpgradeStatus(studioBlueprintsMap, studio),
			studioId: studio._id,
			name: studio.name,
		})
	}

	return result
}

type StudioForUpgradeCheck = Pick<
	Studio,
	'_id' | 'blueprintId' | 'blueprintConfigPresetId' | 'lastBlueprintConfig' | 'blueprintConfigWithOverrides' | 'name'
>
type BlueprintForUpgradeCheck = Pick<Blueprint, '_id' | 'configPresets' | 'blueprintHash'>

function checkStudioUpgradeStatus(
	studioBlueprintsMap: Map<BlueprintId, BlueprintForUpgradeCheck>,
	studio: StudioForUpgradeCheck
): Pick<GetUpgradeStatusResultStudio, 'pendingUpgrade' | 'invalidReason'> {
	// Check the blueprintId is valid
	const blueprint = studio.blueprintId ? studioBlueprintsMap.get(studio.blueprintId) : null
	if (!blueprint || !blueprint.configPresets) {
		// Studio blueprint is missing/invalid
		return {
			invalidReason: generateTranslation('Invalid blueprint: "{{blueprintId}}"', {
				blueprintId: studio.blueprintId,
			}),
			pendingUpgrade: false,
		}
	}

	// Check the blueprintConfigPresetId is valid
	const configPreset = studio.blueprintConfigPresetId
		? blueprint.configPresets[studio.blueprintConfigPresetId]
		: undefined
	if (!configPreset) {
		return {
			invalidReason: generateTranslation(
				'Invalid config preset for blueprint: "{{configPresetId}}" ({{blueprintId}})',
				{
					configPresetId: studio.blueprintConfigPresetId,
					blueprintId: studio.blueprintId,
				}
			),
			pendingUpgrade: false,
		}
	}

	// Some basic property checks
	let hasPendingUpdate =
		!studio.lastBlueprintConfig ||
		studio.lastBlueprintConfig.blueprintId !== blueprint._id ||
		studio.lastBlueprintConfig.blueprintHash !== blueprint.blueprintHash

	if (!hasPendingUpdate && studio.lastBlueprintConfig) {
		// Check if the config blob has changed since last run
		const newConfig = applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj
		const oldConfig = studio.lastBlueprintConfig.config
		hasPendingUpdate = !_.isEqual(newConfig, oldConfig)
	}

	return {
		pendingUpgrade: hasPendingUpdate,
	}
}

export async function verifyConfigForStudio(studioId: StudioId): Promise<IConfigMessage[]> {
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
