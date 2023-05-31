import React from 'react'
import { TFunction } from 'react-i18next'
import { GUISetting, GUISettingSection, GUISettingsType, guiSettingId } from '../../guiSettings'
import { Studio } from '../../../../../lib/collections/Studios'
import { Blueprints, Studios } from '../../../../collections'
import { SelectBlueprint } from './SelectBlueprint'
import { SelectConfigPreset } from './SelectConfigPreset'
import { getBlueprintConfigSchemaGuiSettings } from '../../BlueprintConfigSchema'
import { JSONBlobParse } from '@sofie-automation/blueprints-integration'
import {
	applyAndValidateOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'

export function blueprintProperties(t: TFunction, studio: Studio, urlBase: string): (GUISetting | GUISettingSection)[] {
	const settings: (GUISetting | GUISettingSection)[] = []

	// const editAttributeProps = getDefaultEditAttributeProps(studio)

	const selectedBlueprint = Blueprints.findOne({
		_id: studio.blueprintId,
	})

	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Select blueprint'),
		// description: t('Name of the studio'),
		id: guiSettingId(urlBase, 'blueprintId'),
		getWarning: () => {
			if (!studio.blueprintId) return t('No Blueprint assigned to studio')
			if (!selectedBlueprint) return t('Assigned Blueprint not found')
			return undefined
		},
		render: () => <SelectBlueprint t={t} studio={studio} />,
		getSearchString: '',
	})

	if (selectedBlueprint) {
		settings.push({
			type: GUISettingsType.SETTING,
			name: t('Blueprint config preset'),
			// description: t('Name of the studio'),
			id: guiSettingId(urlBase, 'blueprint-config-preset'),
			getWarning: () => {
				if (!studio.blueprintConfigPresetId) return t('Blueprint config preset not set')
				if (studio.blueprintConfigPresetIdUnlinked) return t('Blueprint config preset is missing')
				return undefined
			},
			render: () => <SelectConfigPreset t={t} studio={studio} blueprint={selectedBlueprint} />,
			getSearchString: '',
		})

		settings.push({
			type: GUISettingsType.SECTION,
			name: t('Blueprint settings'),
			// description: t('Name of the studio'),
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
		// settings.push({
		// 	type: GUISettingsType.SETTING,
		// 	name: t('Blueprint settings'),
		// 	// description: t('Name of the studio'),
		// 	id: guiSettingId(urlBase, 'blueprint-settings'),
		// 	// getWarning: () => {
		// 	// 	return undefined
		// 	// },
		// 	render: () => <BlueprintSettings t={t} studio={studio}/>,
		// 	getSearchString: '',
		// })
	}

	return settings
}
function getBlueprintSettings(
	t: TFunction,
	studio: Studio,
	urlBase: string,
	blueprint: Blueprint
): (GUISetting | GUISettingSection)[] {
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
