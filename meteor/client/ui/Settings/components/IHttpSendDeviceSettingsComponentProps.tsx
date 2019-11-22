import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { DeviceOptionsAny as PlayoutDeviceSettingsDevice } from 'timeline-state-resolver-types'
export interface IHttpSendDeviceSettingsComponentProps {
	parentDevice: PeripheralDevice
	deviceId: string
	device: PlayoutDeviceSettingsDevice
}
export interface IHttpSendDeviceSettingsComponentState {
	deleteConfirmMakeReadyId: string | undefined
	showDeleteConfirmMakeReady: boolean
	editedMakeReady: Array<string>
}
export interface IPlayoutDeviceSettingsComponentProps {
	device: PeripheralDevice
	subDevices?: PeripheralDevice[]
}
export interface IPlayoutDeviceSettingsComponentState {
	deleteConfirmDeviceId: string | undefined
	showDeleteConfirm: boolean
	editedDevices: Array<string>
}
