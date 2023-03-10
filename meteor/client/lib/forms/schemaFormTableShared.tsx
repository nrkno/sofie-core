import { faCheck, faPencilAlt, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { objectPathGet } from '@sofie-automation/corelib/dist/lib'
import classNames from 'classnames'
import React, { useCallback } from 'react'
import { OverrideOpHelperForItemContents } from '../../ui/Settings/util/OverrideOpHelper'
import { SchemaFormSofieEnumDefinition, SchemaSummaryField } from './schemaFormUtil'
import { SchemaFormWithOverrides } from './schemaFormWithOverrides'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'

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
	sofieEnumDefinitons: Record<string, SchemaFormSofieEnumDefinition> | undefined
	translationNamespaces: string[]
	rowId: number | string
	columns: Record<string, JSONSchema | undefined>
	editItem: (rowId: number | string, forceState?: boolean) => void

	rowItem: any

	overrideHelper: OverrideOpHelperForItemContents
}
export function SchemaFormTableEditRow({
	sofieEnumDefinitons,
	translationNamespaces,
	rowId,
	columns,
	editItem,
	rowItem,
	overrideHelper,
}: SchemaFormTableEditRowProps): JSX.Element {
	const finishEditItem = useCallback(() => editItem(rowId, false), [editItem, rowId])

	return (
		<tr className="expando-details hl" key={rowId + '-details'}>
			<td colSpan={99}>
				<div>
					{Object.entries(columns || {}).map(([id, schema]) =>
						schema ? (
							<SchemaFormWithOverrides
								key={id}
								schema={schema}
								sofieEnumDefinitons={sofieEnumDefinitons}
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
