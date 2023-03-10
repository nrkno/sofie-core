import { faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { clone, getRandomString, objectPathGet, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
	WrappedOverridableItemNormal,
	OverrideOpHelperForItemContents,
	getAllCurrentAndDeletedItemsFromOverrides,
	WrappedOverridableItem,
} from '../../ui/Settings/util/OverrideOpHelper'
import { useToggleExpandHelper } from '../../ui/Settings/util/ToggleExpandedHelper'
import { doModalDialog } from '../ModalDialog'
import {
	getSchemaSummaryFieldsForObject,
	joinObjectPathFragments,
	SchemaFormUIField,
	SchemaSummaryField,
	translateStringIfHasNamespaces,
} from './schemaFormUtil'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { getSchemaDefaultValues } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaUtil'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { SchemaFormTableEditRow, SchemaTableSummaryRow } from './schemaFormTableShared'

interface SchemaFormObjectTableProps {
	schema: JSONSchema
	translationNamespaces: string[]

	attr: string

	item: WrappedOverridableItemNormal<any>
	overrideHelper: OverrideOpHelperForItemContents
}
export const SchemaFormObjectTable = ({
	schema,
	translationNamespaces,
	attr,
	item,
	overrideHelper,
}: SchemaFormObjectTableProps): JSX.Element => {
	const { t } = useTranslation()

	const wrappedRows = useMemo(() => {
		const rawRows = (attr ? objectPathGet(item.defaults, attr) : item.defaults) || {}

		const prefix = joinObjectPathFragments(item.id, attr) + '.'

		// Filter and strip the ops to be local to the row object
		const ops: SomeObjectOverrideOp[] = []
		for (const op of item.overrideOps) {
			if (op.path.startsWith(prefix)) {
				ops.push({
					...op,
					path: op.path.slice(prefix.length),
				})
			}
		}

		const wrappedRows = getAllCurrentAndDeletedItemsFromOverrides(
			{
				defaults: rawRows,
				overrides: ops,
			},
			(a, b) => a[0].localeCompare(b[0]) // TODO - better comparitor?
		)

		return wrappedRows
	}, [attr, item.computed])

	const rowSchema = schema.patternProperties?.['']

	const addNewItem = useCallback(() => {
		overrideHelper.setItemValue(item.id, `${attr}.${getRandomString()}`, getSchemaDefaultValues(rowSchema))
	}, [rowSchema, overrideHelper, item.id, attr])

	const doUndeleteRow = useCallback(
		(rowId: string) => {
			console.log('undelete', item.id, joinObjectPathFragments(attr, rowId), rowId)
			overrideHelper.clearItemOverrides(item.id, joinObjectPathFragments(attr, rowId))
		},
		[overrideHelper, item.id, attr]
	)

	const tableOverrideHelper = useMemo(
		() => new OverrideOpHelperObjectTable(overrideHelper, item.id, wrappedRows, attr),
		[overrideHelper, item.id, wrappedRows, attr]
	)

	const columns = useMemo(() => rowSchema?.properties ?? {}, [rowSchema])
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
	const titleElement = title && <h2 className="mhn">{translateStringIfHasNamespaces(title, translationNamespaces)}</h2>

	if (Object.keys(schema.properties || {}).length > 0) {
		return (
			<>
				{titleElement}
				{t('Table is not allowed to have `properties` defined')}{' '}
			</>
		)
	} else if (
		schema.patternProperties?.['']?.type !== 'object' ||
		Object.keys(schema.patternProperties || {}).length > 1
	) {
		return (
			<>
				{titleElement}
				{t('Table is only allowed the wildcard `patternProperties`')}{' '}
			</>
		)
	} else {
		return (
			<>
				{titleElement}
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
						{wrappedRows.map((rowItem) =>
							rowItem.type === 'deleted' ? (
								<TableDeletedRow
									key={rowItem.id}
									summaryFields={summaryFields}
									id={rowItem.id}
									obj={rowItem.defaults}
									doUndelete={doUndeleteRow}
								/>
							) : (
								<React.Fragment key={rowItem.id}>
									<SchemaTableSummaryRow
										summaryFields={summaryFields}
										rowId={rowItem.id}
										showRowId={false}
										object={rowItem.computed}
										isEdited={isExpanded(rowItem.id)}
										editItem={toggleExpanded}
										removeItem={confirmRemove}
									/>
									{isExpanded(rowItem.id) && (
										<SchemaFormTableEditRow
											translationNamespaces={translationNamespaces}
											rowId={rowItem.id}
											columns={columns}
											rowItem={rowItem}
											editItem={toggleExpanded}
											overrideHelper={tableOverrideHelper}
										/>
									)}
								</React.Fragment>
							)
						)}
					</tbody>
				</table>

				<div className="mod mhs">
					<button className="btn btn-primary" onClick={addNewItem}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</>
		)
	}
}

interface TableDeletedRowProps {
	summaryFields: SchemaSummaryField[]
	id: string
	obj: any
	doUndelete: (itemId: string) => void
}
function TableDeletedRow({ summaryFields, id, obj, doUndelete }: TableDeletedRowProps) {
	const doUndeleteItem = useCallback(() => doUndelete(id), [doUndelete, id])

	return (
		<tr>
			{summaryFields.map((field) => {
				const rawValue = objectPathGet(obj, field.attr)
				let value = field.transform ? field.transform(rawValue) : rawValue
				if (Array.isArray(value)) value = value.join(', ')

				return (
					<td className="settings-studio-device__primary_id c4 deleted" key={field.attr}>
						{value ?? ''}
					</td>
				)
			})}

			<td className="settings-studio-device__actions table-item-actions c1" key="action">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

/**
 * The OverrideOp system does not support tables of objects currently.
 * This is intended to be a break point to allow tables to provide their nested schemaForms with a way to work with this
 */
class OverrideOpHelperObjectTable implements OverrideOpHelperForItemContents {
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
	setItemValue(rowId: string, subPath: string, value: any): void {
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
