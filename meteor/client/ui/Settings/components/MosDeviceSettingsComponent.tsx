import * as ClassNames from 'classnames'
import * as React from 'react'
import * as _ from 'underscore'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { translate } from 'react-i18next'
import { PeripheralDevices, PeripheralDeviceId } from '../../../../lib/collections/PeripheralDevices'
import { MosDeviceSettings, MosDeviceSettingsDevice } from '../../../../lib/collections/PeripheralDeviceSettings/mosDevice'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { ModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { Meteor } from 'meteor/meteor'
import { DeviceItem } from '../../Status/SystemStatus'
import { IPlayoutDeviceSettingsComponentProps } from './IHttpSendDeviceSettingsComponentProps'
import { protectString, unprotectString } from '../../../../lib/lib'
interface IMosDeviceSettingsComponentState {
	deleteConfirmDeviceId: PeripheralDeviceId | undefined
	showDeleteConfirm: boolean
	editedDevices: PeripheralDeviceId[]
}
export const MosDeviceSettingsComponent = translate()(class MosDeviceSettingsComponent extends React.Component<Translated<IPlayoutDeviceSettingsComponentProps>, IMosDeviceSettingsComponentState> {
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
		if (this.state.editedDevices.indexOf(deviceId) < 0) {
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
		let settings = this.props.device.settings as MosDeviceSettings || {}
		// find free key name
		let newDeviceId = 'mosDevice'
		let iter = 0
		while ((settings.devices || {})[newDeviceId + iter.toString()]) {
			iter++
		}
		let setObject = {}
		setObject['settings.devices.' + newDeviceId + iter.toString()] = {
			primary: {
				id: 'MOSSERVERID',
				host: ''
			}
		}
		PeripheralDevices.update(this.props.device._id, {
			$set: setObject
		})
	}

	updateDeviceId = (edit: EditAttributeBase, newValue: string) => {
		let settings = this.props.device.settings as MosDeviceSettings
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
		let settings = this.props.device.settings as MosDeviceSettings
		const { t } = this.props
		return (<React.Fragment>
			<tr className='hl' key={'header'}>
				<th>Device ID</th>
				<th>Primary ID</th>
				<th>Host</th>
				<th>Secondary ID</th>
				<th>Host</th>
				<th></th>
			</tr>
			{_.map(settings.devices, (device: MosDeviceSettingsDevice, deviceId0) => {
				const deviceId = protectString(deviceId0)
				return <React.Fragment key={deviceId0}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(deviceId)
					})}>
						<th className='settings-studio-device__name c1'>
							{deviceId}
						</th>
						<td className='settings-studio-device__primary_id c3'>
							{(device.primary || { id: '' }).id}
						</td>
						<td className='settings-studio-device__primary_host c2'>
							{(device.primary || { host: '' }).host}
						</td>
						<td className='settings-studio-device__secondary_id c3'>
							{(device.secondary || { id: '' }).id}
						</td>
						<td className='settings-studio-device__secondary_host c2'>
							{(device.secondary || { host: '' }).host}
						</td>
						<td className='settings-studio-device__actions table-item-actions c1'>
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
							<td colSpan={6}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Device ID')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.devices'} overrideDisplayValue={deviceId} obj={this.props.device} type='text' collection={PeripheralDevices} updateFunction={this.updateDeviceId} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Primary ID (Newsroom System MOS ID)')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.primary.id'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Primary Host (IP or Hostname)')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.primary.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Primary: dont use MOS query-port')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.primary.dontUseQueryPort'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Secondary ID (Newsroom System MOS ID)')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.secondary.id'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Secondary Host (IP Address or Hostname)')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.secondary.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Secondary: dont use MOS query-port')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.secondary.dontUseQueryPort'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
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
		</React.Fragment>)
	}

	render () {
		const { t, subDevices } = this.props
		const settings = this.props.device.settings as MosDeviceSettings
		return (<div>
			<div>
				<label className='field'>
					{t('MOS ID of Gateway (Sofie MOS ID)')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.mosId'} obj={this.props.device} type='text' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div>
				<label className='field'>
					{t('Activate Debug Logging')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.debugLogging'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>

			<ModalDialog title={t('Remove this device?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmRemoveAccept(e)} onSecondary={(e) => this.handleConfirmRemoveCancel(e)}>
				<p>{t('Are you sure you want to remove device "{{deviceId}}"?', { deviceId: (this.state.deleteConfirmDeviceId && this.state.deleteConfirmDeviceId) })}</p>
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
					{subDevices.map((device) => <DeviceItem key={unprotectString(device._id)} device={device} showRemoveButtons={true} />)}
				</React.Fragment>)}
		</div>)
	}
})
