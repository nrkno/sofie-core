import React from 'react'
import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { SchemaFormSofieEnumDefinition } from '../../../lib/forms/schemaFormUtil'
import {
	OverrideOpHelperForItemContents,
	WrappedOverridableItemNormal,
} from '../../../ui/Settings/util/OverrideOpHelper'
import { SchemaFormWithOverrides } from '../../forms/SchemaFormWithOverrides'

interface ConfigCategoryEntryProps {
	translationNamespaces: string[]
	wrappedItem: WrappedOverridableItemNormal<IBlueprintConfig>
	categorySchema: JSONSchema
	// isExpanded: boolean
	// toggleExpanded: (itemId: string | null, force?: boolean) => void
	overrideHelper: OverrideOpHelperForItemContents
	sofieEnumDefinitons: Record<string, SchemaFormSofieEnumDefinition>
}

export function ConfigCategoryEntry({
	translationNamespaces,
	wrappedItem,
	categorySchema,
	// isExpanded,
	// toggleExpanded,
	overrideHelper,
	sofieEnumDefinitons,
}: ConfigCategoryEntryProps): JSX.Element {
	return (
		<>
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
		</>
	)
}
