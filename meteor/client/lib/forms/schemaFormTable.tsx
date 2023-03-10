import { faCheck, faPencilAlt, faPlus, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { clone, getRandomString, literal, objectPathGet, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import classNames from 'classnames'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { WrappedOverridableItemNormal, OverrideOpHelperForItemContents } from '../../ui/Settings/util/OverrideOpHelper'
import { useToggleExpandHelper } from '../../ui/Settings/util/ToggleExpandedHelper'
import { doModalDialog } from '../ModalDialog'
import {
	getSchemaSummaryFieldsForObject,
	SchemaFormUIField,
	SchemaSummaryField,
	translateStringIfHasNamespaces,
} from './schemaFormUtil'
import { SchemaFormWithOverrides } from './schemaFormWithOverrides'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { getSchemaDefaultValues } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaUtil'
import { hasOpWithPath } from '../Components/util'

interface SchemaFormTableProps {
	schema: JSONSchema
	translationNamespaces: string[]

	attr: string

	item: WrappedOverridableItemNormal<any>
	overrideHelper: OverrideOpHelperForItemContents
}
export const SchemaFormArrayTable = ({
	schema,
	translationNamespaces,
	attr,
	item,
	overrideHelper,
}: SchemaFormTableProps): JSX.Element => {
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

	const title = schema[SchemaFormUIField.Title]

	return (
		<>
			{title && <h2 className="mhn">{translateStringIfHasNamespaces(title, translationNamespaces)}</h2>}
			<SchemaFormInner
				rowSchema={schema.items}
				rows={rows}
				addNewItem={addNewItem}
				resyncTable={resyncTable}
				tableOverrideHelper={tableOverrideHelper}
				translationNamespaces={translationNamespaces}
				attr={attr}
				item={item}
			/>
		</>
	)
}
export const SchemaFormObjectTable = ({
	schema,
	translationNamespaces,
	attr,
	item,
	overrideHelper,
}: SchemaFormTableProps): JSX.Element => {
	const { t } = useTranslation()

	const rows: Record<string | number, any> = useMemo(
		() => Object.assign({}, (attr ? objectPathGet(item.computed, attr) : item.computed) || {}),
		[attr, item.computed]
	)

	const rowSchema = schema.patternProperties?.['']

	const addNewItem = useCallback(() => {
		// Build the new object
		const newObj = clone(rows)

		const newRow = getSchemaDefaultValues(rowSchema)

		newObj[getRandomString()] = newRow

		overrideHelper.setItemValue(item.id, attr, newObj)
	}, [rowSchema, overrideHelper, rows, item.id, attr])

	const resyncTable = useCallback(
		() => overrideHelper.clearItemOverrides(item.id, attr),
		[overrideHelper, item.id, attr]
	)

	const tableOverrideHelper = useMemo(
		() => new OverrideOpHelperObjectTable(overrideHelper, item.id, rows, attr),
		[overrideHelper, item.id, rows, attr]
	)

	const title = schema[SchemaFormUIField.Title]
	const titleElemenet = title && <h2 className="mhn">{translateStringIfHasNamespaces(title, translationNamespaces)}</h2>

	if (Object.keys(schema.properties || {}).length > 0) {
		return (
			<>
				{titleElemenet}
				{t('Table is not allowed to have `properties` defined')}{' '}
			</>
		)
	} else if (
		schema.patternProperties?.['']?.type !== 'object' ||
		Object.keys(schema.patternProperties || {}).length > 1
	) {
		return (
			<>
				{titleElemenet}
				{t('Table is only allowed the wildcard `patternProperties`')}{' '}
			</>
		)
	} else {
		return (
			<>
				{titleElemenet}
				<SchemaFormInner
					rowSchema={rowSchema}
					rows={rows}
					addNewItem={addNewItem}
					resyncTable={resyncTable}
					tableOverrideHelper={tableOverrideHelper}
					translationNamespaces={translationNamespaces}
					attr={attr}
					item={item}
				/>
			</>
		)
	}
}

interface SchemaFormTableInnerProps {
	rowSchema: JSONSchema | undefined
	rows: Record<string | number, any>

	addNewItem: () => void
	resyncTable: () => void
	tableOverrideHelper: OverrideOpHelperTableBase

	translationNamespaces: string[]

	attr: string

	item: WrappedOverridableItemNormal<any>
}
const SchemaFormInner = ({
	rowSchema,
	rows,

	addNewItem,
	resyncTable,
	tableOverrideHelper,

	translationNamespaces,
	attr,
	item,
}: SchemaFormTableInnerProps): JSX.Element => {
	const { t } = useTranslation()

	const isOverridden = hasOpWithPath(item.overrideOps, item.id, attr)

	return (
		<>
			<table className={'expando setings-config-table table'}>
				<SchemaFormTableContents
					translationNamespaces={translationNamespaces}
					columns={rowSchema?.properties || {}}
					rows={rows}
					overrideHelper={tableOverrideHelper}
				/>
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

interface SchemaFormTableContentsProps {
	columns: Record<string, JSONSchema>
	translationNamespaces: string[]

	rows: Record<string | number, any>
	overrideHelper: OverrideOpHelperTableBase
}
function SchemaFormTableContents({
	columns,
	translationNamespaces,
	rows,
	overrideHelper,
}: SchemaFormTableContentsProps) {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const confirmRemove = useCallback(
		(rowId: number | string) => {
			doModalDialog({
				title: t('Remove this item?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					overrideHelper.deleteItem(rowId + '')
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
		[t, overrideHelper]
	)

	const summaryFields = getSchemaSummaryFieldsForObject(columns)

	return (
		<>
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
					const i = i0 as string | number
					return (
						<React.Fragment key={i}>
							<SchemaTableSummaryRow
								summaryFields={summaryFields}
								rowId={i}
								showRowId={false}
								object={obj}
								isEdited={isExpanded(i)}
								editItem={toggleExpanded}
								removeItem={confirmRemove}
							/>
							{isExpanded(i) && (
								<SchemaFormTableEditRow
									translationNamespaces={translationNamespaces}
									rowId={i}
									columns={columns}
									rowObject={obj}
									editItem={toggleExpanded}
									overrideHelper={overrideHelper}
								/>
							)}
						</React.Fragment>
					)
				})}
			</tbody>
		</>
	)
}

interface SchemaTableSummaryRowProps<T extends string | number> {
	summaryFields: SchemaSummaryField[]
	showRowId: boolean
	rowId: T
	object: any
	isEdited: boolean
	editItem: (rowId: T) => void
	removeItem: (rowId: T) => void
}

export function SchemaTableSummaryRow<T extends string | number>({
	summaryFields,
	showRowId,
	rowId,
	object,
	isEdited,
	editItem,
	removeItem,
}: SchemaTableSummaryRowProps<T>): JSX.Element {
	const editItem2 = useCallback(() => editItem(rowId), [editItem, rowId])
	const removeItem2 = useCallback(() => removeItem(rowId), [removeItem, rowId])

	return (
		<tr
			className={classNames({
				hl: isEdited,
			})}
		>
			{showRowId && <th className="settings-studio-device__name c2">{rowId}</th>}

			{summaryFields.map((field) => {
				const rawValue = objectPathGet(object, field.attr)
				let value = field.transform ? field.transform(rawValue) : rawValue
				if (Array.isArray(value)) value = value.join(', ')

				return (
					<td className="settings-studio-device__primary_id c4" key={field.attr}>
						{value ?? ''}
					</td>
				)
			})}

			<td className="settings-studio-device__actions table-item-actions c1" key="action">
				<button className="action-btn" onClick={editItem2}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button className="action-btn" onClick={removeItem2}>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</td>
		</tr>
	)
}

interface SchemaFormTableEditRowProps {
	translationNamespaces: string[]
	rowId: number | string
	columns: Record<string, JSONSchema | undefined>
	editItem: (rowId: number | string, forceState?: boolean) => void

	rowObject: any

	overrideHelper: OverrideOpHelperForItemContents
}
function SchemaFormTableEditRow({
	translationNamespaces,
	rowId,
	columns,
	editItem,
	rowObject,
	overrideHelper,
}: SchemaFormTableEditRowProps) {
	const finishEditItem = useCallback(() => editItem(rowId, false), [editItem, rowId])

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
		<tr className="expando-details hl" key={rowId + '-details'}>
			<td colSpan={99}>
				<div>
					{Object.entries(columns || {}).map(([id, schema]) =>
						schema ? (
							<SchemaFormWithOverrides
								key={id}
								schema={schema}
								item={rowItem}
								attr={id}
								overrideHelper={overrideHelper}
								translationNamespaces={translationNamespaces}
								allowTables={false}
							/>
						) : (
							''
						)
					)}
				</div>
				<div className="mod alright">
					<button className={classNames('btn btn-primary')} onClick={finishEditItem}>
						<FontAwesomeIcon icon={faCheck} />
					</button>
				</div>
			</td>
		</tr>
	)
}

interface OverrideOpHelperTableBase extends OverrideOpHelperForItemContents {
	deleteItem(rowId: string): void
}

/**
 * The OverrideOp system does not support Arrays currently.
 * This is intended to be a break point to avoid tables from attempting to define operations on arrays,
 * and instead make the table be treated as a single blob.
 */
class OverrideOpHelperArrayTable implements OverrideOpHelperTableBase {
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
	deleteItem(rowId: string): void {
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

/**
 * The OverrideOp system does not support Arrays currently.
 * This is intended to be a break point to avoid tables from attempting to define operations on arrays,
 * and instead make the table be treated as a single blob.
 */
class OverrideOpHelperObjectTable implements OverrideOpHelperTableBase {
	readonly #baseHelper: OverrideOpHelperForItemContents
	readonly #itemId: string
	readonly #currentRows: Record<string | number, any>
	readonly #path: string

	constructor(
		baseHelper: OverrideOpHelperForItemContents,
		itemId: string,
		currentRows: Record<string | number, any>,
		path: string
	) {
		this.#baseHelper = baseHelper
		this.#itemId = itemId
		this.#currentRows = currentRows
		this.#path = path
	}

	clearItemOverrides(_itemId: string, _subPath: string): void {
		// Not supported as this is faking an item with overrides
	}
	deleteItem(rowId: string): void {
		// Delete the row
		const newObj = clone(this.#currentRows)
		delete newObj[rowId]

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
