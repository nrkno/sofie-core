import * as ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import {
	StudioInstallation,
	StudioInstallations,
	MappingExt
} from '../../../lib/collections/StudioInstallations'
import {
	MappingCasparCG,
	MappingAtem,
	MappingLawo,
	MappingHyperdeck,
	MappingAtemType,
	MappingLawoType,
	MappingPanasonicPtzType,
	MappingPanasonicPtz,
	MappingHyperdeckType,
	DeviceType as PlayoutDeviceType,
	ChannelFormat
} from 'timeline-state-resolver-types'
import { EditAttribute, EditAttributeBase } from '../../lib/EditAttribute'
import { doModalDialog } from '../../lib/ModalDialog'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { literal } from '../../../lib/lib'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'

import { Link } from 'react-router-dom'
import { MomentFromNow } from '../../lib/Moment'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { ShowStyleVariants, ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { translate } from 'react-i18next'
import { ShowStyleBases, ShowStyleBase, } from '../../../lib/collections/ShowStyleBases'
import { IConfigItem, LookaheadMode } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import { ConfigManifestSettings, ObjectWithConfig, collectConfigs } from './ConfigManifestSettings'

interface IConfigSettingsProps {
	item: ObjectWithConfig
}
interface IConfigSettingsState {
	editedItems: Array<string>
}

export const ConfigSettings = translate()(class ConfigSettings extends React.Component<Translated<IConfigSettingsProps>, IConfigSettingsState> {
	constructor (props: Translated<IConfigSettingsProps>) {
		super(props)

		this.state = {
			editedItems: []
		}
	}

	isItemEdited = (item: IConfigItem) => {
		return this.state.editedItems.indexOf(item._id) >= 0
	}

	finishEditItem = (item: IConfigItem) => {
		let index = this.state.editedItems.indexOf(item._id)
		if (index >= 0) {
			this.state.editedItems.splice(index, 1)
			this.setState({
				editedItems: this.state.editedItems
			})
		}
	}

	editItem = (item: IConfigItem) => {
		if (this.state.editedItems.indexOf(item._id) < 0) {
			this.state.editedItems.push(item._id)
			this.setState({
				editedItems: this.state.editedItems
			})
		}
	}
	confirmDelete = (item: IConfigItem) => {
		const { t } = this.props
		doModalDialog({
			title: t('Delete this item?'),
			no: t('Cancel'),
			onAccept: () => {
				this.onDeleteConfigItem(item)
			},
			message: <React.Fragment>
				<p>{t('Are you sure you want to delete this config item "{{configId}}"?', { configId: (item && item._id) })}</p>,
				<p>{t('Please note: This action is irreversible!')}</p>
			</React.Fragment>
		})
	}
	onDeleteConfigItem = (item: IConfigItem) => {
		this.getCollection().update(this.props.item._id, {
			$pull: {
				config: {
					_id: item._id
				}
			}
		})
	}
	onAddConfigItem = () => {
		const { t } = this.props

		const newItem = literal<IConfigItem>({
			_id: t('new_config_item'),
			value: ''
		})

		if (this.props.item) {
			this.getCollection().update(this.props.item._id, {
				$push: {
					config: newItem
				}
			})
		}
	}
	getCollection (): Mongo.Collection<any> {
		if (this.props.item instanceof StudioInstallation) {
			return StudioInstallations
		} else if (this.props.item instanceof ShowStyleBase) {
			return ShowStyleBases
		} else if (this.props.item instanceof ShowStyleVariant) {
			return ShowStyleVariants
		} else {
			logger.error('collectConfigs: unknown item type', this.props.item)
			throw new Meteor.Error('collectConfigs: unknown item type')
		}
	}

	renderItems () {
		const { t } = this.props

		let manifestEntries = collectConfigs(this.props.item)

		const excludeIds = manifestEntries.map(c => c.id)
		return (
			(this.props.item.config || []).map((item, index) => {
				// Don't show if part of the config manifest
				if (excludeIds.indexOf(item._id) !== -1) return null

				return <React.Fragment key={item._id}>
					<tr key={index} className={ClassNames({
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
													obj={this.props.item}
													type='text'
													collection={this.getCollection()}
													className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Value')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'config.' + index + '.value'}
												obj={this.props.item}
												type='text'
												collection={this.getCollection()}
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
				<h3>{t('Custom Configuration')}</h3>
				<table className='expando settings-studio-custom-config-table'>
					<tbody>
						{this.renderItems()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={this.onAddConfigItem}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		)
	}
})

interface IStudioDevicesProps {
	studioInstallation: StudioInstallation
	studioDevices: Array<PeripheralDevice>
	availableDevices: Array<PeripheralDevice>
}
interface IStudioDevicesSettingsState {
	showAvailableDevices: boolean
}
const StudioDevices = translate()(class StudioDevices extends React.Component<Translated<IStudioDevicesProps>, IStudioDevicesSettingsState> {
	constructor (props: Translated<IStudioDevicesProps>) {
		super(props)

		this.state = {
			showAvailableDevices: false,
		}
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
	confirmRemove = (device: PeripheralDevice) => {
		const { t } = this.props
		doModalDialog({
			title: t('Remove this device?'),
			no: t('Cancel'),
			onAccept: () => {
				this.onRemoveDevice(device)
			},
			message: <p>{t('Are you sure you want to remove device "{{devideId}}"?', { deviceId: device && device.name })}</p>
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
				<h3>{t('Attached Devices')}</h3>
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
											<div className='ctx-menu-item' key={device._id} onClick={(e) => this.onAddDevice(device)}>
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
})

interface IStudioMappingsProps {
	studioInstallation: StudioInstallation
}
interface IStudioMappingsState {
	editedMappings: Array<string>
}

const StudioMappings = translate()(class StudioMappings extends React.Component<Translated<IStudioMappingsProps>, IStudioMappingsState> {
	constructor (props: Translated<IStudioMappingsProps>) {
		super(props)

		this.state = {
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
	confirmRemove = (mappingId: string) => {
		const { t } = this.props
		doModalDialog({
			title: t('Remove this mapping?'),
			no: t('Cancel'),
			onAccept: () => {
				this.removeLayer(mappingId)
			},
			message: <p>{t('Are you sure you want to remove mapping for layer "{{mappingId}}"?', { mappingId: mappingId })}</p>
		})
	}
	removeLayer = (mappingId: string) => {
		let unsetObject = {}
		unsetObject['mappings.' + mappingId] = ''
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

		if (edit.props.collection) {
			edit.props.collection.update(this.props.studioInstallation._id, {
				$set: mSet,
				$unset: mUnset
			})
		}

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
	renderPanasonicPTZSettings (layerId: string) {
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
							options={MappingPanasonicPtzType}
							optionsAreNumbers={false}
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
			</React.Fragment>
		)
	}

	renderHyperdeckMappingSettings (layerId: string) {
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
							options={MappingHyperdeckType}
							optionsAreNumbers={false}
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
			</React.Fragment>
		)
	}
	renderPharosMappingSettings (layerId: string) {
		const { t } = this.props
		return (
			<React.Fragment>
				<div></div>
			</React.Fragment>
		)
	}

	renderMappings () {
		const { t } = this.props

		return (
			_.map(this.props.studioInstallation.mappings, (mapping: MappingExt , layerId: string) => {
				// If an internal mapping, then hide it
				if (mapping.internal) return <React.Fragment key={layerId}></React.Fragment>

				return <React.Fragment key={layerId}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(layerId)
					})}>
						<th className='settings-studio-device__name c3'>
							{layerId}
						</th>
						<td className='settings-studio-device__id c2'>
							{PlayoutDeviceType[mapping.device]}
						</td>
						<td className='settings-studio-device__id c2'>
							{mapping.deviceId}
						</td>
						<td className='settings-studio-device__id c4'>
						{
							(
								mapping.device === PlayoutDeviceType.ABSTRACT && (
								<span>-</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.CASPARCG && (
								<span>{ (mapping as MappingCasparCG).channel } - { (mapping as MappingCasparCG).layer }</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.ATEM && (
								<span>{ MappingAtemType[(mapping as MappingAtem & MappingExt).mappingType] } { (mapping as MappingAtem & MappingExt).index }</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.LAWO && (
								<span>{ (mapping as MappingLawo & MappingExt).identifier }</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.PANASONIC_PTZ && (
									<span>{
										(mapping as MappingPanasonicPtz & MappingExt).mappingType === MappingPanasonicPtzType.PRESET ? t('Preset') :
										(mapping as MappingPanasonicPtz & MappingExt).mappingType === MappingPanasonicPtzType.PRESET_SPEED ? t('Preset transition speed') :
										(mapping as MappingPanasonicPtz & MappingExt).mappingType === MappingPanasonicPtzType.ZOOM ? t('Zoom') :
										(mapping as MappingPanasonicPtz & MappingExt).mappingType === MappingPanasonicPtzType.ZOOM_SPEED ? t('Zoom speed') :
										t('Unknown mapping')
									}</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.HTTPSEND && (
								<span>-</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.HYPERDECK && (
								<span>{ (mapping as MappingHyperdeck & MappingExt).mappingType }</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.PHAROS && (
								<span>-</span>
							)) ||
							(
								mapping.device === PlayoutDeviceType.OSC && (
								<span>-</span>
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
											{t('Device Type')}
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
											{t('Device ID')}
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
											{t('Lookahead Mode')}
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
										)) ||
										(
										mapping.device === PlayoutDeviceType.PANASONIC_PTZ && (
											this.renderPanasonicPTZSettings(layerId)
										)) ||
										(
										mapping.device === PlayoutDeviceType.HYPERDECK && (
											this.renderHyperdeckMappingSettings(layerId)
										)) ||
										(
										mapping.device === PlayoutDeviceType.PHAROS && (
											this.renderPharosMappingSettings(layerId)
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
})

interface ITestToolsRecordingsSettingsProps {
	studioInstallation: StudioInstallation
}
interface ITestToolsRecordingsSettingsState {
}

const TestToolsRecordingsSettings = translate()(class TestToolsRecordingsSettings extends React.Component<Translated<ITestToolsRecordingsSettingsProps>, ITestToolsRecordingsSettingsState> {
	render () {
		const { t } = this.props
		return (
			<div>
				<h3>{t('Test Tools - Recordings')}</h3>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('Device ID')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute='testToolsConfig.recordings.deviceId'
							obj={this.props.studioInstallation}
							type='text'
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('CasparCG Channel')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute='testToolsConfig.recordings.channelIndex'
							obj={this.props.studioInstallation}
							type='int'
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('Path Prefix')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute='testToolsConfig.recordings.filePrefix'
							obj={this.props.studioInstallation}
							type='text'
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('URL Prefix')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute='testToolsConfig.recordings.urlPrefix'
							obj={this.props.studioInstallation}
							type='text'
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('Decklink Input Index')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute='testToolsConfig.recordings.decklinkDevice'
							obj={this.props.studioInstallation}
							type='int'
							collection={StudioInstallations}
							className='input text-input input-l'></EditAttribute>
					</label>
				</div>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('Decklink Input Format')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute='testToolsConfig.recordings.channelFormat'
							obj={this.props.studioInstallation}
							type='dropdown'
							options={_.keys(ChannelFormat).map((k) => ({
								name: k,
								value: ChannelFormat[k]
							}))}
							collection={StudioInstallations}
							className='input text-input input-l '></EditAttribute>
					</label>
				</div>
			</div>
		)
	}
})

interface IStudioSettingsProps {
	match: {
		params: {
			studioId: string
		}
	}
}
interface IStudioSettingsState {

}
interface IStudioSettingsTrackedProps {
	studioInstallation?: StudioInstallation
	studioDevices: Array<PeripheralDevice>
	availableShowStyleVariants: Array<{
		name: string,
		value: string,
		showStyleVariant: ShowStyleVariant
	}>
	availableShowStyleBases: Array<{
		name: string,
		value: string
		showStyleBase: ShowStyleBase
	}>
	availableDevices: Array<PeripheralDevice>
}
interface ITrackedProps {

}

export default translateWithTracker<IStudioSettingsProps, IStudioSettingsState, IStudioSettingsTrackedProps>((props: IStudioSettingsProps, state) => {
	const studio = StudioInstallations.findOne(props.match.params.studioId)

	return {
		studioInstallation: studio,
		studioDevices: PeripheralDevices.find({
			studioInstallationId: props.match.params.studioId
		}).fetch(),
		availableShowStyleVariants: ShowStyleVariants.find(studio ? {
			showStyleBaseId: {
				$in: studio.supportedShowStyleBase || []
			}
		} : {}).fetch().map((variant) => {
			const baseStyle = ShowStyleBases.findOne(variant.showStyleBaseId)
			return {
				name: `${(baseStyle || {name: ''}).name}: ${variant.name} (${variant._id})`,
				value: variant._id,
				showStyleVariant: variant
			}
		}),
		availableShowStyleBases: ShowStyleBases.find().fetch().map((showStyle) => {
			return {
				name: `${showStyle.name}`,
				value: showStyle._id,
				showStyleBase: showStyle
			}
		}),
		availableDevices: PeripheralDevices.find({
			studioInstallationId: {
				$not: {
					$eq: props.match.params.studioId
				}
			},
			parentDeviceId: {
				$exists: false
			}
		}, {
			sort: {
				lastConnected: -1
			}
		}).fetch()
	}
})(class StudioSettings extends MeteorReactComponent<Translated<IStudioSettingsProps & IStudioSettingsTrackedProps>, IStudioSettingsState> {
	renderEditForm () {
		const { t } = this.props

		return (
			this.props.studioInstallation ?
			<div className='studio-edit mod mhl mvs'>
				<div>
					<h3>{t('Generic Properties')}</h3>
					<label className='field'>
						{t('Studio Name')}
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
					<div className='field'>
						{t('Select Compatible Show Styles')}
						<div className='mdi'>
							<EditAttribute
								attribute='supportedShowStyleBase'
								obj={this.props.studioInstallation}
								options={this.props.availableShowStyleBases}
								label={t('Click to show available Show Styles')}
								type='multiselect'
								collection={StudioInstallations}></EditAttribute>
						</div>
					</div>
					<label className='field'>
						{t('Default ShowStyleVariant')}
						<div className='mdi'>
							<EditAttribute
								modifiedClassName='bghl'
								attribute='defaultShowStyleVariant'
								obj={this.props.studioInstallation}
								type='dropdown'
								options={this.props.availableShowStyleVariants}
								collection={StudioInstallations}
								className='mdinput'></EditAttribute>
							<span className='mdfx'></span>
						</div>
					</label>
					<label className='field'>
						{t('Media Preview URL')}
						<div className='mdi'>
							<EditAttribute
								modifiedClassName='bghl'
								attribute='settings.mediaPreviewsUrl'
								obj={this.props.studioInstallation}
								type='text'
								collection={StudioInstallations}
								className='mdinput'></EditAttribute>
							<span className='mdfx'></span>
						</div>
					</label>
					<label className='field'>
						{t('Sofie Host URL')}
						<div className='mdi'>
							<EditAttribute
								modifiedClassName='bghl'
								attribute='settings.sofieUrl'
								obj={this.props.studioInstallation}
								type='text'
								collection={StudioInstallations}
								className='mdinput'></EditAttribute>
							<span className='mdfx'></span>
						</div>
					</label>
				</div>
				<div className='row'>
					<div className='col c12 r1-c12'>
						<StudioDevices
							studioInstallation={this.props.studioInstallation}
							studioDevices={this.props.studioDevices}
							availableDevices={this.props.availableDevices}
						/>
					</div>
				</div>
				<div className='row'>
					<div className='col c12 r1-c12'>
						<ConfigManifestSettings t={this.props.t} manifest={collectConfigs(this.props.studioInstallation)} object={this.props.studioInstallation} />
					</div>
				</div>
				<div className='row'>
					<div className='col c12 r1-c12'>
						<ConfigSettings item={this.props.studioInstallation}/>
					</div>
				</div>
				<div className='row'>
					<div className='col c12 r1-c12'>
						<StudioMappings studioInstallation={this.props.studioInstallation} />
					</div>
				</div>
				<div className='row'>
					<div className='col c12 r1-c12'>
						<TestToolsRecordingsSettings studioInstallation={this.props.studioInstallation} />
					</div>
				</div>
			</div> :
			<Spinner />
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

export function setProperty (studioInstallation: StudioInstallation, property: string, value: any) {
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

export function findHighestRank (array: Array<{ _rank: number }>): { _rank: number } | null {
	let max: { _rank: number } | null = null

	array.forEach((value, index) => {
		if (max == null || max._rank < value._rank) {
			max = value
		}
	})

	return max
}
