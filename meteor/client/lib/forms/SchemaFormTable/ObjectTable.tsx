import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getRandomString, joinObjectPathFragments, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
	WrappedOverridableItemNormal,
	OverrideOpHelperForItemContents,
	getAllCurrentAndDeletedItemsFromOverrides,
} from '../../../ui/Settings/util/OverrideOpHelper'
import { useToggleExpandHelper } from '../../../ui/Settings/util/ToggleExpandedHelper'
import { doModalDialog } from '../../ModalDialog'
import {
	getSchemaSummaryFieldsForObject,
	SchemaFormSofieEnumDefinition,
	translateStringIfHasNamespaces,
} from '../schemaFormUtil'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { getSchemaDefaultValues, SchemaFormUIField } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaUtil'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { SchemaFormTableEditRow } from './TableEditRow'
import { SchemaTableSummaryRow } from '../SchemaTableSummaryRow'
import { OverrideOpHelperObjectTable } from './ObjectTableOpHelper'
import { ObjectTableDeletedRow } from './ObjectTableDeletedRow'
import { SchemaFormSectionHeader } from '../SchemaFormSectionHeader'

interface SchemaFormObjectTableProps {
	/** Schema for each row in the table */
	schema: JSONSchema
	/** Translation namespaces for the schama */
	translationNamespaces: string[]
	/** Allow special 'built-in' enum types to be used with the 'ui:sofie-enum' property in the schema */
	sofieEnumDefinitons?: Record<string, SchemaFormSofieEnumDefinition>

	/** The base item, containing the rows represented in the table */
	item: WrappedOverridableItemNormal<any>
	/** Base property path for the rows inside the item */
	attr: string
	/** Helper to create/update the OverrideOps for the table rows */
	overrideHelper: OverrideOpHelperForItemContents
}

/**
 * An object based table using JSONSchema. This allows for granular overrides, as well as adding and removing rows.
 * This should not be used directly, and should instead be used via SchemaFormWithOverrides or one of the alternative wrappers
 */
export const SchemaFormObjectTable = ({
	schema,
	translationNamespaces,
	sofieEnumDefinitons,
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
	const description = schema[SchemaFormUIField.Description]
	const titleElement = title && (
		<SchemaFormSectionHeader title={title} description={description} translationNamespaces={translationNamespaces} />
	)

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
			<div className="settings-config-table">
				{titleElement}
				<table className={'expando table'}>
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
								<ObjectTableDeletedRow
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
											sofieEnumDefinitons={sofieEnumDefinitons}
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
			</div>
		)
	}
}
