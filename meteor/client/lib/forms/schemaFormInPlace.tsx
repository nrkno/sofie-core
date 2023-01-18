import { literal, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import React, { useMemo } from 'react'
import { WrappedOverridableItemNormal, OverrideOpHelper } from '../../ui/Settings/util/OverrideOpHelper'
import { JSONSchema } from './schema-types'
import { SchemaFormWithOverrides } from './schemaFormWithOverrides'

interface SchemaFormInPlaceProps {
	schema: JSONSchema
	object: any
	translationNamespaces: string[]
}
export function SchemaFormInPlace({ schema, object, translationNamespaces }: SchemaFormInPlaceProps) {
	const helper = useMemo(() => new OverrideOpHelperInPlace(object), [object])

	// TODO - how does the reactivity work here?

	const wrappedItem = useMemo(
		() =>
			literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: 'not-used',
				computed: object,
				defaults: undefined,
				overrideOps: [],
			}),
		[object]
	)

	return (
		<SchemaFormWithOverrides
			schema={schema}
			translationNamespaces={translationNamespaces}
			attr={''}
			item={wrappedItem}
			overrideHelper={helper}
		/>
	)
}

/**
 * An alternate OverrideOpHelper designed to directly mutate an object, instead of using the `ObjectWithOverrides` system.
 * This allows us to have one SchemaForm implementation that can handle working with `ObjectWithOverrides`, and simpler options
 */
class OverrideOpHelperInPlace implements OverrideOpHelper {
	readonly #object: any

	constructor(object: any) {
		this.#object = object
	}

	clearItemOverrides(_itemId: string, _subPath: string): void {
		// Not supported as this is faking an item with overrides
	}
	resetItem(_itemId: string): void {
		// Not supported as this is faking an item with overrides
	}
	deleteItem(_itemId: string): void {
		// Not supported as this is faking an item with overrides
	}
	changeItemId(_oldItemId: string, _newItemId: string): void {
		// Not supported as this is faking an item with overrides
	}
	setItemValue(_itemId: string, subPath: string, value: any): void {
		objectPathSet(this.#object, subPath, value)
	}
	replaceItem(_itemId: string, _value: any): void {
		// Not supported as this is faking an item with overrides
	}
}
