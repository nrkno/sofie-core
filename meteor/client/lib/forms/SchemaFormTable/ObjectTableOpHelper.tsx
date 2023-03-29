import { clone, joinObjectPathFragments, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import { OverrideOpHelperForItemContents, WrappedOverridableItem } from '../../../ui/Settings/util/OverrideOpHelper'

/**
 * The OverrideOp system does not support tables of objects currently.
 * This is intended to be a break point to allow tables to provide their nested schemaForms with a way to work with this
 */
export class OverrideOpHelperObjectTable implements OverrideOpHelperForItemContents {
	readonly #baseHelper: OverrideOpHelperForItemContents
	readonly #itemId: string
	readonly #currentRows: WrappedOverridableItem<object>[]
	readonly #path: string

	constructor(
		baseHelper: OverrideOpHelperForItemContents,
		itemId: string,
		currentRows: WrappedOverridableItem<object>[],
		path: string
	) {
		this.#baseHelper = baseHelper
		this.#itemId = itemId
		this.#currentRows = currentRows
		this.#path = path
	}

	clearItemOverrides(rowId: string, subPath: string): void {
		this.#baseHelper.clearItemOverrides(this.#itemId, joinObjectPathFragments(this.#path, rowId, subPath))
	}
	deleteRow(rowId: string): void {
		// Clear any existing overrides
		this.#baseHelper.clearItemOverrides(this.#itemId, joinObjectPathFragments(this.#path, rowId))

		// If row was not user created (it has defaults), then don't store `undefined`
		const row = this.#currentRows.find((r) => r.id === rowId)
		if (row && row.defaults) {
			// This is a bit of a hack, but it isn't possible to create a delete op from here
			this.#baseHelper.setItemValue(this.#itemId, joinObjectPathFragments(this.#path, rowId), undefined)
		}
	}
	setItemValue(rowId: string, subPath: string, value: unknown): void {
		const currentRow = this.#currentRows.find((r) => r.id === rowId)
		if (!currentRow || currentRow.type === 'deleted') return // Unable to set value

		if (currentRow.defaults) {
			// has defaults, so override the single value
			this.#baseHelper.setItemValue(this.#itemId, joinObjectPathFragments(this.#path, rowId, subPath), value)
		} else {
			// no defaults, replace the whole object
			// Ensure there arent existing overrides
			this.#baseHelper.clearItemOverrides(this.#itemId, joinObjectPathFragments(this.#path, rowId))

			// replace with a new override
			const newObj = clone(currentRow.computed)
			objectPathSet(newObj, subPath, value)
			this.#baseHelper.setItemValue(this.#itemId, joinObjectPathFragments(this.#path, rowId), newObj)
		}
	}
}
