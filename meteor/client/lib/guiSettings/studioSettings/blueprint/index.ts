import { TFunction } from 'react-i18next'
import { GUISetting, GUISettingSection, GUISettingsType, guiSettingId } from '../../guiSettings'
import { Studio } from '../../../../../lib/collections/Studios'
import { Blueprints, Studios } from '../../../../collections'
import { getSettingSelectBlueprint } from './SelectBlueprint'
import { getSelectConfigPreset as getSettingSelectConfigPreset } from './SelectConfigPreset'
import { getBlueprintConfigSchemaGuiSettings } from '../../BlueprintConfigSchema'
import { JSONBlobParse } from '@sofie-automation/blueprints-integration'
import {
	applyAndValidateOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'

export function blueprintProperties(props: {
	t: TFunction
	studio: Studio
	urlBase: string
}): (GUISetting<any> | GUISettingSection)[] {
	const settings: (GUISetting<any> | GUISettingSection)[] = []

	const { t, studio, urlBase } = props

	// const editAttributeProps = getDefaultEditAttributeProps(studio)

	const selectedBlueprint = Blueprints.findOne({
		_id: studio.blueprintId,
	})

	settings.push(getSettingSelectBlueprint({ ...props, selectedBlueprint }))

	if (selectedBlueprint) {
		settings.push(getSettingSelectConfigPreset({ ...props, selectedBlueprint }))

		settings.push({
			type: GUISettingsType.SECTION,
			name: t('Blueprint settings'),
			id: guiSettingId(urlBase, 'blueprint-settings'),
			// getWarning: () => {
			// 	if (!studio.blueprintConfigPresetId) return t('Blueprint config preset not set')
			// 	if (studio.blueprintConfigPresetIdUnlinked) return t('Blueprint config preset is missing')
			// 	return undefined
			// },
			getList: () => getBlueprintSettings(t, studio, urlBase, selectedBlueprint),
			getSearchString: '',
			renderSummary: () => null,
		})
	}

	return settings
}
function getBlueprintSettings(
	t: TFunction,
	studio: Studio,
	urlBase: string,
	blueprint: Blueprint
): (GUISetting<any> | GUISettingSection)[] {
	const configSchema = blueprint.studioConfigSchema ? JSONBlobParse(blueprint.studioConfigSchema) : undefined
	const translationNamespaces = ['blueprint_' + studio.blueprintId]
	const layerMappings = {
		[studio.name]: applyAndValidateOverrides(studio.mappingsWithOverrides).obj,
	}
	const saveBlueprintConfigOverrides = (newOps: SomeObjectOverrideOp[]) => {
		Studios.update(studio._id, {
			$set: {
				'blueprintConfigWithOverrides.overrides': newOps,
			},
		})
	}

	return getBlueprintConfigSchemaGuiSettings({
		t,
		urlBase,
		schema: configSchema,
		translationNamespaces,
		layerMappings,
		configObject: studio.blueprintConfigWithOverrides,
		saveOverrides: saveBlueprintConfigOverrides,
		alternateConfig: undefined,
	})
}
