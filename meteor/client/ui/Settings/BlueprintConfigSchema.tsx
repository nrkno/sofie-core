import React, { useCallback, useMemo } from 'react'
import ClassNames from 'classnames'
import { MappingsExt } from '../../../lib/collections/Studios'
import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { groupByToMapFunc, literal } from '../../../lib/lib'
import { useTranslation } from 'react-i18next'
import {
	applyAndValidateOverrides,
	ObjectWithOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	OverrideOpHelperForItemContents,
	useOverrideOpHelper,
	WrappedOverridableItemNormal,
} from './util/OverrideOpHelper'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { SchemaFormWithOverrides } from '../../lib/forms/SchemaFormWithOverrides'
import deepmerge from 'deepmerge'
import { SchemaFormSofieEnumDefinition, translateStringIfHasNamespaces } from '../../lib/forms/schemaFormUtil'
import { useToggleExpandHelper } from './util/ToggleExpandedHelper'
import { faPencilAlt, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { SchemaFormUIField } from '../../../lib/jsonSchemaUtil'

interface BlueprintConfigSchemaSettingsProps {
	schema: JSONSchema | undefined

	translationNamespaces: string[]

	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateConfig: IBlueprintConfig | undefined

	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: SourceLayers

	configObject: ObjectWithOverrides<IBlueprintConfig>
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void
}

export function BlueprintConfigSchemaSettings({
	schema,
	translationNamespaces,
	alternateConfig,
	layerMappings,
	sourceLayers,

	configObject: rawConfigObject,
	saveOverrides: rawSaveOverrides,
}: BlueprintConfigSchemaSettingsProps): JSX.Element {
	const { t } = useTranslation()

	const saveOverridesStrippingPrefix = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			rawSaveOverrides(
				newOps.map((op) => ({
					...op,
					path: op.path.startsWith('0.') ? op.path.slice(2) : op.path,
				}))
			)
		},
		[rawSaveOverrides]
	)

	const sofieEnumDefinitons: Record<string, SchemaFormSofieEnumDefinition> = useMemo(() => {
		// Future: if there are multiple studios, this could result in duplicates
		const mappingsDefinition: SchemaFormSofieEnumDefinition = { options: [] }
		for (const mappings of Object.values(layerMappings || {})) {
			for (const [mappingId, mapping] of Object.entries(mappings)) {
				mappingsDefinition.options.push({
					name: mapping.layerName || mappingId,
					value: mappingId,
					filter: mapping.device,
				})
			}
		}
		mappingsDefinition.options.sort((a, b) => a.name.localeCompare(b.name))

		const sourceLayersDefinition: SchemaFormSofieEnumDefinition = { options: [] }
		for (const [id, sourceLayer] of Object.entries(sourceLayers || {})) {
			if (sourceLayer) {
				sourceLayersDefinition.options.push({
					name: sourceLayer.name,
					value: id,
					filter: sourceLayer.type,
				})
			}
		}
		sourceLayersDefinition.options.sort((a, b) => a.name.localeCompare(b.name))

		return {
			mappings: mappingsDefinition,
			'source-layers': sourceLayersDefinition,
		}
	}, [layerMappings, sourceLayers])

	const [wrappedItem, wrappedConfigObject] = useMemo(() => {
		const combinedDefaults: IBlueprintConfig = alternateConfig
			? deepmerge<IBlueprintConfig>(alternateConfig, rawConfigObject.defaults, {
					arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
			  })
			: rawConfigObject.defaults

		const prefixedOps = rawConfigObject.overrides.map((op) => ({
			...op,
			// TODO: can we avoid doing this hack?
			path: `0.${op.path}`,
		}))

		const computedValue = applyAndValidateOverrides({
			defaults: combinedDefaults,
			overrides: rawConfigObject.overrides,
		}).obj

		const wrappedItem = literal<WrappedOverridableItemNormal<IBlueprintConfig>>({
			type: 'normal',
			id: '0',
			computed: computedValue,
			defaults: combinedDefaults,
			overrideOps: prefixedOps,
		})

		const wrappedConfigObject: ObjectWithOverrides<IBlueprintConfig> = {
			defaults: combinedDefaults,
			overrides: prefixedOps,
		}

		return [wrappedItem, wrappedConfigObject]
	}, [rawConfigObject])

	const overrideHelper = useOverrideOpHelper(saveOverridesStrippingPrefix, wrappedConfigObject) // TODO - replace based around a custom implementation of OverrideOpHelperForItemContents?

	const groupedSchema = useMemo(() => {
		if (schema?.type === 'object' && schema.properties) {
			const groupedMap = groupByToMapFunc(
				Object.entries(schema.properties),
				(v) => translateStringIfHasNamespaces(v[1][SchemaFormUIField.Category], translationNamespaces) || null
			)

			return Array.from(groupedMap.entries())
				.map(([name, schemas]) =>
					literal<[string | null, JSONSchema]>([
						name,
						literal<JSONSchema>({
							type: 'object',
							properties: Object.fromEntries(schemas),
						}),
					])
				)
				.sort((a, b) => {
					if (a[0] === b[0]) return 0
					if (a[0] === null) return 1
					if (b[0] === null) return -1
					return a[0].localeCompare(b[0])
				})
		} else {
			return []
		}
	}, [schema])

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()
	const toggleExpanded2 = useCallback(
		(categoryName: string | null, force?: boolean) => toggleExpanded(categoryName ?? '__OTHER__', force),
		[toggleExpanded]
	)

	return (
		<div className="scroll-x">
			{groupedSchema.length ? (
				<table className="expando settings-studio-source-table">
					<tbody>
						{groupedSchema.map(([categoryName, schema]) => (
							<CategoryEntry
								key={categoryName ?? '__OTHER__'}
								translationNamespaces={translationNamespaces}
								wrappedItem={wrappedItem}
								categoryName={categoryName}
								categorySchema={schema}
								isExpanded={isExpanded(categoryName ?? '__OTHER__')}
								toggleExpanded={toggleExpanded2}
								overrideHelper={overrideHelper}
								sofieEnumDefinitons={sofieEnumDefinitons}
							/>
						))}
					</tbody>
				</table>
			) : (
				<p>{t('This blueprint has not provided a valid config schema')}</p>
			)}
		</div>
	)
}

interface EntryProps {
	translationNamespaces: string[]
	wrappedItem: WrappedOverridableItemNormal<IBlueprintConfig>
	categoryName: string | null
	categorySchema: JSONSchema
	isExpanded: boolean
	toggleExpanded: (itemId: string | null, force?: boolean) => void
	overrideHelper: OverrideOpHelperForItemContents
	sofieEnumDefinitons: Record<string, SchemaFormSofieEnumDefinition>
}
function CategoryEntry({
	translationNamespaces,
	wrappedItem,
	categoryName,
	categorySchema,
	isExpanded,
	toggleExpanded,
	overrideHelper,
	sofieEnumDefinitons,
}: EntryProps) {
	const { t } = useTranslation()

	const toggleEditItem = useCallback(() => toggleExpanded(categoryName), [toggleExpanded, categoryName])

	return (
		<>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-source-table__name c2">{categoryName ?? t('Other')}</th>
				<td className="settings-studio-source-table__actions table-item-actions c3">
					<button className="action-btn" onClick={toggleEditItem} title={t('Edit')}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={4}>
						<div>
							<SchemaFormWithOverrides
								schema={categorySchema}
								translationNamespaces={translationNamespaces}
								allowTables
								attr={''}
								item={wrappedItem}
								overrideHelper={overrideHelper}
								sofieEnumDefinitons={sofieEnumDefinitons}
							/>
						</div>
						<div className="mod alright">
							<button className="btn btn-primary" onClick={toggleEditItem}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</>
	)
}
