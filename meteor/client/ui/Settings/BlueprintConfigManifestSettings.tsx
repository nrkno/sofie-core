import * as objectPath from 'object-path'
import ClassNames from 'classnames'
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import * as _ from 'underscore'
import Tooltip from 'rc-tooltip'
import { MappingsExt } from '../../../lib/collections/Studios'
import { EditAttribute, EditAttributeBase } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
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
import { DBObj, ProtectedString, objectPathGet, getRandomString, clone } from '../../../lib/lib'
import { MongoModifier } from '../../../lib/typings/meteor'
import { Meteor } from 'meteor/meteor'
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
} from '@fortawesome/free-solid-svg-icons'
import { UploadButton } from '../../lib/uploadButton'
import { NotificationCenter, NoticeLevel, Notification } from '../../lib/notifications/notifications'
import { MongoCollection } from '../../../lib/collections/lib'
import { useTranslation } from 'react-i18next'

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
	layerMappings?: { [key: string]: MappingsExt },
	sourceLayers?: Array<{ name: string; value: string; type: SourceLayerType }>,
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
}
interface IConfigManifestSettingsState {
	showAddItem: boolean
	addItemId: string | undefined
	showDeleteConfirm: boolean
	deleteConfirmItem: ConfigManifestEntry | undefined
	editedItems: Array<string>
	uploadFileKey: number // Used to force clear the input after use
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

	layerMappings?: { [key: string]: MappingsExt }
	sourceLayers?: Array<{ name: string; value: string; type: SourceLayerType }>

	subPanel?: boolean
}

interface BlueprintConfigManifestTableEntryProps<TCol extends MongoCollection<DBInterface>, DBInterface extends DBObj> {
	resolvedColumns: ResolvedBasicConfigManifestEntry[]

	collection: TCol
	object: DBInterface
	configPath: string

	valPath: string
	val: any

	removeRow: (id: string) => void

	subPanel?: boolean
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
				<td key={col.id}>{getEditAttribute(collection, configPath, object, col, `${valPath}.${col.id}`)}</td>
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

	const exportJSON = useCallback(() => {
		// TODO - this is very reactive
		const jsonStr = JSON.stringify(vals, undefined, 4)

		const element = document.createElement('a')
		element.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
		element.download = `${object._id}_config_${configEntry.id}.json`

		document.body.appendChild(element) // Required for this to work in FireFox
		element.click()
		document.body.removeChild(element) // Required for this to work in FireFox
	}, [configEntry.id, object._id, vals])

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

	configPath: string
	updateObject: (modifer: MongoModifier<DBInterface>) => void
}
interface AddItemModalRef {
	show: () => void
}
const AddItemModal = forwardRef(function AddItemModal(
	{ manifest, config, configPath, updateObject }: AddItemModalProps,
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
		let addOptions: { value: string; name: string }[] = []
		addOptions = manifest.map((c) => ({ value: c.id, name: c.name }))

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

	const updateSelected = useCallback((_e: EditAttributeBase, v: any) => {
		setSelectedItem(v)
	}, [])

	const handleConfirmAddItemCancel = useCallback(() => {
		setShow(false)
		setSelectedItem(null)
	}, [])

	const handleConfirmAddItemAccept = useCallback(() => {
		if (selectedItem) {
			const item = manifest.find((c) => c.id === selectedItem)
			const m: any = {
				$set: {
					[`${configPath}.${selectedItem}`]: item ? item.defaultVal : '',
				},
			}
			updateObject(m)
		}

		setShow(false)
		setSelectedItem(null)
	}, [selectedItem, manifest, updateObject, configPath])

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
						<EditAttribute
							modifiedClassName="bghl"
							type="dropdown"
							options={addOptions}
							updateFunction={updateSelected}
							overrideDisplayValue={selectedItem}
						/>
					</div>
				</label>
			</div>
		</ModalDialog>
	)
})

export function BlueprintConfigManifestSettings2<TCol extends MongoCollection<DBInterface>, DBInterface extends DBObj>({
	manifest,
	collection,
	object,
	alternateObject,
	configPath,
	layerMappings,
	sourceLayers,
	subPanel,
}: IConfigManifestSettingsProps<TCol, DBInterface>) {
	const { t } = useTranslation()

	const addRef = useRef<AddItemModalRef>(null)

	const config = objectPathGet(object, configPath)

	const updateObject = useCallback(
		(modifier: MongoModifier<DBInterface>) => {
			collection.update(object._id, modifier)
		},
		[collection, object._id]
	)

	return (
		<div className="scroll-x">
			<AddItemModal
				ref={addRef}
				manifest={manifest}
				config={config}
				configPath={configPath}
				updateObject={updateObject}
			/>

			<ModalDialog
				title={t('Delete this item?')}
				acceptText={t('Delete')}
				secondaryText={t('Cancel')}
				show={this.state.showDeleteConfirm}
				onAccept={() => this.handleConfirmDeleteAccept()}
				onSecondary={() => this.handleConfirmDeleteCancel()}
			>
				<p>
					{t('Are you sure you want to delete this config item "{{configId}}"?', {
						configId: this.state.deleteConfirmItem && this.state.deleteConfirmItem.name,
					})}
				</p>
				<p>{t('Please note: This action is irreversible!')}</p>
			</ModalDialog>
			{subPanel ? (
				<h3 className="mhn">{t('Blueprint Configuration')}</h3>
			) : (
				<h2 className="mhn">{t('Blueprint Configuration')}</h2>
			)}
			<table className="table expando settings-studio-custom-config-table">
				<tbody>{this.renderItems()}</tbody>
			</table>
			<div className="mod mhs">
				<button
					className={ClassNames('btn btn-primary', {
						'btn-tight': subPanel,
					})}
					onClick={addRef.current?.show}
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

export class BlueprintConfigManifestSettings<
	TCol extends MongoCollection<DBInterface>,
	DBInterface extends DBObj
> extends React.Component<Translated<IConfigManifestSettingsProps<TCol, DBInterface>>, IConfigManifestSettingsState> {
	constructor(props: Translated<IConfigManifestSettingsProps<TCol, DBInterface>>) {
		super(props)

		this.state = {
			showAddItem: false,
			addItemId: undefined,
			showDeleteConfirm: false,
			deleteConfirmItem: undefined,
			editedItems: [],
			uploadFileKey: Date.now(),
		}
	}

	private getObjectConfig(): IBlueprintConfig {
		return objectPathGet(this.props.object, this.props.configPath)
	}

	private updateObject(obj: DBInterface, updateObj: MongoModifier<DBInterface>) {
		this.props.collection.update(obj._id, updateObj)
	}

	private isItemEdited = (item: ConfigManifestEntry) => {
		return this.state.editedItems.indexOf(item.id) >= 0
	}

	private finishEditItem = (item: ConfigManifestEntry) => {
		const index = this.state.editedItems.indexOf(item.id)
		if (index >= 0) {
			this.state.editedItems.splice(index, 1)
			this.setState({
				editedItems: this.state.editedItems,
			})
		}
	}

	private createItem = (item: ConfigManifestEntry) => {
		const m: any = {
			$set: {
				[`${this.props.configPath}.${item.id}`]: item.defaultVal,
			},
		}
		this.updateObject(this.props.object, m)
	}

	private editItem = (item: ConfigManifestEntry) => {
		// Ensure the item exists, so edit by index works
		const val = objectPathGet(this.getObjectConfig(), item.id)

		if (val === undefined) throw new Meteor.Error(500, `Unable to edit an item that doesn't exist`)

		if (this.state.editedItems.indexOf(item.id) < 0) {
			this.state.editedItems.push(item.id)
			this.setState({
				editedItems: this.state.editedItems,
			})
		} else {
			this.finishEditItem(item)
		}
	}

	private confirmDelete = (item: ConfigManifestEntry) => {
		this.setState({
			showAddItem: false,
			showDeleteConfirm: true,
			deleteConfirmItem: item,
		})
	}

	private handleConfirmDeleteCancel = () => {
		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false,
		})
	}

	private handleConfirmDeleteAccept = () => {
		if (this.state.deleteConfirmItem) {
			const m: any = {
				$unset: {
					[`${this.props.configPath}.${this.state.deleteConfirmItem.id}`]: '',
				},
			}
			this.updateObject(this.props.object, m)
		}

		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false,
		})
	}

	private renderConfigValue(item: ConfigManifestEntry, rawValue: ConfigItemValue | undefined) {
		const { t } = this.props

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
				return _.isArray(value) ? (
					<React.Fragment>
						<ul className="table-values-list">
							{_.map((value as string[]) || [], (val) => (
								<li key={val}>{val}</li>
							))}
						</ul>
					</React.Fragment>
				) : (
					value.toString()
				)
			case ConfigManifestEntryType.INT:
				return _.isNumber(value) && item.zeroBased ? (value + 1).toString() : value.toString()
			default:
				return value.toString()
		}
	}

	private renderEditableArea(item: ConfigManifestEntry, valIndex: string) {
		const baseAttribute = `${this.props.configPath}.${valIndex}`
		const { t, collection, object, i18n, tReady } = this.props
		switch (item.type) {
			case ConfigManifestEntryType.TABLE:
				return (
					<BlueprintConfigManifestTable
						t={t}
						i18n={i18n}
						tReady={tReady}
						collection={collection}
						object={object}
						baseAttribute={baseAttribute}
						item={item}
						layerMappings={this.props.layerMappings}
						sourceLayers={this.props.sourceLayers}
						configPath={this.props.configPath}
						alternateObject={this.props.alternateObject}
					/>
				)
			case ConfigManifestEntryType.SELECT:
			case ConfigManifestEntryType.SELECT_FROM_COLUMN:
			case ConfigManifestEntryType.LAYER_MAPPINGS:
			case ConfigManifestEntryType.SOURCE_LAYERS:
				return (
					<div className="field">
						{t('Value')}
						{getEditAttribute(
							this.props.collection,
							this.props.configPath,
							this.props.object,
							item as BasicConfigManifestEntry,
							baseAttribute,
							this.props.layerMappings,
							this.props.sourceLayers,
							this.props.alternateObject
						)}
					</div>
				)
			default:
				return (
					<label className="field">
						{t('Value')}
						{getEditAttribute(
							this.props.collection,
							this.props.configPath,
							this.props.object,
							item as BasicConfigManifestEntry,
							baseAttribute,
							this.props.layerMappings,
							this.props.sourceLayers,
							this.props.alternateObject
						)}
					</label>
				)
		}
	}

	private renderItems() {
		const { t } = this.props

		const values = this.getObjectConfig()
		return this.props.manifest.map((item) => {
			const configItem = objectPathGet(values, item.id)
			if (configItem === undefined && !item.required) return undefined

			return (
				<React.Fragment key={`${item.id}`}>
					<tr
						className={ClassNames({
							hl: this.isItemEdited(item),
						})}
					>
						<th className="settings-studio-custom-config-table__name c2">{item.name}</th>
						<td className="settings-studio-custom-config-table__value c3">
							{this.renderConfigValue(item, configItem)}
						</td>
						<td className="settings-studio-custom-config-table__actions table-item-actions c3">
							{configItem !== undefined ? (
								<React.Fragment>
									<button className="action-btn" onClick={() => this.editItem(item)}>
										<FontAwesomeIcon icon={faPencilAlt} />
									</button>
									{!item.required && (
										<button className="action-btn" onClick={() => this.confirmDelete(item)}>
											<FontAwesomeIcon icon={faTrash} />
										</button>
									)}
								</React.Fragment>
							) : (
								<button
									className={ClassNames('btn btn-primary', {
										'btn-tight': this.props.subPanel,
									})}
									onClick={() => this.createItem(item)}
								>
									<FontAwesomeIcon icon={faPlus} /> {t('Create')}
								</button>
							)}
						</td>
					</tr>
					{this.isItemEdited(item) && (
						<tr className="expando-details hl">
							<td colSpan={4}>
								<div>
									<div className="mod mvs mhs">
										<label className="field">{item.description}</label>
									</div>
									<div className="mod mvs mhs">{this.renderEditableArea(item, item.id)}</div>
								</div>
								<div className="mod alright">
									<button className={ClassNames('btn btn-primary')} onClick={() => this.finishEditItem(item)}>
										<FontAwesomeIcon icon={faCheck} />
									</button>
								</div>
							</td>
						</tr>
					)}
				</React.Fragment>
			)
		})
	}

	render() {
		const { t } = this.props
		return (
			<div className="scroll-x">
				<ModalDialog
					title={t('Delete this item?')}
					acceptText={t('Delete')}
					secondaryText={t('Cancel')}
					show={this.state.showDeleteConfirm}
					onAccept={() => this.handleConfirmDeleteAccept()}
					onSecondary={() => this.handleConfirmDeleteCancel()}
				>
					<p>
						{t('Are you sure you want to delete this config item "{{configId}}"?', {
							configId: this.state.deleteConfirmItem && this.state.deleteConfirmItem.name,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</ModalDialog>
				{this.props.subPanel ? (
					<h3 className="mhn">{t('Blueprint Configuration')}</h3>
				) : (
					<h2 className="mhn">{t('Blueprint Configuration')}</h2>
				)}
				<table className="table expando settings-studio-custom-config-table">
					<tbody>{this.renderItems()}</tbody>
				</table>
				<div className="mod mhs">
					<button
						className={ClassNames('btn btn-primary', {
							'btn-tight': this.props.subPanel,
						})}
						// onClick={this.addConfigItem}
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
}
