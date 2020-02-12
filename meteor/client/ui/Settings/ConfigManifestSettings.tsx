import * as objectPath from 'object-path'
import * as ClassNames from 'classnames'
import * as React from 'react'
import * as _ from 'underscore'
const Tooltip = require('rc-tooltip')
import {
	Studio,
	Studios
} from '../../../lib/collections/Studios'
import { EditAttribute } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { ConfigManifestEntry, ConfigManifestEntryType, IConfigItem, BasicConfigManifestEntry, ConfigManifestEntryEnum, ConfigItemValue, ConfigManifestEntryTable, TableConfigItemValue } from 'tv-automation-sofie-blueprints-integration'
import { literal, DBObj, KeysByType } from '../../../lib/lib'
import { ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { logger } from '../../../lib/logging'
import { MongoModifier, TransformedCollection } from '../../../lib/typings/meteor'
import { Meteor } from 'meteor/meteor'
import { getHelpMode } from '../../lib/localStorage'
import { Random } from 'meteor/random'
import { faDownload, faTrash, faPencilAlt, faCheck, faPlus, faUpload } from '@fortawesome/fontawesome-free-solid'
import { UploadButton } from '../../lib/uploadButton'
import { NotificationCenter, NoticeLevel, Notification } from '../../lib/notifications/notifications'

function getEditAttribute<TObj, TObj2> (collection: TransformedCollection<TObj2, TObj>, object: TObj, item: BasicConfigManifestEntry, attribute: string) {
	switch (item.type) {
		case ConfigManifestEntryType.STRING:
			return <EditAttribute
				modifiedClassName='bghl'
				attribute={attribute}
				obj={object}
				type='text'
				collection={collection}
				className='input text-input input-l' />
		case ConfigManifestEntryType.NUMBER:
			return <EditAttribute
				modifiedClassName='bghl'
				attribute={attribute}
				obj={object}
				type='int'
				collection={collection}
				className='input text-input input-l' />
		case ConfigManifestEntryType.BOOLEAN:
			return <EditAttribute
				modifiedClassName='bghl'
				attribute={attribute}
				obj={object}
				type='checkbox'
				collection={collection}
				className='input' />
		case ConfigManifestEntryType.ENUM:
			const item2 = item as ConfigManifestEntryEnum
			return <EditAttribute
				modifiedClassName='bghl'
				attribute={attribute}
				obj={object}
				type='dropdown'
				options={item2.options || []}
				collection={collection}
				className='input text-input input-l' />
		default:
			return null
	}
}

interface IConfigManifestSettingsProps<TCol extends TransformedCollection<TObj2, TObj>, TObj, TObj2> {
	manifest: ConfigManifestEntry[]

	collection: TCol
	object: TObj
	configPath: KeysByType<TObj, Array<IConfigItem>>

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

interface IConfigManifestTableProps<TCol extends TransformedCollection<TObj2, TObj>, TObj, TObj2> {
	item: ConfigManifestEntryTable
	baseAttribute: string

	collection: TCol
	object: TObj

	subPanel?: boolean
}
interface IConfigManifestTableState {
	uploadFileKey: number // Used to force clear the input after use
}

export class ConfigManifestTable<TCol extends TransformedCollection<TObj2, TObj>, TObj extends DBObj, TObj2>
	extends React.Component<Translated<IConfigManifestTableProps<TCol, TObj, TObj2>>, IConfigManifestTableState> {

	constructor (props: Translated<IConfigManifestTableProps<TCol, TObj, TObj2>>) {
		super(props)

		this.state = {
			uploadFileKey: Date.now()
		}
	}

	updateObject (obj: TObj, updateObj: MongoModifier<TObj>) {
		this.props.collection.update(obj._id, updateObj)
	}

	render () {
		const { t } = this.props

		const baseAttribute = this.props.baseAttribute
		const vals: TableConfigItemValue = objectPath.get(this.props.object, baseAttribute) || []
		const item2 = this.props.item
		const item = item2

		return (
			<div>
				<table style={{ width: '100%' }}>
					<thead>
						<tr>
							{ _.map(item2.columns, col => <th key={col.id}><span title={col.description}>{ col.name} </span></th>) }
							<th>&nbsp;</th>
						</tr>
					</thead>
					<tbody>
					{
						_.map(vals, (val, i) => <tr key={i}>
							{ _.map(item2.columns, col => <td key={col.id}>{
								getEditAttribute(this.props.collection, this.props.object, col, `${baseAttribute}.${i}.${col.id}`)
							}</td>) }
							<td>
								<button className={ClassNames('btn btn-danger', {
									'btn-tight': this.props.subPanel
								})} onClick={() => {
									const m: any = {}
									m[baseAttribute] = {
										_id: val._id
									}
									this.updateObject(this.props.object, { $pull: m })
								}}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>)
					}
					</tbody>
				</table>

				<button className={ClassNames('btn btn-primary', {
					'btn-tight': this.props.subPanel
				})} onClick={() => {
					const rowDefault: any = {
						_id: Random.id()
					}
					_.each(item2.columns, col => rowDefault[col.id] = col.defaultVal)

					const m: any = {}
					m[baseAttribute] = rowDefault
					this.updateObject(this.props.object, { $push: m })
				}}>
					<FontAwesomeIcon icon={faPlus} />
					{ ' ' }
					{ t('Row') }
				</button>
				{ ' ' }
				<button className={ClassNames('btn btn-primary', {
					'btn-tight': this.props.subPanel
				})} onClick={() => {
					const jsonStr = JSON.stringify(vals, undefined, 4)

					const element = document.createElement('a')
					element.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
					element.download = `${this.props.object._id}_config_${item.id}.json`

					document.body.appendChild(element) // Required for this to work in FireFox
					element.click()
					document.body.removeChild(element) // Required for this to work in FireFox
				}}>
					<FontAwesomeIcon icon={faDownload} />
					{ ' ' }
					{ t('Export') }
				</button>
				{ ' ' }
				<UploadButton className='btn btn-primary' accept='application/json,.json' onChange={e => {
					const { t } = this.props

					const file = e.target.files ? e.target.files[0] : null
					if (!file) {
						return
					}

					const reader = new FileReader()
					reader.onload = (e2) => {
						// On file upload

						this.setState({
							uploadFileKey: Date.now()
						})

						const uploadFileContents = (e2.target as any).result

						// Parse the config
						let newConfig: TableConfigItemValue = []
						try {
							newConfig = JSON.parse(uploadFileContents)
							if (!_.isArray(newConfig)) {
								throw new Error('Not an array')
							}
						} catch (err) {
							NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, t('Failed to update config: {{errorMessage}}', { errorMessage: err + '' }), 'ConfigManifestSettings'))
							return
						}

						// Validate the config
						const conformedConfig: TableConfigItemValue = []
						_.forEach(newConfig, entry => {
							const newEntry: TableConfigItemValue[0] = {
								_id: entry._id || Random.id()
							}

							// Ensure all fields are defined
							_.forEach(item2.columns, col => {
								newEntry[col.id] = entry[col.id] !== undefined ? entry[col.id] : col.defaultVal
							})
							conformedConfig.push(newEntry)
						})

						const m: any = {}
						m[baseAttribute] = conformedConfig
						this.updateObject(this.props.object, { $set: m })
					}
					reader.readAsText(file)
				}} key={this.state.uploadFileKey}>
					<FontAwesomeIcon icon={faUpload} />
					{ ' ' }
					{ t('Import') }
				</UploadButton>
			</div>
		)
	}
}

export class ConfigManifestSettings<TCol extends TransformedCollection<TObj2, TObj>, TObj extends DBObj, TObj2>
	extends React.Component<Translated<IConfigManifestSettingsProps<TCol, TObj, TObj2>>, IConfigManifestSettingsState> {

	constructor (props: Translated<IConfigManifestSettingsProps<TCol, TObj, TObj2>>) {
		super(props)

		this.state = {
			showAddItem: false,
			addItemId: undefined,
			showDeleteConfirm: false,
			deleteConfirmItem: undefined,
			editedItems: [],
			uploadFileKey: Date.now()
		}
	}

	getObjectConfig (): Array<IConfigItem> {
		return this.props.object[this.props.configPath]
	}

	updateObject (obj: TObj, updateObj: MongoModifier<TObj>) {
		this.props.collection.update(obj._id, updateObj)
	}

	isItemEdited = (item: ConfigManifestEntry) => {
		return this.state.editedItems.indexOf(item.id) >= 0
	}

	finishEditItem = (item: ConfigManifestEntry) => {
		let index = this.state.editedItems.indexOf(item.id)
		if (index >= 0) {
			this.state.editedItems.splice(index, 1)
			this.setState({
				editedItems: this.state.editedItems
			})
		}
	}

	createItem = (item: ConfigManifestEntry) => {
		const m: any = {}
		m[this.props.configPath] = literal<IConfigItem>({
			_id: item.id,
			value: item.defaultVal
		})
		this.updateObject(this.props.object, { $push: m })
	}

	editItem = (item: ConfigManifestEntry) => {
		// Ensure the item exists, so edit by index works
		const valIndex = this.getObjectConfig().findIndex(v => v._id === item.id)

		if (valIndex === -1) throw new Meteor.Error(500, `Unable to edit an item that doesn't exist`)

		if (this.state.editedItems.indexOf(item.id) < 0) {
			this.state.editedItems.push(item.id)
			this.setState({
				editedItems: this.state.editedItems
			})
		} else {
			this.finishEditItem(item)
		}
	}

	addConfigItem = () => {
		const options = this.getAddOptions()

		this.setState({
			showAddItem: true,
			showDeleteConfirm: false,
			addItemId: options.length > 0 ? options[0].value : undefined
		})
	}

	handleConfirmAddItemCancel = (e) => {
		this.setState({
			addItemId: undefined,
			showAddItem: false
		})
	}

	handleConfirmAddItemAccept = (e) => {
		if (this.state.addItemId) {
			const item = this.props.manifest.find(c => c.id === this.state.addItemId)
			const m: any = {}
			m[this.props.configPath] = literal<IConfigItem>({
				_id: this.state.addItemId,
				value: item ? item.defaultVal : ''
			})
			this.updateObject(this.props.object, { $push: m })
		}

		this.setState({
			addItemId: undefined,
			showAddItem: false
		})
	}

	confirmDelete = (item: ConfigManifestEntry) => {
		this.setState({
			showAddItem: false,
			showDeleteConfirm: true,
			deleteConfirmItem: item
		})
	}

	handleConfirmDeleteCancel = (e) => {
		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	handleConfirmDeleteAccept = (e) => {
		if (this.state.deleteConfirmItem) {
			const m: any = {}
			m[this.props.configPath] = {
				_id: this.state.deleteConfirmItem.id
			}
			this.updateObject(this.props.object, { $pull: m })
		}

		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	renderConfigValue (item: ConfigManifestEntry, rawValue: ConfigItemValue | undefined) {
		const { t } = this.props

		const value = rawValue === undefined ? item.defaultVal : rawValue

		switch (item.type) {
			case ConfigManifestEntryType.BOOLEAN:
				return value ? t('true') : t('false')
			case ConfigManifestEntryType.TABLE:
				return `${(rawValue as any[] || []).length} ${t('rows')}`
			default:
				return value
		}
	}

	renderEditableArea (item: ConfigManifestEntry, valIndex: number) {
		const baseAttribute = `config.${valIndex}.value`
		const { t, collection, object } = this.props
		if (item.type === ConfigManifestEntryType.TABLE) {
			const item2 = item as ConfigManifestEntryTable
			return <ConfigManifestTable t={t} collection={collection} object={object} baseAttribute={baseAttribute} item={item2} />
		} else {
			return (
				<label className='field'>
					{t('Value')}
					{ getEditAttribute(this.props.collection, this.props.object, item as BasicConfigManifestEntry, baseAttribute) }
				</label>
			)
		}
	}

	renderItems () {
		const { t } = this.props

		const values = this.getObjectConfig()
		return (
			this.props.manifest.map((item, index) => {
				const valIndex = values.findIndex(v => v._id === item.id)
				if (valIndex === -1 && !item.required) return undefined

				const configItem = values[valIndex]

				return <React.Fragment key={`${item.id}`}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<th className='settings-studio-custom-config-table__name c2'>
							{item.name}
						</th>
						<td className='settings-studio-custom-config-table__value c3'>
							{ this.renderConfigValue(item, configItem ? configItem.value : undefined)}
						</td>
						<td className='settings-studio-custom-config-table__actions table-item-actions c3'>
							{
								configItem ?
								<React.Fragment>
									<button className='action-btn' onClick={(e) => this.editItem(item)}>
										<FontAwesomeIcon icon={faPencilAlt} />
									</button>
									{
										!item.required &&
										<button className='action-btn' onClick={(e) => this.confirmDelete(item)}>
											<FontAwesomeIcon icon={faTrash} />
										</button>
									}
								</React.Fragment> :
								<button className={ClassNames('btn btn-primary', {
									'btn-tight': this.props.subPanel
								})} onClick={(e) => this.createItem(item)}>
									<FontAwesomeIcon icon={faPlus} /> {t('Create')}
								</button>

							}
						</td>
					</tr>
					{this.isItemEdited(item) &&
						<tr className='expando-details hl'>
							<td colSpan={4}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{item.description}
										</label>
									</div>
									<div className='mod mvs mhs'>
										{ this.renderEditableArea(item, valIndex) }
									</div>
								</div>
								<div className='mod alright'>
									<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(item)}>
										<FontAwesomeIcon icon={faCheck} />
									</button>
								</div>
							</td>
						</tr>
					}
				</React.Fragment>
			})
		)
	}

	getAddOptions () {
		let existingIds: string[] = []
		let addOptions: { value: string, name: string }[] = []
		existingIds = this.getObjectConfig().map(c => c._id)
		addOptions = this.props.manifest.map(c => ({ value: c.id, name: c.name }))

		return addOptions.filter(o => existingIds.indexOf(o.value) === -1)
	}

	render () {
		const { t } = this.props
		return (
			<div>
				<ModalDialog title={t('Add config item')} acceptText={t('Add')}
					secondaryText={t('Cancel')} show={this.state.showAddItem}
					onAccept={(e) => this.handleConfirmAddItemAccept(e)}
					onSecondary={(e) => this.handleConfirmAddItemCancel(e)}>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Item')}
							<div className='select focusable'>
								<EditAttribute
									modifiedClassName='bghl'
									type='dropdown'
									options={this.getAddOptions()}
									updateFunction={(e, v) => this.setState({ addItemId: v })}
									overrideDisplayValue={this.state.addItemId}
									/>
							</div>
						</label>
					</div>
				</ModalDialog>
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')}
					secondaryText={t('Cancel')} show={this.state.showDeleteConfirm}
					onAccept={(e) => this.handleConfirmDeleteAccept(e)}
					onSecondary={(e) => this.handleConfirmDeleteCancel(e)}>
					<p>{t('Are you sure you want to delete this config item "{{configId}}"?',
						{ configId: (this.state.deleteConfirmItem && this.state.deleteConfirmItem.name) })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</ModalDialog>
				{this.props.subPanel ?
					<h3 className='mhn'>{t('Blueprint Configuration')}</h3>
					: <h2 className='mhn'>{t('Blueprint Configuration')}</h2> }
				<table className='table expando settings-studio-custom-config-table'>
					<tbody>
						{this.renderItems()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className={ClassNames('btn btn-primary', {
						'btn-tight': this.props.subPanel
					})} onClick={this.addConfigItem}>
						<Tooltip overlay={t('More settings specific to this studio can be found here')} visible={getHelpMode()} placement='right'>
							<FontAwesomeIcon icon={faPlus} />
						</Tooltip>
					</button>
				</div>
			</div>
		)
	}
}

export function collectConfigs (item: Studio | ShowStyleBase | ShowStyleVariant): ConfigManifestEntry[] {
	if (item instanceof Studio) {
		if (item.blueprintId) {
			const blueprint = Blueprints.findOne(item.blueprintId)
			if (blueprint) {
				return blueprint.studioConfigManifest || []
			}
		}
	} else if (item instanceof ShowStyleBase) {
		if (item.blueprintId) {
			const blueprint = Blueprints.findOne(item.blueprintId)
			if (blueprint) {
				return blueprint.showStyleConfigManifest || []
			}
		}
	} else if (item instanceof ShowStyleVariant) {
		const showStyleBase = ShowStyleBases.findOne({
			_id: item.showStyleBaseId
		})

		if (showStyleBase && showStyleBase.blueprintId) {
			const blueprint = Blueprints.findOne(showStyleBase.blueprintId)
			if (blueprint) {
				return blueprint.showStyleConfigManifest || []
			}
		}
	} else {
		logger.error('collectConfigs: unknown item type', item)
	}

	return []
}
