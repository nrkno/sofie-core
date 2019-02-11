import * as ClassNames from 'classnames'
import * as React from 'react'
import { translate } from 'react-i18next'
import * as _ from 'underscore'
import { literal } from '../../../lib/lib'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice,
	PeripheralDevices,
	PlayoutDeviceSettings,
	MosDeviceSettings,
	MosDeviceSettingsDevice,
	MediaManagerDeviceSettings,
	LocalFolderStorage,
	StorageType,
	StorageSettings,
	MediaFlow,
	MediaFlowType
} from '../../../lib/collections/PeripheralDevices'
import { DeviceType as PlayoutDeviceType, DeviceOptions as PlayoutDeviceSettingsDevice, TimelineContentTypeHttp } from 'timeline-state-resolver-types'
import { EditAttribute, EditAttributeBase } from '../../lib/EditAttribute'
import { ModalDialog, doModalDialog } from '../../lib/ModalDialog'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { Random } from 'meteor/random'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { Meteor } from 'meteor/meteor'
import { DeviceItem } from '../Status/SystemStatus'
import { callPeripheralDeviceFunction, PeripheralDevicesAPI } from '../../lib/clientAPI';

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
			id: Random.id(),
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
			return <React.Fragment key={i}>
				<tr className={ClassNames({
					'hl': this.isItemEdited(cmd.id)
				})}>
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
				</tr>
				{ this.isItemEdited(cmd.id) &&
					<tr className='expando-details hl' key={cmd.id + '-details'}>
						<td colSpan={5}>
							<div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('URL')}
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
				}
			</React.Fragment>
		})
	}

	render () {
		const { t } = this.props

		return (
			<React.Fragment>
				<h3 className='mhs'>{t('Make ready commands')}</h3>
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
	subDevices?: PeripheralDevice[]
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
				{ this.isItemEdited(deviceId) &&
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
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Thread Usage')}
										<EditAttribute
											modifiedClassName='bghl'
											attribute={`settings.devices.${deviceId}.threadUsage`}
											obj={this.props.device}
											type='float'
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
										<HttpSendDeviceSettingsComponent parentDevice={this.props.device} device={device} deviceId={deviceId} />
										)
									)) ||
									(
									device.type === PlayoutDeviceType.PANASONIC_PTZ && (
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
														type='text'
														collection={PeripheralDevices}
														className='input text-input input-l'></EditAttribute>
												</label>
											</div>
										</React.Fragment>
										)
									) ||
									(
									device.type === PlayoutDeviceType.HYPERDECK && (
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
									)) ||
									(
										device.type === PlayoutDeviceType.PHAROS && (
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
														{t('Enable SSL')}
														<EditAttribute
															modifiedClassName='bghl'
															attribute={'settings.devices.' + deviceId + '.options.ssl'}
															obj={this.props.device}
															type='checkbox'
															collection={PeripheralDevices}
															className='input text-input input-l'></EditAttribute>
													</label>
												</div>
											</React.Fragment>
											)
										)) ||
										(
										device.type === PlayoutDeviceType.OSC && (
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
								}
							</div>
							<div className='mod alright'>
								<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(deviceId)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>
				}
				</React.Fragment>
		})
	}
	render () {
		const { t, subDevices } = this.props

		const settings = this.props.device.settings as PlayoutDeviceSettings

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
				<div>
					<label className='field'>
						{t('Activate multi threading')}
						<EditAttribute
							modifiedClassName='bghl'
							attribute={'settings.multiThreading'}
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
							<h3 className='mhs'>{t('Devices')}</h3>
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

				{subDevices &&
					(
						<React.Fragment>
						<h3 className='mhs'>{t('Attached sub-devices')}</h3>
							{subDevices.map((item) => <DeviceItem key={item._id} device={item} showRemoveButtons={true} />)}
						</React.Fragment>
					)
				}
			</div>
		)
	}
})

interface IMediaManagerSettingsComponentState {
	deleteConfirmStorageId: string | undefined
	showDeleteStorageConfirm: boolean
	editedStorages: Array<string>

	deleteConfirmFlowId: string | undefined
	showDeleteFlowConfirm: boolean
	editedFlows: Array<string>
}
interface IMediaManagerSettingsComponentProps {
	device: PeripheralDevice
}

const MediaManagerSettingsComponent = translate()(
	class MediaManagerSettingsComponent extends React.Component<Translated<IMediaManagerSettingsComponentProps>, IMediaManagerSettingsComponentState> {
		constructor (props: Translated<IMediaManagerSettingsComponentProps>) {
			super(props)

			this.state = {
				deleteConfirmStorageId: undefined,
				showDeleteStorageConfirm: false,
				editedStorages: [],

				deleteConfirmFlowId: undefined,
				showDeleteFlowConfirm: false,
				editedFlows: []
			}
		}

		isStorageItemEdited = (deviceId: string) => {
			return this.state.editedStorages.indexOf(deviceId) >= 0
		}

		isFlowItemEdited = (flowId: string) => {
			return this.state.editedFlows.indexOf(flowId) >= 0
		}

		finishEditStorageItem = (deviceId: string) => {
			let index = this.state.editedStorages.indexOf(deviceId)
			if (index >= 0) {
				this.state.editedStorages.splice(index, 1)
				this.setState({
					editedStorages: this.state.editedStorages
				})
			}
		}

		finishEditFlowItem = (flowId: string) => {
			let index = this.state.editedFlows.indexOf(flowId)
			if (index >= 0) {
				this.state.editedFlows.splice(index, 1)
				this.setState({
					editedFlows: this.state.editedFlows
				})
			}
		}

		editStorageItem = (deviceId: string) => {
			if (this.state.editedStorages.indexOf(deviceId) < 0) {
				this.state.editedStorages.push(deviceId)
				this.setState({
					editedStorages: this.state.editedStorages
				})
			}
		}
		editFlowItem = (flowId: string) => {
			if (this.state.editedFlows.indexOf(flowId) < 0) {
				this.state.editedFlows.push(flowId)
				this.setState({
					editedFlows: this.state.editedFlows
				})
			}
		}
		handleConfirmRemoveStorageCancel = (e) => {
			this.setState({
				showDeleteStorageConfirm: false,
				deleteConfirmStorageId: undefined
			})
		}

		handleConfirmRemoveStorageAccept = (e) => {
			this.state.deleteConfirmStorageId && this.removeStorage(this.state.deleteConfirmStorageId)
			this.setState({
				showDeleteStorageConfirm: false,
				deleteConfirmStorageId: undefined
			})
		}

		handleConfirmRemoveFlowCancel = (e) => {
			this.setState({
				showDeleteFlowConfirm: false,
				deleteConfirmFlowId: undefined
			})
		}

		handleConfirmRemoveFlowAccept = (e) => {
			this.state.deleteConfirmFlowId && this.removeFlow(this.state.deleteConfirmFlowId)
			this.setState({
				showDeleteFlowConfirm: false,
				deleteConfirmFlowId: undefined
			})
		}

		confirmRemoveStorage = (deviceId: string) => {
			this.setState({
				showDeleteStorageConfirm: true,
				deleteConfirmStorageId: deviceId
			})
		}

		confirmRemoveFlow = (flowId: string) => {
			this.setState({
				showDeleteFlowConfirm: true,
				deleteConfirmFlowId: flowId
			})
		}

		removeStorage = (deviceId: string) => {
			PeripheralDevices.update(this.props.device._id, {
				$pull: {
					'settings.storages': {
						id: deviceId
					}
				}
			})
		}
		removeFlow = (flowId: string) => {
			PeripheralDevices.update(this.props.device._id, {
				$pull: {
					'settings.mediaFlows': {
						id: flowId
					}
				}
			})
		}
		addNewStorage = () => {
			let settings = this.props.device.settings as MediaManagerDeviceSettings || {}
			// find free key name
			let newDeviceId = 'storage'
			let iter = 0
			while ((settings.storages || []).findIndex(i => i.id === newDeviceId + iter.toString()) >= 0) {
				iter++
			}

			PeripheralDevices.update(this.props.device._id, {
				$push: {
					'settings.storages': literal<StorageSettings>({
						id: newDeviceId + iter,
						type: StorageType.UNKNOWN,
						options: {},
						support: {
							read: false,
							write: false
						}
					})
				}
			})
		}
		renderStorages () {
			let settings = this.props.device.settings as MediaManagerDeviceSettings

			const { t } = this.props

			return _.map(settings.storages, (storage: StorageSettings, index) => {
				return <React.Fragment key={storage.id}>
					<tr key={storage.id} className={ClassNames({
						'hl': this.isStorageItemEdited(storage.id)
					})}>
						<th className='settings-studio-device__name c5'>
							{storage.id}
						</th>
						<td className='settings-studio-device__id c4'>
							{StorageType[storage.type]}
						</td>
						<td className='settings-studio-device__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editStorageItem(storage.id)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.confirmRemoveStorage(storage.id)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
					{this.isStorageItemEdited(storage.id) &&
						<tr className='expando-details hl' key={storage.id + '-details'}>
							<td colSpan={5}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Storage ID')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'settings.storages.' + index + '.id'}
												obj={this.props.device}
												type='text'
												collection={PeripheralDevices}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Storage Type')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'settings.storages.' + index + '.type'}
												obj={this.props.device}
												type='dropdown'
												options={StorageType}
												collection={PeripheralDevices}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Allow read')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'settings.storages.' + index + '.support.read'}
												obj={this.props.device}
												type='checkbox'
												collection={PeripheralDevices}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Allow write')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'settings.storages.' + index + '.support.write'}
												obj={this.props.device}
												type='checkbox'
												collection={PeripheralDevices}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									{(
										storage.type === StorageType.FILE_SHARE && (
											(
												<React.Fragment>
													<div className='mod mvs mhs'>
														<label className='field'>
															{t('Base Path')}
															<EditAttribute
																modifiedClassName='bghl'
																attribute={'settings.storages.' + index + '.options.basePath'}
																obj={this.props.device}
																type='text'
																collection={PeripheralDevices}
																className='input text-input input-l'></EditAttribute>
														</label>
													</div>
													<div className='mod mvs mhs'>
														<label className='field'>
															{t('Media Path')}
															<EditAttribute
																modifiedClassName='bghl'
																attribute={'settings.storages.' + index + '.options.mediaPath'}
																obj={this.props.device}
																type='text'
																collection={PeripheralDevices}
																className='input text-input input-l'></EditAttribute>
														</label>
													</div>
													<div className='mod mvs mhs'>
														<label className='field'>
															{t('Mapped Networked Drive')}
															<EditAttribute
																modifiedClassName='bghl'
																attribute={'settings.storages.' + index + '.options.mappedNetworkedDriveTarget'}
																obj={this.props.device}
																type='text'
																collection={PeripheralDevices}
																className='input text-input input-l'></EditAttribute>
														</label>
													</div>
													<div className='mod mvs mhs'>
														<label className='field'>
															{t('Username')}
															<EditAttribute
																modifiedClassName='bghl'
																attribute={'settings.storages.' + index + '.options.username'}
																obj={this.props.device}
																type='text'
																collection={PeripheralDevices}
																className='input text-input input-l'></EditAttribute>
														</label>
													</div>
													<div className='mod mvs mhs'>
														<label className='field'>
															{t('Password')}
															<EditAttribute
																modifiedClassName='bghl'
																attribute={'settings.storages.' + index + '.options.password'}
																obj={this.props.device}
																type='text'
																collection={PeripheralDevices}
																className='input text-input input-l'></EditAttribute>
														</label>
													</div>
												</React.Fragment>
											)
										) ||
										(
											storage.type === StorageType.LOCAL_FOLDER && (
												(
													<React.Fragment>
														<div className='mod mvs mhs'>
															<label className='field'>
																{t('Base Path')}
																<EditAttribute
																	modifiedClassName='bghl'
																	attribute={'settings.storages.' + index + '.options.basePath'}
																	obj={this.props.device}
																	type='text'
																	collection={PeripheralDevices}
																	className='input text-input input-l'></EditAttribute>
															</label>
														</div>
														<div className='mod mvs mhs'>
															<label className='field'>
																{t('Media Path')}
																<EditAttribute
																	modifiedClassName='bghl'
																	attribute={'settings.storages.' + index + '.options.mediaPath'}
																	obj={this.props.device}
																	type='text'
																	collection={PeripheralDevices}
																	className='input text-input input-l'></EditAttribute>
															</label>
														</div>
													</React.Fragment>
												)
											))
									)
									}
								</div>
								<div className='mod alright'>
									<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditStorageItem(storage.id)}>
										<FontAwesomeIcon icon={faCheck} />
									</button>
								</div>
							</td>
						</tr>
					}
				</React.Fragment>
			})
		}

		addNewFlow = () => {
			let settings = this.props.device.settings as MediaManagerDeviceSettings || {}
			// find free key name
			let newFlowId = 'flow'
			let iter = 0
			while ((settings.mediaFlows || []).findIndex(i => i.id === newFlowId + iter.toString()) >= 0) {
				iter++
			}

			PeripheralDevices.update(this.props.device._id, {
				$push: {
					'settings.mediaFlows': literal<MediaFlow>({
						id: newFlowId + iter,
						mediaFlowType: MediaFlowType.UNKNOWN,
						sourceId: ''
					})
				}
			})
		}
		renderFlows () {
			let settings = this.props.device.settings as MediaManagerDeviceSettings

			const { t } = this.props

			return _.map(settings.mediaFlows, (flow: MediaFlow, index) => {
				return <React.Fragment key={flow.id}>
					<tr key={flow.id} className={ClassNames({
						'hl': this.isFlowItemEdited(flow.id)
					})}>
						<th className='settings-studio-device__name c5'>
							{flow.id}
						</th>
						<td className='settings-studio-device__id c4'>
							{MediaFlowType[flow.mediaFlowType]}
						</td>
						<td className='settings-studio-device__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editFlowItem(flow.id)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.confirmRemoveFlow(flow.id)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
					{this.isFlowItemEdited(flow.id) &&
						<tr className='expando-details hl' key={flow.id + '-details'}>
							<td colSpan={5}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Media Flow ID')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'settings.mediaFlows.' + index + '.id'}
												obj={this.props.device}
												type='text'
												collection={PeripheralDevices}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Media Flow Type')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'settings.mediaFlows.' + index + '.mediaFlowType'}
												obj={this.props.device}
												type='dropdown'
												options={MediaFlowType}
												collection={PeripheralDevices}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Source Storage')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'settings.mediaFlows.' + index + '.sourceId'}
												obj={this.props.device}
												type='dropdown'
												options={settings.storages.map(i => i.id)}
												collection={PeripheralDevices}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									{(flow.mediaFlowType === MediaFlowType.EXPECTED_ITEMS || flow.mediaFlowType === MediaFlowType.WATCH_FOLDER) &&
										(<div className='mod mvs mhs'>
											<label className='field'>
												{t('Target Storage')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'settings.mediaFlows.' + index + '.destinationId'}
													obj={this.props.device}
													type='dropdown'
													options={settings.storages.map(i => i.id)}
													collection={PeripheralDevices}
													className='input text-input input-l'></EditAttribute>
											</label>
										</div>)
									}
								</div>
								<div className='mod alright'>
									<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditFlowItem(flow.id)}>
										<FontAwesomeIcon icon={faCheck} />
									</button>
								</div>
							</td>
						</tr>
					}
				</React.Fragment>
			})
		}

		render () {
			const { t } = this.props

			let settings = this.props.device.settings as MediaManagerDeviceSettings

			return (
				<div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('No. of available workers')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute={'settings.workers'}
								obj={this.props.device}
								type='int'
								collection={PeripheralDevices}
								className=''></EditAttribute>
						</label>
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Default linger time')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute={'settings.lingerTime'}
								obj={this.props.device}
								type='int'
								collection={PeripheralDevices}
								className=''></EditAttribute>
						</label>
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Cron Job period')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute={'settings.cronJobTime'}
								obj={this.props.device}
								type='int'
								collection={PeripheralDevices}
								className=''></EditAttribute>
						</label>
					</div>
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

					<ModalDialog title={t('Remove this storage?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteStorageConfirm} onAccept={(e) => this.handleConfirmRemoveStorageAccept(e)} onSecondary={(e) => this.handleConfirmRemoveStorageCancel(e)}>
						<p>{t('Are you sure you want to remove storage "{{storageId}}"?', { storageId: (this.state.deleteConfirmStorageId) })}</p>
					</ModalDialog>

					<ModalDialog title={t('Remove this flow?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteFlowConfirm} onAccept={(e) => this.handleConfirmRemoveFlowAccept(e)} onSecondary={(e) => this.handleConfirmRemoveFlowCancel(e)}>
						<p>{t('Are you sure you want to remove flow "{{flowId}}"?', { flowId: (this.state.deleteConfirmFlowId) })}</p>
					</ModalDialog>

					<h3 className='mhs'>{t('Attached Storages')}</h3>
					{settings && settings.storages &&
						(
							<table className='expando settings-studio-device-table'>
								<tbody>
									{this.renderStorages()}
								</tbody>
							</table>
						)
					}
					<div className='mod mhs'>
						<button className='btn btn-primary' onClick={(e) => this.addNewStorage()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>

					<h3 className='mhs'>{t('Media Flows')}</h3>
					{settings && settings.mediaFlows &&
						(
						<table className='expando settings-studio-device-table'>
							<tbody>
								{this.renderFlows()}
							</tbody>
						</table>
						)
					}
					<div className='mod mhs'>
						<button className='btn btn-primary' onClick={(e) => this.addNewFlow()}>
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

		return (<React.Fragment>
			<tr className='hl' key={'header'}>
				<th>Device ID</th>
				<th>Primary ID</th>
				<th>Host</th>
				<th>Secondary ID</th>
				<th>Host</th>
				<th></th>
			</tr>
			{_.map(settings.devices, (device: MosDeviceSettingsDevice, deviceId) => {
				return <React.Fragment key={deviceId}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(deviceId)
					})}>
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
					</tr>
					{ this.isItemEdited(deviceId) &&
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
					}
				</React.Fragment>
			})}
			</React.Fragment>)
	}
	render () {
		const { t, subDevices } = this.props

		const settings = this.props.device.settings as PlayoutDeviceSettings

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
							<h3 className='mhs'>{t('Devices')}</h3>
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

				{subDevices &&
					(
						<React.Fragment>
							<h3 className='mhs'>{t('Attached subdevices')}</h3>
							{subDevices.map((item) => <DeviceItem key={item._id} device={item} showRemoveButtons={true} />)}
						</React.Fragment>
					)
				}
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
	subDevices?: PeripheralDevice[]
}
export default translateWithTracker<IDeviceSettingsProps, IDeviceSettingsState, IDeviceSettingsTrackedProps>(
(props: IDeviceSettingsProps) => {
	return {
		device: PeripheralDevices.findOne(props.match.params.deviceId),
		subDevices: PeripheralDevices.find({
			parentDeviceId: props.match.params.deviceId
		}).fetch()
	}
})(
class DeviceSettings extends MeteorReactComponent<Translated<IDeviceSettingsProps & IDeviceSettingsTrackedProps>> {
	renderSpecifics () {
		if (this.props.device) {
			switch (this.props.device.type) {
				case PeripheralDeviceAPI.DeviceType.MOSDEVICE:
					return <MosDeviceSettingsComponent
						device={this.props.device}
						subDevices={this.props.subDevices}
					/>
				case PeripheralDeviceAPI.DeviceType.PLAYOUT:
					return <PlayoutDeviceSettingsComponent
						device={this.props.device}
						subDevices={this.props.subDevices}
					/>
				case PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER:
					return <MediaManagerSettingsComponent
						device={this.props.device}
					/>
			}
		}
		return null
	}

	restartDevice (device: PeripheralDevice) {
		const { t } = this.props
		doModalDialog({
			message: t('Are you sure you want to restart this device?'),
			title: t('Restart this device?'),
			yes: t('Restart'),
			no: t('Cancel'),
			onAccept: (e: any) => {
				PeripheralDevicesAPI.restartDevice(device, e).then((res) => {
					console.log(res)
				}).catch((err) => {
					console.error(err)
				})
			}
		})
	}

	renderEditForm () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<button className='btn btn-secondary btn-tight right' onClick={(e) => this.props.device && this.restartDevice(this.props.device)}>
						{t('Restart device')}
					</button>
					<h3 className='mhs'>
						{t('Generic Properties')}
					</h3>
					<label className='field'>
						{t('Device Name')}
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
