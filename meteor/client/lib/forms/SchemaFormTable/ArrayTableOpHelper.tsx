import { clone, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import { OverrideOpHelperForItemContents } from '../../../ui/Settings/util/OverrideOpHelper'

/**
 * The OverrideOp system does not support Arrays currently.
 * This is intended to be a break point to avoid tables from attempting to define operations on arrays,
 * and instead make the table be treated as a single blob.
 */
export class OverrideOpHelperArrayTable implements OverrideOpHelperForItemContents {
	readonly #baseHelper: OverrideOpHelperForItemContents
	readonly #itemId: string
	readonly #currentRows: unknown[]
	readonly #path: string

	constructor(baseHelper: OverrideOpHelperForItemContents, itemId: string, currentRows: unknown[], path: string) {
		this.#baseHelper = baseHelper
		this.#itemId = itemId
		this.#currentRows = currentRows
		this.#path = path
	}

	clearItemOverrides(_itemId: string, _subPath: string): void {
		// Not supported as this is faking an item with overrides
	}
	deleteRow(rowId: string): void {
		// Delete the row
		const newObj = clone(this.#currentRows)
		newObj.splice(Number(rowId), 1)

		// Send it onwards
		this.#baseHelper.setItemValue(this.#itemId, this.#path, newObj)
	}
	setItemValue(rowId: string, subPath: string, value: unknown): void {
		// Build the new object
		const newObj = clone(this.#currentRows)
		objectPathSet(newObj, `${rowId}.${subPath}`, value)

		// Send it onwards
		this.#baseHelper.setItemValue(this.#itemId, this.#path, newObj)
	}
}
