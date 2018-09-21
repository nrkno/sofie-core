import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { PeripheralDevice,
		PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import * as i18next from 'react-i18next'
import { ClientAPI } from '../../../lib/api/client'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import Moment from 'react-moment'
import { translate } from 'react-i18next'
import { getCurrentTime } from '../../../lib/lib'
import { Link } from 'react-router-dom'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as _ from 'underscore'
import { ModalDialog, doModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { eventContextForLog } from '../../lib/eventTargetLogHelper'

interface IDeviceItemProps {
	// key: string,
	device: PeripheralDevice
}
interface IDeviceItemState {
	showDeleteDeviceConfirm: PeripheralDevice | null
	showKillDeviceConfirm: PeripheralDevice | null
}

export function statusCodeToString (t: i18next.TranslationFunction, statusCode: PeripheralDeviceAPI.StatusCode) {
	return (
		statusCode === PeripheralDeviceAPI.StatusCode.UNKNOWN ?
			t('Unknown') :
		statusCode === PeripheralDeviceAPI.StatusCode.GOOD ?
			t('Good') :
		statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MINOR ?
			t('Minor Warning') :
		statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MAJOR ?
			t('Warning') :
		statusCode === PeripheralDeviceAPI.StatusCode.BAD ?
			t('Bad') :
		statusCode === PeripheralDeviceAPI.StatusCode.FATAL ?
			t('Fatal') :
			t('Unknown')
	)
}

const DeviceItem = translate()(class extends React.Component<Translated<IDeviceItemProps>, IDeviceItemState> {
	constructor (props: Translated<IDeviceItemProps>) {
		super(props)
		this.state = {
			showDeleteDeviceConfirm: null,
			showKillDeviceConfirm: null
		}
	}
	statusCodeString () {
		let t = this.props.t
		return this.props.device.connected ? statusCodeToString(t, this.props.device.status.statusCode) : t('Not connected')
	}
	statusMessages () {
		let messages = ((this.props.device || {}).status || {}).messages || []
		return (
			messages.length ?
			'"' + messages.join(', ') + '"' :
			''
		)
	}
	deviceTypeString () {
		let t = this.props.t

		switch (this.props.device.type) {
			case PeripheralDeviceAPI.DeviceType.MOSDEVICE:
				return t('MOS Device')
			case PeripheralDeviceAPI.DeviceType.PLAYOUT:
				return t('Play-out Device')
			case PeripheralDeviceAPI.DeviceType.OTHER:
				return t('Sub-Device')
			default:
				return t('Unknown Device')
		}
	}
	deviceVersions () {
		let versions = this.props.device.versions
		if (versions) {
			return _.map(versions, (version, packageName) => {
				return packageName + ': ' + version
			}).join('\n')
		}
	}
	onDeleteDevice (device: PeripheralDevice) {
		this.setState({
			showDeleteDeviceConfirm: device
		})
	}
	handleConfirmDeleteShowStyleAccept = (e) => {
		if (this.state.showDeleteDeviceConfirm) {
			Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), 'temporaryRemovePeripheralDevice', this.state.showDeleteDeviceConfirm._id)
			// PeripheralDevices.remove(this.state.showDeleteDeviceConfirm._id)
		}
		// ShowStyles.remove(this.state.deleteConfirmItem._id)
		this.setState({
			showDeleteDeviceConfirm: null
		})
	}

	handleConfirmDeleteShowStyleCancel = (e) => {
		this.setState({
			showDeleteDeviceConfirm: null
		})
	}

	onKillDevice (device: PeripheralDevice) {
		this.setState({
			showKillDeviceConfirm: device
		})
	}
	handleConfirmKillAccept = (e) => {
		if (this.state.showKillDeviceConfirm) {
			Meteor.call(ClientAPI.methods.callPeripheralDeviceFunction, eventContextForLog(e), this.state.showKillDeviceConfirm._id, 'killProcess', 1, (err, result) => {
				// console.log('reply', err, result)
				if (err) {
					console.error(err)
				} else {
					console.log(result)
				}
			})
		}
		// ShowStyles.remove(this.state.KillConfirmItem._id)
		this.setState({
			showKillDeviceConfirm: null
		})
	}

	handleConfirmKillCancel = (e) => {
		this.setState({
			showKillDeviceConfirm: null
		})
	}

	onRestartCasparCG (device: PeripheralDevice) {
		const { t } = this.props

		doModalDialog({
			title: t('Restart CasparCG'),
			message: t('Do you want to restart CasparCG?'),
			onAccept: (event: any) => {

				Meteor.call(ClientAPI.methods.callPeripheralDeviceFunction, eventContextForLog(event), device._id, 'restartCasparCG', (err, result) => {
					if (err) {
						console.error(err)
					} else {
						console.log(result)
						// resolve(result)
					}
				})
			},
		})
	}

	render () {
		const { t } = this.props
		// let statusClassNames = ClassNames({
		// 	'device-item__device-status': true,
		// 	'device-item__device-status--unknown': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.UNKNOWN,
		// 	'device-item__device-status--good': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.GOOD,
		// 	'device-item__device-status--minor-warning': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MINOR,
		// 	'device-item__device-status--warning': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MAJOR,
		// 	'device-item__device-status--bad': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.BAD,
		// 	'device-item__device-status--fatal': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.FATAL
		// })
		let statusClassNames = [
			'device-item__device-status',
			(
				(
					this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.UNKNOWN
					|| !this.props.device.connected
				) ?
					'device-item__device-status--unknown' :
				( this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.GOOD ) ?
					'device-item__device-status--good' :
				( this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MINOR ) ?
					'device-item__device-status--minor-warning' :
				( this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MAJOR ) ?
					'device-item__device-status--warning' :
				( this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.BAD ) ?
					'device-item__device-status--bad' :
				( this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.FATAL ) ?
					'device-item__device-status--fatal' :
				''
			)
		].join(' ')

		return (
			<div key={this.props.device._id} className='device-item'>
				<div className='status-container'>
					<div className={statusClassNames}>
						<div className='value'>
							<span className='pill device-item__device-status__label'>
								{this.statusCodeString()}
							</span>
						</div>
						<div><i>{this.statusMessages()}</i></div>
					</div>
					<div className='device-item__last-seen'>
						<label>{t('Last seen')}: </label>
						<div className='value'>
							<Moment from={getCurrentTime()} date={this.props.device.lastSeen} />
						</div>
					</div>
				</div>
				<div className='device-item__id'>
					<label>{t('ID')}: </label>
					<div className='value'><Link to={'/settings/peripheralDevice/' + this.props.device._id}>{this.props.device._id}</Link></div>
				</div>
				<div className='device-item__name'>
					<label>{t('Name')}: </label>
					<div className='value'>{this.props.device.name}</div>
				</div>
				<div className='device-item__type'>
					<label>{t('Type')}: </label>
					<div className='value'>{this.deviceTypeString()}</div>
				</div>
				{this.props.device.versions ?
					<div className='device-item__version'>
						<label>{t('Version')}: </label>
						<div className='value'>
							<a title={this.deviceVersions()} href='#'>
								{this.props.device.versions._process || 'N/A'}
							</a>
						</div>
					</div>
				: null}

				<div className='actions-container'>
					<div className='device-item__actions'>
						{(
							// questionable check based on naming convention, but settings are not available.
							this.props.device.type === PeripheralDeviceAPI.DeviceType.OTHER && this.props.device.name.substr(0, 17) === 'Playout: CasparCG' ? <React.Fragment>
								<button className='btn btn-secondary' onClick={(e) => e.preventDefault() || e.stopPropagation() || this.onRestartCasparCG(this.props.device)}>
									Restart
									{ JSON.stringify(this.props.device.settings) }
								</button>
							</React.Fragment> : null
						)}
						<ModalDialog key='modal-device' title={t('Delete this item?')} acceptText={t('Delete')}
							secondaryText={t('Cancel')}
							show={!!this.state.showDeleteDeviceConfirm}
							onAccept={(e) => this.handleConfirmDeleteShowStyleAccept(e)}
							onSecondary={(e) => this.handleConfirmDeleteShowStyleCancel(e)}>
							<p>{t('Are you sure you want to delete this device?')}</p>
						</ModalDialog>
						<button key='button-device' className='btn btn-primary' onClick={(e) => e.preventDefault() || e.stopPropagation() || this.onDeleteDevice(this.props.device)}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
						{(
							this.props.device.type !== PeripheralDeviceAPI.DeviceType.OTHER ? <React.Fragment>
								<ModalDialog title={t('Kill this device process?')} acceptText={t('Kill')}
									secondaryText={t('Cancel')}
									show={!!this.state.showKillDeviceConfirm}
									onAccept={(e) => this.handleConfirmKillAccept(e)}
									onSecondary={(e) => this.handleConfirmKillCancel(e)}>
									<p>{t('Are you sure you want to kill the process of this device?')}</p>
								</ModalDialog>
								<button className='btn btn-secondary' onClick={(e) => e.preventDefault() || e.stopPropagation() || this.onKillDevice(this.props.device)}>
									Kill process
								</button>
							</React.Fragment> : null
						)}
					</div>
				</div>

				<div className='clear'></div>
			</div>
			// <tr className='device-item'>
			// 	<td className='device-item__id'>
			// 		<p><Link to={'/settings/peripheralDevice/' + this.props.device._id}>{this.props.device._id}</Link></p>
			// 	</td>
			// 	<td className='device-item__name'>
			// 		<p>{this.props.device.name}</p>
			// 	</td>
			// 	<td className='device-item__connected'>
			// 		<p>{this.connectedString()}</p>
			// 	</td>
			// 	<td className='device-item__type'>
			// 		<p>{this.deviceTypeString()}</p>
			// 	</td>
			// 	<td className={statusClassNames}>
			// 		<p>
			// 			<span className='pill device-item__device-status__label'>
			// 				{this.statusCodeString()}
			// 			</span>
			// 		</p>
			// 		<div><i>{(((this.props.device || {}).status || {}).messages || []).join(', ')}</i></div>
			// 	</td>
			// 	<td className='device-item__last-seen'>
			// 		<p><Moment from={getCurrentTime()} date={this.props.device.lastSeen} /></p>
			// 	</td>
			// 	<td className='device-item__actions'>
			// 		<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')}
			// 			secondaryText={t('Cancel')}
			// 			show={!!this.state.showDeleteDeviceConfirm}
			// 			onAccept={(e) => this.handleConfirmDeleteShowStyleAccept(e)}
			// 			onSecondary={(e) => this.handleConfirmDeleteShowStyleCancel(e)}>
			// 			<p>{t(`Are you sure you want to delete this device?`)}</p>
			// 		</ModalDialog>
			// 		<button className='action-btn' onClick={(e) => e.preventDefault() || e.stopPropagation() || this.onDeleteDevice(this.props.device)}>
			// 			<FontAwesomeIcon icon={faTrash} />
			// 		</button>
			// 	</td>
			// </tr>
		)
	}
})

interface ISystemStatusProps {
}
interface ISystemStatusState {
	devices: Array<PeripheralDevice>
}
interface ISystemStatusTrackedProps {
	devices: Array<PeripheralDevice>
}

interface DeviceInHierarchy {
	device: PeripheralDevice
	children: Array<DeviceInHierarchy>
}

export default translateWithTracker<ISystemStatusProps, ISystemStatusState, ISystemStatusTrackedProps>((props: ISystemStatusProps) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	return {
		devices: PeripheralDevices.find({}, { sort: { lastConnected: -1 } }).fetch()
	}
})(class SystemStatus extends MeteorReactComponent<Translated<ISystemStatusProps & ISystemStatusTrackedProps>, ISystemStatusState> {
	componentWillMount () {
		// Subscribe to data:
		this.subscribe('peripheralDevices', {})
	}
	renderPeripheralDevices () {

		let devices: Array<DeviceInHierarchy> = []
		let refs = {}
		let devicesToAdd = {}
		// First, add all as references:
		_.each(this.props.devices, (device) => {
			let d: DeviceInHierarchy = {
				device: device,
				children: []
			}
			refs[device._id] = d
			devicesToAdd[device._id] = d
		})
		// Then, map and add devices:
		_.each(devicesToAdd, (d: DeviceInHierarchy) => {
			if (d.device.parentDeviceId) {
				let parent: DeviceInHierarchy = refs[d.device.parentDeviceId]
				if (parent) {
					parent.children.push(d)
				} else {
					// not found, add on top level then:
					devices.push(d)
				}
			} else {
				devices.push(d)
			}
		})

		let getDeviceContent = (d: DeviceInHierarchy): JSX.Element => {
			let content: JSX.Element[] = [
				<DeviceItem key={'device' + d.device._id } device={d.device} />
			]
			if (d.children.length) {
				let children: JSX.Element[] = []
				_.each(d.children, (child: DeviceInHierarchy) => (
					children.push(getDeviceContent(child))
				))
				content.push(
					<div key={d.device._id + '_children'} className='children'>
						{children}
					</div>
				)
			}
			return (
				<div key={d.device._id + '_parent'} className='device-item-container'>
					{content}
				</div>
			)
		}
		return _.map(devices, (d) => getDeviceContent(d))
	}

	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter system-status'>
				<header className='mbs'>
					<h1>{t('System Status')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderPeripheralDevices()}
					{/* <table className='table system-status-table'>
						<thead>
							<tr>
								<th className='c2'>
									{t('ID')}
								</th>
								<th className='c3'>
									{t('Name')}
								</th>
								<th className='c1'>
									{t('Telemetry')}
								</th>
								<th className='c2'>
									{t('Type')}
								</th>
								<th className='c2'>
									{t('Status')}
								</th>
								<th className='c2'>
									{t('Last seen')}
								</th>
							</tr>
						</thead>
						<tbody>
							{this.renderPeripheralDevices()}
						</tbody>
					</table> */}
				</div>
			</div>
		)
	}
})
