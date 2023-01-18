import { literal } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import React, { useMemo } from 'react'
import { MongoCollection } from '../../../lib/collections/lib'
import { WrappedOverridableItemNormal, OverrideOpHelper } from '../../ui/Settings/util/OverrideOpHelper'
import { JSONSchema } from './schema-types'
import { SchemaFormWithOverrides } from './schemaFormWithOverrides'

interface SchemaFormForCollectionProps {
	schema: JSONSchema
	object: any
	translationNamespaces: string[]
	collection: MongoCollection<any>
	objectId: ProtectedString<any>
	basePath: string
}
export function SchemaFormForCollection({
	schema,
	object,
	basePath,
	translationNamespaces,
	collection,
	objectId,
}: SchemaFormForCollectionProps) {
	const helper = useMemo(() => new OverrideOpHelper2(collection, objectId, basePath), [collection, objectId, basePath])

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

class OverrideOpHelper2 implements OverrideOpHelper {
	readonly #collection: MongoCollection<any>
	readonly #objectId: ProtectedString<any>
	readonly #basePath: string

	constructor(collection: MongoCollection<any>, objectId: ProtectedString<any>, basePath: string) {
		this.#collection = collection
		this.#objectId = objectId
		this.#basePath = basePath
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
		console.log('set', `${this.#basePath}.${subPath}`, value)
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
	replaceItem(_itemId: string, _value: any): void {
		// TODO - is this needed?
		throw new Error('Method not implemented.')
	}
}

// const updateFunction = useCallback(
// 	(path: string, val: any, mode?: 'push' | 'pull') => {
// 		if (mode === 'push') {
// 			PeripheralDevices.update(parentId, {
// 				$push: {
// 					[`settings.devices.${subdeviceId}.${path}`]: val,
// 				},
// 			})
// 		} else if (mode === 'pull') {
// 			if (isNaN(val)) {
// 				throw new Error("Can't pop a non-numeric array index!")
// 			}
// 			PeripheralDevices.update(parentId, {
// 				$unset: {
// 					[`settings.devices.${subdeviceId}.${path}.${val}`]: 1,
// 				},
// 			})

// 			// clean up the array
// 			PeripheralDevices.update(parentId, {
// 				$pull: {
// 					[`settings.devices.${subdeviceId}.${path}`]: null,
// 				},
// 			})
// 		} else {
// 			if (val === undefined) {
// 				PeripheralDevices.update(parentId, {
// 					$unset: {
// 						[`settings.devices.${subdeviceId}.${path}`]: 1,
// 					},
// 				})
// 			} else {
// 				PeripheralDevices.update(parentId, {
// 					$set: {
// 						[`settings.devices.${subdeviceId}.${path}`]: val,
// 					},
// 				})
// 			}
// 		}
// 	},
// 	[parentId, subdeviceId]
// )
