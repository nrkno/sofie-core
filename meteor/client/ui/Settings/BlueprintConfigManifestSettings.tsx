import * as objectPath from 'object-path'
import ClassNames from 'classnames'
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import * as _ from 'underscore'
import Tooltip from 'rc-tooltip'
import { MappingsExt } from '../../../lib/collections/Studios'
import { EditAttribute } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	ConfigManifestEntry,
	ConfigManifestEntryType,
	IBlueprintConfig,
	BasicConfigManifestEntry,
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
} from '@sofie-automation/blueprints-integration'
import { DBObj, ProtectedString, objectPathGet, getRandomString, clone, literal } from '../../../lib/lib'
import { MongoModifier } from '../../../lib/typings/meteor'
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
import { MongoCollection } from '../../../lib/collections/lib'
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
import { TextInputControlWithOverride } from '../../lib/Components/TextInput'
import { t } from 'i18next'
import { MultiLineTextInputControlWithOverride } from '../../lib/Components/MultiLineTextInput'
import { isEqual } from 'underscore'
import { IntInputControlWithOverride } from '../../lib/Components/IntInput'
import { FloatInputControlWithOverride } from '../../lib/Components/FloatInput'
import { CheckboxControlWithOverride } from '../../lib/Components/Checkbox'

function filterSourceLayers(
	select: ConfigManifestEntrySourceLayers<true | false>,
	layers: Array<{ name: string; value: string; type: SourceLayerType }>
): Array<{ name: string; value: string; type: SourceLayerType }> {
	if (select.filters && select.filters.sourceLayerTypes) {
		const sourceLayerTypes = select.filters.sourceLayerTypes
		return _.filter(layers, (layer) => {
			return sourceLayerTypes.includes(layer.type)
		})
	} else {
		return layers
	}
}

function filterLayerMappings(
	select: ConfigManifestEntryLayerMappings<true | false>,
	mappings: { [key: string]: MappingsExt }
): Array<{ name: string; value: string }> {
	const deviceTypes = select.filters?.deviceTypes
	const result: Array<{ name: string; value: string }> = []

	for (const studioMappings of Object.values(mappings)) {
		for (const [layerId, mapping] of Object.entries(studioMappings)) {
			if (!deviceTypes || deviceTypes.includes(mapping.device)) {
				result.push({ name: mapping.layerName || layerId, value: layerId })
			}
		}
	}

	return result
}

function getTableColumnValues<DBInterface extends { _id: ProtectedString<any> }>(
	item: ConfigManifestEntrySelectFromColumn<boolean>,
	configPath: string,
	object: DBInterface,
	alternateObject?: any
): string[] {
	const attribute = `${configPath}.${item.tableId}`
	const table = objectPathGet(object, attribute) ?? objectPathGet(alternateObject, attribute)
	const result: string[] = []
	if (!Array.isArray(table)) {
		return result
	}
	table.forEach((row) => {
		if (typeof row === 'object' && row[item.columnId] !== undefined) {
			result.push(row[item.columnId])
		}
	})
	return result
}

function getEditAttribute<DBInterface extends { _id: ProtectedString<any> }>(
	collection: MongoCollection<DBInterface>,
	configPath: string,
	object: DBInterface,
	item: BasicConfigManifestEntry | ResolvedBasicConfigManifestEntry,
	attribute: string,
	layerMappings: { [key: string]: MappingsExt } | undefined,
	sourceLayers: Array<{ name: string; value: string; type: SourceLayerType }> | undefined,
	alternateObject?: any
) {
	switch (item.type) {
		case ConfigManifestEntryType.STRING:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={object}
					type="text"
					collection={collection}
					className="input text-input input-l"
				/>
			)
		case ConfigManifestEntryType.MULTILINE_STRING:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={object}
					type="multiline"
					collection={collection}
					className="input text-input input-l"
					mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? undefined : v.join('\n'))}
					mutateUpdateValue={(v) =>
						v === undefined || v.length === 0 ? undefined : v.split('\n').map((i) => i.trimStart())
					}
				/>
			)
		case ConfigManifestEntryType.INT:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={object}
					type="int"
					collection={collection}
					className="input text-input input-m"
					mutateDisplayValue={(v) => (item.zeroBased ? v + 1 : v)}
					mutateUpdateValue={(v) => (item.zeroBased ? v - 1 : v)}
				/>
			)
		case ConfigManifestEntryType.FLOAT:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={object}
					type="float"
					collection={collection}
					className="input text-input input-m"
				/>
			)
		case ConfigManifestEntryType.BOOLEAN:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={object}
					type="checkbox"
					collection={collection}
					className="input"
				/>
			)
		case ConfigManifestEntryType.ENUM:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={object}
					type="dropdown"
					options={item.options || []}
					collection={collection}
					className="input text-input input-l"
				/>
			)
		case ConfigManifestEntryType.JSON:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					invalidClassName="warn"
					attribute={attribute}
					obj={object}
					type="json"
					collection={collection}
					className="input text-input input-l"
				/>
			)
		case ConfigManifestEntryType.SELECT:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={object}
					type={item.multiple ? 'multiselect' : 'dropdown'}
					options={item.options}
					collection={collection}
					className="input text-input dropdown input-l"
				/>
			)
		case ConfigManifestEntryType.SOURCE_LAYERS:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={object}
					type={item.multiple ? 'multiselect' : 'dropdown'}
					options={'options' in item ? item.options : filterSourceLayers(item, sourceLayers ?? [])}
					collection={collection}
					className="input text-input dropdown input-l"
				/>
			)
		case ConfigManifestEntryType.LAYER_MAPPINGS:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={object}
					type={item.multiple ? 'multiselect' : 'dropdown'}
					options={'options' in item ? item.options : filterLayerMappings(item, layerMappings ?? {})}
					collection={collection}
					className="input text-input dropdown input-l"
				/>
			)
		case ConfigManifestEntryType.SELECT_FROM_COLUMN:
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={object}
					type={item.multiple ? 'multiselect' : 'dropdown'}
					options={'options' in item ? item.options : getTableColumnValues(item, configPath, object, alternateObject)}
					collection={collection}
					className="input text-input dropdown input-l"
				/>
			)
		default:
			return null
	}
}

function getEditAttribute2(
	item: WrappedOverridableItemNormal<any> & WrappedOverridableExt,
	// layerMappings: { [key: string]: MappingsExt } | undefined,
	// sourceLayers: Array<{ name: string; value: string; type: SourceLayerType }> | undefined,
	// alternateObject?: any
	handleUpdate: (value: any) => void,
	clearOverride: () => void
) {
	const manifest = item.manifest

	const commonProps = {
		label: t('Value'),
		hint: manifest.hint,
		modifiedClassName: 'bghl',
		value: item.computed,
		defaultValue: item.defaults,
		isOverridden: item.defaults !== item.computed,
		handleUpdate: handleUpdate,
		clearOverride: clearOverride,
	}

	switch (manifest.type) {
		case ConfigManifestEntryType.STRING:
			return <TextInputControlWithOverride classNames="input text-input input-l" {...commonProps} />
		case ConfigManifestEntryType.MULTILINE_STRING:
			return (
				<MultiLineTextInputControlWithOverride
					classNames="input text-input input-l"
					{...commonProps}
					isOverridden={!isEqual(item.defaults, item.computed)}
				/>
			)
		case ConfigManifestEntryType.INT:
			return (
				<IntInputControlWithOverride
					classNames="input text-input input-m"
					{...commonProps}
					zeroBased={manifest.zeroBased}
				/>
			)
		case ConfigManifestEntryType.FLOAT:
			return <FloatInputControlWithOverride classNames="input text-input input-m" {...commonProps} />
		case ConfigManifestEntryType.BOOLEAN:
			return <CheckboxControlWithOverride classNames="input" {...commonProps} />

		// TODO
		// case ConfigManifestEntryType.ENUM:
		// 	return (
		// 		<EditAttribute
		// 			modifiedClassName="bghl"
		// 			attribute={attribute}
		// 			obj={object}
		// 			type="dropdown"
		// 			options={item.options || []}
		// 			collection={collection}
		// 			className="input text-input input-l"
		// 		/>
		// 	)
		// case ConfigManifestEntryType.JSON:
		// 	return (
		// 		<EditAttribute
		// 			modifiedClassName="bghl"
		// 			invalidClassName="warn"
		// 			attribute={attribute}
		// 			obj={object}
		// 			type="json"
		// 			collection={collection}
		// 			className="input text-input input-l"
		// 		/>
		// 	)
		// case ConfigManifestEntryType.SELECT:
		// 	return (
		// 		<EditAttribute
		// 			modifiedClassName="bghl"
		// 			attribute={attribute}
		// 			obj={object}
		// 			type={item.multiple ? 'multiselect' : 'dropdown'}
		// 			options={item.options}
		// 			collection={collection}
		// 			className="input text-input dropdown input-l"
		// 		/>
		// 	)
		// case ConfigManifestEntryType.SOURCE_LAYERS:
		// 	return (
		// 		<EditAttribute
		// 			modifiedClassName="bghl"
		// 			attribute={attribute}
		// 			obj={object}
		// 			type={item.multiple ? 'multiselect' : 'dropdown'}
		// 			options={'options' in item ? item.options : filterSourceLayers(item, sourceLayers ?? [])}
		// 			collection={collection}
		// 			className="input text-input dropdown input-l"
		// 		/>
		// 	)
		// case ConfigManifestEntryType.LAYER_MAPPINGS:
		// 	return (
		// 		<EditAttribute
		// 			modifiedClassName="bghl"
		// 			attribute={attribute}
		// 			obj={object}
		// 			type={item.multiple ? 'multiselect' : 'dropdown'}
		// 			options={'options' in item ? item.options : filterLayerMappings(item, layerMappings ?? {})}
		// 			collection={collection}
		// 			className="input text-input dropdown input-l"
		// 		/>
		// 	)
		// case ConfigManifestEntryType.SELECT_FROM_COLUMN:
		// 	return (
		// 		<EditAttribute
		// 			modifiedClassName="bghl"
		// 			attribute={attribute}
		// 			obj={object}
		// 			type={item.multiple ? 'multiselect' : 'dropdown'}
		// 			options={'options' in item ? item.options : getTableColumnValues(item, configPath, object, alternateObject)}
		// 			collection={collection}
		// 			className="input text-input dropdown input-l"
		// 		/>
		// 	)
		default:
			// assertNever(item)
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
	| (ConfigManifestEntrySelectFromColumn<boolean> & { options: string[] })
	| (ConfigManifestEntrySourceLayers<boolean> & { options: Array<{ name: string; value: string }> })
	| (ConfigManifestEntryLayerMappings<boolean> & { options: Array<{ name: string; value: string }> })
	| ConfigManifestEntryJson

interface IConfigManifestSettingsProps<
	TCol extends MongoCollection<DBInterface>,
	DBInterface extends { _id: ProtectedString<any> }
> {
	manifest: ConfigManifestEntry[]

	collection: TCol
	object: DBInterface
	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateObject?: any
	configPath: string

	layerMappings?: { [key: string]: MappingsExt }
	sourceLayers?: Array<{ name: string; value: string; type: SourceLayerType }>

	subPanel?: boolean

	configObject: ObjectWithOverrides<IBlueprintConfig>
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void
	pushOverride: (newOp: SomeObjectOverrideOp) => void
}
interface IConfigManifestTableProps<
	TCol extends MongoCollection<DBInterface>,
	DBInterface extends { _id: ProtectedString<any> }
> {
	item: ConfigManifestEntryTable
	baseAttribute: string

	collection: TCol
	object: DBInterface
	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateObject?: any
	configPath: string

	layerMappings: { [key: string]: MappingsExt } | undefined
	sourceLayers: Array<{ name: string; value: string; type: SourceLayerType }> | undefined

	subPanel: boolean
}

interface BlueprintConfigManifestTableEntryProps<TCol extends MongoCollection<DBInterface>, DBInterface extends DBObj> {
	resolvedColumns: ResolvedBasicConfigManifestEntry[]

	collection: TCol
	object: DBInterface
	configPath: string

	valPath: string
	val: any

	removeRow: (id: string) => void

	subPanel: boolean
}
function BlueprintConfigManifestTableEntry<TCol extends MongoCollection<DBInterface>, DBInterface extends DBObj>({
	resolvedColumns,
	collection,
	object,
	configPath,
	valPath,
	val,
	removeRow,
	subPanel,
}: BlueprintConfigManifestTableEntryProps<TCol, DBInterface>) {
	const doRemoveRow = useCallback(() => removeRow(val._id), [removeRow, val._id])

	return (
		<tr>
			{resolvedColumns.map((col) => (
				<td key={col.id}>
					{getEditAttribute(collection, configPath, object, col, `${valPath}.${col.id}`, undefined, undefined)}
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

function BlueprintConfigManifestTable<TCol extends MongoCollection<DBInterface>, DBInterface extends DBObj>({
	item,
	baseAttribute,
	collection,
	object,
	alternateObject,
	configPath,
	layerMappings,
	sourceLayers,
	subPanel,
}: IConfigManifestTableProps<TCol, DBInterface>) {
	const { t } = useTranslation()

	const resolvedColumns = useMemo(() => {
		// TODO - this is too reactive..
		return item.columns.map((column): ResolvedBasicConfigManifestEntry => {
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
						options: layerMappings ? getTableColumnValues(column, configPath, object, alternateObject) : [],
					}
				default:
					return column
			}
		})
	}, [item.columns, sourceLayers, layerMappings, configPath, object, alternateObject])

	const sortedColumns = useMemo(() => {
		const columns = [...item.columns]
		columns.sort((a, b) => {
			if (a.rank > b.rank) return 1
			if (a.rank < b.rank) return -1

			return 0
		})
		return columns
	}, [item.columns])

	const configEntry = item

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

	const updateObject = useCallback(
		(updateObj: MongoModifier<DBInterface>) => {
			collection.update(object._id, updateObj)
		},
		[collection, object._id]
	)
	const addRow = useCallback(() => {
		const rowDefault: any = {
			_id: getRandomString(),
		}

		for (const column of configEntry.columns) {
			rowDefault[column.id] = clone<any>(column.defaultVal)
		}

		const m: any = {}
		m[baseAttribute] = rowDefault
		updateObject({ $push: m })
	}, [updateObject, baseAttribute, configEntry.columns])

	const removeRow = useCallback(
		(id: string) => {
			const m: any = {}
			m[baseAttribute] = {
				_id: id,
			}
			updateObject({ $pull: m })
		},
		[updateObject, baseAttribute]
	)

	const vals: TableConfigItemValue = objectPath.get(object, baseAttribute) || []

	// Limit reactivity of export callback, by passing values through a ref
	const valsRef = useRef(vals)
	useEffect(() => {
		valsRef.current = vals
	}, [vals])
	const exportJSON = useCallback(() => {
		if (valsRef.current) {
			const jsonStr = JSON.stringify(valsRef.current, undefined, 4)

			const element = document.createElement('a')
			element.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
			element.download = `${object._id}_config_${configEntry.id}.json`

			document.body.appendChild(element) // Required for this to work in FireFox
			element.click()
			document.body.removeChild(element) // Required for this to work in FireFox
		}
	}, [configEntry.id, object._id, valsRef])

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

				const m: any = {}
				m[baseAttribute] = conformedConfig
				updateObject({ $set: m })
			}
			reader.readAsText(file)
		},
		[t, updateObject, baseAttribute, configEntry.columns]
	)

	let sortedIndices = _.range(vals.length)
	if (tableSort.column >= 0) {
		sortedIndices = sortedIndices.sort((x, y) => {
			const col = configEntry.columns[tableSort.column]
			let a
			let b
			if (tableSort.order === 'asc') {
				a = vals[x][col.id]
				b = vals[y][col.id]
			} else {
				a = vals[y][col.id]
				b = vals[x][col.id]
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
						{_.map(vals, (val, i) => (
							<BlueprintConfigManifestTableEntry
								key={sortedIndices[i]}
								resolvedColumns={resolvedColumns}
								collection={collection}
								object={object}
								configPath={configPath}
								valPath={`${baseAttribute}.${sortedIndices[i]}`}
								val={val}
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

export function BlueprintConfigManifestSettings<TCol extends MongoCollection<DBInterface>, DBInterface extends DBObj>({
	manifest,
	collection,
	object,
	alternateObject,
	configPath,
	layerMappings,
	sourceLayers,
	subPanel,

	configObject,
	saveOverrides,
	pushOverride,
}: IConfigManifestSettingsProps<TCol, DBInterface>) {
	const { t } = useTranslation()

	const addRef = useRef<AddItemModalRef>(null)
	const deleteRef = useRef<DeleteItemModalRef>(null)

	const config = objectPathGet(object, configPath)

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

	const sortedManifestItems = useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(manifest, configObject),
		[configObject, manifest]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, configObject) // TODO - is this appropriate?

	return (
		<div className="scroll-x">
			<AddItemModal ref={addRef} manifest={manifest} config={config} doCreate={doCreate} />
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
								<BlueprintConfigManifestEntry<TCol, DBInterface>
									key={item.id}
									wrappedItem={item}
									overrideHelper={overrideHelper}
									value={item.computed}
									showDelete={showDelete}
									doCreate={doCreate}
									configPath={configPath}
									collection={collection}
									object={object}
									alternateObject={alternateObject}
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

interface BlueprintConfigManifestEntryProps<TCol extends MongoCollection<DBInterface>, DBInterface extends DBObj> {
	value: any

	wrappedItem: WrappedOverridableItemNormal<any> & WrappedOverridableExt
	overrideHelper: OverrideOpHelper

	showDelete: (item: ConfigManifestEntry) => void
	doCreate: (itemId: string, value: any) => void

	configPath: string

	collection: TCol
	object: DBInterface
	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateObject?: any
	layerMappings: { [key: string]: MappingsExt } | undefined
	sourceLayers: Array<{ name: string; value: string; type: SourceLayerType }> | undefined

	subPanel: boolean

	isExpanded: boolean
	toggleExpanded: (id: string, force?: boolean) => void
}
function BlueprintConfigManifestEntry<TCol extends MongoCollection<DBInterface>, DBInterface extends DBObj>({
	value,
	wrappedItem,
	overrideHelper,
	showDelete,
	doCreate,
	configPath,
	collection,
	object,
	alternateObject,
	layerMappings,
	sourceLayers,
	subPanel,
	isExpanded,
	toggleExpanded,
}: BlueprintConfigManifestEntryProps<TCol, DBInterface>) {
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
	const clearOverride = useCallback(() => {
		overrideHelper.replaceItem(wrappedItem.id, wrappedItem.defaults)
	}, [overrideHelper, wrappedItem.id, wrappedItem.defaults])

	let component: React.ReactElement | undefined = undefined
	const baseAttribute = `${configPath}.${manifestEntry.id}`
	if (manifestEntry.type === ConfigManifestEntryType.TABLE) {
		component = (
			<BlueprintConfigManifestTable
				collection={collection}
				object={object}
				baseAttribute={baseAttribute}
				item={manifestEntry}
				layerMappings={layerMappings}
				sourceLayers={sourceLayers}
				configPath={configPath}
				alternateObject={alternateObject}
				subPanel={subPanel}
			/>
		)
	} else {
		component = getEditAttribute2(wrappedItem, handleUpdate, clearOverride)
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
