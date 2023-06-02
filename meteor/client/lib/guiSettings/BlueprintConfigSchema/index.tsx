import React from 'react'
import { MappingExt, MappingsExt } from '../../../../lib/collections/Studios'
import { IBlueprintConfig, ISourceLayer, SchemaFormUIField } from '@sofie-automation/blueprints-integration'
import { groupByToMapFunc, joinObjectPathFragments, literal } from '../../../../lib/lib'
import { TFunction, useTranslation } from 'react-i18next'
import {
	applyAndValidateOverrides,
	ObjectWithOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { JSONSchema, TypeName } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import deepmerge from 'deepmerge'
import { SchemaFormSofieEnumDefinition, translateStringIfHasNamespaces } from '../../forms/schemaFormUtil'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import {
	OverrideOpHelper,
	WrappedOverridableItemNormal,
	useOverrideOpHelper,
} from '../../../ui/Settings/util/OverrideOpHelper'
import {
	GUISetting,
	GUISettingSection,
	GUISettingSectionList,
	GUISettingsType,
	guiSetting,
	guiSettingId,
} from '../guiSettings'
import { ArrayFormWithOverrides, SchemaFormWithOverrides } from '../../forms/SchemaFormWithOverrides'
import { GUISettingId } from '../guiSettings'

export function getBlueprintConfigSchemaGuiSettings(props: {
	t: TFunction
	urlBase: string
	schema: JSONSchema | undefined

	translationNamespaces: string[]

	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateConfig: IBlueprintConfig | undefined

	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: SourceLayers

	configObject: ObjectWithOverrides<IBlueprintConfig>
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void
}): GUISettingSectionList {
	const { t } = useTranslation()
	const {
		urlBase,
		schema,
		translationNamespaces,
		alternateConfig,
		layerMappings,
		sourceLayers,

		configObject: rawConfigObject,
		saveOverrides: rawSaveOverrides,
	} = props

	const saveOverridesStrippingPrefix = (newOps: SomeObjectOverrideOp[]) => {
		rawSaveOverrides(
			newOps.map((op) => ({
				...op,
				path: op.path.startsWith('0.') ? op.path.slice(2) : op.path,
			}))
		)
	}

	// Future: if there are multiple studios, this could result in duplicates
	const mappingsDefinition: SchemaFormSofieEnumDefinition = { options: [] }
	for (const mappings of Object.values<MappingsExt>(layerMappings || {})) {
		for (const [mappingId, mapping] of Object.entries<MappingExt>(mappings)) {
			mappingsDefinition.options.push({
				name: mapping.layerName || mappingId,
				value: mappingId,
				filter: mapping.device,
			})
		}
	}
	mappingsDefinition.options.sort((a, b) => a.name.localeCompare(b.name))

	const sourceLayersDefinition: SchemaFormSofieEnumDefinition = { options: [] }
	for (const [id, sourceLayer] of Object.entries<ISourceLayer | undefined>(sourceLayers || {})) {
		if (sourceLayer) {
			sourceLayersDefinition.options.push({
				name: sourceLayer.name,
				value: id,
				filter: sourceLayer.type,
			})
		}
	}
	sourceLayersDefinition.options.sort((a, b) => a.name.localeCompare(b.name))

	const sofieEnumDefinitons: Record<string, SchemaFormSofieEnumDefinition> = {
		mappings: mappingsDefinition,
		'source-layers': sourceLayersDefinition,
	}

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

	const overrideHelper = useOverrideOpHelper(saveOverridesStrippingPrefix, wrappedConfigObject) // TODO - replace based around a custom implementation of OverrideOpHelperForItemContents?

	let groupedSchema: [string | null, JSONSchema][]

	if (schema?.type === 'object' && schema.properties) {
		const groupedMap = groupByToMapFunc(
			Object.entries<JSONSchema>(schema.properties),
			(v) => translateStringIfHasNamespaces(v[1][SchemaFormUIField.Category], translationNamespaces) || null
		)

		groupedSchema = Array.from(groupedMap.entries())
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
		groupedSchema = []
	}

	// const { toggleExpanded, isExpanded } = useToggleExpandHelper()
	// const toggleExpanded2 = useCallback(
	// 	(categoryName: string | null, force?: boolean) => toggleExpanded(categoryName ?? '__OTHER__', force),
	// 	[toggleExpanded]
	// )
	const settings: (GUISetting<any> | GUISettingSection)[] = []

	for (const [categoryName, schema] of groupedSchema) {
		if (categoryName) {
			settings.push(
				getSettingFromSchema(urlBase, categoryName, schema, '', {
					t,
					translationNamespaces,
					wrappedItem,
					overrideHelper,
					sofieEnumDefinitons,
				})
			)

			// settings.push({
			// 	type: GUISettingsType.SETTING,
			// 	name: categoryName,
			// 	description: schema.description,
			// 	id: guiSettingId(urlBase, categoryName), // TODO: what to use for id?
			// 	render: () => {
			// 		return (
			// 			<ConfigCategoryEntry
			// 				// key={categoryName ?? '__OTHER__'}
			// 				translationNamespaces={translationNamespaces}
			// 				wrappedItem={wrappedItem}
			// 				categorySchema={schema}
			// 				// isExpanded={isExpanded(categoryName ?? '__OTHER__')}
			// 				// toggleExpanded={toggleExpanded2}
			// 				overrideHelper={overrideHelper}
			// 				sofieEnumDefinitons={sofieEnumDefinitons}
			// 			/>
			// 		)
			// 	},
			// 	getSearchString: '',
			// })
		}
	}
	return { warning: undefined, list: settings }
}

function getSettingFromSchema(
	urlBase: string | GUISettingId,
	categoryName: string,
	schema: JSONSchema,
	attr: string,
	context: {
		t: TFunction
		translationNamespaces: string[]
		wrappedItem: WrappedOverridableItemNormal<IBlueprintConfig>
		overrideHelper: OverrideOpHelper
		sofieEnumDefinitons: Record<string, SchemaFormSofieEnumDefinition>
	}
): GUISetting<any> | GUISettingSection {
	const t = context.t
	const settingId = guiSettingId(urlBase, categoryName)
	// const { t } = useTranslation()

	// const childProps = useChildPropsForFormComponent(props)

	switch (schema.type) {
		case TypeName.Array:
			return literal<GUISettingSection>({
				type: GUISettingsType.SECTION,
				name: categoryName,
				description: schema.description,
				id: settingId,
				getList: () => {
					return {
						list: [
							guiSetting({
								type: GUISettingsType.SETTING,
								name: '',
								description: '',
								transparent: true,
								id: guiSettingId(settingId, 'items'),
								render: ArrayFormWithOverrides,
								renderProps: {
									schema: schema,
									translationNamespaces: context.translationNamespaces,
									allowTables: true,
									attr: attr,
									item: context.wrappedItem,
									overrideHelper: context.overrideHelper,
									sofieEnumDefinitons: context.sofieEnumDefinitons,
								},
								getSearchString: '',
							}),
						],
					}
				},
				getSearchString: '',
				renderSummary: () => null, // TODO
			})
		case TypeName.Object:
			return literal<GUISettingSection>({
				type: GUISettingsType.SECTION,
				name: categoryName,
				description: schema.description,
				id: settingId,
				getList: () => {
					return {
						list: Object.entries<JSONSchema>(schema.properties || {}).map(([property, innerSchema]) => {
							const path = joinObjectPathFragments(attr, property)

							return getSettingFromSchema(settingId, property, innerSchema, path, context)
							// getSettingFromSchema()

							// <SchemaFormWithOverrides
							// 	key={index}
							// 	attr={path}
							// 	schema={innerSchema}
							// 	item={props.item}
							// 	overrideHelper={props.overrideHelper}
							// 	translationNamespaces={props.translationNamespaces}
							// 	sofieEnumDefinitons={props.sofieEnumDefinitons}
							// 	allowTables={props.allowTables}
							// />
						}),
					}
				},
				getSearchString: '',
				renderSummary: () => null, // TODO
			})
		// if (schema[SchemaFormUIField.DisplayType] === 'json') {
		// 	return <JsonFormWithOverrides {...childProps} />
		// } else if (schema.patternProperties) {
		// 	if (props.allowTables) {
		// 		return <SchemaFormObjectTable {...props} />
		// 	} else {
		// 		return <>{t('Tables are not supported here')}</>
		// 	}
		// } else {
		// 	return <ObjectFormWithOverrides {...props} />
		// }
		case TypeName.Integer:
		case TypeName.Number:
		case TypeName.Boolean:
		case TypeName.String:
			return guiSetting({
				type: GUISettingsType.SETTING,
				name: categoryName,
				description: schema.description,
				id: settingId,
				render: SchemaFormWithOverrides,
				renderProps: {
					schema: schema,
					translationNamespaces: context.translationNamespaces,
					allowTables: true,
					attr: attr,
					item: context.wrappedItem,
					overrideHelper: context.overrideHelper,
					sofieEnumDefinitons: context.sofieEnumDefinitons,
				},
				getSearchString: '',
			})

		default:
			return guiSetting({
				type: GUISettingsType.SETTING,
				name: categoryName,
				description: schema.description,
				id: guiSettingId(urlBase, categoryName), // TODO: what to use for id?
				getWarning: () => t('Unsupported field type "{{ type }}"', { type: schema.type }),
				render: () => {
					return <>{t('Unsupported field type "{{ type }}"', { type: schema.type })}</>
				},
				renderProps: {},
				getSearchString: '',
			})
		// return <>{t('Unsupported field type "{{ type }}"', { type: schema.type })}</>
	}
	// switch (schema.type) {
	// 	case TypeName.Array:
	// 		return <ArrayFormWithOverrides {...props} />
	// 	case TypeName.Object:
	// 		if (schema[SchemaFormUIField.DisplayType] === 'json') {
	// 			return <JsonFormWithOverrides {...childProps} />
	// 		} else if (schema.patternProperties) {
	// 			if (props.allowTables) {
	// 				return <SchemaFormObjectTable {...props} />
	// 			} else {
	// 				return <>{t('Tables are not supported here')}</>
	// 			}
	// 		} else {
	// 			return <ObjectFormWithOverrides {...props} />
	// 		}
	// 	case TypeName.Integer:
	// 		if (schema.enum) {
	// 			return <EnumFormWithOverrides {...childProps} multiple={false} />
	// 		} else {
	// 			return <IntegerFormWithOverrides {...childProps} />
	// 		}
	// 	case TypeName.Number:
	// 		return <NumberFormWithOverrides {...childProps} />
	// 	case TypeName.Boolean:
	// 		return <BooleanFormWithOverrides {...childProps} />
	// 	case TypeName.String:
	// 		if (schema[SchemaFormUIField.SofieEnum]) {
	// 			return (
	// 				<SofieEnumFormWithOverrides
	// 					{...childProps}
	// 					sofieEnumDefinitions={props.sofieEnumDefinitons}
	// 					multiple={false}
	// 				/>
	// 			)
	// 		} else if (schema.enum) {
	// 			return <EnumFormWithOverrides {...childProps} multiple={false} />
	// 		} else {
	// 			return <StringFormWithOverrides {...childProps} />
	// 		}
	// 	default:
	// 		return <>{t('Unsupported field type "{{ type }}"', { type: schema.type })}</>
	// }
}
