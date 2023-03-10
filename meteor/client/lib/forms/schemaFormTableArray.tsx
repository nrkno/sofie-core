import { faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { clone, objectPathGet, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { WrappedOverridableItemNormal, OverrideOpHelperForItemContents } from '../../ui/Settings/util/OverrideOpHelper'
import { useToggleExpandHelper } from '../../ui/Settings/util/ToggleExpandedHelper'
import { doModalDialog } from '../ModalDialog'
import {
	getSchemaSummaryFieldsForObject,
	SchemaFormSofieEnumDefinition,
	SchemaFormUIField,
	SchemaSummaryField,
	translateStringIfHasNamespaces,
} from './schemaFormUtil'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { getSchemaDefaultValues } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaUtil'
import { hasOpWithPath } from '../Components/util'
import { SchemaTableSummaryRow, SchemaFormTableEditRow } from './schemaFormTableShared'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'

interface SchemaFormTableProps {
	schema: JSONSchema
	translationNamespaces: string[]
	sofieEnumDefinitons?: Record<string, SchemaFormSofieEnumDefinition>

	attr: string

	item: WrappedOverridableItemNormal<any>
	overrideHelper: OverrideOpHelperForItemContents
}
export const SchemaFormArrayTable = ({
	schema,
	translationNamespaces,
	sofieEnumDefinitons,
	attr,
	item,
	overrideHelper,
}: SchemaFormTableProps): JSX.Element => {
	const { t } = useTranslation()

	const rowsArray: any[] = useMemo(
		() => (attr ? objectPathGet(item.computed, attr) : item.computed) || [],
		[attr, item.computed]
	)
	const rows: Record<string | number, any> = useMemo(() => Object.assign({}, rowsArray), [rowsArray])

	const addNewItem = useCallback(() => {
		// Build the new object
		const newObj = clone(rowsArray)
		newObj.push(getSchemaDefaultValues(schema.items))

		// Send it onwards
		overrideHelper.setItemValue(item.id, attr, newObj)
	}, [schema.items, overrideHelper, rowsArray, item.id, attr])

	const resyncTable = useCallback(
		() => overrideHelper.clearItemOverrides(item.id, attr),
		[overrideHelper, item.id, attr]
	)

	const tableOverrideHelper = useMemo(
		() => new OverrideOpHelperArrayTable(overrideHelper, item.id, rowsArray, attr),
		[overrideHelper, item.id, rows, attr]
	)

	const isOverridden = hasOpWithPath(item.overrideOps, item.id, attr)

	const columns = useMemo(() => schema?.items?.properties || {}, [schema])
	const summaryFields = useMemo(() => getSchemaSummaryFieldsForObject(columns), [columns])
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const confirmRemove = useCallback(
		(rowId: number | string) => {
			doModalDialog({
				title: t('Remove this item?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					tableOverrideHelper.deleteRow(rowId + '')
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove {{type}} "{{deviceId}}"?', {
								type: 'item',
								deviceId: rowId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		},
		[t, tableOverrideHelper]
	)

	const title = schema[SchemaFormUIField.Title]

	return (
		<>
			{title && <h2 className="mhn">{translateStringIfHasNamespaces(title, translationNamespaces)}</h2>}
			<table className={'expando setings-config-table table'}>
				<thead>
					<tr className="hl">
						{summaryFields.map((col) => {
							return <th key={col.attr}>{translateStringIfHasNamespaces(col.name, translationNamespaces)}</th>
						})}
						<th key="action">&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(rows).map(([i0, obj]) => {
						const i = Number(i0)

						return (
							<TableRow
								key={i}
								columns={columns}
								summaryFields={summaryFields}
								translationNamespaces={translationNamespaces}
								sofieEnumDefinitons={sofieEnumDefinitons}
								overrideHelper={tableOverrideHelper}
								rowId={i}
								rowObject={obj}
								isExpanded={isExpanded(i)}
								toggleExpanded={toggleExpanded}
								confirmRemove={confirmRemove}
							/>
						)
					})}
				</tbody>
			</table>

			<div className="mod mhs">
				<button className="btn btn-primary" onClick={addNewItem}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
				&nbsp;
				{item.defaults && (
					<button className="btn btn-primary" onClick={resyncTable} title="Reset to default" disabled={!isOverridden}>
						{t('Reset')}
						&nbsp;
						<FontAwesomeIcon icon={faSync} />
					</button>
				)}
			</div>
		</>
	)
}

interface TableRowProps {
	columns: Record<string, JSONSchema | undefined>
	summaryFields: SchemaSummaryField[]
	translationNamespaces: string[]
	sofieEnumDefinitons: Record<string, SchemaFormSofieEnumDefinition> | undefined

	overrideHelper: OverrideOpHelperArrayTable

	rowId: number
	rowObject: any

	isExpanded: boolean
	toggleExpanded: (rowId: number | string, forceState?: boolean) => void
	confirmRemove: (rowId: number | string) => void
}
function TableRow({
	columns,
	summaryFields,
	translationNamespaces,
	sofieEnumDefinitons,
	overrideHelper,
	rowId,
	rowObject,
	isExpanded,
	toggleExpanded,
	confirmRemove,
}: TableRowProps) {
	const rowItem = useMemo(
		() =>
			literal<WrappedOverridableItemNormal<any>>({
				type: 'normal',
				id: rowId + '',
				computed: rowObject,
				defaults: undefined,
				overrideOps: [],
			}),
		[rowObject, rowId]
	)

	return (
		<React.Fragment key={rowId}>
			<SchemaTableSummaryRow
				summaryFields={summaryFields}
				rowId={rowId}
				showRowId={false}
				object={rowObject}
				isEdited={isExpanded}
				editItem={toggleExpanded}
				removeItem={confirmRemove}
			/>
			{isExpanded && (
				<SchemaFormTableEditRow
					translationNamespaces={translationNamespaces}
					sofieEnumDefinitons={sofieEnumDefinitons}
					rowId={rowId}
					columns={columns}
					rowItem={rowItem}
					editItem={toggleExpanded}
					overrideHelper={overrideHelper}
				/>
			)}
		</React.Fragment>
	)
}

/**
 * The OverrideOp system does not support Arrays currently.
 * This is intended to be a break point to avoid tables from attempting to define operations on arrays,
 * and instead make the table be treated as a single blob.
 */
class OverrideOpHelperArrayTable implements OverrideOpHelperForItemContents {
	readonly #baseHelper: OverrideOpHelperForItemContents
	readonly #itemId: string
	readonly #currentRows: any[]
	readonly #path: string

	constructor(baseHelper: OverrideOpHelperForItemContents, itemId: string, currentRows: any[], path: string) {
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
	setItemValue(rowId: string, subPath: string, value: any): void {
		// Build the new object
		const newObj = clone(this.#currentRows)
		objectPathSet(newObj, `${rowId}.${subPath}`, value)

		// Send it onwards
		this.#baseHelper.setItemValue(this.#itemId, this.#path, newObj)
	}
}
