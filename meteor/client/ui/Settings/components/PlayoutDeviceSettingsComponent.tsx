import * as ClassNames from 'classnames'
import * as React from 'react'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as _ from 'underscore'
import { translate } from 'react-i18next'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { PlayoutDeviceSettings } from '../../../../lib/collections/PeripheralDeviceSettings/playoutDevice'
import { DeviceType as PlayoutDeviceType, DeviceOptions as PlayoutDeviceSettingsDevice } from 'timeline-state-resolver-types'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { ModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { Meteor } from 'meteor/meteor'
import { DeviceItem } from '../../Status/SystemStatus'
import { HttpSendDeviceSettingsComponent } from './HttpSendDeviceSettingsComponent'
import { IPlayoutDeviceSettingsComponentProps, IPlayoutDeviceSettingsComponentState } from './IHttpSendDeviceSettingsComponentProps'
export const PlayoutDeviceSettingsComponent = translate()(class PlayoutDeviceSettingsComponent extends React.Component<Translated<IPlayoutDeviceSettingsComponentProps>, IPlayoutDeviceSettingsComponentState> {
	constructor (props: Translated<IPlayoutDeviceSettingsComponentProps>) {
		super(props)
		this.state = {
			deleteConfirmDeviceId: undefined,
			showDeleteConfirm: false,
			editedDevices: []
		}
	}
	isItemEdited = (deviceId: string) => {
		return this.state.editedDevices.indexOf(deviceId) >= 0
	}
	finishEditItem = (deviceId: string) => {
		let index = this.state.editedDevices.indexOf(deviceId)
		if (index >= 0) {
			this.state.editedDevices.splice(index, 1)
			this.setState({
				editedDevices: this.state.editedDevices
			})
		}
	}
	editItem = (deviceId: string) => {
		if (this.state.editedDevices.indexOf(deviceId) < 0) {
			this.state.editedDevices.push(deviceId)
			this.setState({
				editedDevices: this.state.editedDevices
			})
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
	confirmRemove = (deviceId: string) => {
		this.setState({
			showDeleteConfirm: true,
			deleteConfirmDeviceId: deviceId
		})
	}
	removeDevice = (deviceId: string) => {
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
			type: PlayoutDeviceType.ABSTRACT,
			options: {}
		}
		PeripheralDevices.update(this.props.device._id, {
			$set: setObject
		})
	}
	updateDeviceId = (edit: EditAttributeBase, newValue: string) => {
		let settings = this.props.device.settings as PlayoutDeviceSettings
		let oldDeviceId = edit.props.overrideDisplayValue
		let newDeviceId = newValue + ''
		let device = settings.devices[oldDeviceId]
		if (settings[newDeviceId]) {
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
		return _.map(settings.devices, (device: PlayoutDeviceSettingsDevice, deviceId) => {
			let renderObject: any | undefined = undefined
			switch (device.type) {
				case PlayoutDeviceType.CASPARCG:
					renderObject = (<React.Fragment>
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
					</React.Fragment>)
					break
				case PlayoutDeviceType.ATEM:
					renderObject = (<React.Fragment>
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
					</React.Fragment>)
					break
				case PlayoutDeviceType.LAWO:
					renderObject = (<React.Fragment>
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
					</React.Fragment>)
					break
				case PlayoutDeviceType.HTTPSEND:
					renderObject = (<HttpSendDeviceSettingsComponent parentDevice={this.props.device} device={device} deviceId={deviceId} />)
					break
				case PlayoutDeviceType.HTTPWATCHER:
					renderObject = (<React.Fragment>
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
					</React.Fragment>)
					break
				case PlayoutDeviceType.PANASONIC_PTZ:
					renderObject = (<React.Fragment>
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
					</React.Fragment>)
					break
				case PlayoutDeviceType.HYPERDECK:
					renderObject = (<React.Fragment>
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
					</React.Fragment>)
					break
				case PlayoutDeviceType.PHAROS:
					renderObject = (<React.Fragment>
						<div className='mod mvs mhs'>
							<label className='field'>
								{t('Host')}
								<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
							</label>
						</div>
						<div className='mod mvs mhs'>
							<label className='field'>
								{t('Enable SSL')}
								<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.spart'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
							</label>
						</div>
					</React.Fragment>)
					break
				case PlayoutDeviceType.OSC:
					renderObject = (<React.Fragment>
						<div className='mod mvs mhs'>
							<label className='field'>
								{t('Gateway url')}
								<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.gatewayUrl'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
							</label>
						</div>
						<div className='mod mvs mhs'>
							<label className='field'>
								{t('ISA url')}
								<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.ISAUrl'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
							</label>
						</div>
						<div className='mod mvs mhs'>
							<label className='field'>
								{t('Zone id')} ({t('Optional')})
								<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.zoneId'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
							</label>
						</div>
						<div className='mod mvs mhs'>
							<label className='field'>
								{t('Server id')}
								<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.serverId'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
							</label>
						</div>

					</React.Fragment>)
					break
				case PlayoutDeviceType.SISYFOS:
					renderObject = (<React.Fragment>
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
					</React.Fragment>)
					break
				case PlayoutDeviceType.QUANTEL:
					renderObject = (<React.Fragment>
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
					</React.Fragment>)
					break
				default:
					break
			}
			return <React.Fragment key={deviceId}>
				<tr className={ClassNames({
					'hl': this.isItemEdited(deviceId)
				})}>
					<th className='settings-studio-device__name c5'>
						{deviceId}
					</th>
					<td className='settings-studio-device__id c4'>
						{PlayoutDeviceType[device.type]}
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
										<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.type'} obj={this.props.device} type='dropdown' options={PlayoutDeviceType} optionsAreNumbers={true} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Thread Usage')}
										<EditAttribute modifiedClassName='bghl' attribute={`settings.devices.${deviceId}.threadUsage`} obj={this.props.device} type='float' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								{renderObject}
							</div>
							<div className='mod alright'>
								<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(deviceId)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>}
			</React.Fragment>
		})
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

			<ModalDialog title={t('Remove this device?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmRemoveAccept(e)} onSecondary={(e) => this.handleConfirmRemoveCancel(e)}>
				<p>{t('Are you sure you want to remove device "{{deviceId}}"?', { deviceId: (this.state.deleteConfirmDeviceId && this.state.deleteConfirmDeviceId) })}</p>
				<p>{t('Please note: This action is irreversible!')}</p>
			</ModalDialog>

			{settings && settings.devices &&
				(<React.Fragment>
					<h2 className='mhn'>{t('Devices')}</h2>
					<table className='expando settings-studio-device-table'>
						<tbody>
							{this.renderDevices()}
						</tbody>
					</table>
				</React.Fragment>)}

			<div className='mod mhs'>
				<button className='btn btn-primary' onClick={(e) => this.addNewDevice()}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>

			{subDevices &&
				(<React.Fragment>
					<h2 className='mhn'>{t('Attached Subdevices')}</h2>
					{subDevices.map((item) => <DeviceItem key={item._id} device={item} showRemoveButtons={true} />)}
				</React.Fragment>)}
		</div>)
	}
})
