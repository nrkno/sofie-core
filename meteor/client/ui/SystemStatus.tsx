import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { PeripheralDevice,
		PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import * as ClassNames from 'classnames'
import Moment from 'react-moment'
import { translate, InjectedTranslateProps } from 'react-i18next'

interface IDeviceItemPropsHeader extends InjectedTranslateProps {
	key: string,
	device: PeripheralDevice
}
const DeviceItem = translate()(class extends React.Component<IDeviceItemPropsHeader> {
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

	render () {
		let statusClassNames = ClassNames({
			'device-item__device-status': true,
			'device-item__device-status--unknown': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.UNKNOWN,
			'device-item__device-status--good': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.GOOD,
			'device-item__device-status--minor-warning': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MINOR,
			'device-item__device-status--warning': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MAJOR,
			'device-item__device-status--bad': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.BAD,
			'device-item__device-status--fatal': this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.FATAL
		})

		return (
			<tr className='device-item'>
				<td className='device-item__id'>
					<p>{this.props.device._id}</p>
				</td>
				<td className='device-item__name'>
					<p>{this.props.device.name}</p>
				</td>
				<td className='device-item__connected'>
					<p>{this.connectedString()}</p>
				</td>
				<td className='device-item__type'>
					<p>{this.deviceTypeString()}</p>
				</td>
				<td className={statusClassNames}>
					<p>
						<span className='pill device-item__device-status__label'>{this.statusCodeString()}</span>
					</p>
				</td>
				<td className='device-item__last-seen'>
					<p><Moment fromNow date={this.props.device.lastSeen} /></p>
				</td>
			</tr>
		)
	}
})

interface IPropsHeader extends InjectedTranslateProps {
	devices: Array<PeripheralDevice>
}
export class SystemStatus extends React.Component<IPropsHeader> {
	renderPeripheralDevices () {
		return this.props.devices.map((device) => (
			<DeviceItem key={device._id} device={device} />
		))
	}

	render () {
		const { t } = this.props

		return (
			<div>
				<header className='mvs'>
					<h1>{t('System Status')}</h1>
				</header>
				<div className='mod mvl'>
					<table className='table system-status-table'>
						<thead>
							<tr>
								<th className='c1'>
									{t('ID')}
								</th>
								<th className='c3'>
									{t('Name')}
								</th>
								<th className='c1'>
									{t('Connected')}
								</th>
								<th className='c1'>
									{t('Type')}
								</th>
								<th className='c2'>
									{t('Status')}
								</th>
								<th className='c4'>
									{t('Last seen')}
								</th>
							</tr>
						</thead>
						<tbody>
							{this.renderPeripheralDevices()}
						</tbody>
					</table>
				</div>
			</div>
		)
	}
}

export default translate()(withTracker(() => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	return {
		devices: PeripheralDevices.find({}, { sort: { lastSeen: -1 } }).fetch()
	}
})(SystemStatus))
