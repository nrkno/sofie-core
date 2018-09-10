import * as ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import Moment from 'react-moment'
import { RundownAPI } from '../../../lib/api/rundown'
import { LookaheadMode } from '../../../lib/api/playout'
import { IOutputLayer,
	ISourceLayer,
	IStudioConfigItem,
	StudioInstallation,
	StudioInstallations,
	Mapping,
	MappingCasparCG,
	MappingAtem,
	MappingLawo,
	MappingAtemType,
	MappingLawoType
} from '../../../lib/collections/StudioInstallations'
import { ShowStyles } from '../../../lib/collections/ShowStyles'
import { EditAttribute, EditAttributeBase } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { literal } from '../../../lib/lib'
import { Random } from 'meteor/random'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { PeripheralDevice, PeripheralDevices, PlayoutDeviceType } from '../../../lib/collections/PeripheralDevices'

import { Link } from 'react-router-dom'
import { MomentFromNow } from '../../lib/Moment'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'

interface IProps {
	studioInstallation: StudioInstallation
	studioDevices: Array<PeripheralDevice>
	availableDevices: Array<PeripheralDevice>
	availableShowStyles: Array<{
		name: string,
		value: string
	}>
}

interface IChildStudioInterfaceProps {
	onDeleteSource?: (item: ISourceLayer) => void
	onDeleteOutput?: (item: IOutputLayer) => void
	onRemoveDevice?: (item: PeripheralDevice) => void
	onRemoveMapping?: (layerId: string) => void
	onDeleteConfigItem?: (item: IStudioConfigItem) => void
	onAddSource?: () => void
	onAddOutput?: () => void
	onAddDevice?: (item: PeripheralDevice) => void
	onAddMapping?: () => void
	onAddConfigItem?: () => void
}

interface IStudioOutputSettingsProps extends IProps, IChildStudioInterfaceProps {
}
interface IStudioOutputSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: IOutputLayer | undefined
	editedOutputs: Array<string>
}

class StudioOutputSettings extends React.Component<Translated<IStudioOutputSettingsProps>, IStudioOutputSettingsState> {
	constructor (props: Translated<IStudioOutputSettingsProps>) {
		super(props)

		this.state = {
			showDeleteConfirm: false,
			deleteConfirmItem: undefined,
			editedOutputs: []
		}
	}

	isItemEdited = (item: IOutputLayer) => {
		return this.state.editedOutputs.indexOf(item._id) >= 0
	}

	finishEditItem = (item: IOutputLayer) => {
		let index = this.state.editedOutputs.indexOf(item._id)
		if (index >= 0) {
			this.state.editedOutputs.splice(index, 1)
			this.setState({
				editedOutputs: this.state.editedOutputs
			})
		}
	}

	editItem = (item: IOutputLayer) => {
		if (this.state.editedOutputs.indexOf(item._id) < 0) {
			this.state.editedOutputs.push(item._id)
			this.setState({
				editedOutputs: this.state.editedOutputs
			})
		}
	}

	confirmDelete = (item: IOutputLayer) => {
		this.setState({
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
		if (this.props.onDeleteOutput && typeof this.props.onDeleteOutput === 'function' && this.state.deleteConfirmItem) {
			this.props.onDeleteOutput(this.state.deleteConfirmItem)
		}

		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	renderOutputs () {
		const { t } = this.props
		return (
			this.props.studioInstallation.outputLayers.map((item, index) => {
				let newItem = _.clone(item) as (IOutputLayer & { index: number })
				newItem.index = index
				return newItem
			}).sort((a, b) => {
				return a._rank - b._rank
			}).map((item, index) => {
				return [
					<tr key={item._id} className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<th className='settings-studio-output-table__name c2'>
							{item.name}
						</th>
						<td className='settings-studio-output-table__id c4'>
							{item._id}
						</td>
						<td className='settings-studio-output-table__isPGM c3'>
							<div className={ClassNames('switch', 'switch-tight', {
								'switch-active': item.isPGM
							})}>PGM</div>
						</td>
						<td className='settings-studio-output-table__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editItem(item)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.confirmDelete(item)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>,
					this.isItemEdited(item) ?
						<tr className='expando-details hl' key={item._id + '-details'}>
							<td colSpan={4}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Channel name')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'outputLayers.' + item.index + '.name'}
													obj={this.props.studioInstallation}
													type='text'
													collection={StudioInstallations}
													className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Internal ID')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'outputLayers.' + item.index + '._id'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'outputLayers.' + item.index + '.isPGM'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
											{t('Is PGM output')}
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Display rank')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'outputLayers.' + item.index + '._rank'}
												obj={this.props.studioInstallation}
												type='int'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
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
					:
						null
				]
			})
		)
	}

	render () {
		const { t } = this.props
		return (
			<div>
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmDeleteAccept(e)} onSecondary={(e) => this.handleConfirmDeleteCancel(e)}>
					<p>{t('Are you sure you want to delete output channel ') + (this.state.deleteConfirmItem && this.state.deleteConfirmItem.name) + '?'}</p>
					<p>{t('This action is irreversible.')}</p>
				</ModalDialog>
				<h3>{t('Output channels')}</h3>
				<table className='expando settings-studio-output-table'>
					<tbody>
						{this.renderOutputs()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={this.props.onAddOutput}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		)
	}
}

interface IStudioKeyValueSettingsProps extends IProps, IChildStudioInterfaceProps {
}
interface IStudioKeyValueSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: IStudioConfigItem | undefined
	editedItems: Array<string>
}

class StudioKeyValueSettings extends React.Component<Translated<IStudioKeyValueSettingsProps>, IStudioKeyValueSettingsState> {
	constructor (props: Translated<IStudioKeyValueSettingsProps>) {
		super(props)

		this.state = {
			showDeleteConfirm: false,
			deleteConfirmItem: undefined,
			editedItems: []
		}
	}

	isItemEdited = (item: IStudioConfigItem) => {
		return this.state.editedItems.indexOf(item._id) >= 0
	}

	finishEditItem = (item: IStudioConfigItem) => {
		let index = this.state.editedItems.indexOf(item._id)
		if (index >= 0) {
			this.state.editedItems.splice(index, 1)
			this.setState({
				editedItems: this.state.editedItems
			})
		}
	}

	editItem = (item: IStudioConfigItem) => {
		if (this.state.editedItems.indexOf(item._id) < 0) {
			this.state.editedItems.push(item._id)
			this.setState({
				editedItems: this.state.editedItems
			})
		}
	}

	confirmDelete = (item: IStudioConfigItem) => {
		this.setState({
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
		if (this.props.onDeleteConfigItem && typeof this.props.onDeleteConfigItem === 'function' && this.state.deleteConfirmItem) {
			this.props.onDeleteConfigItem(this.state.deleteConfirmItem)
		}

		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	renderItems () {
		const { t } = this.props
		return (
			(this.props.studioInstallation.config || []).map((item, index) => {
				return <React.Fragment key={item._id}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<th className='settings-studio-custom-config-table__name c2'>
							{item._id}
						</th>
						<td className='settings-studio-custom-config-table__value c3'>
							{item.value}
						</td>
						<td className='settings-studio-custom-config-table__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editItem(item)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.confirmDelete(item)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
					{this.isItemEdited(item) &&
						<tr className='expando-details hl'>
							<td colSpan={4}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('ID')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'config.' + index + '._id'}
													obj={this.props.studioInstallation}
													type='text'
													collection={StudioInstallations}
													className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Value')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'config.' + index + '.value'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
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

	render () {
		const { t } = this.props
		return (
			<div>
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmDeleteAccept(e)} onSecondary={(e) => this.handleConfirmDeleteCancel(e)}>
					<p>{t('Are you sure you want to delete this config item ') + (this.state.deleteConfirmItem && this.state.deleteConfirmItem._id) + '?'}</p>
					<p>{t('This action is irreversible.')}</p>
				</ModalDialog>
				<h3>{t('Custom config')}</h3>
				<table className='expando settings-studio-custom-config-table'>
					<tbody>
						{this.renderItems()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={this.props.onAddConfigItem}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		)
	}
}

interface IStudioSourcesSettingsProps extends IProps, IChildStudioInterfaceProps {
}
interface IStudioSourcesSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: ISourceLayer | undefined
	editedSources: Array<string>
}

class StudioSourcesSettings extends React.Component<Translated<IStudioSourcesSettingsProps>, IStudioSourcesSettingsState> {
	constructor (props: Translated<IStudioSourcesSettingsProps>) {
		super(props)

		this.state = {
			showDeleteConfirm: false,
			deleteConfirmItem: undefined,
			editedSources: []
		}
	}

	isItemEdited = (item: ISourceLayer) => {
		return this.state.editedSources.indexOf(item._id) >= 0
	}

	finishEditItem = (item: ISourceLayer) => {
		let index = this.state.editedSources.indexOf(item._id)
		if (index >= 0) {
			this.state.editedSources.splice(index, 1)
			this.setState({
				editedSources: this.state.editedSources
			})
		}
	}

	editItem = (item: ISourceLayer) => {
		if (this.state.editedSources.indexOf(item._id) < 0) {
			this.state.editedSources.push(item._id)
			this.setState({
				editedSources: this.state.editedSources
			})
		}
	}

	sourceLayerString (type: RundownAPI.SourceLayerType) {
		const { t } = this.props
		switch (type) {
			case RundownAPI.SourceLayerType.CAMERA:
				return t('Camera')
			case RundownAPI.SourceLayerType.GRAPHICS:
				return t('Graphics')
			case RundownAPI.SourceLayerType.LIVE_SPEAK:
				return t('LiveSpeak')
			case RundownAPI.SourceLayerType.LOWER_THIRD:
				return t('Lower Third')
			case RundownAPI.SourceLayerType.MIC:
				return t('Studio Microphone')
			case RundownAPI.SourceLayerType.REMOTE:
				return t('Remote source')
			case RundownAPI.SourceLayerType.SCRIPT:
				return t('Generic script')
			case RundownAPI.SourceLayerType.SPLITS:
				return t('Split screen')
			case RundownAPI.SourceLayerType.VT:
				return t('Clips')
			case RundownAPI.SourceLayerType.METADATA:
				return t('Metadata')
			case RundownAPI.SourceLayerType.CAMERA_MOVEMENT:
				return t('Camera Movement')
			case RundownAPI.SourceLayerType.UNKNOWN:
				return t('Unknown layer')
			case RundownAPI.SourceLayerType.AUDIO:
				return t('Audio Mixing')
			case RundownAPI.SourceLayerType.TRANSITION:
				return t('Transition')
			default:
				return RundownAPI.SourceLayerType[type]
		}
	}

	confirmDelete = (item: ISourceLayer) => {
		this.setState({
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
		if (this.props.onDeleteSource && typeof this.props.onDeleteSource === 'function' && this.state.deleteConfirmItem) {
			this.props.onDeleteSource(this.state.deleteConfirmItem)
		}

		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	renderInputSources () {
		const { t } = this.props

		return (
			this.props.studioInstallation.sourceLayers.map((item, index) => {
				let newItem = _.clone(item) as (ISourceLayer & {index: number})
				newItem.index = index
				return newItem
			}).sort((a, b) => {
				return a._rank - b._rank
			}).map((item, index) => {
				return <React.Fragment key={item._id}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<th className='settings-studio-source-table__name c2'>
							{item.name}
						</th>
						<td className='settings-studio-source-table__id c4'>
							{item._id}
						</td>
						<td className='settings-studio-source-table__type c3'>
							{this.sourceLayerString(Number.parseInt(item.type.toString(), 10) as RundownAPI.SourceLayerType)}
						</td>
						<td className='settings-studio-source-table__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editItem(item)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.confirmDelete(item)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
					{this.isItemEdited(item) &&
						<tr className='expando-details hl'>
							<td colSpan={4}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Source name')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.name'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Source abbreviation')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.abbreviation'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Internal ID')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '._id'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Source type')}
											<div className='select focusable'>
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'sourceLayers.' + item.index + '.type'}
													obj={this.props.studioInstallation}
													type='dropdown'
													options={RundownAPI.SourceLayerType}
													optionsAreNumbers
													collection={StudioInstallations}
													className='focusable-main input-l'></EditAttribute>
											</div>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.unlimited'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
											{t('Is unlimited')}
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.onPGMClean'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
											{t('Is on clean PGM')}
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.isRemoteInput'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
											{t('Is a live remote input')}
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.isHidden'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
											{t('Is hidden')}
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Display rank')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '._rank'}
												obj={this.props.studioInstallation}
												type='int'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.onPresenterScreen'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
											{t('Display on presenter\'s screen')}
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('AdLib activate shortcut list')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.activateKeyboardHotkeys'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Clear shortcut')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.clearKeyboardHotkey'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.assignHotkeysToGlobalAdlibs'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
											{t('Assign hotkeys to global adlibs')}
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.isSticky'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
											{t('Items on this layer are sticky')}
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Activate sticky item shortcut')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.activateStickyKeyboardHotkey'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.allowDisable'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''
											/>
											{t('Allow disabling of elements')}
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + item.index + '.isQueueable'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''
											/>
											{t('Adlibs on this layer can be queued')}
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

	render () {
		const { t } = this.props
		return (
			<div>
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmDeleteAccept(e)} onSecondary={(e) => this.handleConfirmDeleteCancel(e)}>
					<p>{t('Are you sure you want to delete source layer ') + (this.state.deleteConfirmItem && this.state.deleteConfirmItem.name) + '?'}</p>
					<p>{t('This action is irreversible.')}</p>
				</ModalDialog>
				<h3>{t('Source Layers')}</h3>
				<table className='expando settings-studio-source-table'>
					<tbody>
						{this.renderInputSources()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={this.props.onAddSource}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		)
	}
}
interface IStudioDevicesProps extends IProps, IChildStudioInterfaceProps {
}
interface IStudioDevicesSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: PeripheralDevice | undefined
	showAvailableDevices: boolean
}
class StudioDevices extends React.Component<Translated<IStudioDevicesProps>, IStudioDevicesSettingsState> {
	constructor (props: Translated<IStudioDevicesProps>) {
		super(props)

		this.state = {
			showDeleteConfirm: false,
			deleteConfirmItem: undefined,
			showAvailableDevices: false,
		}
	}

	handleConfirmRemoveCancel = (e) => {
		this.setState({
			showDeleteConfirm: false,
			deleteConfirmItem: undefined
		})
	}

	handleConfirmRemoveAccept = (e) => {
		if (this.props.onRemoveDevice && typeof this.props.onRemoveDevice === 'function' && this.state.deleteConfirmItem) {
			this.props.onRemoveDevice(this.state.deleteConfirmItem)
		}
		this.setState({
			showDeleteConfirm: false,
			deleteConfirmItem: undefined
		})
	}

	confirmRemove = (item: PeripheralDevice) => {
		this.setState({
			showDeleteConfirm: true,
			deleteConfirmItem: item
		})
	}

	renderDevices () {
		const { t } = this.props

		return (
			this.props.studioDevices.map((device, index) => {
				return <tr key={device._id}>
							<th className='settings-studio-device__name c3'>
								<Link to={'/settings/peripheralDevice/' + device._id}>{device.name}</Link>
							</th>
							<td className='settings-studio-device__id c3'>
								{device._id}
							</td>
							<td className='settings-studio-device__id c3'>
								<MomentFromNow date={device.lastSeen} />
							</td>
							<td className='settings-studio-device__actions table-item-actions c3'>
								<button className='action-btn' onClick={(e) => this.confirmRemove(device)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
			})
		)
	}

	showAvailableDevices () {
		this.setState({
			showAvailableDevices: !this.state.showAvailableDevices
		})
	}

	render () {
		const { t } = this.props
		return (
			<div>
				<ModalDialog title={t('Remove this device?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmRemoveAccept(e)} onSecondary={(e) => this.handleConfirmRemoveCancel(e)}>
					<p>{t('Are you sure you want to remove device ') + (this.state.deleteConfirmItem && this.state.deleteConfirmItem.name) + '?'}</p>
				</ModalDialog>
				<h3>{t('Attached devices')}</h3>
				<table className='expando settings-studio-device-table'>
					<tbody>
						{this.renderDevices()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={(e) => this.showAvailableDevices()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
					{ this.state.showAvailableDevices &&
						<div className='border-box text-s studio-devices-dropdown'>
							<div className='ctx-menu'>
								{
									this.props.availableDevices.map((device) => {
										return (
											<div className='ctx-menu-item' key={device._id} onClick={(e) => this.props.onAddDevice && this.props.onAddDevice(device)}>
												<b>{device.name}</b> <MomentFromNow date={device.lastSeen} /> ({device._id})
											</div>
										)
									})
								}
							</div>
						</div>
					}
				</div>
			</div>
		)
	}
}

interface IStudioMappingsState {
	showDeleteConfirm: boolean
	deleteConfirmLayerId: string | undefined
	editedMappings: Array<string>
}
interface IStudioMappingsProps extends IProps, IChildStudioInterfaceProps {
	match: {
		params: {
			studioId: string
		}
	}
}
class StudioMappings extends React.Component<Translated<IStudioMappingsProps>, IStudioMappingsState> {
	constructor (props: Translated<IStudioMappingsProps>) {
		super(props)

		this.state = {
			showDeleteConfirm: false,
			deleteConfirmLayerId: undefined,
			editedMappings: []
		}
	}

	isItemEdited = (layerId: string) => {
		return this.state.editedMappings.indexOf(layerId) >= 0
	}

	finishEditItem = (layerId: string) => {
		let index = this.state.editedMappings.indexOf(layerId)
		if (index >= 0) {
			this.state.editedMappings.splice(index, 1)
			this.setState({
				editedMappings: this.state.editedMappings
			})
		}
	}

	editItem = (layerId: string) => {
		if (this.state.editedMappings.indexOf(layerId) < 0) {
			this.state.editedMappings.push(layerId)
			this.setState({
				editedMappings: this.state.editedMappings
			})
		}
	}

	handleConfirmRemoveCancel = (e) => {
		this.setState({
			showDeleteConfirm: false,
			deleteConfirmLayerId: undefined
		})
	}

	handleConfirmRemoveAccept = (e) => {
		this.state.deleteConfirmLayerId && this.removeLayer(this.state.deleteConfirmLayerId)
		this.setState({
			showDeleteConfirm: false,
			deleteConfirmLayerId: undefined
		})
	}

	confirmRemove = (layerId: string) => {
		this.setState({
			showDeleteConfirm: true,
			deleteConfirmLayerId: layerId
		})
	}
	removeLayer = (layerId: string) => {
		let unsetObject = {}
		unsetObject['mappings.' + layerId] = ''
		StudioInstallations.update(this.props.studioInstallation._id, {
			$unset: unsetObject
		})
	}
	addNewLayer = () => {
		// find free key name
		let newLayerKeyName = 'newLayer'
		let iter = 0
		while ((this.props.studioInstallation.mappings || {})[newLayerKeyName + iter.toString()]) {
			iter++
		}
		let setObject = {}
		setObject['mappings.' + newLayerKeyName + iter.toString()] = {
			device: PlayoutDeviceType.CASPARCG,
			deviceId: 'newDeviceId',
		}

		StudioInstallations.update(this.props.studioInstallation._id, {
			$set: setObject
		})
	}
	updateLayerId = (edit: EditAttributeBase, newValue: string) => {

		let oldLayerId = edit.props.overrideDisplayValue
		let newLayerId = newValue + ''
		let layer = this.props.studioInstallation.mappings[oldLayerId]

		if (this.props.studioInstallation.mappings[newLayerId]) {
			throw new Meteor.Error(400, 'Layer "' + newLayerId + '" already exists')
		}

		let mSet = {}
		let mUnset = {}
		mSet['mappings.' + newLayerId] = layer
		mUnset['mappings.' + oldLayerId] = 1

		edit.props.collection.update(this.props.studioInstallation._id, {
			$set: mSet,
			$unset: mUnset
		})

		this.finishEditItem(oldLayerId)
		this.editItem(newLayerId)
	}

	renderCaparCGMappingSettings (layerId: string) {
		const { t } = this.props
		return (
			<React.Fragment>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('channel')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'mappings.' + layerId + '.channel'}
							obj={this.props.studioInstallation}
							type='int'
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('layer')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'mappings.' + layerId + '.layer'}
							obj={this.props.studioInstallation}
							type='int'
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
			</React.Fragment>
		)
	}

	renderAtemMappingSettings (layerId: string) {
		const { t } = this.props
		return (
			<React.Fragment>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('mappingType')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'mappings.' + layerId + '.mappingType'}
							obj={this.props.studioInstallation}
							type='dropdown'
							options={MappingAtemType}
							optionsAreNumbers={true}
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('index')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'mappings.' + layerId + '.index'}
							obj={this.props.studioInstallation}
							type='int'
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
			</React.Fragment>
		)
	}
	renderLawoMappingSettings (layerId: string) {
		const { t } = this.props
		return (
			<React.Fragment>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('mappingType')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'mappings.' + layerId + '.mappingType'}
							obj={this.props.studioInstallation}
							type='dropdown'
							options={MappingLawoType}
							optionsAreNumbers={true}
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('Identifier')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'mappings.' + layerId + '.identifier'}
							obj={this.props.studioInstallation}
							type='text'
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
			</React.Fragment>
		)
	}

	renderMappings () {
		const { t } = this.props

		return (
			_.map(this.props.studioInstallation.mappings, (mapping: Mapping , layerId: string) => {
				return <React.Fragment key={layerId}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(layerId)
					})}>
						<th className='settings-studio-device__name c3'>
							{layerId}
						</th>
						<td className='settings-studio-device__id c2'>
							{mapping.device}
						</td>
						<td className='settings-studio-device__id c2'>
							{mapping.deviceId}
						</td>
						<td className='settings-studio-device__id c4'>
						{
							(
								mapping.device === PlayoutDeviceType.CASPARCG && (
								<span>{ (mapping as MappingCasparCG).channel } - { (mapping as MappingCasparCG).layer }</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.ATEM && (
								<span>{ (mapping as MappingAtem).mappingType } - { (mapping as MappingAtem).index }</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.LAWO && (
								<span>{ (mapping as MappingLawo).identifier }</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.HTTPSEND && (
								<span></span>
							)) ||
							(
								<span>Unknown device type: {PlayoutDeviceType[mapping.device] } </span>
							)
						}
						</td>

						<td className='settings-studio-device__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editItem(layerId)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.confirmRemove(layerId)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
					{this.isItemEdited(layerId) &&
						<tr className='expando-details hl'>
							<td colSpan={5}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Layer ID')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'mappings' }
												overrideDisplayValue={layerId }
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												updateFunction={this.updateLayerId}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Device type')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'mappings.' + layerId + '.device'}
												obj={this.props.studioInstallation}
												type='dropdown'
												options={PlayoutDeviceType}
												optionsAreNumbers={true}
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Device Id')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'mappings.' + layerId + '.deviceId'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Lookahead mode')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'mappings.' + layerId + '.lookahead'}
												obj={this.props.studioInstallation}
												type='dropdown'
												options={LookaheadMode}
												optionsAreNumbers={true}
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									{(
										mapping.device === PlayoutDeviceType.CASPARCG && (
											this.renderCaparCGMappingSettings(layerId)
										) ||
										(
										mapping.device === PlayoutDeviceType.ATEM && (
											this.renderAtemMappingSettings(layerId)
										))
										) ||
										(
										mapping.device === PlayoutDeviceType.LAWO && (
											this.renderLawoMappingSettings(layerId)
										))
									}
								</div>
								<div className='mod alright'>
									<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(layerId)}>
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

	render () {
		const { t } = this.props
		return (
			<div>
				<ModalDialog title={t('Remove this mapping?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmRemoveAccept(e)} onSecondary={(e) => this.handleConfirmRemoveCancel(e)}>
					<p>{t('Are you sure you want to remove mapping for LLayer ') + (this.state.deleteConfirmLayerId && this.state.deleteConfirmLayerId) + '?'}</p>
				</ModalDialog>
				<h3>{t('Layer Mappings')}</h3>
				<table className='expando settings-studio-mappings-table'>
					<tbody>
						{this.renderMappings()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={(e) => this.addNewLayer()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		)
	}
}

interface IStudioSettingsProps extends IProps, IChildStudioInterfaceProps {
	match: {
		params: {
			studioId: string
		}
	}
}
export default translateWithTracker((props: IStudioSettingsProps, state) => {
	return {
		studioInstallation: StudioInstallations.findOne(props.match.params.studioId),
		studioDevices: PeripheralDevices.find({
			studioInstallationId: props.match.params.studioId
		}).fetch(),
		availableShowStyles: ShowStyles.find().fetch().map((item) => {
			return {
				name: `${item.name} (${item._id})`,
				value: item._id
			}
		}),
		availableDevices: PeripheralDevices.find({
			studioInstallationId: {
				$not: {
					$eq: props.match.params.studioId
				}
			}
		}, {
			sort: {
				lastConnected: -1
			}
		}).fetch()
	}
})(class StudioSettings extends MeteorReactComponent<Translated<IStudioSettingsProps>> {

	static setProperty (studioInstallation: StudioInstallation, property: string, value: any) {
		// console.log(property, value)
		let m = {}
		if (value !== undefined) {
			m[property] = value
			StudioInstallations.update(studioInstallation._id, { $set: m })
		} else {
			m[property] = 0
			StudioInstallations.update(studioInstallation._id, { $unset: m })
		}
	}

	static findHighestRank (array: Array<{ _rank: number }>): { _rank: number } | null {
		let max: { _rank: number } | null = null

		array.forEach((value, index) => {
			if (max == null || max._rank < value._rank) {
				max = value
			}
		})

		return max
	}

	onDeleteSource = (item: ISourceLayer) => {
		if (this.props.studioInstallation) {
			StudioInstallations.update(this.props.studioInstallation._id, {
				$pull: {
					sourceLayers: {
						_id: item._id
					}
				}
			})
		}
	}

	onDeleteOutput = (item: IOutputLayer) => {
		if (this.props.studioInstallation) {
			StudioInstallations.update(this.props.studioInstallation._id, {
				$pull: {
					outputLayers: {
						_id: item._id
					}
				}
			})
		}
	}

	onDeleteConfigItem = (item: IStudioConfigItem) => {
		if (this.props.studioInstallation) {
			StudioInstallations.update(this.props.studioInstallation._id, {
				$pull: {
					config: {
						_id: item._id
					}
				}
			})
		}
	}

	onAddSource = () => {
		const maxRank = StudioSettings.findHighestRank(this.props.studioInstallation.sourceLayers)
		const { t } = this.props

		const newSource = literal<ISourceLayer>({
			_id: this.props.studioInstallation._id + '-' + Random.id(5),
			_rank: maxRank ? maxRank._rank + 10 : 0,
			name: t('New source'),
			type: RundownAPI.SourceLayerType.UNKNOWN,
			unlimited: false,
			onPGMClean: true
		})

		StudioInstallations.update(this.props.studioInstallation._id, {
			$push: {
				sourceLayers: newSource
			}
		})
	}

	onAddOutput = () => {
		const maxRank = StudioSettings.findHighestRank(this.props.studioInstallation.outputLayers)
		const { t } = this.props

		const newOutput = literal<IOutputLayer>({
			_id: this.props.studioInstallation._id + '-' + Random.id(5),
			_rank: maxRank ? maxRank._rank + 10 : 0,
			name: t('New output'),
			isPGM: false
		})

		StudioInstallations.update(this.props.studioInstallation._id, {
			$push: {
				outputLayers: newOutput
			}
		})
	}

	onAddConfigItem = () => {
		const { t } = this.props

		const newItem = literal<IStudioConfigItem>({
			_id: t('new_config_item'),
			value: ''
		})

		StudioInstallations.update(this.props.studioInstallation._id, {
			$push: {
				config: newItem
			}
		})
	}

	onRemoveDevice = (item: PeripheralDevice) => {
		PeripheralDevices.update(item._id, {$unset: {
			studioInstallationId: 1
		}})
	}

	onAddDevice = (item: PeripheralDevice) => {
		PeripheralDevices.update(item._id, {$set: {
			studioInstallationId: this.props.studioInstallation._id
		}})
	}

	renderEditForm () {
		const { t } = this.props

		return (
				<div className='studio-edit mod mhl mvs'>
					<div>
						<h3>{t('Generic properties')}</h3>
						<label className='field'>
							{t('Studio name')}
							<div className='mdi'>
								<EditAttribute
									modifiedClassName='bghl'
									attribute='name'
									obj={this.props.studioInstallation}
									type='text'
									collection={StudioInstallations}
									className='mdinput'></EditAttribute>
								<span className='mdfx'></span>
							</div>
						</label>
						<label className='field'>
							{t('Default show style')}
							<div className='mdi'>
								<EditAttribute
									modifiedClassName='bghl'
									attribute='defaultShowStyle'
									obj={this.props.studioInstallation}
									type='dropdown'
									options={this.props.availableShowStyles}
									collection={StudioInstallations}
									className='mdinput'></EditAttribute>
								<span className='mdfx'></span>
							</div>
						</label>
					</div>

					<div className='row'>
						<div className='col c12 rl-c6'>
							<StudioSourcesSettings {...this.props} onDeleteSource={this.onDeleteSource} onAddSource={this.onAddSource} />
						</div>
						<div className='col c12 rl-c6'>
							<StudioOutputSettings {...this.props} onDeleteOutput={this.onDeleteOutput} onAddOutput={this.onAddOutput} />
						</div>
					</div>
					<div className='row'>
						<div className='col c12 r1-c12'>
							<StudioDevices {...this.props} onRemoveDevice={this.onRemoveDevice} onAddDevice={this.onAddDevice} />
						</div>
					</div>
					<div className='row'>
						<div className='col c12 r1-c12'>
							<StudioMappings {...this.props} />
						</div>
					</div>
					<div className='row'>
						<div className='col c12 r1-c12'>
							<StudioKeyValueSettings {...this.props} onAddConfigItem={this.onAddConfigItem} onDeleteConfigItem={this.onDeleteConfigItem} />
						</div>
					</div>
				</div>
		)
	}

	render () {
		const { t } = this.props

		if (this.props.studioInstallation) {
			return this.renderEditForm()
		} else {
			return <Spinner />
		}
	}
})
