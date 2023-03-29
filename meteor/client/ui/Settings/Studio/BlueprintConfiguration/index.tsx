import React, { useCallback, useMemo } from 'react'
import { useTracker } from '../../../../lib/ReactMeteorData/react-meteor-data'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { BlueprintConfigSchemaSettings } from '../../BlueprintConfigSchema'
import {
	applyAndValidateOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Blueprints, Studios } from '../../../../collections'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { useTranslation } from 'react-i18next'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { SelectConfigPreset } from './SelectConfigPreset'
import { SelectBlueprint } from './SelectBlueprint'

interface StudioBlueprintConfigurationSettingsProps {
	studio: DBStudio
}

export function StudioBlueprintConfigurationSettings(props: StudioBlueprintConfigurationSettingsProps): JSX.Element {
	const { t } = useTranslation()

	const blueprint = useTracker(() => {
		return props.studio.blueprintId
			? Blueprints.findOne({
					_id: props.studio.blueprintId,
					blueprintType: BlueprintManifestType.STUDIO,
			  })
			: undefined
	}, [props.studio.blueprintId])
	const configSchema = useMemo(
		() => (blueprint?.studioConfigSchema ? JSONBlobParse(blueprint.studioConfigSchema) : undefined),
		[blueprint?.studioConfigSchema]
	)
	const translationNamespaces = useMemo(() => ['blueprint_' + props.studio.blueprintId], [props.studio.blueprintId])

	const layerMappings = useMemo(() => {
		return {
			[props.studio.name]: applyAndValidateOverrides(props.studio.mappingsWithOverrides).obj,
		}
	}, [props.studio.name, props.studio.mappingsWithOverrides])

	const saveBlueprintConfigOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(props.studio._id, {
				$set: {
					'blueprintConfigWithOverrides.overrides': newOps,
				},
			})
		},
		[props.studio._id]
	)

	return (
		<>
			<h2 className="mhn">{t('Blueprint Configuration')}</h2>

			<SelectBlueprint studio={props.studio} />
			<SelectConfigPreset studio={props.studio} blueprint={blueprint} />

			<BlueprintConfigSchemaSettings
				schema={configSchema}
				translationNamespaces={translationNamespaces}
				layerMappings={layerMappings}
				configObject={props.studio.blueprintConfigWithOverrides}
				saveOverrides={saveBlueprintConfigOverrides}
				alternateConfig={undefined}
			/>
		</>
	)
}
