import { clone, literal, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import {
	SomeObjectOverrideOp,
	ObjectWithOverrides,
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useRef, useMemo, useEffect } from 'react'
import { ReadonlyDeep, SetNonNullable } from 'type-fest'

export function filterOpsForPrefix(
	allOps: ReadonlyDeep<SomeObjectOverrideOp[]>,
	prefix: string
): { opsForId: ReadonlyDeep<SomeObjectOverrideOp>[]; otherOps: ReadonlyDeep<SomeObjectOverrideOp>[] } {
	const res: { opsForId: ReadonlyDeep<SomeObjectOverrideOp>[]; otherOps: ReadonlyDeep<SomeObjectOverrideOp>[] } = {
		opsForId: [],
		otherOps: [],
	}

	for (const op of allOps) {
		if (op.path === prefix || op.path.startsWith(`${prefix}.`)) {
			res.opsForId.push(op)
		} else {
			res.otherOps.push(op)
		}
	}

	return res
}

export interface WrappedItem<T extends object> {
	id: string
	computed: T | undefined
	defaults: ReadonlyDeep<T> | undefined
	overrideOps: ReadonlyDeep<SomeObjectOverrideOp[]>
}
export function getAllCurrentAndDeletedItemsFromOverrides<T extends object>(
	rawObject: ReadonlyDeep<ObjectWithOverrides<Record<string, T | undefined>>>,
	comparitor: (a: T | ReadonlyDeep<T>, b: T | ReadonlyDeep<T>) => number
) {
	const resolvedObject = applyAndValidateOverrides(rawObject).obj

	const validItems: Array<[id: string, obj: T]> = []
	for (const [id, obj] of Object.entries(resolvedObject)) {
		if (obj) validItems.push([id, obj])
	}

	const sortedItems = validItems
		.sort((a, b) => comparitor(a[1], b[1]))
		.map(([id, obj]) =>
			literal<WrappedItem<T>>({
				id: id,
				computed: obj,
				defaults: rawObject.defaults[id],
				overrideOps: filterOpsForPrefix(rawObject.overrides, id).opsForId,
			})
		)

	const removedOutputLayers: SetNonNullable<WrappedItem<T>, 'defaults'>[] = []

	const computedOutputLayerIds = new Set(sortedItems.map((l) => l.id))
	for (const [id, output] of Object.entries(rawObject.defaults)) {
		if (!computedOutputLayerIds.has(id) && output) {
			removedOutputLayers.push(
				literal<SetNonNullable<WrappedItem<T>, 'defaults'>>({
					id: id,
					computed: undefined,
					defaults: output,
					overrideOps: filterOpsForPrefix(rawObject.overrides, id).opsForId,
				})
			)
		}
	}

	removedOutputLayers.sort((a, b) => comparitor(a.defaults, b.defaults))

	return [...sortedItems, ...removedOutputLayers]
}

export interface OverrideOpHelper {
	clearItemOverrides: (itemId: string, subPath: string) => void
	resetItem: (itemId: string) => void
	setItemValue: (itemId: string, subPath: string | null, value: any) => void
	changeItemId: (oldItemId: string, newItemId: string) => void
}

export function useOverrideOpHelper<T extends object>(
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void,
	objectWithOverrides: ObjectWithOverrides<T>
): OverrideOpHelper {
	const objectWithOverridesRef = useRef(objectWithOverrides)

	const helper = useMemo(() => {
		const helper = literal<OverrideOpHelper>({
			clearItemOverrides: (itemId, subPath) => {
				console.log(`reset ${itemId}.${subPath}`)

				if (!objectWithOverridesRef.current) return

				const opPath = `${itemId}.${subPath}`

				const newOps = objectWithOverridesRef.current.overrides.filter((op) => op.path !== opPath)

				saveOverrides(newOps)
			},

			// Reset an item back to defaults
			resetItem: (itemId: string) => {
				console.log('reset', itemId)

				if (!objectWithOverridesRef.current) return

				const newOps = filterOpsForPrefix(objectWithOverridesRef.current.overrides, itemId).otherOps

				saveOverrides(newOps)
			},

			changeItemId: (oldItemId: string, newItemId: string) => {
				console.log('changeItemId', oldItemId, newItemId)

				if (!objectWithOverridesRef.current) return

				const { otherOps: newOps, opsForId } = filterOpsForPrefix(objectWithOverridesRef.current.overrides, oldItemId)

				if (
					!newItemId ||
					newOps.find((op) => op.path === newItemId) ||
					objectWithOverridesRef.current.defaults[newItemId]
				) {
					throw new Error('Id is invalid or already in use')
				}

				if (objectWithOverridesRef.current.defaults[oldItemId]) {
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

					saveOverrides(newOps)
				}
			},

			setItemValue: (itemId: string, subPath: string | null, value: any) => {
				console.log(`set ${itemId}.${subPath} = ${value}`)

				if (!objectWithOverridesRef.current) return

				// Handle deletion
				if (!subPath && value === undefined) {
					const newOps = filterOpsForPrefix(objectWithOverridesRef.current.overrides, itemId).otherOps
					if (objectWithOverridesRef.current.defaults[itemId]) {
						// If it was from the defaults, we need to mark it deleted
						newOps.push(
							literal<ObjectOverrideDeleteOp>({
								op: 'delete',
								path: itemId,
							})
						)
					}

					saveOverrides(newOps)
				} else if (subPath === '_id') {
					throw new Error('Item id cannot be changed through this helper')
				} else if (subPath) {
					// Set a property
					const { otherOps: newOps, opsForId } = filterOpsForPrefix(objectWithOverridesRef.current.overrides, itemId)

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

					saveOverrides(newOps)
				}
			},
		})

		return helper
	}, [saveOverrides])

	// Use a ref to minimise reactivity when it changes
	useEffect(() => {
		objectWithOverridesRef.current = objectWithOverrides
	}, [objectWithOverrides])

	return helper
}
