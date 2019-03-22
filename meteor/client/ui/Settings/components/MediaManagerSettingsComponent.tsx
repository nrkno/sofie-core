import * as ClassNames from 'classnames'
import * as React from 'react'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { translate } from 'react-i18next'
import { literal } from '../../../../lib/lib'
import { PeripheralDevice, PeripheralDevices, MediaManagerDeviceSettings, StorageType, StorageSettings, MediaFlow, MediaFlowType } from '../../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../../lib/EditAttribute'
import { ModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
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
export const MediaManagerSettingsComponent = translate()(class MediaManagerSettingsComponent extends React.Component<Translated<IMediaManagerSettingsComponentProps>, IMediaManagerSettingsComponentState> {
	constructor(props: Translated<IMediaManagerSettingsComponentProps>) {
		super(props);
		this.state = {
			deleteConfirmStorageId: undefined,
			showDeleteStorageConfirm: false,
			editedStorages: [],
			deleteConfirmFlowId: undefined,
			showDeleteFlowConfirm: false,
			editedFlows: []
		};
	}
	isStorageItemEdited = (deviceId: string) => {
		return this.state.editedStorages.indexOf(deviceId) >= 0;
	};
	isFlowItemEdited = (flowId: string) => {
		return this.state.editedFlows.indexOf(flowId) >= 0;
	};
	finishEditStorageItem = (deviceId: string) => {
		let index = this.state.editedStorages.indexOf(deviceId);
		if (index >= 0) {
			this.state.editedStorages.splice(index, 1);
			this.setState({
				editedStorages: this.state.editedStorages
			});
		}
	};
	finishEditFlowItem = (flowId: string) => {
		let index = this.state.editedFlows.indexOf(flowId);
		if (index >= 0) {
			this.state.editedFlows.splice(index, 1);
			this.setState({
				editedFlows: this.state.editedFlows
			});
		}
	};
	editStorageItem = (deviceId: string) => {
		if (this.state.editedStorages.indexOf(deviceId) < 0) {
			this.state.editedStorages.push(deviceId);
			this.setState({
				editedStorages: this.state.editedStorages
			});
		}
	};
	editFlowItem = (flowId: string) => {
		if (this.state.editedFlows.indexOf(flowId) < 0) {
			this.state.editedFlows.push(flowId);
			this.setState({
				editedFlows: this.state.editedFlows
			});
		}
	};
	handleConfirmRemoveStorageCancel = (e) => {
		this.setState({
			showDeleteStorageConfirm: false,
			deleteConfirmStorageId: undefined
		});
	};
	handleConfirmRemoveStorageAccept = (e) => {
		this.state.deleteConfirmStorageId && this.removeStorage(this.state.deleteConfirmStorageId);
		this.setState({
			showDeleteStorageConfirm: false,
			deleteConfirmStorageId: undefined
		});
	};
	handleConfirmRemoveFlowCancel = (e) => {
		this.setState({
			showDeleteFlowConfirm: false,
			deleteConfirmFlowId: undefined
		});
	};
	handleConfirmRemoveFlowAccept = (e) => {
		this.state.deleteConfirmFlowId && this.removeFlow(this.state.deleteConfirmFlowId);
		this.setState({
			showDeleteFlowConfirm: false,
			deleteConfirmFlowId: undefined
		});
	};
	confirmRemoveStorage = (deviceId: string) => {
		this.setState({
			showDeleteStorageConfirm: true,
			deleteConfirmStorageId: deviceId
		});
	};
	confirmRemoveFlow = (flowId: string) => {
		this.setState({
			showDeleteFlowConfirm: true,
			deleteConfirmFlowId: flowId
		});
	};
	removeStorage = (deviceId: string) => {
		PeripheralDevices.update(this.props.device._id, {
			$pull: {
				'settings.storages': {
					id: deviceId
				}
			}
		});
	};
	removeFlow = (flowId: string) => {
		PeripheralDevices.update(this.props.device._id, {
			$pull: {
				'settings.mediaFlows': {
					id: flowId
				}
			}
		});
	};
	addNewStorage = () => {
		let settings = this.props.device.settings as MediaManagerDeviceSettings || {};
		// find free key name
		let newDeviceId = 'storage';
		let iter = 0;
		while ((settings.storages || []).findIndex(i => i.id === newDeviceId + iter.toString()) >= 0) {
			iter++;
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
		});
	};
	renderStorages() {
		let settings = this.props.device.settings as MediaManagerDeviceSettings;
		const { t } = this.props;
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
									</React.Fragment>))))}
							</div>
							<div className='mod alright'>
								<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditStorageItem(storage.id)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>}
			</React.Fragment>;
		});
	}
	addNewFlow = () => {
		let settings = this.props.device.settings as MediaManagerDeviceSettings || {};
		// find free key name
		let newFlowId = 'flow';
		let iter = 0;
		while ((settings.mediaFlows || []).findIndex(i => i.id === newFlowId + iter.toString()) >= 0) {
			iter++;
		}
		PeripheralDevices.update(this.props.device._id, {
			$push: {
				'settings.mediaFlows': literal<MediaFlow>({
					id: newFlowId + iter,
					mediaFlowType: MediaFlowType.UNKNOWN,
					sourceId: ''
				})
			}
		});
	};
	renderFlows() {
		let settings = this.props.device.settings as MediaManagerDeviceSettings;
		const { t } = this.props;
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
			</React.Fragment>;
		});
	}
	// componentDidMount() {
	// 	// const script = document.createElement('script')
	// 	// script.type = 'text/javascript'
	// 	// script.async = true
	// 	// script.innerHTML = "document.write('This is output by document.write()!')"
	// 	// // this.instance.appendChild(s)
	// 	// document.body.appendChild(script)
	// 	loadScript('/scripts/statusChecker.js', err => {
	// 		if(err) {
	// 			console.error(err)
	// 		}
	// 	})
	// }
	render() {
		const { t } = this.props;
		let settings = this.props.device.settings as MediaManagerDeviceSettings;
		return (<div>
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
		</div>);
	}
});
