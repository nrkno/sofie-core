import { BlueprintManifestType, StatusCode } from '@sofie-automation/blueprints-integration'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Blueprint, Blueprints } from '../../lib/collections/Blueprints'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { Studio, Studios } from '../../lib/collections/Studios'
import { lazyIgnore } from '../../lib/lib'
import { findMissingConfigs } from '../api/blueprints/config'
import { createBlueprintConfigCompound } from '../api/showStyles'
import { logger } from '../logging'
import { removeSystemStatus, setSystemStatus } from '../systemStatus/systemStatus'

let checkBlueprintsConfigRunning = false
export function queueCheckBlueprintsConfig() {
	const RATE_LIMIT = 10000

	// We want to rate limit this. It doesn't matter if it is delayed, so lets do that to keep it simple
	lazyIgnore('coreSystem.checkBlueprintsConfig', checkBlueprintsConfig, RATE_LIMIT)
}

let lastUpdatedSystemStatusIds = new Set<string>()
async function checkBlueprintsConfig() {
	if (checkBlueprintsConfigRunning) {
		// already running, queue for later
		queueCheckBlueprintsConfig()
		return
	}
	checkBlueprintsConfigRunning = true

	logger.debug('checkBlueprintsConfig start')

	try {
		const updateSystemStatusIds = new Set<string>()

		// Future: these checks are not useful for blueprints which are the new flow
		await Promise.all([
			checkStudioBlueprintConfigs(updateSystemStatusIds),
			checkShowStyleBlueprintConfigs(updateSystemStatusIds),
		])

		// Check for removed
		for (const id of lastUpdatedSystemStatusIds) {
			if (!updateSystemStatusIds.has(id)) {
				removeSystemStatus(id)
			}
		}
		lastUpdatedSystemStatusIds = updateSystemStatusIds
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

async function checkStudioBlueprintConfigs(updateSystemStatusIds: Set<string>) {
	const studios = (await Studios.findFetchAsync(
		{ blueprintId: { $exists: true } },
		{
			fields: {
				_id: 1,
				blueprintId: 1,
				blueprintConfigWithOverrides: 1,
			},
		}
	)) as Array<Pick<Studio, '_id' | 'blueprintId' | 'blueprintConfigWithOverrides'>>

	for (const studio of studios) {
		if (!studio.blueprintId) return

		const blueprint = (await Blueprints.findOneAsync(
			{
				_id: studio.blueprintId,
				blueprintType: BlueprintManifestType.SHOWSTYLE,
			},
			{
				fields: {
					_id: 1,
					studioConfigManifest: 1,
				},
			}
		)) as Pick<Blueprint, '_id' | 'studioConfigManifest'>
		if (!blueprint || !blueprint.studioConfigManifest) return

		const blueprintConfig = applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj
		const diff = findMissingConfigs(blueprint.studioConfigManifest, blueprintConfig)

		const systemStatusId = `blueprintConfig_${blueprint._id}_studio_${studio._id}`
		setBlueprintConfigStatus(systemStatusId, diff, studio._id)
		updateSystemStatusIds.add(systemStatusId)
	}
}

async function checkShowStyleBlueprintConfigs(updateSystemStatusIds: Set<string>) {
	const showStyleBases = (await ShowStyleBases.findFetchAsync(
		{ blueprintId: { $exists: true } },
		{
			fields: {
				_id: 1,
				blueprintId: 1,
				blueprintConfigWithOverrides: 1,
			},
		}
	)) as Array<Pick<ShowStyleBase, '_id' | 'blueprintId' | 'blueprintConfigWithOverrides'>>

	for (const showStyleBase of showStyleBases) {
		if (!showStyleBase.blueprintId) continue

		const blueprint = (await Blueprints.findOneAsync(
			{
				_id: showStyleBase.blueprintId,
				blueprintType: BlueprintManifestType.SHOWSTYLE,
			},
			{
				fields: {
					_id: 1,
					showStyleConfigManifest: 1,
				},
			}
		)) as Pick<Blueprint, '_id' | 'showStyleConfigManifest'>
		if (!blueprint || !blueprint.showStyleConfigManifest) return

		const variants = (await ShowStyleVariants.findFetchAsync(
			{ showStyleBaseId: showStyleBase._id },
			{
				fields: {
					_id: 1,
					blueprintConfigWithOverrides: 1,
				},
			}
		)) as Array<Pick<ShowStyleVariant, '_id' | 'blueprintConfigWithOverrides'>>

		const allDiffs: string[] = []

		for (const variant of variants) {
			const compoundConfig = createBlueprintConfigCompound(
				showStyleBase.blueprintConfigWithOverrides,
				variant.blueprintConfigWithOverrides
			)

			const diff = findMissingConfigs(blueprint.showStyleConfigManifest, compoundConfig)
			if (diff && diff.length) {
				allDiffs.push(`Variant ${variant._id}: ${diff.join(', ')}`)
			}
		}

		const systemStatusId = `blueprintConfig_${blueprint._id}_showStyle_${showStyleBase._id}`
		setBlueprintConfigStatus(systemStatusId, allDiffs)
		updateSystemStatusIds[systemStatusId] = true
	}
}
