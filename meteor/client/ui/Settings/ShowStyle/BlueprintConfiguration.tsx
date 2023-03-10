import React, { useCallback, useMemo } from 'react'
import { useTracker } from '../../../lib/ReactMeteorData/react-meteor-data'
import { BlueprintManifestType, JSONSchema } from '@sofie-automation/blueprints-integration'
import { BlueprintConfigSchemaSettings, SourceLayerDropdownOption } from '../BlueprintConfigSchema'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Blueprints, ShowStyleBases } from '../../../collections'
import { useTranslation } from 'react-i18next'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { EditAttribute } from '../../../lib/EditAttribute'
import { RedirectToBlueprintButton } from '../../../lib/SettingsNavigation'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'

interface ShowStyleBaseBlueprintConfigurationSettingsProps {
	showStyleBase: ShowStyleBase

	schema: JSONSchema | undefined

	layerMappings: { [studioId: string]: MappingsExt } | undefined
	sourceLayers: Array<SourceLayerDropdownOption> | undefined
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

interface SelectBlueprintProps {
	showStyleBase: ShowStyleBase
}
function SelectBlueprint({ showStyleBase }: SelectBlueprintProps) {
	const { t } = useTranslation()

	const allShowStyleBlueprints = useTracker(() => {
		return Blueprints.find({
			blueprintType: BlueprintManifestType.SHOWSTYLE,
		}).fetch()
	}, [])
	const blueprintOptions: { name: string; value: BlueprintId | null }[] = useMemo(() => {
		if (allShowStyleBlueprints) {
			return allShowStyleBlueprints.map((blueprint) => {
				return {
					name: blueprint.name ? blueprint.name + ` (${blueprint._id})` : unprotectString(blueprint._id),
					value: blueprint._id,
				}
			})
		} else {
			return []
		}
	}, [allShowStyleBlueprints])

	return (
		<div className="mod mvs mhs">
			<label className="field">
				{t('Blueprint')}
				{!showStyleBase.blueprintId ? (
					<div className="error-notice inline">
						{t('Blueprint not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				) : null}

				<EditAttribute
					modifiedClassName="bghl"
					attribute="blueprintId"
					obj={showStyleBase}
					type="dropdown"
					options={blueprintOptions}
					collection={ShowStyleBases}
					className="input text-input input-l"
				/>
				<RedirectToBlueprintButton id={showStyleBase.blueprintId} />
			</label>
		</div>
	)
}

interface SelectConfigPresetProps {
	showStyleBase: ShowStyleBase
}
function SelectConfigPreset({ showStyleBase }: SelectConfigPresetProps) {
	const { t } = useTranslation()

	const blueprint = useTracker(() => {
		return showStyleBase.blueprintId
			? Blueprints.findOne({
					_id: showStyleBase.blueprintId,
					blueprintType: BlueprintManifestType.SHOWSTYLE,
			  })
			: undefined
	}, [showStyleBase.blueprintId])

	const configPresetOptions = useMemo(() => {
		const options: { name: string; value: string | null }[] = []

		if (blueprint?.showStyleConfigPresets) {
			if (blueprint.showStyleConfigPresets) {
				for (const [id, preset] of Object.entries(blueprint.showStyleConfigPresets)) {
					options.push({
						value: id,
						name: preset.name,
					})
				}
			}
		}

		return options
	}, [blueprint?.showStyleConfigPresets])

	return (
		<div className="mod mvs mhs">
			<label className="field">
				{t('Blueprint config preset')}
				{!showStyleBase.blueprintConfigPresetId && (
					<div className="error-notice inline">
						{t('Blueprint config preset not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				)}
				{showStyleBase.blueprintConfigPresetIdUnlinked && showStyleBase.blueprintConfigPresetId && (
					<div className="error-notice inline">
						{t('Blueprint config preset is missing')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				)}
				<EditAttribute
					modifiedClassName="bghl"
					attribute="blueprintConfigPresetId"
					obj={showStyleBase}
					type="dropdown"
					options={configPresetOptions}
					mutateDisplayValue={(v) => v || ''}
					mutateUpdateValue={(v) => (v === '' ? undefined : v)}
					collection={ShowStyleBases}
					className="input text-input input-l"
				/>
			</label>
		</div>
	)
}
