import { literal, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import React, { useCallback, useMemo, useState } from 'react'
import { WrappedOverridableItemNormal, OverrideOpHelperForItemContents } from '../../ui/Settings/util/OverrideOpHelper'
import { SchemaFormCommonProps } from './schemaFormUtil'
import { SchemaFormWithOverrides } from './SchemaFormWithOverrides'

interface SchemaFormInPlaceProps extends Omit<SchemaFormCommonProps, 'isRequired'> {
	/** The object to be modified in place */
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

	return <SchemaFormWithOverrides {...commonProps} attr={''} item={wrappedItem} overrideHelper={helper} isRequired />
}

/**
 * An alternate OverrideOpHelper designed to directly mutate an object, instead of using the `ObjectWithOverrides` system.
 * This allows us to have one SchemaForm implementation that can handle working with `ObjectWithOverrides`, and simpler options
 */
class OverrideOpHelperInPlace implements OverrideOpHelperForItemContents {
	readonly #object: any
	readonly #forceRender: () => void

	constructor(object: any, forceRender: () => void) {
		this.#object = object
		this.#forceRender = forceRender
	}

	clearItemOverrides(_itemId: string, _subPath: string): void {
		// Not supported as this is faking an item with overrides
	}
	setItemValue(_itemId: string, subPath: string, value: any): void {
		objectPathSet(this.#object, subPath, value)
		this.#forceRender()
	}
}
