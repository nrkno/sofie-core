import { literal } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import {
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import React, { useMemo } from 'react'
import { MongoCollection } from '../../../lib/collections/lib'
import { WrappedOverridableItemNormal, OverrideOpHelperForItemContents } from '../../ui/Settings/util/OverrideOpHelper'
import { SchemaFormCommonProps } from './schemaFormUtil'
import { SchemaFormWithOverrides } from './SchemaFormWithOverrides'

interface SchemaFormForCollectionProps extends SchemaFormCommonProps {
	/** The collection to operate on */
	collection: MongoCollection<any>
	/** Id of the document in the collection */
	objectId: ProtectedString<any>
	/** Base path of the schema within the document */
	basePath: string
	/** The portion of the document where the schema applies, that will be modified */
	object: any

	/**
	 * If set, this form is to build a Partial object of overrides to apply over the provided object
	 * Note: this requires the schema to be shallow, and to not use any sub-objects
	 */
	partialOverridesForObject?: any
}

export function SchemaFormForCollection({
	object,
	basePath,
	collection,
	objectId,
	partialOverridesForObject,
	...commonProps
}: SchemaFormForCollectionProps): JSX.Element {
	const helper = useMemo(
		() => new OverrideOpHelperCollection(collection, objectId, basePath),
		[collection, objectId, basePath]
	)

	const wrappedItem = useMemo(() => {
		if (partialOverridesForObject) {
			// Note: this assumes it to be using a shallow object. If it is not then the logic becomes a lot more complex, and more than we want to handle here
			const computed = {
				...partialOverridesForObject,
				...object,
			}

			// Note: these ops use a prefix of `0.` to satisfy how the objectWithOverrides expects them to look
			const overrideOps = Object.entries<any>(object).map(([key, val]) =>
				val === undefined
					? literal<ObjectOverrideDeleteOp>({
							op: 'delete',
							path: `0.${key}`,
					  })
					: literal<ObjectOverrideSetOp>({
							op: 'set',
							path: `0.${key}`,
							value: val,
					  })
			)

			return literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: '0',
				computed: computed,
				defaults: partialOverridesForObject,
				overrideOps,
			})
		} else {
			return literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: 'not-used',
				computed: object,
				defaults: undefined,
				overrideOps: [],
			})
		}
	}, [object, partialOverridesForObject])

	return <SchemaFormWithOverrides {...commonProps} attr={''} item={wrappedItem} overrideHelper={helper} />
}

/**
 * An alternate OverrideOpHelper designed to directly mutate a collection, instead of using the `ObjectWithOverrides` system.
 * This allows us to have one SchemaForm implementation that can handle working with `ObjectWithOverrides`, and basic objects in mongodb
 */
class OverrideOpHelperCollection implements OverrideOpHelperForItemContents {
	readonly #collection: MongoCollection<any>
	readonly #objectId: ProtectedString<any>
	readonly #basePath: string

	constructor(collection: MongoCollection<any>, objectId: ProtectedString<any>, basePath: string) {
		this.#collection = collection
		this.#objectId = objectId
		this.#basePath = basePath
	}

	clearItemOverrides(_itemId: string, subPath: string): void {
		this.#collection.update(this.#objectId, {
			$unset: {
				[`${this.#basePath}.${subPath}`]: 1,
			},
		})
	}
	setItemValue(_itemId: string, subPath: string, value: any): void {
		if (value === undefined) {
			this.#collection.update(this.#objectId, {
				$unset: {
					[`${this.#basePath}.${subPath}`]: 1,
				},
			})
		} else {
			this.#collection.update(this.#objectId, {
				$set: {
					[`${this.#basePath}.${subPath}`]: value,
				},
			})
		}
	}
}
