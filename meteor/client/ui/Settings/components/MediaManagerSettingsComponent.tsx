import * as ClassNames from 'classnames'
import * as React from 'react'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { translate } from 'react-i18next'
import { literal, unprotectString } from '../../../../lib/lib'
import { PeripheralDevice, PeripheralDevices, PeripheralDeviceId } from '../../../../lib/collections/PeripheralDevices'
import { MediaManagerDeviceSettings, StorageType, StorageSettings, MediaFlow, MediaFlowType, MonitorSettings, MonitorSettingsType } from '../../../../lib/collections/PeripheralDeviceSettings/mediaManager'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { ModalDialog, doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { DeviceItem } from '../../Status/SystemStatus'
interface IMediaManagerSettingsComponentState {
	deleteConfirmStorageId: string | undefined
	showDeleteStorageConfirm: boolean
	editedStorages: Array<string>
	deleteConfirmFlowId: string | undefined
	showDeleteFlowConfirm: boolean
	editedFlows: Array<string>
	editedMonitors: Array<string>
}
interface IMediaManagerSettingsComponentProps {
	device: PeripheralDevice
	subDevices?: PeripheralDevice[]
}
export const MediaManagerSettingsComponent = translate()(class MediaManagerSettingsComponent extends React.Component<Translated<IMediaManagerSettingsComponentProps>, IMediaManagerSettingsComponentState> {
	constructor (props: Translated<IMediaManagerSettingsComponentProps>) {
		super(props)
		this.state = {
			deleteConfirmStorageId: undefined,
			showDeleteStorageConfirm: false,
			editedStorages: [],
			deleteConfirmFlowId: undefined,
			showDeleteFlowConfirm: false,
			editedFlows: [],
			editedMonitors: []
		}
	}
	isStorageItemEdited = (storageKey: string) => {
		return this.state.editedStorages.indexOf(storageKey) >= 0
	}
	isFlowItemEdited = (flowId: string) => {
		return this.state.editedFlows.indexOf(flowId) >= 0
	}
	isMonitorItemEdited = (monitorId: string) => {
		return this.state.editedMonitors.indexOf(monitorId) >= 0
	}
	finishEditStorageItem = (storageKey: string) => {
		let index = this.state.editedStorages.indexOf(storageKey)
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
	finishEditMonitorItem = (monitorId: string) => {
		let index = this.state.editedMonitors.indexOf(monitorId)
		if (index >= 0) {
			this.state.editedMonitors.splice(index, 1)
			this.setState({
				editedMonitors: this.state.editedMonitors
			})
		}
	}
	editStorageItem = (storageKey: string) => {
		if (this.state.editedStorages.indexOf(storageKey) < 0) {
			this.state.editedStorages.push(storageKey)
			this.setState({
				editedStorages: this.state.editedStorages
			})
		} else {
			this.finishEditStorageItem(storageKey)
		}
	}
	editFlowItem = (flowId: string) => {
		if (this.state.editedFlows.indexOf(flowId) < 0) {
			this.state.editedFlows.push(flowId)
			this.setState({
				editedFlows: this.state.editedFlows
			})
		} else {
			this.finishEditFlowItem(flowId)
		}
	}
	editMonitorItem = (monitorId: string) => {
		if (this.state.editedMonitors.indexOf(monitorId) < 0) {
			this.state.editedMonitors.push(monitorId)
			this.setState({
				editedMonitors: this.state.editedMonitors
			})
		} else {
			this.finishEditMonitorItem(monitorId)
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
	confirmRemoveStorage = (storageKey: string) => {
		this.setState({
			showDeleteStorageConfirm: true,
			deleteConfirmStorageId: storageKey
		})
	}
	confirmRemoveFlow = (flowId: string) => {
		this.setState({
			showDeleteFlowConfirm: true,
			deleteConfirmFlowId: flowId
		})
	}
	removeStorage = (storageKey: string) => {
		PeripheralDevices.update(this.props.device._id, {
			$pull: {
				'settings.storages': {
					id: storageKey
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
		return settings.storages.map((storage: StorageSettings, index) => {
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
										<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.id'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Storage Type')}
										<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.type'} obj={this.props.device} type='dropdown' options={StorageType} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Allow Read')}
										<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.support.read'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Allow Write')}
										<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.support.write'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input input-l'></EditAttribute>
									</label>
								</div>
								{(storage.type === StorageType.FILE_SHARE && ((<React.Fragment>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Base Path')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.options.basePath'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Media Path')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.options.mediaPath'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Mapped Networked Drive')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.options.mappedNetworkedDriveTarget'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Username')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.options.username'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Password')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.options.password'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Don\'t Scan Entire Storage')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.options.onlySelectedFiles'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input input-l'></EditAttribute>
										</label>
									</div>
								</React.Fragment>)) ||
									(storage.type === StorageType.LOCAL_FOLDER && ((<React.Fragment>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Base Path')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.options.basePath'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Media Path')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.options.mediaPath'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Base path is a network share')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.storages.' + index + '.options.usePolling'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className='input input-l'></EditAttribute>
											</label>
										</div>
									</React.Fragment>))))}
							</div>
							<div className='mod alright'>
								<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditStorageItem(storage.id)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>}
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
		return settings.mediaFlows.map((flow: MediaFlow, index) => {
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
										<EditAttribute modifiedClassName='bghl' attribute={'settings.mediaFlows.' + index + '.id'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Media Flow Type')}
										<EditAttribute modifiedClassName='bghl' attribute={'settings.mediaFlows.' + index + '.mediaFlowType'} obj={this.props.device} type='dropdown' options={MediaFlowType} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Source Storage')}
										<EditAttribute modifiedClassName='bghl' attribute={'settings.mediaFlows.' + index + '.sourceId'} obj={this.props.device} type='dropdown' options={settings.storages.map(i => i.id)} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								{(flow.mediaFlowType === MediaFlowType.EXPECTED_ITEMS || flow.mediaFlowType === MediaFlowType.WATCH_FOLDER) &&
									(<div className='mod mvs mhs'>
										<label className='field'>
											{t('Target Storage')}
											<EditAttribute modifiedClassName='bghl' attribute={'settings.mediaFlows.' + index + '.destinationId'} obj={this.props.device} type='dropdown' options={settings.storages.map(i => i.id)} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
										</label>
									</div>)}
							</div>
							<div className='mod alright'>
								<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditFlowItem(flow.id)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>}
			</React.Fragment>
		})
	}
	addNewMonitor = () => {
		let settings = this.props.device.settings as MediaManagerDeviceSettings || {}

		// Find free key name:
		let iter = 0
		let newMonitorId: string = ''
		do {
			newMonitorId = 'monitor' + iter
			iter++
		} while (_.find(_.keys(settings.monitors || {}), monitorId => monitorId === newMonitorId))

		const newMonitor: MonitorSettings = {
			type: MonitorSettingsType.NULL,
			storageId: ''
		}
		const m: any = {}
		m['settings.monitors.' + newMonitorId] = newMonitor
		PeripheralDevices.update(this.props.device._id, {
			$set: m
		})
	}
	removeMonitor = (monitorId: string) => {

		const { t } = this.props
		doModalDialog({
			title: t('Delete this Monitor?'),
			yes: t('Delete'),
			no: t('Cancel'),
			onAccept: () => {
				const m: any = {}
				m['settings.monitors.' + monitorId] = 1
				PeripheralDevices.update(this.props.device._id, {
					$unset: m
				})
			},
			message: <React.Fragment>
				<p>{t('Are you sure you want to delete the monitor "{{monitorId}}"?', { monitorId: monitorId })}</p>
			</React.Fragment>
		})
	}
	onEditMonitorId = (edit: EditAttributeBase, newMonitorId: any): void => {
		const oldMonitorId = edit.props.attribute
		if (oldMonitorId && newMonitorId) {

			// @ts-ignore
			const settings: MediaManagerDeviceSettings = this.props.device.settings || {}
			const monitor = (settings.monitors || {})[oldMonitorId]

			const existingMonitor = (settings.monitors || {})[newMonitorId]
			if (!existingMonitor) {
				if (newMonitorId !== oldMonitorId && monitor) {

					// remove old
					const mUnset: any = {}
					mUnset['settings.monitors.' + oldMonitorId] = 1

					const mSet: any = {}
					mSet['settings.monitors.' + newMonitorId] = monitor

					PeripheralDevices.update(this.props.device._id, {
						$unset: mUnset,
						$set: mSet
					})

					this.finishEditMonitorItem(oldMonitorId)
					this.editMonitorItem(newMonitorId)
				}
			} else {
				const { t } = this.props
				doModalDialog({
					title: t('ID already exists'),
					acceptOnly: true,
					onAccept: () => {
						// nothing
					},
					message: <React.Fragment>
						<p>{t('The ID {{monitorId}} already exists!', { monitorId: newMonitorId })}</p>
					</React.Fragment>
				})
			}
		}

	}
	renderMonitors () {
		let settings = this.props.device.settings as MediaManagerDeviceSettings
		const { t } = this.props
		return _.map(settings.monitors || {}, (monitor: MonitorSettings, monitorId: string) => {
			return <React.Fragment key={monitorId}>
				<tr key={monitorId} className={ClassNames({
					'hl': this.isMonitorItemEdited(monitorId)
				})}>
					<th className='settings-studio-device__name c5'>
						{monitorId}
					</th>
					<td className='settings-studio-device__id c4'>
						{MonitorSettingsType[monitor.type]}
					</td>
					<td className='settings-studio-device__actions table-item-actions c3'>
						<button className='action-btn' onClick={(e) => this.editMonitorItem(monitorId)}>
							<FontAwesomeIcon icon={faPencilAlt} />
						</button>
						<button className='action-btn' onClick={(e) => this.removeMonitor(monitorId)}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</td>
				</tr>
				{this.isMonitorItemEdited(monitorId) &&
					<tr className='expando-details hl' key={monitorId + '-details'}>
						<td colSpan={5}>
							<div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Monitor ID')}
										<EditAttribute modifiedClassName='bghl' attribute={monitorId} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l' overrideDisplayValue={monitorId} updateFunction={this.onEditMonitorId}></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Monitor Type')}
										<EditAttribute modifiedClassName='bghl' attribute={'settings.monitors.' + monitorId + '.type'} obj={this.props.device} type='dropdown' options={MonitorSettingsType} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Storage ID')}
										<EditAttribute modifiedClassName='bghl' attribute={'settings.monitors.' + monitorId + '.storageId'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>

								{
									monitor.type === MonitorSettingsType.WATCHER ?
									<React.Fragment>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Media Scanner Host')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.monitors.' + monitorId + '.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Media Scanner Port')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.monitors.' + monitorId + '.port'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
									</React.Fragment> :
									monitor.type === MonitorSettingsType.QUANTEL ?
									<React.Fragment>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Quantel Gateway URL')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.monitors.' + monitorId + '.gatewayUrl'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Quantel ISA URL')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.monitors.' + monitorId + '.ISAUrl'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Zone ID (leave blank for default)')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.monitors.' + monitorId + '.zoneId'} obj={this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Quantel Server ID')}
												<EditAttribute modifiedClassName='bghl' attribute={'settings.monitors.' + monitorId + '.serverId'} obj={this.props.device} type='int' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
									</React.Fragment> :
									null
								}
							</div>
							<div className='mod alright'>
								<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditMonitorItem(monitorId)}>
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
		let settings = this.props.device.settings as MediaManagerDeviceSettings
		return (
		<div>
			<div className='mod mvs mhn'>
				<label className='field'>
					{t('No. of Available Workers')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.workers'} obj={this.props.device} type='int' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhn'>
				<label className='field'>
					{t('File Linger Time')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.lingerTime'} obj={this.props.device} type='int' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhn'>
				<label className='field'>
					{t('Workflow Linger Time')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.workFlowLingerTime'} obj={this.props.device} type='int' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhn'>
				<label className='field'>
					{t('Cron-Job Interval Time')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.cronJobTime'} obj={this.props.device} type='int' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhn'>
				<label className='field'>
					{t('Media Scanner Host')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.mediaScanner.host'} obj={this.props.device} type='text' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhn'>
				<label className='field'>
					{t('Media Scanner Port')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.mediaScanner.port'} obj={this.props.device} type='int' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>
			<div className='mod mvs mhn'>
				<label className='field'>
					{t('Activate Debug Logging')}
					<EditAttribute modifiedClassName='bghl' attribute={'settings.debugLogging'} obj={this.props.device} type='checkbox' collection={PeripheralDevices} className=''></EditAttribute>
				</label>
			</div>

			<ModalDialog title={t('Remove this storage?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteStorageConfirm} onAccept={(e) => this.handleConfirmRemoveStorageAccept(e)} onSecondary={(e) => this.handleConfirmRemoveStorageCancel(e)}>
				<p>{t('Are you sure you want to remove storage "{{storageId}}"?', { storageId: (this.state.deleteConfirmStorageId) })}</p>
			</ModalDialog>

			<ModalDialog title={t('Remove this flow?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteFlowConfirm} onAccept={(e) => this.handleConfirmRemoveFlowAccept(e)} onSecondary={(e) => this.handleConfirmRemoveFlowCancel(e)}>
				<p>{t('Are you sure you want to remove flow "{{flowId}}"?', { flowId: (this.state.deleteConfirmFlowId) })}</p>
			</ModalDialog>

			<h2 className='mhn'>{t('Attached Storages')}</h2>
			{settings && settings.storages &&
				(<table className='expando settings-studio-device-table'>
					<tbody>
						{this.renderStorages()}
					</tbody>
				</table>)}
			<div className='mod mhs'>
				<button className='btn btn-primary' onClick={(e) => this.addNewStorage()}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>

			<h2 className='mhn'>{t('Media Flows')}</h2>
			{settings && settings.mediaFlows &&
				(<table className='expando settings-studio-device-table'>
					<tbody>
						{this.renderFlows()}
					</tbody>
				</table>)}
			<div className='mod mhs'>
				<button className='btn btn-primary' onClick={(e) => this.addNewFlow()}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>

			<h2 className='mhn'>{t('Monitors')}</h2>
			{settings && settings.monitors &&
				(<table className='expando settings-studio-device-table'>
					<tbody>
						{this.renderMonitors()}
					</tbody>
				</table>)}
			<div className='mod mhs'>
				<button className='btn btn-primary' onClick={(e) => this.addNewMonitor()}>
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
