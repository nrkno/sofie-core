import React, { useCallback, useMemo } from 'react'
import { JSONSchema } from '@sofie-automation/blueprints-integration'
import { BlueprintConfigSchemaSettings } from '../../BlueprintConfigSchema'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBases } from '../../../../collections'
import { useTranslation } from 'react-i18next'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ShowStyleBase, SourceLayers } from '../../../../../lib/collections/ShowStyleBases'
import { SelectConfigPreset } from './SelectConfigPreset'
import { SelectBlueprint } from './SelectBlueprint'

interface ShowStyleBaseBlueprintConfigurationSettingsProps {
	showStyleBase: ShowStyleBase

	schema: JSONSchema | undefined

	layerMappings: { [studioId: string]: MappingsExt } | undefined
	sourceLayers: SourceLayers | undefined
}

export function ShowStyleBaseBlueprintConfigurationSettings(
	props: ShowStyleBaseBlueprintConfigurationSettingsProps
): JSX.Element {
	const { t } = useTranslation()

	const translationNamespaces = useMemo(
		() => ['blueprint_' + props.showStyleBase.blueprintId],
		[props.showStyleBase.blueprintId]
	)

	const saveBlueprintConfigOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			ShowStyleBases.update(props.showStyleBase._id, {
				$set: {
					'blueprintConfigWithOverrides.overrides': newOps,
				},
			})
		},
		[props.showStyleBase._id]
	)

	return (
		<>
			<h2 className="mhn">{t('Blueprint Configuration')}</h2>

			<SelectBlueprint showStyleBase={props.showStyleBase} />
			<SelectConfigPreset showStyleBase={props.showStyleBase} />

			<BlueprintConfigSchemaSettings
				schema={props.schema}
				translationNamespaces={translationNamespaces}
				layerMappings={props.layerMappings}
				sourceLayers={props.sourceLayers}
				configObject={props.showStyleBase.blueprintConfigWithOverrides}
				saveOverrides={saveBlueprintConfigOverrides}
				alternateConfig={undefined}
			/>
		</>
	)
}
