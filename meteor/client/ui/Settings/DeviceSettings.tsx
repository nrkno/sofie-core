import * as React from 'react'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice, PeripheralDevices, PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../lib/EditAttribute'
import { doModalDialog } from '../../lib/ModalDialog'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PeripheralDevicesAPI } from '../../lib/clientAPI'

import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { PeripheralDeviceStatus } from '../Status/SystemStatus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { faExclamationTriangle } from '@fortawesome/fontawesome-free-solid'
import { GenericDeviceSettingsComponent } from './components/GenericDeviceSettingsComponent'

interface IDeviceSettingsProps {
	match: {
		params: {
			deviceId: PeripheralDeviceId
		}
	}
}
interface IDeviceSettingsState {}
interface IDeviceSettingsTrackedProps {
	device?: PeripheralDevice
	subDevices?: PeripheralDevice[]
}
export default translateWithTracker<IDeviceSettingsProps, IDeviceSettingsState, IDeviceSettingsTrackedProps>(
	(props: IDeviceSettingsProps) => {
		return {
			device: PeripheralDevices.findOne(props.match.params.deviceId),
			subDevices: PeripheralDevices.find({
				parentDeviceId: props.match.params.deviceId,
			}).fetch(),
		}
	}
)(
	class DeviceSettings extends MeteorReactComponent<Translated<IDeviceSettingsProps & IDeviceSettingsTrackedProps>> {
		renderSpecifics() {
			if (this.props.device && this.props.device.subType === PeripheralDeviceAPI.SUBTYPE_PROCESS) {
				if (this.props.device.configManifest) {
					return <GenericDeviceSettingsComponent device={this.props.device} subDevices={this.props.subDevices} />
				} else {
					const { t } = this.props

					return (
						<div>
							<h2>{t('Peripheral Device is outdated')}</h2>
							<p>
								{t(
									'The config UI is now driven by manifests fed by the device. This device needs updating to provide the configManifest to be configurable'
								)}
							</p>
						</div>
					)
				}
			}
			return null
		}

		restartDevice(device: PeripheralDevice) {
			const { t } = this.props
			doModalDialog({
				message: t('Are you sure you want to restart this device?'),
				title: t('Restart this Device?'),
				yes: t('Restart'),
				no: t('Cancel'),
				onAccept: (e: any) => {
					PeripheralDevicesAPI.restartDevice(device, e)
						.then((res) => {
							// console.log(res)
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.NOTIFICATION,
									t('Device "{{deviceName}}" restarting...', { deviceName: device.name }),
									'DeviceSettings'
								)
							)
						})
						.catch((err) => {
							// console.error(err)
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.WARNING,
									t('Failed to restart device: "{{deviceName}}": {{errorMessage}}', {
										deviceName: device.name,
										errorMessage: err + '',
									}),
									'DeviceSettings'
								)
							)
						})
				},
			})
		}

		renderEditForm(device: PeripheralDevice) {
			const { t } = this.props

			return (
				<div className="studio-edit mod mhl mvn">
					<div className="row">
						<div className="col c12 rl-c6">
							<h2 className="mhn mtn">{t('Generic Properties')}</h2>
							<label className="field">
								{t('Device Name')}
								{!(this.props.device && this.props.device.name) ? (
									<div className="error-notice inline">
										{t('No name set')} <FontAwesomeIcon icon={faExclamationTriangle} />
									</div>
								) : null}
								<div className="mdi">
									<EditAttribute
										modifiedClassName="bghl"
										attribute="name"
										obj={this.props.device}
										type="text"
										collection={PeripheralDevices}
										className="mdinput"></EditAttribute>
									<span className="mdfx"></span>
								</div>
							</label>
						</div>
						<div className="col c12 rl-c6 alright">
							<div className="mbs">
								<button className="btn btn-secondary btn-tight" onClick={(e) => device && this.restartDevice(device)}>
									{t('Restart Device')}
								</button>
							</div>
							<div className="mbs">
								<PeripheralDeviceStatus device={device} />
							</div>
						</div>
					</div>

					{this.renderSpecifics()}
				</div>
			)
		}

		render() {
			if (this.props.device) {
				return this.renderEditForm(this.props.device)
			} else {
				return <Spinner />
			}
		}
	}
)
