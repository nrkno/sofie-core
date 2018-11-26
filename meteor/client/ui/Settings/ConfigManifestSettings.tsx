import * as ClassNames from 'classnames'
import * as React from 'react'
import * as _ from 'underscore'
import {
	StudioInstallation,
	StudioInstallations
} from '../../../lib/collections/StudioInstallations'
import { EditAttribute } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { Blueprint } from '../../../lib/collections/Blueprints'
import { ConfigManifestEntry, ConfigManifestEntryType, IConfigItem } from 'tv-automation-sofie-blueprints-integration'
import { literal } from '../../../lib/lib'

interface IConfigManifestSettingsProps {
	blueprint: Blueprint

	studioInstallation?: StudioInstallation
	// TODO - showstyle mode
}
interface IConfigManifestSettingsState {
	showAddItem: boolean
	addItemId: string | undefined
	showDeleteConfirm: boolean
	deleteConfirmItem: ConfigManifestEntry | undefined
	editedItems: Array<string>
}

export class ConfigManifestSettings extends React.Component<Translated<IConfigManifestSettingsProps>, IConfigManifestSettingsState> {
	constructor (props: Translated<IConfigManifestSettingsProps>) {
		super(props)

		this.state = {
			showAddItem: false,
			addItemId: undefined,
			showDeleteConfirm: false,
			deleteConfirmItem: undefined,
			editedItems: []
		}
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

	editItem = (item: ConfigManifestEntry) => {
		if (this.state.editedItems.indexOf(item.id) < 0) {
			this.state.editedItems.push(item.id)
			this.setState({
				editedItems: this.state.editedItems
			})
		}

		// Ensure the item exists, so edit by index works
		if (this.props.studioInstallation) {
			const valIndex = this.props.studioInstallation.config.findIndex(v => v._id === item.id)
			if (valIndex === -1) {
				StudioInstallations.update(this.props.studioInstallation._id, {
					$push: {
						config: literal<IConfigItem>({
							_id: item.id,
							value: ''
						})
					}
				})
			}
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
			if (this.props.studioInstallation) {
				const item = this.props.blueprint.studioConfigManifest.find(c => c.id === this.state.addItemId)
				StudioInstallations.update(this.props.studioInstallation._id, {
					$push: {
						config: literal<IConfigItem>({
							_id: this.state.addItemId,
							value: item ? item.defaultVal : ''
						})
					}
				})
			}
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
			if (this.props.studioInstallation) {
				StudioInstallations.update(this.props.studioInstallation._id, {
					$pull: {
						config: {
							_id: this.state.deleteConfirmItem.id
						}
					}
				})
			}
		}

		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	renderItems () {
		const { t } = this.props

		let options: ConfigManifestEntry[] = []
		let values: IConfigItem[] = []
		let collection: any = null
		let obj: any = null

		if (this.props.studioInstallation) {
			options = this.props.blueprint.studioConfigManifest
			values = this.props.studioInstallation.config
			collection = StudioInstallations
			obj = this.props.studioInstallation
		}

		return (
			options.map((item, index) => {
				const valIndex = values.findIndex(v => v._id === item.id)
				if (valIndex === -1 && !item.required) return

				return <React.Fragment key={item.id}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<th className='settings-studio-custom-config-table__name c2'>
							{item.name}
						</th>
						<td className='settings-studio-custom-config-table__value c3'>
							{valIndex !== -1 && values[valIndex].value !== undefined ? (
								(item.type === ConfigManifestEntryType.BOOLEAN && (
									values[valIndex].value ? t('true') : t('false')
								))
								|| values[valIndex].value
							) : item.defaultVal}
						</td>
						<td className='settings-studio-custom-config-table__required c3'>
							{item.required ? 'REQUIRED' : null}
						</td>
						<td className='settings-studio-custom-config-table__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editItem(item)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							{ !item.required &&
								<button className='action-btn' onClick={(e) => this.confirmDelete(item)}>
									<FontAwesomeIcon icon={faTrash} />
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
														obj={obj}
														type='text'
														collection={collection}
														className='input text-input input-l' />
												))
												|| (item.type === ConfigManifestEntryType.NUMBER && (
													<EditAttribute
														modifiedClassName='bghl'
														attribute={'config.' + valIndex + '.value'}
														obj={obj}
														type='int'
														collection={collection}
														className='input text-input input-l' />
												))
												|| (item.type === ConfigManifestEntryType.BOOLEAN && (
													<EditAttribute
														modifiedClassName='bghl'
														attribute={'config.' + valIndex + '.value'}
														obj={obj}
														type='checkbox'
														collection={collection}
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
		if (this.props.studioInstallation) {
			existingIds = this.props.studioInstallation.config.map(c => c._id)
			addOptions = this.props.blueprint.studioConfigManifest.map(c => ({ value: c.id, name: c.name }))
		}

		return addOptions.filter(o => existingIds.indexOf(o.value) === -1)
	}

	render () {
		const { t } = this.props
		return (
			<div>
				<ModalDialog title={t('Add config item')} acceptText={t('Add')} secondaryText={t('Cancel')} show={this.state.showAddItem} onAccept={(e) => this.handleConfirmAddItemAccept(e)} onSecondary={(e) => this.handleConfirmAddItemCancel(e)}>
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
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmDeleteAccept(e)} onSecondary={(e) => this.handleConfirmDeleteCancel(e)}>
					<p>{t('Are you sure you want to delete this config item "{{configId}}"?', { configId: (this.state.deleteConfirmItem && this.state.deleteConfirmItem.name) })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</ModalDialog>
				<h3>{t('Blueprint Configuration')}</h3>
				<table className='expando settings-studio-custom-config-table'>
					<tbody>
						{this.renderItems()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={this.addConfigItem}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		)
	}
}
