import React, { useCallback, useMemo } from 'react'
import { useTracker } from '../../../lib/ReactMeteorData/react-meteor-data'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { BlueprintConfigManifestSettings } from '../BlueprintConfigManifest'
import {
	applyAndValidateOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Blueprints, Studios } from '../../../collections'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { useTranslation } from 'react-i18next'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { EditAttribute } from '../../../lib/EditAttribute'
import { RedirectToBlueprintButton } from '../../../lib/SettingsNavigation'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'

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

			<BlueprintConfigManifestSettings
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

interface SelectBlueprintProps {
	studio: DBStudio
}
function SelectBlueprint({ studio }: SelectBlueprintProps) {
	const { t } = useTranslation()

	const allStudioBlueprints = useTracker(() => {
		return Blueprints.find({
			blueprintType: BlueprintManifestType.STUDIO,
		}).fetch()
	}, [])
	const blueprintOptions = useMemo(() => {
		const options: { name: string; value: BlueprintId | null }[] = [
			{
				name: t('None'),
				value: protectString(''),
			},
		]

		if (allStudioBlueprints) {
			options.push(
				...allStudioBlueprints.map((blueprint) => {
					return {
						name: blueprint.name ? blueprint.name + ` (${blueprint._id})` : unprotectString(blueprint._id),
						value: blueprint._id,
					}
				})
			)
		}

		return options
	}, [t, allStudioBlueprints])

	return (
		<div className="mod mvs mhs">
			<label className="field">
				{t('Blueprint')}
				{!studio.blueprintId ? (
					<div className="error-notice inline">
						{t('Blueprint not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				) : null}

				<EditAttribute
					modifiedClassName="bghl"
					attribute="blueprintId"
					obj={studio}
					type="dropdown"
					options={blueprintOptions}
					mutateDisplayValue={(v) => v || ''}
					mutateUpdateValue={(v) => (v === '' ? undefined : v)}
					collection={Studios}
					className="input text-input input-l"
				/>
				<RedirectToBlueprintButton id={studio.blueprintId} />
			</label>
		</div>
	)
}

interface SelectConfigPresetProps {
	studio: DBStudio
	blueprint: Blueprint | undefined
}
function SelectConfigPreset({ studio, blueprint }: SelectConfigPresetProps) {
	const { t } = useTranslation()

	const configPresetOptions = useMemo(() => {
		const options: { name: string; value: string | null }[] = []

		if (blueprint?.studioConfigPresets) {
			if (blueprint.studioConfigPresets) {
				for (const [id, preset] of Object.entries(blueprint.studioConfigPresets)) {
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
		<div className="mod mvs mhs">
			<label className="field">
				{t('Blueprint config preset')}
				{!studio.blueprintConfigPresetId && (
					<div className="error-notice inline">
						{t('Blueprint config preset not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				)}
				{studio.blueprintConfigPresetIdUnlinked && studio.blueprintConfigPresetId && (
					<div className="error-notice inline">
						{t('Blueprint config preset is missing')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				)}
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
			</label>
		</div>
	)
}
