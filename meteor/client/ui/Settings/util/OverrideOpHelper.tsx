import { clone, literal, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import {
	SomeObjectOverrideOp,
	ObjectWithOverrides,
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useRef, useMemo, useEffect } from 'react'

export function filterOpsForPrefix(
	allOps: SomeObjectOverrideOp[],
	prefix: string
): { opsForId: SomeObjectOverrideOp[]; otherOps: SomeObjectOverrideOp[] } {
	const res: { opsForId: SomeObjectOverrideOp[]; otherOps: SomeObjectOverrideOp[] } = { opsForId: [], otherOps: [] }

	for (const op of allOps) {
		if (op.path === prefix || op.path.startsWith(`${prefix}.`)) {
			res.opsForId.push(op)
		} else {
			res.otherOps.push(op)
		}
	}

	return res
}

export interface OverrideOpHelper {
	clearItemOverrides: (itemId: string, subPath: string) => void
	resetItem: (itemId: string) => void
	setItemValue: (itemId: string, subPath: string | null, value: any) => void
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
					// Change id

					const { otherOps: newOps, opsForId } = filterOpsForPrefix(objectWithOverridesRef.current.overrides, itemId)

					if (!value || newOps.find((op) => op.path === value) || objectWithOverridesRef.current.defaults[value]) {
						throw new Error('Id is invalid or already in use')
					}

					if (objectWithOverridesRef.current.defaults[itemId]) {
						// Future: should we be able to handle this?
						throw new Error("Can't change id of object with defaults")
					} else {
						// Change the id prefix of the ops
						for (const op of opsForId) {
							const newPath = `${value}${op.path.substring(itemId.length)}`

							const newOp = {
								...op,
								path: newPath,
							}
							newOps.push(newOp)

							if (newOp.path === value && newOp.op === 'set') {
								newOp.value._id = value
							}
						}

						saveOverrides(newOps)
					}
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
