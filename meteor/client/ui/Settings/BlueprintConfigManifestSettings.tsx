import ClassNames from 'classnames'
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import * as _ from 'underscore'
import Tooltip from 'rc-tooltip'
import { MappingsExt } from '../../../lib/collections/Studios'
import { ModalDialog } from '../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	ConfigManifestEntry,
	ConfigManifestEntryType,
	IBlueprintConfig,
	ConfigItemValue,
	ConfigManifestEntryTable,
	TableConfigItemValue,
	ConfigManifestEntrySourceLayers,
	ConfigManifestEntryLayerMappings,
	SourceLayerType,
	ConfigManifestEntrySelectFromColumn,
	ConfigManifestEntryBoolean,
	ConfigManifestEntryEnum,
	ConfigManifestEntryFloat,
	ConfigManifestEntryInt,
	ConfigManifestEntryMultilineString,
	ConfigManifestEntrySelectFromOptions,
	ConfigManifestEntryString,
	ConfigManifestEntryJson,
	BasicConfigManifestEntry,
} from '@sofie-automation/blueprints-integration'
import { objectPathGet, getRandomString, clone, literal } from '../../../lib/lib'
import { getHelpMode } from '../../lib/localStorage'
import {
	faDownload,
	faTrash,
	faPencilAlt,
	faCheck,
	faPlus,
	faUpload,
	faSortUp,
	faSortDown,
	faSort,
	faRefresh,
} from '@fortawesome/free-solid-svg-icons'
import { UploadButton } from '../../lib/uploadButton'
import { NotificationCenter, NoticeLevel, Notification } from '../../lib/notifications/notifications'
import { TFunction, useTranslation } from 'react-i18next'
import { useToggleExpandHelper } from './util/ToggleExpandedHelper'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	ObjectWithOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'
import {
	filterOverrideOpsForPrefix,
	OverrideOpHelper,
	useOverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
} from './util/OverrideOpHelper'
import { DropdownInputControl, DropdownInputOption } from '../../lib/Components/DropdownInput'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'
import { TextInputControl } from '../../lib/Components/TextInput'
import { MultiLineTextInputControl } from '../../lib/Components/MultiLineTextInput'
import { IntInputControl } from '../../lib/Components/IntInput'
import { FloatInputControl } from '../../lib/Components/FloatInput'
import { CheckboxControl } from '../../lib/Components/Checkbox'
import { MultiSelectInputControl } from '../../lib/Components/MultiSelectInput'
import { JsonTextInputControl, tryParseJson } from '../../lib/Components/JsonTextInput'

export interface SourceLayerDropdownOption extends DropdownInputOption<string> {
	type: SourceLayerType
}

function filterSourceLayers(
	select: ConfigManifestEntrySourceLayers<true | false>,
	layers: Array<SourceLayerDropdownOption>
): DropdownInputOption<string>[] {
	if (select.filters && select.filters.sourceLayerTypes) {
		const sourceLayerTypes = new Set(select.filters.sourceLayerTypes)
		return layers.filter((layer) => sourceLayerTypes.has(layer.type))
	} else {
		return layers
	}
}

function filterLayerMappings(
	select: ConfigManifestEntryLayerMappings<true | false>,
	mappings: { [studioId: string]: MappingsExt }
): DropdownInputOption<string>[] {
	const deviceTypes = select.filters?.deviceTypes
	const result: DropdownInputOption<string>[] = []

	for (const studioMappings of Object.values(mappings)) {
		for (const [layerId, mapping] of Object.entries(studioMappings)) {
			if (!deviceTypes || deviceTypes.includes(mapping.device)) {
				result.push({ name: mapping.layerName || layerId, value: layerId, i: result.length })
			}
		}
	}

	return result
}

function getTableColumnValues(
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

function getInputControl(
	manifest: BasicConfigManifestEntry | ResolvedBasicConfigManifestEntry,
	value: any,
	handleUpdate: (value: any) => void,
	layerMappings: { [studioId: string]: MappingsExt } | undefined,
	sourceLayers: Array<SourceLayerDropdownOption> | undefined,
	fullConfig: IBlueprintConfig | undefined,
	alternateConfig: IBlueprintConfig | undefined
) {
	const commonProps = {
		modifiedClassName: 'bghl',
		value: value,
		handleUpdate: handleUpdate,
	}

	switch (manifest.type) {
		case ConfigManifestEntryType.STRING:
			return <TextInputControl classNames="input text-input input-l" {...commonProps} />
		case ConfigManifestEntryType.MULTILINE_STRING:
			return <MultiLineTextInputControl classNames="input text-input input-l" {...commonProps} />
		case ConfigManifestEntryType.INT:
			return <IntInputControl classNames="input text-input input-m" {...commonProps} zeroBased={manifest.zeroBased} />
		case ConfigManifestEntryType.FLOAT:
			return <FloatInputControl classNames="input text-input input-m" {...commonProps} />
		case ConfigManifestEntryType.BOOLEAN:
			return <CheckboxControl classNames="input" {...commonProps} />
		case ConfigManifestEntryType.ENUM: {
			const options: DropdownInputOption<string>[] = manifest.options.map((opt, i) => ({ name: opt, value: opt, i }))
			return <DropdownInputControl classNames="input text-input input-l" {...commonProps} options={options} />
		}
		case ConfigManifestEntryType.JSON:
			return (
				<JsonTextInputControl
					classNames="input text-input input-l"
					modifiedClassName="bghl"
					invalidClassName="warn"
					value={tryParseJson(value)?.parsed ?? value}
					handleUpdate={(valueObj) => handleUpdate(JSON.stringify(valueObj, undefined, 2))}
				/>
			)

		case ConfigManifestEntryType.SELECT: {
			const options: DropdownInputOption<string>[] = manifest.options.map((opt, i) => ({ name: opt, value: opt, i }))
			return manifest.multiple ? (
				<MultiSelectInputControl classNames="input text-input dropdown input-l" {...commonProps} options={options} />
			) : (
				<DropdownInputControl classNames="input text-input input-l" {...commonProps} options={options} />
			)
		}
		case ConfigManifestEntryType.SOURCE_LAYERS: {
			const options = 'options' in manifest ? manifest.options : filterSourceLayers(manifest, sourceLayers ?? [])
			return manifest.multiple ? (
				<MultiSelectInputControl classNames="input text-input dropdown input-l" {...commonProps} options={options} />
			) : (
				<DropdownInputControl classNames="input text-input input-l" {...commonProps} options={options} />
			)
		}
		case ConfigManifestEntryType.LAYER_MAPPINGS: {
			const options = 'options' in manifest ? manifest.options : filterLayerMappings(manifest, layerMappings ?? {})
			return manifest.multiple ? (
				<MultiSelectInputControl classNames="input text-input dropdown input-l" {...commonProps} options={options} />
			) : (
				<DropdownInputControl classNames="input text-input input-l" {...commonProps} options={options} />
			)
		}
		case ConfigManifestEntryType.SELECT_FROM_COLUMN: {
			const options =
				'options' in manifest ? manifest.options : getTableColumnValues(manifest, fullConfig || {}, alternateConfig)
			return manifest.multiple ? (
				<MultiSelectInputControl classNames="input text-input dropdown input-l" {...commonProps} options={options} />
			) : (
				<DropdownInputControl classNames="input text-input input-l" {...commonProps} options={options} />
			)
		}
		default:
			assertNever(manifest)
			return undefined
	}
}

type ResolvedBasicConfigManifestEntry =
	| ConfigManifestEntryString
	| ConfigManifestEntryMultilineString
	| ConfigManifestEntryInt
	| ConfigManifestEntryFloat
	| ConfigManifestEntryBoolean
	| ConfigManifestEntryEnum
	| ConfigManifestEntrySelectFromOptions<boolean>
	| (ConfigManifestEntrySelectFromColumn<boolean> & { options: DropdownInputOption<string>[] })
	| (ConfigManifestEntrySourceLayers<boolean> & { options: DropdownInputOption<string>[] })
	| (ConfigManifestEntryLayerMappings<boolean> & { options: DropdownInputOption<string>[] })
	| ConfigManifestEntryJson

interface IConfigManifestSettingsProps {
	/** An 'id' of this config manifest, eg the studioId it is in refernce to */
	configManifestId: string

	manifest: ConfigManifestEntry[]

	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateConfig: IBlueprintConfig | undefined

	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: Array<SourceLayerDropdownOption>

	subPanel?: boolean

	configObject: ObjectWithOverrides<IBlueprintConfig>
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void
	pushOverride: (newOp: SomeObjectOverrideOp) => void
}
interface IConfigManifestTableProps {
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

interface BlueprintConfigManifestTableEntryProps {
	resolvedColumns: (ResolvedBasicConfigManifestEntry & { rank: number })[]

	rowValue: TableConfigItemValue[0]

	setCellValue: (id: string, col: string, value: any) => void
	removeRow: (id: string) => void

	subPanel: boolean
}
function BlueprintConfigManifestTableEntry({
	resolvedColumns,
	rowValue,
	setCellValue,
	removeRow,
	subPanel,
}: BlueprintConfigManifestTableEntryProps) {
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

interface TableSort {
	column: number
	order: 'asc' | 'desc'
}

function BlueprintConfigManifestTable({
	configManifestId,
	manifest,
	wrappedItem,
	fullConfig,
	alternateConfig,
	layerMappings,
	sourceLayers,
	subPanel,
	overrideHelper,
}: IConfigManifestTableProps) {
	const { t } = useTranslation()

	const resolvedColumns = useMemo(() => {
		// Future: this is too reactive, depending on fullConfig
		return manifest.columns
			.sort((a, b) => a.rank - b.rank)
			.map((column): ResolvedBasicConfigManifestEntry & { rank: number } => {
				switch (column.type) {
					case ConfigManifestEntryType.SOURCE_LAYERS:
						return {
							...column,
							options: sourceLayers ? filterSourceLayers(column, sourceLayers) : [],
						}
					case ConfigManifestEntryType.LAYER_MAPPINGS:
						return {
							...column,
							options: layerMappings ? filterLayerMappings(column, layerMappings) : [],
						}
					case ConfigManifestEntryType.SELECT_FROM_COLUMN:
						return {
							...column,
							options: layerMappings ? getTableColumnValues(column, fullConfig, alternateConfig) : [],
						}
					default:
						return column
				}
			})
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
							<BlueprintConfigManifestTableEntry
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

interface AddItemModalProps {
	manifest: ConfigManifestEntry[]
	config: IBlueprintConfig

	doCreate: (itemId: string, value: any) => void
}
interface AddItemModalRef {
	show: () => void
}
const AddItemModal = forwardRef(function AddItemModal(
	{ manifest, config, doCreate }: AddItemModalProps,
	ref: React.ForwardedRef<AddItemModalRef>
) {
	const { t } = useTranslation()

	const [show, setShow] = useState(false)
	const [selectedItem, setSelectedItem] = useState<string | null>(null)

	useImperativeHandle(ref, () => {
		return {
			show: () => {
				setShow(true)
			},
		}
	})

	const addOptions = useMemo(() => {
		let addOptions: DropdownInputOption<string>[] = []
		addOptions = manifest.map((c, i) => ({ value: c.id, name: c.name, i }))

		return addOptions.filter((o) => objectPathGet(config, o.value) === undefined)
	}, [manifest, config])

	useEffect(() => {
		// Make sure the selected is always valid
		setSelectedItem((id) => {
			const selected = addOptions.find((opt) => opt.value === id)
			if (selected) {
				return id
			} else {
				return addOptions[0]?.value
			}
		})
	}, [addOptions])

	const handleConfirmAddItemCancel = useCallback(() => {
		setShow(false)
		setSelectedItem(null)
	}, [])

	const handleConfirmAddItemAccept = useCallback(() => {
		const item = manifest.find((c) => c.id === selectedItem)
		if (selectedItem && item) {
			doCreate(item.id, item.defaultVal ?? '')
		}

		setShow(false)
		setSelectedItem(null)
	}, [selectedItem, manifest, doCreate])

	return (
		<ModalDialog
			title={t('Add config item')}
			acceptText={t('Add')}
			secondaryText={t('Cancel')}
			show={show}
			onAccept={handleConfirmAddItemAccept}
			onSecondary={handleConfirmAddItemCancel}
		>
			<div className="mod mvs mhs">
				<label className="field">
					{t('Item')}
					<div className="select focusable">
						<DropdownInputControl value={selectedItem ?? ''} options={addOptions} handleUpdate={setSelectedItem} />
					</div>
				</label>
			</div>
		</ModalDialog>
	)
})

interface DeleteItemModalProps {
	manifest: ConfigManifestEntry[]

	doDelete: (id: string) => void
}
interface DeleteItemModalRef {
	show: (item: ConfigManifestEntry) => void
}
const DeleteItemModal = forwardRef(function DeleteItemModal(
	{ manifest, doDelete }: DeleteItemModalProps,
	ref: React.ForwardedRef<DeleteItemModalRef>
) {
	const { t } = useTranslation()

	const [showForItem, setShowForItem] = useState<ConfigManifestEntry | null>(null)

	useImperativeHandle(ref, () => {
		return {
			show: (item: ConfigManifestEntry) => {
				setShowForItem(item)
			},
		}
	})

	const handleConfirmDeleteCancel = useCallback(() => {
		setShowForItem(null)
	}, [])

	const handleConfirmDeleteAccept = useCallback(() => {
		if (showForItem) {
			doDelete(showForItem.id)
		}

		setShowForItem(null)
	}, [showForItem, manifest])

	return (
		<ModalDialog
			title={t('Delete this item?')}
			acceptText={t('Delete')}
			secondaryText={t('Cancel')}
			show={!!showForItem}
			onAccept={handleConfirmDeleteAccept}
			onSecondary={handleConfirmDeleteCancel}
		>
			<p>
				{t('Are you sure you want to delete this config item "{{configId}}"?', {
					configId: showForItem?.name ?? '??',
				})}
			</p>
			<p>{t('Please note: This action is irreversible!')}</p>
		</ModalDialog>
	)
})

interface WrappedOverridableExt {
	manifest: ConfigManifestEntry
}
/**
 * Compile a sorted array of all the items currently in the ObjectWithOverrides, and those that have been deleted
 * @param rawConfig The ObjectWithOverrides to look at
 * @param comparitor Comparitor for sorting the items
 * @returns Sorted items, with sorted deleted items at the end
 */
function getAllCurrentAndDeletedItemsFromOverrides(
	manifest: ConfigManifestEntry[],
	rawConfig: ReadonlyDeep<ObjectWithOverrides<IBlueprintConfig>>
): Array<WrappedOverridableItem<any> & WrappedOverridableExt> {
	const resolvedObject = applyAndValidateOverrides(rawConfig).obj

	// Convert the items into an array
	const validItems: Array<WrappedOverridableItemNormal<any> & WrappedOverridableExt> = []
	for (const entry of manifest) {
		const value = objectPathGet(resolvedObject, entry.id)
		// Only include the ones with values or if they are 'required'
		if (value === undefined && !entry.required) continue

		validItems.push(
			literal<WrappedOverridableItemNormal<any> & WrappedOverridableExt>({
				type: 'normal',
				id: entry.id,
				computed: value,
				defaults: objectPathGet(rawConfig.defaults, entry.id),
				overrideOps: filterOverrideOpsForPrefix(rawConfig.overrides, entry.id).opsForPrefix,
				manifest: entry,
			})
		)
	}

	const removedOutputLayers: Array<WrappedOverridableItemDeleted<any> & WrappedOverridableExt> = []

	// Find the items which have been deleted with an override
	const computedOutputLayerIds = new Set(validItems.map((l) => l.id))
	for (const entry of manifest) {
		const value = objectPathGet(rawConfig.defaults, entry.id)
		if (!computedOutputLayerIds.has(entry.id) && value !== undefined) {
			removedOutputLayers.push(
				literal<WrappedOverridableItemDeleted<any> & WrappedOverridableExt>({
					type: 'deleted',
					id: entry.id,
					computed: undefined,
					defaults: value,
					overrideOps: filterOverrideOpsForPrefix(rawConfig.overrides, entry.id).opsForPrefix,
					manifest: entry,
				})
			)
		}
	}

	return [...validItems, ...removedOutputLayers]
}

export function BlueprintConfigManifestSettings({
	configManifestId,
	manifest,
	alternateConfig,
	layerMappings,
	sourceLayers,
	subPanel,

	configObject,
	saveOverrides,
	pushOverride,
}: IConfigManifestSettingsProps) {
	const { t } = useTranslation()

	const addRef = useRef<AddItemModalRef>(null)
	const deleteRef = useRef<DeleteItemModalRef>(null)

	const addItem = useCallback(() => {
		if (addRef.current) {
			addRef.current.show()
		}
	}, [])
	const showDelete = useCallback((item: ConfigManifestEntry) => {
		if (deleteRef.current) {
			deleteRef.current.show(item)
		}
	}, [])

	const doCreate = useCallback(
		(id: string, value: any) => {
			pushOverride(
				literal<ObjectOverrideSetOp>({
					op: 'set',
					path: id,
					value,
				})
			)
		},
		[pushOverride]
	)

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const resolvedConfig = useMemo(() => applyAndValidateOverrides(configObject).obj, [configObject])

	const sortedManifestItems = useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(manifest, configObject),
		[configObject, manifest]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, configObject) // TODO - is this appropriate?

	return (
		<div className="scroll-x">
			<AddItemModal ref={addRef} manifest={manifest} config={resolvedConfig} doCreate={doCreate} />
			<DeleteItemModal ref={deleteRef} manifest={manifest} doDelete={overrideHelper.deleteItem} />

			{subPanel ? (
				<h3 className="mhn">{t('Blueprint Configuration')}</h3>
			) : (
				<h2 className="mhn">{t('Blueprint Configuration')}</h2>
			)}

			<table className="table expando settings-studio-custom-config-table">
				<tbody>
					{sortedManifestItems.map((item) => {
						if (item.type === 'deleted') {
							return (
								<BlueprintConfigManifestDeletedEntry
									key={item.id}
									manifestEntry={item.manifest}
									defaultValue={item.defaults}
									doUndelete={overrideHelper.resetItem}
									doCreate={doCreate}
									subPanel={!!subPanel}
								/>
							)
						} else {
							return (
								<BlueprintConfigManifestEntry
									configManifestId={configManifestId}
									key={item.id}
									wrappedItem={item}
									overrideHelper={overrideHelper}
									value={item.computed}
									showDelete={showDelete}
									doCreate={doCreate}
									fullConfig={resolvedConfig} // This will react everytime the config is changed..
									alternateConfig={alternateConfig}
									layerMappings={layerMappings}
									sourceLayers={sourceLayers}
									subPanel={!!subPanel}
									isExpanded={isExpanded(item.id)}
									toggleExpanded={toggleExpanded}
								/>
							)
						}
					})}
				</tbody>
			</table>

			<div className="mod mhs">
				<button
					className={ClassNames('btn btn-primary', {
						'btn-tight': subPanel,
					})}
					onClick={addItem}
				>
					<Tooltip
						overlay={t('More settings specific to this studio can be found here')}
						visible={getHelpMode()}
						placement="right"
					>
						<FontAwesomeIcon icon={faPlus} />
					</Tooltip>
				</button>
			</div>
		</div>
	)
}

function renderConfigValue(t: TFunction, item: ConfigManifestEntry, rawValue: ConfigItemValue | undefined) {
	const value = rawValue === undefined ? item.defaultVal : rawValue

	const rawValueArr = rawValue as any[]

	switch (item.type) {
		case ConfigManifestEntryType.BOOLEAN:
			return value ? t('true') : t('false')
		case ConfigManifestEntryType.TABLE:
			return t('{{count}} rows', { count: (rawValueArr || []).length })
		case ConfigManifestEntryType.SELECT:
		case ConfigManifestEntryType.LAYER_MAPPINGS:
		case ConfigManifestEntryType.SOURCE_LAYERS:
			return Array.isArray(value) ? (
				<ul className="table-values-list">
					{(value as string[]).map((val) => (
						<li key={val}>{val}</li>
					))}
				</ul>
			) : (
				value.toString()
			)
		case ConfigManifestEntryType.INT:
			return _.isNumber(value) && item.zeroBased ? (value + 1).toString() : value.toString()
		default:
			return value.toString()
	}
}

interface BlueprintConfigManifestDeletedEntryProps {
	manifestEntry: ConfigManifestEntry
	defaultValue: any

	doUndelete: (itemId: string) => void
	doCreate: (itemId: string, value: any) => void

	subPanel: boolean
}
function BlueprintConfigManifestDeletedEntry({
	manifestEntry,
	defaultValue,
	doUndelete,
	doCreate,
	subPanel,
}: BlueprintConfigManifestDeletedEntryProps) {
	const { t } = useTranslation()

	const doUndeleteItem = useCallback(() => doUndelete(manifestEntry.id), [doUndelete, manifestEntry.id])
	const doCreateItem = useCallback(
		() => doCreate(manifestEntry.id, manifestEntry.defaultVal ?? ''),
		[doCreate, manifestEntry.id, manifestEntry.defaultVal]
	)

	return (
		<tr>
			<th className="settings-studio-custom-config-table__name c2">{manifestEntry.name}</th>
			<td className="settings-studio-custom-config-table__value c3">
				{renderConfigValue(t, manifestEntry, defaultValue)}
			</td>
			<td className="settings-studio-custom-config-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faRefresh} />
				</button>
				<button
					className={ClassNames('btn btn-primary', {
						'btn-tight': subPanel,
					})}
					onClick={doCreateItem}
				>
					<FontAwesomeIcon icon={faPlus} /> {t('Create')}
				</button>
			</td>
		</tr>
	)
}

interface BlueprintConfigManifestEntryProps {
	configManifestId: string
	value: any

	wrappedItem: WrappedOverridableItemNormal<any> & WrappedOverridableExt
	overrideHelper: OverrideOpHelper

	showDelete: (item: ConfigManifestEntry) => void
	doCreate: (itemId: string, value: any) => void

	fullConfig: IBlueprintConfig
	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateConfig: IBlueprintConfig | undefined
	layerMappings: { [studioId: string]: MappingsExt } | undefined
	sourceLayers: Array<SourceLayerDropdownOption> | undefined

	subPanel: boolean

	isExpanded: boolean
	toggleExpanded: (id: string, force?: boolean) => void
}
function BlueprintConfigManifestEntry({
	configManifestId,
	value,
	wrappedItem,
	overrideHelper,
	showDelete,
	doCreate,
	fullConfig,
	alternateConfig,
	layerMappings,
	sourceLayers,
	subPanel,
	isExpanded,
	toggleExpanded,
}: BlueprintConfigManifestEntryProps) {
	const { t } = useTranslation()

	const manifestEntry = wrappedItem.manifest

	const doShowDelete = useCallback(() => showDelete(manifestEntry), [manifestEntry, showDelete])
	const doToggleExpanded = useCallback(() => toggleExpanded(manifestEntry.id), [manifestEntry.id, toggleExpanded])

	const doCreateItem = useCallback(
		() => doCreate(manifestEntry.id, manifestEntry.defaultVal ?? ''),
		[doCreate, manifestEntry.id, manifestEntry.defaultVal]
	)

	const handleUpdate = useCallback(
		(value: any) => {
			overrideHelper.replaceItem(wrappedItem.id, value)
		},
		[overrideHelper, wrappedItem.id]
	)

	let component: React.ReactElement | undefined = undefined
	// TODO - the undefined params
	switch (manifestEntry.type) {
		case ConfigManifestEntryType.TABLE:
			component = (
				<BlueprintConfigManifestTable
					configManifestId={configManifestId}
					manifest={manifestEntry}
					wrappedItem={wrappedItem}
					layerMappings={layerMappings}
					sourceLayers={sourceLayers}
					fullConfig={fullConfig}
					alternateConfig={alternateConfig}
					subPanel={subPanel}
					overrideHelper={overrideHelper}
				/>
			)
			break
		case ConfigManifestEntryType.SELECT:
		case ConfigManifestEntryType.LAYER_MAPPINGS:
		case ConfigManifestEntryType.SOURCE_LAYERS:
			component = (
				<div className="field">
					{t('Value')}
					{getInputControl(
						manifestEntry,
						wrappedItem.computed,
						handleUpdate,
						layerMappings,
						sourceLayers,
						fullConfig,
						alternateConfig
					)}
				</div>
			)
			break
		default:
			component = (
				<label className="field">
					{t('Value')}
					{getInputControl(
						manifestEntry,
						wrappedItem.computed,
						handleUpdate,
						layerMappings,
						sourceLayers,
						fullConfig,
						alternateConfig
					)}
				</label>
			)
			break
	}

	return (
		<>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-custom-config-table__name c2">{manifestEntry.name}</th>
				<td className="settings-studio-custom-config-table__value c3">{renderConfigValue(t, manifestEntry, value)}</td>
				<td className="settings-studio-custom-config-table__actions table-item-actions c3">
					{value !== undefined ? (
						<>
							<button className="action-btn" onClick={doToggleExpanded}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							{!manifestEntry.required && (
								<button className="action-btn" onClick={doShowDelete}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							)}
						</>
					) : (
						<button
							className={ClassNames('btn btn-primary', {
								'btn-tight': subPanel,
							})}
							onClick={doCreateItem}
						>
							<FontAwesomeIcon icon={faPlus} /> {t('Create')}
						</button>
					)}
				</td>
			</tr>
			{isExpanded && value !== undefined && (
				<tr className="expando-details hl">
					<td colSpan={4}>
						<div>
							<div className="mod mvs mhs">
								<label className="field">{manifestEntry.description}</label>
							</div>
							<div className="mod mvs mhs">{component}</div>
						</div>
						<div className="mod alright">
							<button className={ClassNames('btn btn-primary')} onClick={doToggleExpanded}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</>
	)
}
