import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useCallback } from 'react'
import { OverrideOpHelperForItemContents } from '../../../ui/Settings/util/OverrideOpHelper'
import { SchemaFormSofieEnumDefinition } from '../schemaFormUtil'
import { SchemaFormWithOverrides } from '../SchemaFormWithOverrides'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'

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
				<div className="properties-grid">
					{Object.entries<JSONSchema | undefined>(columns || {}).map(([id, schema]) =>
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
