import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { PeripheralDevice,
		PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import Moment from 'react-moment'
import { translate } from 'react-i18next'
import { getCurrentTime } from '../../lib/lib'
import { Link } from 'react-router-dom'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as _ from 'underscore'
import { ModalDialog } from '../lib/ModalDialog'

interface IDeviceItemProps {
	// key: string,
	device: PeripheralDevice
}
interface IDeviceItemState {
	showDeleteDeviceConfirm: PeripheralDevice | null
}
const DeviceItem = translate()(class extends React.Component<Translated<IDeviceItemProps>, IDeviceItemState> {
	constructor (props: Translated<IDeviceItemProps>) {
		super(props)
		this.state = {
			showDeleteDeviceConfirm: null
		}
	}
	statusCodeString () {
		let t = this.props.t

		switch (this.props.device.status.statusCode) {
			case PeripheralDeviceAPI.StatusCode.UNKNOWN:
				return t('Unknown')
			case PeripheralDeviceAPI.StatusCode.GOOD:
				return t('Good')
			case PeripheralDeviceAPI.StatusCode.WARNING_MINOR:
				return t('Minor Warning')
			case PeripheralDeviceAPI.StatusCode.WARNING_MAJOR:
				return t('Warning')
			case PeripheralDeviceAPI.StatusCode.BAD:
				return t('Bad')
			case PeripheralDeviceAPI.StatusCode.FATAL:
				return t('Fatal')
		}
	}
	connectedString () {
		let t = this.props.t

		if (this.props.device.connected) {
			return t('Connected')
		} else {
			return t('Disconnected')
		}
	}
	deviceTypeString () {
		let t = this.props.t

		switch (this.props.device.type) {
			case PeripheralDeviceAPI.DeviceType.MOSDEVICE:
				return t('MOS Device')
			case PeripheralDeviceAPI.DeviceType.PLAYOUT:
				return t('Playout Device')
			default:
				return t('Unknown Device')
		}
	}
	onDeleteDevice (device: PeripheralDevice) {
		this.setState({
			showDeleteDeviceConfirm: device
		})
	}
	handleConfirmDeleteShowStyleAccept = (e) => {
		if (this.state.showDeleteDeviceConfirm) {
			Meteor.call('temporaryRemovePeripheralDevice', this.state.showDeleteDeviceConfirm._id)
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
			<div className='device-item'>
				<div className='device-item__id'>
					ID: <p><Link to={'/settings/peripheralDevice/' + this.props.device._id}>{this.props.device._id}</Link></p>
				</div>
				<div className='device-item__name'>
					Name: <p>{this.props.device.name}</p>
				</div>
				<div className='device-item__connected'>
					Connected: <p>{this.connectedString()}</p>
				</div>
				<div className='device-item__type'>
					Type: <p>{this.deviceTypeString()}</p>
				</div>
				<div className={statusClassNames}>
					Status: <p>
						<span className='pill device-item__device-status__label'>
							{this.statusCodeString()}
						</span>
					</p>
					<div><i>{(((this.props.device || {}).status || {}).messages || []).join(', ')}</i></div>
				</div>
				<div className='device-item__last-seen'>
					Last seen: <p><Moment from={getCurrentTime()} date={this.props.device.lastSeen} /></p>
				</div>
				<div className='device-item__actions'>
					<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')}
						secondaryText={t('Cancel')}
						show={!!this.state.showDeleteDeviceConfirm}
						onAccept={(e) => this.handleConfirmDeleteShowStyleAccept(e)}
						onSecondary={(e) => this.handleConfirmDeleteShowStyleCancel(e)}>
						<p>{t(`Are you sure you want to delete this device?`)}</p>
					</ModalDialog>
					<button className='action-btn' onClick={(e) => e.preventDefault() || e.stopPropagation() || this.onDeleteDevice(this.props.device)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</div>
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
		devices: PeripheralDevices.find({}, { sort: { lastSeen: -1 } }).fetch()
	}
})(class SystemStatus extends React.Component<Translated<ISystemStatusProps & ISystemStatusTrackedProps>, ISystemStatusState> {
	private _subscriptions: Array<Meteor.SubscriptionHandle> = []
	componentWillMount () {
		// Subscribe to data:

		this._subscriptions.push(Meteor.subscribe('peripheralDevices', {}))
	}
	componentWillUnmount () {
		_.each(this._subscriptions, (sub ) => {
			sub.stop()
		})
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
				<DeviceItem device={d.device} />
			]
			if (d.children.length) {
				let children: JSX.Element[] = []
				_.each(d.children, (child: DeviceInHierarchy) => (
					children.push(getDeviceContent(child))
				))
				content.push(
					<div className='children'>
						{children}
					</div>
				)
			}
			return (
				<div className='device-item-container'>
					{content}
				</div>
			)
		}
		return _.map(devices, (d) => getDeviceContent(d))
	}

	render () {
		const { t } = this.props

		return (
			<div className='mtl gutter'>
				<header className='mvs'>
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
