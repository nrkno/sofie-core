import { faSortUp, faSortDown, faSort, faPlus, faDownload, faUpload, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	TableConfigItemValue,
	ConfigManifestEntryType,
	ConfigManifestEntryTable,
	IBlueprintConfig,
} from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { clone, getRandomString } from '@sofie-automation/corelib/dist/lib'
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import _ from 'underscore'
import { NotificationCenter, NoticeLevel, Notification } from '../../../../lib/notifications/notifications'
import { UploadButton } from '../../../lib/uploadButton'
import { WrappedOverridableItemNormal, OverrideOpHelper } from '../util/OverrideOpHelper'
import { ResolvedBasicConfigManifestEntry, resolveTableColumns, SourceLayerDropdownOption } from './resolveColumns'
import ClassNames from 'classnames'
import { getInputControl } from './InputControl'

interface TableSort {
	column: number
	order: 'asc' | 'desc'
}

export interface IConfigManifestTableProps {
	configManifestId: string

	manifest: ConfigManifestEntryTable
	wrappedItem: WrappedOverridableItemNormal<TableConfigItemValue>

	fullConfig: IBlueprintConfig
	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateConfig: IBlueprintConfig | undefined
	overrideHelper: OverrideOpHelper

	layerMappings: { [studioId: string]: MappingsExt } | undefined
	sourceLayers: Array<SourceLayerDropdownOption> | undefined

	subPanel: boolean
}

export function BlueprintConfigManifestTable({
	configManifestId,
	manifest,
	wrappedItem,
	fullConfig,
	alternateConfig,
	layerMappings,
	sourceLayers,
	subPanel,
	overrideHelper,
}: IConfigManifestTableProps): JSX.Element {
	const { t } = useTranslation()

	const resolvedColumns = useMemo(() => {
		// Future: this is too reactive, depending on fullConfig
		return resolveTableColumns(manifest, layerMappings, sourceLayers, fullConfig, alternateConfig)
	}, [manifest.columns, sourceLayers, layerMappings, fullConfig, alternateConfig])

	const sortedColumns = useMemo(() => {
		const columns = [...manifest.columns]
		columns.sort((a, b) => {
			if (a.rank > b.rank) return 1
			if (a.rank < b.rank) return -1

			return 0
		})
		return columns
	}, [manifest.columns])

	const configEntry = manifest

	const [tableSort, setTableSort] = useState<TableSort>({ column: -1, order: 'asc' })

	const changeSort = useCallback((columnNumber: number) => {
		setTableSort((oldSort) => {
			if (oldSort.column === columnNumber) {
				if (oldSort.order === 'asc') {
					return {
						column: columnNumber,
						order: 'desc',
					}
				} else {
					return {
						column: -1,
						order: 'asc',
					}
				}
			} else {
				return {
					column: columnNumber,
					order: 'asc',
				}
			}
		})
	}, [])

	// Limit reactivity of some callbacks callback, by passing values through a ref
	const currentValueRef = useRef(wrappedItem.computed)
	useEffect(() => {
		currentValueRef.current = wrappedItem.computed
	}, [wrappedItem.computed])

	const addRow = useCallback(() => {
		if (currentValueRef.current) {
			const rowDefault: any = {
				_id: getRandomString(),
			}

			for (const column of configEntry.columns) {
				rowDefault[column.id] = clone<any>(column.defaultVal)
			}

			overrideHelper.replaceItem(configEntry.id, [...currentValueRef.current, rowDefault])
		}
	}, [overrideHelper, configEntry.id, configEntry.columns])

	const removeRow = useCallback(
		(id: string) => {
			if (currentValueRef.current) {
				overrideHelper.replaceItem(
					configEntry.id,
					currentValueRef.current.filter((row) => row._id !== id)
				)
			}
		},
		[overrideHelper, configEntry.id]
	)
	const setCellValue = useCallback(
		(rowId: string, colId: string, value: any) => {
			if (currentValueRef.current) {
				const newVals = currentValueRef.current.map((row) => {
					if (row._id === rowId) {
						return {
							...row,
							[colId]: value,
						}
					} else {
						return row
					}
				})

				overrideHelper.replaceItem(configEntry.id, newVals)
			}
		},
		[overrideHelper, configEntry.id]
	)

	const exportJSON = useCallback(() => {
		if (currentValueRef.current) {
			const jsonStr = JSON.stringify(currentValueRef.current, undefined, 4)

			const element = document.createElement('a')
			element.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
			element.download = `${configManifestId}_config_${configEntry.id}.json`

			document.body.appendChild(element) // Required for this to work in FireFox
			element.click()
			document.body.removeChild(element) // Required for this to work in FireFox
		}
	}, [configEntry.id, configManifestId, currentValueRef])

	const [uploadFileKey, setUploadFileKey] = useState<number | null>(null)
	const importJSON = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files ? e.target.files[0] : null
			if (!file) {
				return
			}

			const reader = new FileReader()
			reader.onload = (e2) => {
				// On file upload

				setUploadFileKey(Date.now())

				const uploadFileContents = (e2.target as any).result

				// Parse the config
				let newConfig: TableConfigItemValue = []
				try {
					newConfig = JSON.parse(uploadFileContents)
					if (!_.isArray(newConfig)) {
						throw new Error('Not an array')
					}
				} catch (err) {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to update config: {{errorMessage}}', { errorMessage: err + '' }),
							'ConfigManifestSettings'
						)
					)
					return
				}

				// Validate the config
				const conformedConfig: TableConfigItemValue = newConfig.map((entry) => {
					const newEntry: TableConfigItemValue[0] = {
						_id: entry._id || getRandomString(),
					}

					// Ensure all fields are defined
					for (const col of configEntry.columns) {
						newEntry[col.id] = entry[col.id] !== undefined ? entry[col.id] : col.defaultVal
					}
					return newEntry
				})

				overrideHelper.replaceItem(configEntry.id, conformedConfig)
			}
			reader.readAsText(file)
		},
		[t, overrideHelper, configEntry.id, configEntry.columns]
	)

	const sortedRows: TableConfigItemValue = [...(wrappedItem.computed || [])]
	if (tableSort.column >= 0) {
		sortedRows.sort((x, y) => {
			const col = configEntry.columns[tableSort.column]
			let a
			let b
			if (tableSort.order === 'asc') {
				a = x[col.id]
				b = y[col.id]
			} else {
				a = y[col.id]
				b = x[col.id]
			}
			switch (col.type) {
				case ConfigManifestEntryType.STRING:
					if (a === '') {
						return 1
					} else if (b === '') {
						return -1
					} else {
						return (a as string).localeCompare(b as string)
					}
				case ConfigManifestEntryType.INT:
				case ConfigManifestEntryType.FLOAT:
					return (a as number) - (b as number)
				default:
					return 0
			}
		})
	}
	return (
		<div>
			<div className="settings-studio-sticky-scroller">
				<table className="table">
					<thead>
						<tr>
							{sortedColumns.map((col, i) => (
								<th key={col.id}>
									<span title={col.description}>{col.name} </span>
									{(col.type === ConfigManifestEntryType.STRING ||
										col.type === ConfigManifestEntryType.INT ||
										col.type === ConfigManifestEntryType.FLOAT) && (
										<button
											className={ClassNames('action-btn', {
												disabled: tableSort.column !== i,
											})}
											onClick={() => changeSort(i)}
										>
											<FontAwesomeIcon
												icon={tableSort.column === i ? (tableSort.order === 'asc' ? faSortUp : faSortDown) : faSort}
											/>
										</button>
									)}
								</th>
							))}
							<th>&nbsp;</th>
						</tr>
					</thead>
					<tbody>
						{sortedRows.map((rowValue) => (
							<BlueprintConfigManifestTableRow
								key={rowValue._id}
								resolvedColumns={resolvedColumns}
								setCellValue={setCellValue}
								rowValue={rowValue}
								removeRow={removeRow}
								subPanel={subPanel}
							/>
						))}
					</tbody>
				</table>
			</div>
			<button
				className={ClassNames('btn btn-primary', {
					'btn-tight': subPanel,
				})}
				onClick={addRow}
			>
				<FontAwesomeIcon icon={faPlus} />
			</button>
			<button
				className={ClassNames('btn mlm btn-secondary', {
					'btn-tight': subPanel,
				})}
				onClick={exportJSON}
			>
				<FontAwesomeIcon icon={faDownload} />
				&nbsp;{t('Export')}
			</button>
			<UploadButton
				className={ClassNames('btn btn-secondary mls', {
					'btn-tight': subPanel,
				})}
				accept="application/json,.json"
				onChange={importJSON}
				key={uploadFileKey}
			>
				<FontAwesomeIcon icon={faUpload} />
				&nbsp;{t('Import')}
			</UploadButton>
		</div>
	)
}

interface BlueprintConfigManifestTableRowProps {
	resolvedColumns: (ResolvedBasicConfigManifestEntry & { rank: number })[]

	rowValue: TableConfigItemValue[0]

	setCellValue: (id: string, col: string, value: any) => void
	removeRow: (id: string) => void

	subPanel: boolean
}
function BlueprintConfigManifestTableRow({
	resolvedColumns,
	rowValue,
	setCellValue,
	removeRow,
	subPanel,
}: BlueprintConfigManifestTableRowProps) {
	const doRemoveRow = useCallback(() => removeRow(rowValue._id), [removeRow, rowValue._id])

	return (
		<tr>
			{resolvedColumns.map((col) => (
				<td key={col.id}>
					{getInputControl(
						col,
						rowValue[col.id],
						(value) => {
							setCellValue(rowValue._id, col.id, value)
						},
						// These are defined on the column manifest if they are needed
						undefined,
						undefined,
						undefined,
						undefined
					)}
				</td>
			))}
			<td>
				<button
					className={ClassNames('btn btn-danger', {
						'btn-tight': subPanel,
					})}
					onClick={doRemoveRow}
				>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</td>
		</tr>
	)
}
