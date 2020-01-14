import ClassNames from 'classnames'
import * as React from 'react'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as _ from 'underscore'
import Tooltip from 'rc-tooltip'
import { withTranslation } from 'react-i18next'
import { PeripheralDevices, PeripheralDeviceId } from '../../../../lib/collections/PeripheralDevices'
import { PlayoutDeviceSettings } from '../../../../lib/collections/PeripheralDeviceSettings/playoutDevice'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { ModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { Meteor } from 'meteor/meteor'
import { DeviceItem } from '../../Status/SystemStatus'
import { HttpSendDeviceSettingsComponent } from './HttpSendDeviceSettingsComponent'
import { IPlayoutDeviceSettingsComponentProps, IPlayoutDeviceSettingsComponentState } from './IHttpSendDeviceSettingsComponentProps'
import { getHelpMode } from '../../../lib/localStorage'
import { TSR } from 'tv-automation-sofie-blueprints-integration'
import { protectString, unprotectString } from '../../../../lib/lib'

export const PlayoutDeviceSettingsComponent = withTranslation()(class PlayoutDeviceSettingsComponent extends React.Component<Translated<IPlayoutDeviceSettingsComponentProps>, IPlayoutDeviceSettingsComponentState> {
	constructor (props: Translated<IPlayoutDeviceSettingsComponentProps>) {
		super(props)
		this.state = {
			deleteConfirmDeviceId: undefined,
			showDeleteConfirm: false,
			editedDevices: []
		}
	}
	isItemEdited = (deviceId: PeripheralDeviceId) => {
		return this.state.editedDevices.indexOf(deviceId) >= 0
	}
	finishEditItem = (deviceId: PeripheralDeviceId) => {
		let index = this.state.editedDevices.indexOf(deviceId)
		if (index >= 0) {
			this.state.editedDevices.splice(index, 1)
			this.setState({
				editedDevices: this.state.editedDevices
			})
		}
	}
	editItem = (deviceId: PeripheralDeviceId) => {
		const index = this.state.editedDevices.indexOf(deviceId)
		if (index < 0) {
			this.state.editedDevices.push(deviceId)
			this.setState({
				editedDevices: this.state.editedDevices
			})
		} else {
			this.finishEditItem(deviceId)
		}
	}
	handleConfirmRemoveCancel = (e) => {
		this.setState({
			showDeleteConfirm: false,
			deleteConfirmDeviceId: undefined
		})
	}
	handleConfirmRemoveAccept = (e) => {
		this.state.deleteConfirmDeviceId && this.removeDevice(this.state.deleteConfirmDeviceId)
		this.setState({
			showDeleteConfirm: false,
			deleteConfirmDeviceId: undefined
		})
	}
	confirmRemove = (deviceId: PeripheralDeviceId) => {
		this.setState({
			showDeleteConfirm: true,
			deleteConfirmDeviceId: deviceId
		})
	}
	removeDevice = (deviceId: PeripheralDeviceId) => {
		let unsetObject = {}
		unsetObject['settings.devices.' + deviceId] = ''
		PeripheralDevices.update(this.props.device._id, {
			$unset: unsetObject
		})
	}
	addNewDevice = () => {
		let settings = this.props.device.settings as PlayoutDeviceSettings || {}
		// find free key name
		let newDeviceId = 'newDevice'
		let iter = 0
		while ((settings.devices || {})[newDeviceId + iter.toString()]) {
			iter++
		}
		let setObject = {}
		setObject['settings.devices.' + newDeviceId + iter.toString()] = {
			type: TSR.DeviceType.ABSTRACT,
			options: {}
		}
		PeripheralDevices.update(this.props.device._id, {
			$set: setObject
		})
	}
	updateDeviceId = (edit: EditAttributeBase, newValue: string) => {
		let settings = this.props.device.settings as PlayoutDeviceSettings
		let oldDeviceId = edit.props.overrideDisplayValue
		let newDeviceId: PeripheralDeviceId = protectString(newValue + '')
		let device = settings.devices[oldDeviceId]
		if (settings[unprotectString(newDeviceId)]) {
			throw new Meteor.Error(400, 'Device "' + newDeviceId + '" already exists')
		}
		let mSet = {}
		let mUnset = {}
		mSet['settings.devices.' + newDeviceId] = device
		mUnset['settings.devices.' + oldDeviceId] = 1
		if (edit.props.collection) {
			edit.props.collection.update(this.props.device._id, {
				$set: mSet,
				$unset: mUnset
			})
		} else {
			throw new Meteor.Error(500, 'EditAttribute.props.collection is not set (it should be)!')
		}
		this.finishEditItem(oldDeviceId)
		this.editItem(newDeviceId)
	}
	renderDevices () {
		let settings = this.props.device.settings as PlayoutDeviceSettings
		const { t } = this.props

		return <table className='expando settings-studio-device-table'>
			<tbody>
				<tr>
					<th>{t('Device id')}</th>
					<th>{t('Type')}</th>
					<th className='alc'>{t('Disable')}</th>
					<th></th>
				</tr>
				{_.map(settings.devices, (subDevice: TSR.DeviceOptionsAny, deviceId0: string) => {
					const deviceId: PeripheralDeviceId = protectString(deviceId0)
					return <React.Fragment key={deviceId0}>
						<tr className={ClassNames({
							'hl': this.isItemEdited(deviceId)
						})}>
							<th className='settings-studio-device__name c5'>
								{deviceId}
							</th>
							<td className='settings-studio-device__id c4'>
								{TSR.DeviceType[subDevice.type]}
							</td>
							<td className='settings-studio-device__id c2 alc'>
								<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.disable'} obj={this.props.device} type='checkbox' options={TSR.DeviceType} collection={PeripheralDevices} className='input'></EditAttribute>
							</td>
							<td className='settings-studio-device__actions table-item-actions c3'>
								<button className='action-btn' onClick={(e) => this.editItem(deviceId)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className='action-btn' onClick={(e) => this.confirmRemove(deviceId)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
						{this.isItemEdited(deviceId) &&
							<tr className='expando-details hl' key={deviceId + '-details'}>
								<td colSpan={5}>
									<div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Device ID')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.devices'} overrideDisplayValue={deviceId} obj={this.props.device} type='text' collection={PeripheralDevices} updateFunction={this.updateDeviceId} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Device Type')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.type'} obj={this.props.device} type='dropdown' options={TSR.DeviceType} optionsAreNumbers={true} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Thread Usage')}
												<EditAttribute modifiedClassName='bghl' attribute={`settings.devices.${deviceId}.threadUsage`} obj={this.props.device} type='float' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										{
											subDevice.type === TSR.DeviceType.CASPARCG ?
												this.renderCasparCGDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.ATEM ?
												this.renderAtemDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.LAWO ?
												this.renderLawoDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.HTTPSEND ?
												this.renderHTTPSendDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.PANASONIC_PTZ ?
												this.renderPanasonicPTZDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.TCPSEND ?
												this.renderTCPSendDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.HYPERDECK ?
												this.renderHyperdeckDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.PHAROS ?
												this.renderPharosDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.OSC ?
												this.renderOSCDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.HTTPWATCHER ?
												this.renderHTTPWatcherDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.SISYFOS ?
												this.renderSisyfosDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.QUANTEL ?
												this.renderQuantelDeviceSettings(subDevice, deviceId) :
											subDevice.type === TSR.DeviceType.VIZMSE ?
												this.renderVizMSEDeviceSettings(subDevice, deviceId) :
											null
										}
									</div>
									<div className='mod alright'>
										<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(deviceId)}>
											<FontAwesomeIcon icon={faCheck} />
										</button>
									</div>
								</td>
							</tr>}
					</React.Fragment>
				})}
			</tbody>
		</table>
	}
	renderCasparCGDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.port'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('CasparCG Launcher Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.launcherHost'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('CasparCG Launcher Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.launcherPort'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderAtemDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.port'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderLawoDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.port'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Sources Path')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.sourcesPath'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Ramp Function Path')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.rampMotorFunctionPath'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Priority')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.priority'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderHTTPSendDeviceSettings (subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		return <HttpSendDeviceSettingsComponent parentDevice={this.props.device} device={subDevice} deviceId={deviceId} />
	}
	renderPanasonicPTZDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.port'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderTCPSendDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.port'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Buffer Encoding')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.bufferEncoding'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderHyperdeckDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.port'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Minimum recording time')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.minRecordingTime'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderPharosDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Enable SSL')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.spart'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderOSCDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.port'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderHTTPWatcherDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('URI')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.uri'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('HTTPMethod')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.httpMethod'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('expectedHttpResponse')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.expectedHttpResponse'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Keyword')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.keyword'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Interval')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.interval'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderSisyfosDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.port'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderQuantelDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Gateway URL')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.gatewayUrl'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('ISA URL')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.ISAUrl'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Zone ID')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.zoneId'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Quantel Server ID')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.serverId'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	renderVizMSEDeviceSettings (_subDevice: TSR.DeviceOptionsAny, deviceId: PeripheralDeviceId) {
		const { t } = this.props
		return <React.Fragment>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('(Optional) REST port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.restPort'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('(Optional) Websocket port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.wsPort'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Show ID')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.showID'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Profile')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.profile'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('(Optional) Playlist id')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.playlistID'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Preload all elements')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.preloadAllElements'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Automatically load internal elements when added')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.autoLoadInternalElements'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Clear-All template name')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.clearAllTemplateName'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Clear-All on make-ready (activate rundown)')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.clearAllOnMakeReady'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Dont deactivate on stand-down (deactivate rundown)')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.dontDeactivateOnStandDown'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Only preload elements in active Rundown')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.onlyPreloadActiveRundown'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input'></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('On preload-All elements, also initialize the rundown playlist again')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.initializeRundownOnLoadAll'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input'></EditAttribute>
				</label>
			</div>
		</React.Fragment>
	}
	render () {
		const { t, subDevices } = this.props
		const settings = this.props.device.settings as PlayoutDeviceSettings
		return (<div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Media Scanner Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.mediaScanner.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhs'>
				<label className='field'>
					{t('Media Scanner Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.mediaScanner.port'} obj={this.props.device} type='int' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div>
				<label className='field'>
					{t('Activate Debug Logging')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.debugLogging'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div>
				<label className='field'>
					{t('Activate Multi-Threading')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.multiThreading'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div>
				<label className='field'>
					{t('Activate Multi-Threaded Timeline Resolving')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.multiThreadedResolver'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className=''></EditAttribute><i>{t('(Restart to apply)')}</i>
				</label>
			</div>
			<div>
				<label className='field'>
					{t('Report command timings on all commangs')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.reportAllCommands'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>

			<ModalDialog title={t('Remove this device?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmRemoveAccept(e)} onSecondary={(e) => this.handleConfirmRemoveCancel(e)}>
				<p>{t('Are you sure you want to remove device "{{deviceId}}"?', { deviceId: (this.state.deleteConfirmDeviceId && this.state.deleteConfirmDeviceId) })}</p>
				<p>{t('Please note: This action is irreversible!')}</p>
			</ModalDialog>

			{settings && settings.devices &&
				(<React.Fragment>
					<h2 className='mhn'>{t('Devices')}</h2>
					{this.renderDevices()}
				</React.Fragment>)}

			<div className='mod mhs'>
				<button className='btn btn-primary' onClick={(e) => this.addNewDevice()}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>

			{subDevices &&
				(<React.Fragment>
					<h2 className='mhn'>
						<Tooltip
							overlay={t('Connect some devices to the playout gateway')}
							visible={getHelpMode() && !subDevices.length} placement='right'>
							<span>{t('Attached Subdevices')}</span>
						</Tooltip>
					</h2>
					{subDevices.map((device) => <DeviceItem key={unprotectString(device._id)} device={device} showRemoveButtons={true} />)}
				</React.Fragment>)}
		</div>)
	}
})
