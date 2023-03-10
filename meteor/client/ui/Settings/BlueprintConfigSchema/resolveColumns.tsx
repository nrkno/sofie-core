import { ConfigManifestEntrySelectFromColumn, IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { DropdownInputOption } from '../../../lib/Components/DropdownInput'

export function getTableColumnValues(
	item: ConfigManifestEntrySelectFromColumn<boolean>,
	object: IBlueprintConfig,
	alternateConfig: IBlueprintConfig | undefined
): DropdownInputOption<string>[] {
	const attribute = item.tableId
	const table = objectPathGet(object, attribute) ?? objectPathGet(alternateConfig, attribute)
	const result: DropdownInputOption<string>[] = []
	if (!Array.isArray(table)) {
		return result
	}
	table.forEach((row) => {
		if (typeof row === 'object' && row[item.columnId] !== undefined) {
			result.push({
				name: `${row[item.columnId]}`,
				value: `${row[item.columnId]}`,
				i: result.length,
			})
		}
	})
	return result
}
