import { clone, joinObjectPathFragments, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import { OverrideOpHelperForItemContents, WrappedOverridableItem } from '../../../ui/Settings/util/OverrideOpHelper'

/**
 * The OverrideOp system does not support tables of objects currently.
 * This is intended to be a break point to allow tables to provide their nested schemaForms with a way to work with this
 */
export class OverrideOpHelperObjectTable implements OverrideOpHelperForItemContents {
	readonly #baseHelper: OverrideOpHelperForItemContents
	readonly #parentItem: WrappedOverridableItem<object>
	readonly #currentRows: WrappedOverridableItem<object>[]
	readonly #path: string

	constructor(
		baseHelper: OverrideOpHelperForItemContents,
		parentItem: WrappedOverridableItem<object>,
		currentRows: WrappedOverridableItem<object>[],
		path: string
	) {
		this.#baseHelper = baseHelper
		this.#parentItem = parentItem
		this.#currentRows = currentRows
		this.#path = path
	}

	clearItemOverrides(rowId: string, subPath: string): void {
		this.#baseHelper.clearItemOverrides(this.#parentItem.id, joinObjectPathFragments(this.#path, rowId, subPath))
	}
	deleteRow(rowId: string): void {
		const rowPath = joinObjectPathFragments(this.#path, rowId)

		// If row was not user created (it has defaults), then don't store `undefined`
		const currentRow = this.#currentRows.find((r) => r.id === rowId)
		if (!this.#parentItem.defaults || currentRow?.defaults) {
			// Mark the row as undefined. This ensures it gets deleted even if the parent is an override
			this.#baseHelper.setItemValue(this.#parentItem.id, rowPath, undefined)
		} else {
			// Clear any existing overrides
			this.#baseHelper.clearItemOverrides(this.#parentItem.id, rowPath)
		}
	}
	setItemValue(rowId: string, subPath: string, value: unknown): void {
		const currentRow = this.#currentRows.find((r) => r.id === rowId)
		if (!currentRow || currentRow.type === 'deleted') return // Unable to set value

		if (currentRow.defaults) {
			// has defaults, so override the single value
			this.#baseHelper.setItemValue(this.#parentItem.id, joinObjectPathFragments(this.#path, rowId, subPath), value)
		} else {
			// no defaults, replace the whole object

			// replace with a new override
			const newObj = clone(currentRow.computed)
			objectPathSet(newObj, subPath, value)
			this.#baseHelper.setItemValue(this.#parentItem.id, joinObjectPathFragments(this.#path, rowId), newObj)
		}
	}
}
