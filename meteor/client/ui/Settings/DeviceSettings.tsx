import * as ClassNames from 'classnames'
import * as React from 'react'
import { translate } from 'react-i18next'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice,
	PeripheralDevices,
	PlayoutDeviceType,
	PlayoutDeviceSettings,
	PlayoutDeviceSettingsDevice,
	MosDeviceSettings,
	MosDeviceSettingsDevice
} from '../../../lib/collections/PeripheralDevices'
import { EditAttribute, EditAttributeBase } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { Random } from 'meteor/random'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { TimelineContentTypeHttp } from '../../../lib/collections/Timeline'
import { Meteor } from 'meteor/meteor'

interface IHttpSendDeviceSettingsComponentProps {
	parentDevice: PeripheralDevice
	deviceId: string
	device: PlayoutDeviceSettingsDevice
}

interface IHttpSendDeviceSettingsComponentState {
	deleteConfirmMakeReadyId: string | undefined
	showDeleteConfirmMakeReady: boolean
	editedMakeReady: Array<string>
}

const HttpSendDeviceSettingsComponent = translate()(
class HttpSendDeviceSettingsComponent extends React.Component<Translated<IHttpSendDeviceSettingsComponentProps>, IHttpSendDeviceSettingsComponentState> {
	constructor (props: Translated<IHttpSendDeviceSettingsComponentProps>) {
		super(props)

		this.state = {
			deleteConfirmMakeReadyId: undefined,
			showDeleteConfirmMakeReady: false,
			editedMakeReady: []
		}
	}

	isItemEdited = (rowId: string) => {
		return this.state.editedMakeReady.indexOf(rowId) >= 0
	}

	finishEditItem = (rowId: string) => {
		let index = this.state.editedMakeReady.indexOf(rowId)
		if (index >= 0) {
			this.state.editedMakeReady.splice(index, 1)
			this.setState({
				editedMakeReady: this.state.editedMakeReady
			})
		}
	}

	editItem = (rowId: string) => {
		if (this.state.editedMakeReady.indexOf(rowId) < 0) {
			this.state.editedMakeReady.push(rowId)
			this.setState({
				editedMakeReady: this.state.editedMakeReady
			})
		}
	}
	handleConfirmRemoveCancel = (e) => {
		this.setState({
			showDeleteConfirmMakeReady: false,
			deleteConfirmMakeReadyId: undefined
		})
	}

	handleConfirmRemoveAccept = (e) => {
		this.state.deleteConfirmMakeReadyId && this.removeMakeReady(this.state.deleteConfirmMakeReadyId)
		this.setState({
			showDeleteConfirmMakeReady: false,
			deleteConfirmMakeReadyId: undefined
		})
	}

	confirmRemove = (rowId: string) => {
		this.setState({
			showDeleteConfirmMakeReady: true,
			deleteConfirmMakeReadyId: rowId
		})
	}

	removeMakeReady = (rowId: string) => {
		// TODO this
		let unsetObject = {}
		unsetObject['settings.devices.' + this.props.deviceId + '.options.makeReadyCommands'] = { id: rowId }
		PeripheralDevices.update(this.props.parentDevice._id, {
			$pull: unsetObject
		})
	}

	addNewHttpSendCommand () {
		const { deviceId } = this.props

		let setObject = {}
		setObject['settings.devices.' + deviceId + '.options.makeReadyCommands'] = {
			id: Random.hexString(5),
			type: TimelineContentTypeHttp.POST,
			url: 'http://',
			params: {}
		}

		PeripheralDevices.update(this.props.parentDevice._id, {
			$push: setObject
		})
	}

	renderHttpSendCommands () {
		const { t, device, deviceId } = this.props

		const commands = (device.options as any || {}).makeReadyCommands || []
		return _.map(commands, (cmd: any, i) => {
			return (
				!this.isItemEdited(cmd.id) ?
				<tr key={i}>
					<th className='settings-studio-device-httpsend__url c5'>
						{cmd.url}
					</th>
					<td className='settings-studio-device-httpsend__type c4'>
						{cmd.type}
					</td>
					<td className='settings-studio-device-httpsend__actions table-item-actions c3'>
						<button className='action-btn' onClick={(e) => this.editItem(cmd.id)}>
							<FontAwesomeIcon icon={faPencilAlt} />
						</button>
						<button className='action-btn' onClick={(e) => this.confirmRemove(cmd.id)}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</td>
				</tr> :
				<tr className='expando-details hl' key={cmd.id + '-details'}>
					<td colSpan={5}>
						<div>
							<div className='mod mvs mhs'>
								<label className='field'>
									{t('Url')}
									<EditAttribute
										modifiedClassName='bghl'
										attribute={'settings.devices.' + deviceId + '.options.makeReadyCommands.' + i + '.url'}
										obj={this.props.parentDevice}
										type='text'
										collection={PeripheralDevices}
										className='input text-input input-l'></EditAttribute>
								</label>
							</div>
							<div className='mod mvs mhs'>
								<label className='field'>
									{t('Type')}
									<EditAttribute
										modifiedClassName='bghl'
										attribute={'settings.devices.' + deviceId + '.options.makeReadyCommands.' + i + '.type'}
										obj={this.props.parentDevice}
										type='dropdown'
										options={TimelineContentTypeHttp}
										collection={PeripheralDevices}
										className='input text-input input-l'></EditAttribute>
								</label>
							</div>
							<div className='mod mvs mhs'>
								<label className='field'>
									{t('Params')}
									<EditAttribute
										modifiedClassName='bghl'
										attribute={'settings.devices.' + deviceId + '.options.makeReadyCommands.' + i + '.params'}
										mutateDisplayValue={v => JSON.stringify(v, undefined, 2)}
										mutateUpdateValue={v => JSON.parse(v)}
										obj={this.props.parentDevice}
										type='multiline'
										collection={PeripheralDevices}
										className='input text-input input-l'></EditAttribute>
								</label>
							</div>
						</div>
						<div className='mod alright'>
							<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(cmd.id)}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)
		})
	}

	render () {
		const { t } = this.props

		return (
			<React.Fragment>
				<h3>{t('Make ready commands')}</h3>
				<table className='expando settings-studio-device-httpsend-table'>
					<tbody>
						{this.renderHttpSendCommands()}
					</tbody>
				</table>

				<ModalDialog title={t('Remove this command?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirmMakeReady} onAccept={(e) => this.handleConfirmRemoveAccept(e)} onSecondary={(e) => this.handleConfirmRemoveCancel(e)}>
					<p>{t('Are you sure you want to remove this command?')}</p>
				</ModalDialog>

				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={(e) => this.addNewHttpSendCommand()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</React.Fragment>
		)
	}
})

interface IPlayoutDeviceSettingsComponentProps {
	device: PeripheralDevice
}

interface IPlayoutDeviceSettingsComponentState {
	deleteConfirmDeviceId: string | undefined
	showDeleteConfirm: boolean
	editedDevices: Array<string>
}
const PlayoutDeviceSettingsComponent = translate()(
class PlayoutDeviceSettingsComponent extends React.Component<Translated<IPlayoutDeviceSettingsComponentProps>, IPlayoutDeviceSettingsComponentState> {
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
		} else throw new Meteor.Error(500, 'EditAttribute.props.collection is not set (it should be)!')

		this.finishEditItem(oldDeviceId)
		this.editItem(newDeviceId)
	}
	renderDevices () {
		let settings = this.props.device.settings as PlayoutDeviceSettings

		const { t } = this.props

		return _.map(settings.devices, (device: PlayoutDeviceSettingsDevice, deviceId) => {
			return (
				!this.isItemEdited(deviceId) ?
				<tr key={deviceId}>
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
				</tr> :
				<tr className='expando-details hl' key={deviceId + '-details'}>
					<td colSpan={5}>
						<div>
							<div className='mod mvs mhs'>
								<label className='field'>
									{t('Device ID')}
									<EditAttribute
										modifiedClassName='bghl'
										attribute={'settings.devices' }
										overrideDisplayValue={deviceId }
										obj={this.props.device}
										type='text'
										collection={PeripheralDevices}
										updateFunction={this.updateDeviceId}
										className='input text-input input-l'></EditAttribute>
								</label>
							</div>
							<div className='mod mvs mhs'>
								<label className='field'>
									{t('Device Type')}
									<EditAttribute
										modifiedClassName='bghl'
										attribute={'settings.devices.' + deviceId + '.type' }
										obj={this.props.device}
										type='dropdown'
										options={PlayoutDeviceType}
										optionsAreNumbers={true}
										collection={PeripheralDevices}
										className='input text-input input-l'></EditAttribute>
								</label>
							</div>
							{(
								device.type === PlayoutDeviceType.CASPARCG && (
									(
									<React.Fragment>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Host')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.devices.' + deviceId + '.options.host' }
													obj={this.props.device}
													type='text'
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Port')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.devices.' + deviceId + '.options.port' }
													obj={this.props.device}
													type='int'
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('CasparCG Launcher Host')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.devices.' + deviceId + '.options.launcherHost' }
													obj={this.props.device}
													type='text'
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('CasparCG Launcher Port')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.devices.' + deviceId + '.options.launcherPort' }
													obj={this.props.device}
													type='int'
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>
									</React.Fragment>
									)
								) ||
								(
								device.type === PlayoutDeviceType.ATEM && (
									(
									<React.Fragment>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Host')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.devices.' + deviceId + '.options.host'}
													obj={this.props.device}
													type='text'
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Port')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.devices.' + deviceId + '.options.port'}
													obj={this.props.device}
													type='int'
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>
									</React.Fragment>
									)
								))
								) ||
								(
								device.type === PlayoutDeviceType.LAWO && (
									(
									<React.Fragment>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Host')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.devices.' + deviceId + '.options.host'}
													obj={this.props.device}
													type='text'
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Port')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.devices.' + deviceId + '.options.port'}
													obj={this.props.device}
													type='int'
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Sources Path')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.devices.' + deviceId + '.options.sourcesPath'}
													obj={this.props.device}
													type='text'
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Ramp Function Path')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.devices.' + deviceId + '.options.rampMotorFunctionPath'}
													obj={this.props.device}
													type='text'
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>
									</React.Fragment>
									)
								)) ||
								(
								device.type === PlayoutDeviceType.HTTPSEND && (
									(
									<React.Fragment>
										<HttpSendDeviceSettingsComponent parentDevice={this.props.device} device={device} deviceId={deviceId} />
									</React.Fragment>
									)
								))
							}
						</div>
						<div className='mod alright'>
							<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(deviceId)}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)
		})
	}
	render () {
		const { t } = this.props

		let settings = this.props.device.settings as PlayoutDeviceSettings

		return (
			<div>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('Media Scanner Host')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'settings.mediaScanner.host'}
							obj={this.props.device}
							type='text'
							collection={PeripheralDevices}
							className=''></EditAttribute>
					</label>
				</div>
				<div className='mod mvs mhs'>
					<label className='field'>
						{t('Media Scanner Port')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'settings.mediaScanner.port'}
							obj={this.props.device}
							type='int'
							collection={PeripheralDevices}
							className=''></EditAttribute>
					</label>
				</div>

				<ModalDialog title={t('Remove this device?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmRemoveAccept(e)} onSecondary={(e) => this.handleConfirmRemoveCancel(e)}>
					<p>{t('Are you sure you want to remove device "{{deviceId}}"?', { deviceId: (this.state.deleteConfirmDeviceId && this.state.deleteConfirmDeviceId) })}</p>
				</ModalDialog>

				{settings && settings.devices &&
					(
						<React.Fragment>
							<h3>{t('Attached Devices')}</h3>
							<table className='expando settings-studio-device-table'>
								<tbody>
									{this.renderDevices()}
								</tbody>
							</table>
						</React.Fragment>
					)
				}

				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={(e) => this.addNewDevice()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		)
	}
})

interface IMosDeviceSettingsComponentState {
	deleteConfirmDeviceId: string | undefined
	showDeleteConfirm: boolean
	editedDevices: Array<string>
}
const MosDeviceSettingsComponent = translate()(
class MosDeviceSettingsComponent extends React.Component<Translated<IPlayoutDeviceSettingsComponentProps>, IMosDeviceSettingsComponentState> {
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
		} else throw new Meteor.Error(500, 'EditAttribute.props.collection is not set (it should be)!')

		this.finishEditItem(oldDeviceId)
		this.editItem(newDeviceId)
	}
	renderDevices () {
		let settings = this.props.device.settings as MosDeviceSettings

		const { t } = this.props

		return ([
			<tr className='hl' key={'header'}>
				<th>DeviceId</th>
				<th>Primary ID</th>
				<th>Host</th>
				<th>Secondary ID</th>
				<th>Host</th>
				<th></th>
			</tr>
		].concat(
			_.map(settings.devices, (device: MosDeviceSettingsDevice, deviceId) => {
				return (
					!this.isItemEdited(deviceId) ?
					<tr key={deviceId}>
						<th className='settings-studio-device__name c1'>
							{deviceId}
						</th>
						<td className='settings-studio-device__primary_id c3'>
							{(device.primary || {id: ''}).id}
						</td>
						<td className='settings-studio-device__primary_host c2'>
							{(device.primary || {host: ''}).host}
						</td>
						<td className='settings-studio-device__secondary_id c3'>
							{(device.secondary || {id: ''}).id}
						</td>
						<td className='settings-studio-device__secondary_host c2'>
							{(device.secondary || {host: ''}).host}
						</td>
						<td className='settings-studio-device__actions table-item-actions c1'>
							<button className='action-btn' onClick={(e) => this.editItem(deviceId)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.confirmRemove(deviceId)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr> :
					<tr className='expando-details hl' key={deviceId + '-details'}>
						<td colSpan={6}>
							<div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Device ID')}
										<EditAttribute
											modifiedClassName='bghl'
											attribute={'settings.devices' }
											overrideDisplayValue={deviceId }
											obj={this.props.device}
											type='text'
											collection={PeripheralDevices}
											updateFunction={this.updateDeviceId}
											className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Primary ID (News Room System MOS ID)')}
										<EditAttribute
											modifiedClassName='bghl'
											attribute={'settings.devices.' + deviceId + '.primary.id' }
											obj={this.props.device}
											type='text'
											collection={PeripheralDevices}
											className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Primary Host (IP or Hostname)')}
										<EditAttribute
											modifiedClassName='bghl'
											attribute={'settings.devices.' + deviceId + '.primary.host' }
											obj={this.props.device}
											type='text'
											collection={PeripheralDevices}
											className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Secondary ID (News Room System MOS ID)')}
										<EditAttribute
											modifiedClassName='bghl'
											attribute={'settings.devices.' + deviceId + '.secondary.id' }
											obj={this.props.device}
											type='text'
											collection={PeripheralDevices}
											className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Secondary Host (IP Address or Hostname)')}
										<EditAttribute
											modifiedClassName='bghl'
											attribute={'settings.devices.' + deviceId + '.secondary.host' }
											obj={this.props.device}
											type='text'
											collection={PeripheralDevices}
											className='input text-input input-l'></EditAttribute>
									</label>
								</div>
							</div>
							<div className='mod alright'>
								<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(deviceId)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>
				)
			})
		))
	}
	render () {
		const { t } = this.props

		let settings = this.props.device.settings as PlayoutDeviceSettings

		return (
			<div>
				<div>
					<label className='field'>
						{t('MOS ID of Gateway (Sofie MOS ID)')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'settings.mosId'}
							obj={this.props.device}
							type='text'
							collection={PeripheralDevices}
							className=''></EditAttribute>
					</label>
				</div>
				<div>
					<label className='field'>
						{t('Activate Debug Logging')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'settings.debugLogging'}
							obj={this.props.device}
							type='checkbox'
							collection={PeripheralDevices}
							className=''></EditAttribute>
					</label>
				</div>

				<ModalDialog title={t('Remove this device?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmRemoveAccept(e)} onSecondary={(e) => this.handleConfirmRemoveCancel(e)}>
					<p>{t('Are you sure you want to remove device "{{deviceId}}"?', { deviceId: (this.state.deleteConfirmDeviceId && this.state.deleteConfirmDeviceId) })}</p>
				</ModalDialog>

				{settings && settings.devices &&
					(
						<React.Fragment>
							<h3>{t('Devices')}</h3>
							<table className='expando settings-studio-device-table'>
								<tbody>
									{this.renderDevices()}
								</tbody>
							</table>
						</React.Fragment>
					)
				}

				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={(e) => this.addNewDevice()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>

			</div>
		)
	}
})

interface IDeviceSettingsProps {
	match: {
		params: {
			deviceId: string
		}
	}
}
interface IDeviceSettingsState {
}
interface IDeviceSettingsTrackedProps {
	device?: PeripheralDevice
}
export default translateWithTracker<IDeviceSettingsProps, IDeviceSettingsState, IDeviceSettingsTrackedProps>(
(props: IDeviceSettingsProps) => {
	return {
		device: PeripheralDevices.findOne(props.match.params.deviceId)
	}
})(
class DeviceSettings extends MeteorReactComponent<Translated<IDeviceSettingsProps & IDeviceSettingsTrackedProps>> {

	findHighestRank (array: Array<{ _rank: number }>): { _rank: number } | null {
		let max: { _rank: number } | null = null

		array.forEach((value, index) => {
			if (max == null || max._rank < value._rank) {
				max = value
			}
		})

		return max
	}

	renderSpecifics () {
		if (this.props.device) {
			switch (this.props.device.type) {
				case PeripheralDeviceAPI.DeviceType.MOSDEVICE:
					return <MosDeviceSettingsComponent
						device={this.props.device}
					/>
				case PeripheralDeviceAPI.DeviceType.PLAYOUT:
					return <PlayoutDeviceSettingsComponent
						device={this.props.device}
					/>
			}
		}
		return null
	}

	renderEditForm () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<h3>{t('Generic properties')}</h3>
					<label className='field'>
						{t('Device name')}
						<div className='mdi'>
							<EditAttribute
								modifiedClassName='bghl'
								attribute='name'
								obj={this.props.device}
								type='text'
								collection={PeripheralDevices}
								className='mdinput'></EditAttribute>
							<span className='mdfx'></span>
						</div>
					</label>

					{this.renderSpecifics()}
				</div>
			</div>
		)
	}

	render () {
		const { t } = this.props

		if (this.props.device) {
			return this.renderEditForm()
		} else {
			return <Spinner />
		}
	}
}
)
