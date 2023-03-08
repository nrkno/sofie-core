import React, { useCallback, useMemo } from 'react'
import { MappingsExt } from '../../../../lib/collections/Studios'
import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { literal } from '../../../../lib/lib'
import { useTranslation } from 'react-i18next'
import {
	applyAndValidateOverrides,
	ObjectWithOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useOverrideOpHelper, WrappedOverridableItemNormal } from '../util/OverrideOpHelper'
import { SourceLayerDropdownOption } from './resolveColumns'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { SchemaFormWithOverrides } from '../../../lib/forms/schemaFormWithOverrides'
import deepmerge from 'deepmerge'

export { SourceLayerDropdownOption }

interface IConfigManifestSettingsProps {
	schema: JSONSchema | undefined

	translationNamespaces: string[]

	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateConfig: IBlueprintConfig | undefined

	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: Array<SourceLayerDropdownOption>

	subPanel?: boolean

	configObject: ObjectWithOverrides<IBlueprintConfig>
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void
}

export function BlueprintConfigManifestSettings({
	schema,
	translationNamespaces,
	alternateConfig,
	// layerMappings,
	// sourceLayers,
	subPanel,

	configObject,
	saveOverrides,
}: IConfigManifestSettingsProps): JSX.Element {
	const { t } = useTranslation()

	const saveOverrides2 = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			saveOverrides(
				newOps.map((op) => ({
					...op,
					path: op.path.slice(2), // trim off 0.
				}))
			)
		},
		[saveOverrides]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides2, configObject)

	const wrappedItem = useMemo(() => {
		const configObject2: ObjectWithOverrides<IBlueprintConfig> = alternateConfig
			? {
					defaults: deepmerge<IBlueprintConfig>(alternateConfig, configObject.defaults, {
						arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
					}),
					overrides: configObject.overrides,
			  }
			: configObject

		return literal<WrappedOverridableItemNormal<IBlueprintConfig>>({
			type: 'normal',
			id: '0',
			computed: applyAndValidateOverrides(configObject2).obj,
			defaults: configObject2.defaults,
			overrideOps: configObject2.overrides.map((op) => ({
				...op,
				// TODO: can we avoid doing this hack?
				path: `0.${op.path}`,
			})),
		})
	}, [configObject])

	return (
		<div className="scroll-x">
			{subPanel ? (
				<h3 className="mhn">{t('Blueprint Configuration')}</h3>
			) : (
				<h2 className="mhn">{t('Blueprint Configuration')}</h2>
			)}

			{schema ? (
				<SchemaFormWithOverrides
					schema={schema}
					translationNamespaces={translationNamespaces}
					allowTables
					attr={''}
					item={wrappedItem}
					overrideHelper={overrideHelper}
				/>
			) : (
				<p>{t('This blueprint has not provided a valid config schema')}</p>
			)}
		</div>
	)
}
