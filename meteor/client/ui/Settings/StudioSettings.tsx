import * as ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { InjectedTranslateProps, translate, Trans } from 'react-i18next'
import * as _ from 'underscore'
import Moment from 'react-moment'
import { RundownAPI } from '../../../lib/api/rundown'
import { IOutputLayer, ISourceLayer, StudioInstallation, StudioInstallations, Mapping, MappingCasparCG, MappingAtem, MappingLawo, MappingAtemType } from '../../../lib/collections/StudioInstallations'
import { EditAttribute, EditAttributeBase } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { literal } from '../../../lib/lib'
import { Random } from 'meteor/random'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as objectPath from 'object-path'
import { PeripheralDevice, PeripheralDevices, PlayoutDeviceType } from '../../../lib/collections/PeripheralDevices'

import { Link } from 'react-router-dom'

interface IPropsHeader {
	studioInstallation: StudioInstallation
	studioDevices: Array<PeripheralDevice>
	availableDevices: Array<PeripheralDevice>
}

interface IChildStudioInterfaceProps {
	onDeleteSource?: (item: ISourceLayer) => void
	onDeleteOutput?: (item: IOutputLayer) => void
	onRemoveDevice?: (item: PeripheralDevice) => void
	onRemoveMapping?: (layerId: string) => void
	onAddSource?: () => void
	onAddOutput?: () => void
	onAddDevice?: (item: PeripheralDevice) => void
	onAddMapping?: () => void
}

interface IStudioOutputSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: IOutputLayer | undefined
	editedOutputs: Array<string>
}

class StudioOutputSettings extends React.Component<IChildStudioInterfaceProps & IPropsHeader & InjectedTranslateProps, IStudioOutputSettingsState> {
	constructor (props) {
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
			this.props.studioInstallation.outputLayers.sort((a, b) => {
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
													attribute={'outputLayers.' + index + '.name'}
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
												attribute={'outputLayers.' + index + '._id'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Is PGM output')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'outputLayers.' + index + '.isPGM'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
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

interface IStudioSourcesSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: ISourceLayer | undefined
	editedSources: Array<string>
}

class StudioSourcesSettings extends React.Component<IChildStudioInterfaceProps & IPropsHeader & InjectedTranslateProps, IStudioSourcesSettingsState> {
	constructor (props) {
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
			this.props.studioInstallation.sourceLayers.sort((a, b) => {
				return a._rank - b._rank
			}).map((item, index) => {
				return [
					<tr key={item._id} className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<th className='settings-studio-source-table__name c2'>
							{item.name}
						</th>
						<td className='settings-studio-source-table__id c4'>
							{item._id}
						</td>
						<td className='settings-studio-source-table__type c3'>
							{this.sourceLayerString(Number.parseInt(item.type.toString()) as RundownAPI.SourceLayerType)}
						</td>
						<td className='settings-studio-source-table__actions table-item-actions c3'>
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
											{t('Source name')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + index + '.name'}
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
												attribute={'sourceLayers.' + index + '._id'}
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
													attribute={'sourceLayers.' + index + '.type'}
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
											{t('Is unlimited')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + index + '.unlimited'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Is on clean PGM')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + index + '.onPGMClean'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Is a live remote input')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + index + '.isRemoteInput'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
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
					<p>{t('Are you sure you want to delete source layer ') + (this.state.deleteConfirmItem && this.state.deleteConfirmItem.name) + '?'}</p>
					<p>{t('This action is irreversible.')}</p>
				</ModalDialog>
				<h3>{t('Source layers')}</h3>
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

interface IStudioDevicesSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: PeripheralDevice | undefined
	showAvailableDevices: boolean
}
class StudioDevices extends React.Component<IChildStudioInterfaceProps & IPropsHeader & InjectedTranslateProps, IStudioDevicesSettingsState> {
	constructor (props) {
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
								<Moment fromNow date={device.lastSeen} />
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
												<b>{device.name}</b> <Moment fromNow date={device.lastSeen} /> ({device._id})
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

interface IStudioMappingsSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmLayerId: string | undefined
	editedMappings: Array<string>
}
class StudioMappings extends React.Component<IChildStudioInterfaceProps & IPropsHeader & InjectedTranslateProps, IStudioMappingsSettingsState> {
	constructor (props) {
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

	renderMappings () {
		const { t } = this.props

		return (
			_.map(this.props.studioInstallation.mappings, (mapping: Mapping , layerId: string) => {
				return (
					!this.isItemEdited(layerId) ?
					<tr key={layerId}>
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
								<span>{ (mapping as MappingLawo).channel }</span>
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
					</tr> :
					<tr className='expando-details hl' key={layerId + '-details'}>
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
								{(
									mapping.device === PlayoutDeviceType.CASPARCG && (
										this.renderCaparCGMappingSettings(layerId)
									) ||
									(
									mapping.device === PlayoutDeviceType.ATEM && (
										this.renderAtemMappingSettings(layerId)
									))
								)}
							</div>
							<div className='mod alright'>
								<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(layerId)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>
				)
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

class StudioSettings extends React.Component<IPropsHeader & InjectedTranslateProps> {

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

	findHighestRank (array: Array<{_rank: number}>): {_rank: number} | null {
		let max: {_rank: number} | null = null

		array.forEach((value, index) => {
			if (max == null || max._rank < value._rank) {
				max = value
			}
		})

		return max
	}

	onAddSource = () => {
		const maxRank = this.findHighestRank(this.props.studioInstallation.sourceLayers)
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
		const maxRank = this.findHighestRank(this.props.studioInstallation.outputLayers)
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
}

export default translate()(withTracker((props, state) => {
	return {
		studioInstallation: StudioInstallations.findOne(props.match.params.studioId),
		studioDevices: PeripheralDevices.find({
			studioInstallationId: props.match.params.studioId
		}).fetch(),
		availableDevices: PeripheralDevices.find({
			studioInstallationId: {
				$not: {
					$eq: props.match.params.studioId
				}
			}
		}, {
			sort: {
				lastSeen: -1
			}
		}).fetch()
	}
})(StudioSettings))
