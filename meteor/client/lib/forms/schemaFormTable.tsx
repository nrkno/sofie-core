import { faCheck, faPencilAlt, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import classNames from 'classnames'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { i18nTranslator } from '../../ui/i18n'
import { useToggleExpandHelper } from '../../ui/Settings/util/ToggleExpandedHelper'
import { doModalDialog } from '../ModalDialog'
import { JSONSchema } from './schema-types'
import { SchemaForm } from './schemaForm'
import {
	getSchemaDefaultValues,
	getSchemaSummaryFieldsForObject,
	joinFragments,
	SchemaFormUpdateFunction,
	SchemaSummaryField,
} from './schemaFormUtil'

interface SchemaFormTableProps {
	schema: JSONSchema
	translationNamespaces: string[] | undefined
	object: any
	updateFunction: SchemaFormUpdateFunction | undefined
}
export const SchemaFormTable = ({ schema, translationNamespaces, object, updateFunction }: SchemaFormTableProps) => {
	const addNewItem = useMemo((): (() => void) => {
		const newObj = getSchemaDefaultValues(schema.items)

		if (updateFunction) {
			return () => {
				updateFunction('', newObj, 'push')
			}
		} else {
			return () => {
				object.push(newObj)
			}
		}
	}, [schema.items?.properties])

	const title = schema['ui:title']

	return (
		<>
			{title && (
				<h2 className="mhn">
					{translationNamespaces
						? translateMessage({ key: title, namespaces: translationNamespaces }, i18nTranslator)
						: title}
				</h2>
			)}
			<table className={'expando setings-config-table table'}>
				<SchemaFormTableContents
					translationNamespaces={translationNamespaces}
					columns={schema.items?.properties || {}}
					object={object}
					updateFunction={updateFunction}
				/>
			</table>

			<div className="mod mhs">
				<button className="btn btn-primary" onClick={addNewItem}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</>
	)
}

interface SchemaFormTableContentsProps {
	columns: Record<string, JSONSchema>
	translationNamespaces: string[] | undefined
	object: any
	updateFunction: SchemaFormUpdateFunction | undefined
}
function SchemaFormTableContents({
	columns,
	translationNamespaces,
	object,
	updateFunction,
}: SchemaFormTableContentsProps) {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const confirmRemove = useCallback(
		(rowId: number) => {
			doModalDialog({
				title: t('Remove this item?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					if (updateFunction) {
						updateFunction('', rowId, 'pull')
					} else {
						delete object[rowId]
					}
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
		[t, object, updateFunction]
	)

	const summaryFields = getSchemaSummaryFieldsForObject(columns)

	return (
		<>
			<thead>
				<tr className="hl">
					{summaryFields.map((col) => (
						<th key={col.attr}>{col.name}</th>
					))}
					<th key="action">&nbsp;</th>
				</tr>
			</thead>
			<tbody>
				{(object || []).map((obj: any, i: number) => {
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
									object={obj}
									editItem={toggleExpanded}
									updateFunction={updateFunction}
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
}: SchemaTableSummaryRowProps<T>) {
	const els: Array<JSX.Element> = summaryFields.map((field) => {
		const rawValue = objectPathGet(object, field.attr)
		const value = field.transform ? field.transform(rawValue) : rawValue

		return (
			<td className="settings-studio-device__primary_id c4" key={field.attr}>
				{value ?? ''}
			</td>
		)
	})

	const editItem2 = useCallback(() => editItem(rowId), [editItem, rowId])
	const removeItem2 = useCallback(() => removeItem(rowId), [removeItem, rowId])

	return (
		<tr
			className={classNames({
				hl: isEdited,
			})}
		>
			{showRowId && <th className="settings-studio-device__name c2">{rowId}</th>}
			{els}
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
	translationNamespaces: string[] | undefined
	rowId: number
	columns: Record<string, JSONSchema | undefined>
	object: any
	editItem: (rowId: number, forceState?: boolean) => void
	updateFunction: SchemaFormUpdateFunction | undefined
}
function SchemaFormTableEditRow({
	translationNamespaces,
	rowId,
	columns,
	object,
	editItem,
	updateFunction,
}: SchemaFormTableEditRowProps) {
	const finishEditItem = useCallback(() => editItem(rowId, false), [editItem, rowId])

	const updateFunction2 = useMemo(() => {
		const fn = updateFunction
		if (fn) {
			return (path: string, value: any) => {
				const path2 = joinFragments(rowId, path)

				return fn(path2, value)
			}
		}
	}, [rowId, updateFunction])

	return (
		<tr className="expando-details hl" key={rowId + '-details'}>
			<td colSpan={99}>
				<div>
					{Object.entries(columns || {}).map(([id, schema]) =>
						schema ? (
							<SchemaForm
								key={id}
								schema={schema}
								object={object}
								attr={id}
								updateFunction={updateFunction2}
								translationNamespaces={translationNamespaces}
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
