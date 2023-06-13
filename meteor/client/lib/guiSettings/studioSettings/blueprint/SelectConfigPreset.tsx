import React, { useMemo } from 'react'
import { TFunction } from 'react-i18next'
import { DBStudio, Studio } from '../../../../../lib/collections/Studios'
import { EditAttribute } from '../../../EditAttribute'
import { Studios } from '../../../../collections'
import { IStudioConfigPreset } from '@sofie-automation/blueprints-integration'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { GUISetting, GUISettingsType, guiSetting, guiSettingId } from '../../guiSettings'

export function getSelectConfigPreset(props: {
	t: TFunction
	studio: Studio
	urlBase: string
	selectedBlueprint: Blueprint
}): GUISetting<any> {
	const { t, studio, urlBase, selectedBlueprint } = props

	return guiSetting({
		type: GUISettingsType.SETTING,
		name: t('Blueprint config preset'),
		// description: t('Name of the studio'),
		id: guiSettingId(urlBase, 'blueprint-config-preset'),
		getWarning: () => {
			if (!studio.blueprintConfigPresetId) return t('Blueprint config preset not set')
			if (studio.blueprintConfigPresetIdUnlinked) return t('Blueprint config preset is missing')
			return undefined
		},
		render: SelectConfigPreset,
		renderProps: { t, studio, blueprint: selectedBlueprint },
		getSearchString: '',
	})
}
export const SelectConfigPreset: React.FC<{ t: TFunction; studio: DBStudio; blueprint: Blueprint }> = ({
	studio,
	blueprint,
}) => {
	const configPresetOptions = useMemo(() => {
		const options: { name: string; value: string | null }[] = []

		if (blueprint.studioConfigPresets) {
			if (blueprint.studioConfigPresets) {
				for (const [id, preset] of Object.entries<IStudioConfigPreset>(blueprint.studioConfigPresets)) {
					options.push({
						value: id,
						name: preset.name,
					})
				}
			}
		}

		return options
	}, [blueprint?.studioConfigPresets])

	return (
		<>
			<EditAttribute
				modifiedClassName="bghl"
				attribute="blueprintConfigPresetId"
				obj={studio}
				type="dropdown"
				options={configPresetOptions}
				mutateDisplayValue={(v) => v || ''}
				mutateUpdateValue={(v) => (v === '' ? undefined : v)}
				collection={Studios}
				className="input text-input input-l"
			/>
		</>
	)
}
