import { literal, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import React, { useCallback, useMemo, useState } from 'react'
import { WrappedOverridableItemNormal, OverrideOpHelper } from '../../ui/Settings/util/OverrideOpHelper'
import { SchemaFormCommonProps } from './schemaFormUtil'
import { SchemaFormWithOverrides } from './schemaFormWithOverrides'

interface SchemaFormInPlaceProps extends SchemaFormCommonProps {
	object: any
}
export function SchemaFormInPlace({ object, ...commonProps }: SchemaFormInPlaceProps): JSX.Element {
	// This is a hack to avoid issues with the UI re-rendering as 'nothing' changed
	const [editCount, setEditCount] = useState(0)
	const forceRender = useCallback(() => setEditCount((v) => v + 1), [])

	const helper = useMemo(() => new OverrideOpHelperInPlace(object, forceRender), [object, forceRender])

	const wrappedItem = useMemo(
		() =>
			literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: 'not-used' + editCount,
				computed: object,
				defaults: undefined,
				overrideOps: [],
			}),
		[object, editCount]
	)

	return <SchemaFormWithOverrides {...commonProps} attr={''} item={wrappedItem} overrideHelper={helper} />
}

/**
 * An alternate OverrideOpHelper designed to directly mutate an object, instead of using the `ObjectWithOverrides` system.
 * This allows us to have one SchemaForm implementation that can handle working with `ObjectWithOverrides`, and simpler options
 */
class OverrideOpHelperInPlace implements OverrideOpHelper {
	readonly #object: any
	readonly #forceRender: () => void

	constructor(object: any, forceRender: () => void) {
		this.#object = object
		this.#forceRender = forceRender
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
		this.#forceRender()
	}
	replaceItem(_itemId: string, _value: any): void {
		// Not supported as this is faking an item with overrides
	}
}
