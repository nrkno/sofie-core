import * as ClassNames from 'classnames'
import * as React from 'react'
import * as _ from 'underscore'
import { Studio } from '../../../lib/collections/Studios'
import { EditAttribute } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { Blueprint, Blueprints } from '../../../lib/collections/Blueprints'
import { ConfigManifestEntry, ConfigManifestEntryType, IConfigItem } from 'tv-automation-sofie-blueprints-integration'
import { literal, DBObj, KeysByType } from '../../../lib/lib'
import { ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { logger } from '../../../lib/logging'
import { MongoModifier, TransformedCollection } from '../../../lib/typings/meteor'
import { Meteor } from 'meteor/meteor'


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
			editedItems: []
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

	renderItems () {
		const { t } = this.props

		const values = this.getObjectConfig()
		return (
			this.props.manifest.map((item, index) => {
				const valIndex = values.findIndex(v => v._id === item.id)
				if (valIndex === -1 && !item.required) return undefined

				const configItem = values[valIndex]

				return <React.Fragment key={item.id}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<th className='settings-studio-custom-config-table__name c2'>
							{item.name}
						</th>
						<td className='settings-studio-custom-config-table__value c3'>
							{configItem && configItem.value !== undefined ? (
								(item.type === ConfigManifestEntryType.BOOLEAN && (
									configItem.value ? t('true') : t('false')
								))
								|| configItem.value
							) : item.defaultVal}
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
										<label className='field'>
											{t('Value')}
											{
												(item.type === ConfigManifestEntryType.STRING && (
													<EditAttribute
														modifiedClassName='bghl'
														attribute={'config.' + valIndex + '.value'}
														obj={this.props.object}
														type='text'
														collection={this.props.collection}
														className='input text-input input-l' />
												))
												|| (item.type === ConfigManifestEntryType.NUMBER && (
													<EditAttribute
														modifiedClassName='bghl'
														attribute={'config.' + valIndex + '.value'}
														obj={this.props.object}
														type='int'
														collection={this.props.collection}
														className='input text-input input-l' />
												))
												|| (item.type === ConfigManifestEntryType.BOOLEAN && (
													<EditAttribute
														modifiedClassName='bghl'
														attribute={'config.' + valIndex + '.value'}
														obj={this.props.object}
														type='checkbox'
														collection={this.props.collection}
														className='input text-input input-l' />
												))
												|| (item.type === ConfigManifestEntryType.ENUM && (
													<EditAttribute
														modifiedClassName='bghl'
														attribute={'config.' + valIndex + '.value'}
														obj={this.props.object}
														type='dropdown'
														options={item.options || []}
														collection={this.props.collection}
														className='input text-input input-l' />
												))
											}
										</label>
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
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		)
	}
}

export function collectConfigs (item: Studio | ShowStyleBase | ShowStyleVariant): ConfigManifestEntry[] {
	let showStyleBases: Array<ShowStyleBase> = []

	if (item instanceof Studio) {
		// All showStyles that the studio is supposed to support:
		showStyleBases = ShowStyleBases.find({
			_id: { $in: item.supportedShowStyleBase || [] }
		}).fetch()
	} else if (item instanceof ShowStyleBase) {
		showStyleBases = [item]
	} else if (item instanceof ShowStyleVariant) {
		showStyleBases = ShowStyleBases.find({
			_id: item.showStyleBaseId
		}).fetch()
	} else {
		logger.error('collectConfigs: unknown item type', item)
	}

	// By extension, all blueprints that the studio is supposed to support:

	let blueprints = Blueprints.find({
		_id: {
			$in: _.compact(_.map(showStyleBases, (showStyleBase) => {
				return showStyleBase.blueprintId
			}))
		}
	}).fetch()

	let manifestEntries: Array<ConfigManifestEntry> = []
	_.each(blueprints, (blueprint: Blueprint) => {
		const entries = item instanceof Studio ? blueprint.studioConfigManifest : blueprint.showStyleConfigManifest
		_.each(entries, (entry: ConfigManifestEntry) => {
			manifestEntries.push(entry)
		})
	})
	return manifestEntries
}
