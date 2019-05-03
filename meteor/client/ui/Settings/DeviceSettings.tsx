import * as React from 'react'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice,
	PeripheralDevices} from '../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../lib/EditAttribute'
import { doModalDialog } from '../../lib/ModalDialog'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PeripheralDevicesAPI } from '../../lib/clientAPI'

import { PlayoutDeviceSettingsComponent } from './components/PlayoutDeviceSettingsComponent'
import { MediaManagerSettingsComponent } from './components/MediaManagerSettingsComponent'
import { MosDeviceSettingsComponent } from './components/MosDeviceSettingsComponent'
import { SpreadsheetSettingsComponent } from './components/SpreadsheetSettingsComponent'

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
		if (
			this.props.device &&
			this.props.device.subType === PeripheralDeviceAPI.SUBTYPE_PROCESS
		) {
			switch (this.props.device.type) {
				case PeripheralDeviceAPI.DeviceType.MOS:
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
				case PeripheralDeviceAPI.DeviceType.SPREADSHEET:
					return <SpreadsheetSettingsComponent
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
			title: t('Restart this Device?'),
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
			<div className='studio-edit mod mhl mvn'>
				<div>
					<button className='btn btn-secondary btn-tight right' onClick={(e) => this.props.device && this.restartDevice(this.props.device)}>
						{t('Restart Device')}
					</button>
					<h2 className='mhn mtn'>
						{t('Generic Properties')}
					</h2>
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

		if (this.props.device) {
			return this.renderEditForm()
		} else {
			return <Spinner />
		}
	}
}
)
