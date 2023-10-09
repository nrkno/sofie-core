import React, { useCallback, useMemo } from 'react'
import { JSONSchema } from '@sofie-automation/blueprints-integration'
import { BlueprintConfigSchemaSettings } from '../../BlueprintConfigSchema'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBases } from '../../../../collections'
import { useTranslation } from 'react-i18next'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBShowStyleBase, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { SelectConfigPreset } from './SelectConfigPreset'
import { SelectBlueprint } from './SelectBlueprint'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PubSub } from '../../../../../lib/api/pubsub'
import { useSubscription, useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { UIBlueprintUpgradeStatuses } from '../../../Collections'
import { getUpgradeStatusMessage, UpgradeStatusButtons } from '../../Upgrades/Components'

interface ShowStyleBaseBlueprintConfigurationSettingsProps {
	showStyleBase: DBShowStyleBase

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

			<BlueprintUpgradeStatus showStyleBaseId={props.showStyleBase._id} />

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

interface BlueprintUpgradeStatusProps {
	showStyleBaseId: ShowStyleBaseId
}

function BlueprintUpgradeStatus({ showStyleBaseId }: BlueprintUpgradeStatusProps): JSX.Element {
	const { t } = useTranslation()

	const isReady = useSubscription(PubSub.uiBlueprintUpgradeStatuses)

	const status = useTracker(
		() =>
			UIBlueprintUpgradeStatuses.findOne({
				documentId: showStyleBaseId,
				documentType: 'showStyle',
			}),
		[showStyleBaseId]
	)

	const statusMessage = isReady && status ? getUpgradeStatusMessage(t, status) ?? t('OK') : t('Loading...')

	console.log(statusMessage, status)

	return (
		<p>
			{t('Upgrade Status')}: {statusMessage}
			{status && <UpgradeStatusButtons upgradeResult={status} />}
		</p>
	)
}
