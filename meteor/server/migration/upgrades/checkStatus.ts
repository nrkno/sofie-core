import {
	BlueprintManifestType,
	IStudioConfigPreset,
	IShowStyleConfigPreset,
	ConfigManifestEntry,
	ITranslatableMessage,
} from '@sofie-automation/blueprints-integration'
import { Blueprint, BlueprintHash } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { normalizeArrayToMap, literal, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import _ from 'underscore'
import {
	GetUpgradeStatusResult,
	GetUpgradeStatusResultStudio,
	GetUpgradeStatusResultShowStyleBase,
} from '../../../lib/api/migration'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { ShowStyleBases, ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { Studios, Studio } from '../../../lib/collections/Studios'
import { generateTranslation } from '../../../lib/lib'

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
			fields: {
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
			fields: {
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
			fields: {
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
			fields: {
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
				oldValue: doc.lastBlueprintConfig.blueprintId || '',
				newValue: doc.blueprintId || '',
			})
		)
	} else if (doc.lastBlueprintConfig.blueprintConfigPresetId !== doc.blueprintConfigPresetId) {
		changes.push(
			generateTranslation(
				'Blueprint config preset has been changed. From "{{ oldValue }}", to "{{ newValue }}"',
				{
					oldValue: doc.lastBlueprintConfig.blueprintConfigPresetId || '',
					newValue: doc.blueprintConfigPresetId || '',
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
									oldValue: oldValue ?? '',
									newValue: newValue ?? '',
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
