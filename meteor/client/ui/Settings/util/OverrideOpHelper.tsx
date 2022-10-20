import { clone, literal, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import {
	SomeObjectOverrideOp,
	ObjectWithOverrides,
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useRef, useMemo, useEffect, MutableRefObject } from 'react'
import { ReadonlyDeep } from 'type-fest'

/**
 * Split a list of SomeObjectOverrideOp based on whether they match a specified prefix
 * @param allOps The array of SomeObjectOverrideOp
 * @param prefix The prefix to match, without a trailing `.`
 */
function filterOverrideOpsForPrefix(
	allOps: ReadonlyDeep<SomeObjectOverrideOp[]>,
	prefix: string
): { opsForPrefix: ReadonlyDeep<SomeObjectOverrideOp>[]; otherOps: ReadonlyDeep<SomeObjectOverrideOp>[] } {
	const res: { opsForPrefix: ReadonlyDeep<SomeObjectOverrideOp>[]; otherOps: ReadonlyDeep<SomeObjectOverrideOp>[] } = {
		opsForPrefix: [],
		otherOps: [],
	}

	for (const op of allOps) {
		if (op.path === prefix || op.path.startsWith(`${prefix}.`)) {
			res.opsForPrefix.push(op)
		} else {
			res.otherOps.push(op)
		}
	}

	return res
}

export interface WrappedOverridableItem<T extends object> {
	id: string
	computed: T | undefined
	defaults: ReadonlyDeep<T> | undefined
	overrideOps: ReadonlyDeep<SomeObjectOverrideOp[]>
}

/**
 * Compile a sorted array of all the items currently in the ObjectWithOverrides, and those that have been deleted
 * @param rawObject The ObjectWithOverrides to look at
 * @param comparitor Comparitor for sorting the items
 * @returns Sorted items, with sorted deleted items at the end
 */
export function getAllCurrentAndDeletedItemsFromOverrides<T extends object>(
	rawObject: ReadonlyDeep<ObjectWithOverrides<Record<string, T | undefined>>>,
	comparitor: (a: T | ReadonlyDeep<T>, b: T | ReadonlyDeep<T>) => number
) {
	const resolvedObject = applyAndValidateOverrides(rawObject).obj

	// Convert the items into an array
	const validItems: Array<[id: string, obj: T]> = []
	for (const [id, obj] of Object.entries(resolvedObject)) {
		if (obj) validItems.push([id, obj])
	}

	// Sort and wrap in the return type
	const sortedItems = validItems
		.sort((a, b) => comparitor(a[1], b[1]))
		.map(([id, obj]) =>
			literal<WrappedOverridableItem<T>>({
				id: id,
				computed: obj,
				defaults: rawObject.defaults[id],
				overrideOps: filterOverrideOpsForPrefix(rawObject.overrides, id).opsForPrefix,
			})
		)

	type WrappedItemWithDefaults = Omit<WrappedOverridableItem<T>, 'defaults'> & { defaults: ReadonlyDeep<T> }

	const removedOutputLayers: WrappedItemWithDefaults[] = []

	// Find the items which have been deleted with an override
	const computedOutputLayerIds = new Set(sortedItems.map((l) => l.id))
	for (const [id, output] of Object.entries(rawObject.defaults)) {
		if (!computedOutputLayerIds.has(id) && output) {
			removedOutputLayers.push(
				literal<WrappedItemWithDefaults>({
					id: id,
					computed: undefined,
					defaults: output,
					overrideOps: filterOverrideOpsForPrefix(rawObject.overrides, id).opsForPrefix,
				})
			)
		}
	}

	removedOutputLayers.sort((a, b) => comparitor(a.defaults, b.defaults))

	return [...sortedItems, ...removedOutputLayers]
}

type SaveOverridesFunction = (newOps: SomeObjectOverrideOp[]) => void

export class OverrideOpHelper {
	readonly #saveOverrides: SaveOverridesFunction
	readonly #objectWithOverridesRef: MutableRefObject<ObjectWithOverrides<any>>

	constructor(
		saveOverrides: SaveOverridesFunction,
		objectWithOverridesRef: MutableRefObject<ObjectWithOverrides<any>>
	) {
		this.#saveOverrides = saveOverrides
		this.#objectWithOverridesRef = objectWithOverridesRef
	}

	/**
	 * Clear all of the overrides for an value inside of an item
	 * This acts as a reset of property of its child properties
	 */
	clearItemOverrides(itemId: string, subPath: string): void {
		if (!this.#objectWithOverridesRef.current) return

		const opPath = `${itemId}.${subPath}`

		const newOps = this.#objectWithOverridesRef.current.overrides.filter((op) => op.path !== opPath)

		this.#saveOverrides(newOps)
	}

	/**
	 * Clear all of the overrides for an item
	 * This acts as a reset to defaults or undelete
	 */
	resetItem(itemId: string): void {
		if (!this.#objectWithOverridesRef.current) return

		const newOps = filterOverrideOpsForPrefix(this.#objectWithOverridesRef.current.overrides, itemId).otherOps

		this.#saveOverrides(newOps)
	}

	/**
	 * Delete an item from the object
	 */
	deleteItem(itemId: string): void {
		const newOps = filterOverrideOpsForPrefix(this.#objectWithOverridesRef.current.overrides, itemId).otherOps
		if (this.#objectWithOverridesRef.current.defaults[itemId]) {
			// If it was from the defaults, we need to mark it deleted
			newOps.push(
				literal<ObjectOverrideDeleteOp>({
					op: 'delete',
					path: itemId,
				})
			)
		}

		this.#saveOverrides(newOps)
	}

	/**
	 * Change the id of an item.
	 * This is only possible for ones which were created by an override, and does not exist in the defaults
	 */
	changeItemId(oldItemId: string, newItemId: string): void {
		if (!this.#objectWithOverridesRef.current) return

		const { otherOps: newOps, opsForPrefix: opsForId } = filterOverrideOpsForPrefix(
			this.#objectWithOverridesRef.current.overrides,
			oldItemId
		)

		if (
			!newItemId ||
			newOps.find((op) => op.path === newItemId) ||
			this.#objectWithOverridesRef.current.defaults[newItemId]
		) {
			throw new Error('Id is invalid or already in use')
		}

		if (this.#objectWithOverridesRef.current.defaults[oldItemId]) {
			// Future: should we be able to handle this?
			throw new Error("Can't change id of object with defaults")
		} else {
			// Change the id prefix of the ops
			for (const op of opsForId) {
				const newPath = `${newItemId}${op.path.substring(oldItemId.length)}`

				const newOp = {
					...op,
					path: newPath,
				}
				newOps.push(newOp)

				if (newOp.path === newItemId && newOp.op === 'set') {
					newOp.value._id = newItemId
				}
			}

			this.#saveOverrides(newOps)
		}
	}

	/**
	 * Set the value of a property of an item.
	 * Note: the id cannot be changed in this way
	 */
	setItemValue(itemId: string, subPath: string, value: any): void {
		if (!this.#objectWithOverridesRef.current) return

		if (subPath === '_id') {
			throw new Error('Item id cannot be changed through this helper')
		} else {
			// Set a property
			const { otherOps: newOps, opsForPrefix: opsForId } = filterOverrideOpsForPrefix(
				this.#objectWithOverridesRef.current.overrides,
				itemId
			)

			// Future: handle subPath being deeper
			if (subPath.indexOf('.') !== -1) throw new Error('Deep subPath not yet implemented')

			const setRootOp = opsForId.find((op) => op.path === itemId)
			if (setRootOp && setRootOp.op === 'set') {
				// This is as its base an override, so modify that instead
				const newOp = clone(setRootOp)

				objectPathSet(newOp.value, subPath, value)

				newOps.push(newOp)
			} else {
				const newOp = literal<ObjectOverrideSetOp>({
					op: 'set',
					path: `${itemId}.${subPath}`,
					value: value,
				})

				// Preserve any other overrides
				for (const op of opsForId) {
					if (op.path !== newOp.path) {
						newOps.push(op)
					}
				}
				// Add the new override
				newOps.push(newOp)
			}

			this.#saveOverrides(newOps)
		}
	}
}

/**
 * A helper to work with modifying an ObjectWithOverrides<T>
 */
export function useOverrideOpHelper<T extends object>(
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void,
	objectWithOverrides: ObjectWithOverrides<T>
): OverrideOpHelper {
	const objectWithOverridesRef = useRef(objectWithOverrides)

	const helper = useMemo(
		() => new OverrideOpHelper(saveOverrides, objectWithOverridesRef),
		[saveOverrides, objectWithOverridesRef]
	)

	// Use a ref to minimise reactivity when it changes
	useEffect(() => {
		objectWithOverridesRef.current = objectWithOverrides
	}, [objectWithOverrides])

	return helper
}