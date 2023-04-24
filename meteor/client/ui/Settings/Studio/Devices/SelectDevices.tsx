import React, { useCallback, useState } from 'react'
import Tooltip from 'rc-tooltip'
import { doModalDialog } from '../../../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons'
import { PeripheralDevice, PeripheralDeviceType } from '../../../../../lib/collections/PeripheralDevices'
import { Link } from 'react-router-dom'
import { MomentFromNow } from '../../../../lib/Moment'
import { useTranslation } from 'react-i18next'
import { getHelpMode } from '../../../../lib/localStorage'
import { unprotectString } from '../../../../../lib/lib'
import { PeripheralDevices } from '../../../../collections'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'

interface StudioSelectDevicesProps {
	studioId: StudioId
	studioDevices: PeripheralDevice[]
}
export function StudioSelectDevices({ studioId, studioDevices }: StudioSelectDevicesProps): JSX.Element {
	const { t } = useTranslation()

	const availableDevices = useTracker(
		() =>
			PeripheralDevices.find(
				{
					studioId: {
						$not: {
							$eq: studioId,
						},
					},
					parentDeviceId: {
						$exists: false,
					},
				},
				{
					sort: {
						lastConnected: -1,
					},
				}
			).fetch(),
		[studioId],
		[]
	)

	const [showAvailableDevices, setShowAvailableDevices] = useState(false)
	const toggleAvailableDevices = useCallback(() => setShowAvailableDevices((show) => !show), [])

	const isPlayoutConnected = !!studioDevices.find((device) => device.type === PeripheralDeviceType.PLAYOUT)

	const confirmRemove = useCallback((deviceId: PeripheralDeviceId, deviceName: string | undefined) => {
		doModalDialog({
			title: t('Remove this device?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				PeripheralDevices.update(deviceId, {
					$unset: {
						studioId: 1,
					},
				})
			},
			message: (
				<p>
					{t('Are you sure you want to remove device "{{deviceId}}"?', {
						deviceId: deviceName || deviceId,
					})}
				</p>
			),
		})
	}, [])

	const addDevice = useCallback((deviceId: PeripheralDeviceId) => {
		PeripheralDevices.update(deviceId, {
			$set: {
				studioId: studioId,
			},
		})
	}, [])

	return (
		<div>
			<h2 className="mhn">
				<Tooltip
					overlay={t('Devices are needed to control your studio hardware')}
					visible={getHelpMode() && !studioDevices.length}
					placement="right"
				>
					<span>{t('Peripheral Devices')}</span>
				</Tooltip>
			</h2>
			&nbsp;
			{!studioDevices.length ? (
				<div className="error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No devices connected')}
				</div>
			) : null}
			{!isPlayoutConnected ? (
				<div className="error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} /> {t('Playout gateway not connected')}
				</div>
			) : null}
			<table className="expando settings-studio-device-table">
				<tbody>
					{studioDevices.map((device) => (
						<StudioDeviceEntry key={unprotectString(device._id)} device={device} confirmRemove={confirmRemove} />
					))}
				</tbody>
			</table>
			<div className="mod mhs">
				<button className="btn btn-primary" onClick={toggleAvailableDevices}>
					<FontAwesomeIcon icon={faPlus} /> {t('Attach device')}
				</button>
				{showAvailableDevices && (
					<div className="border-box text-s studio-devices-dropdown">
						<div className="ctx-menu">
							{availableDevices.map((device) => (
								<AvailableDeviceEntry key={unprotectString(device._id)} device={device} addDevice={addDevice} />
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

interface StudioDeviceEntryProps {
	device: PeripheralDevice
	confirmRemove: (deviceId: PeripheralDeviceId, deviceName: string | undefined) => void
}
function StudioDeviceEntry({ device, confirmRemove }: StudioDeviceEntryProps) {
	const doConfirmRemove = useCallback(
		() => confirmRemove(device._id, device.name),
		[confirmRemove, device._id, device.name]
	)
	return (
		<tr>
			<th className="settings-studio-device__name c3">
				<Link to={'/settings/peripheralDevice/' + device._id}>{device.name}</Link>
			</th>
			<td className="settings-studio-device__id c3">{unprotectString(device._id)}</td>
			<td className="settings-studio-device__id c3">
				<MomentFromNow date={device.lastSeen} />
			</td>
			<td className="settings-studio-device__actions table-item-actions c3">
				<button className="action-btn" onClick={doConfirmRemove}>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</td>
		</tr>
	)
}

interface AvailableDeviceEntryProps {
	device: PeripheralDevice
	addDevice: (deviceId: PeripheralDeviceId) => void
}
function AvailableDeviceEntry({ device, addDevice }: AvailableDeviceEntryProps) {
	const doAddDevice = useCallback(() => {
		addDevice(device._id)
	}, [addDevice, device._id])

	return (
		<div className="ctx-menu-item" onClick={doAddDevice}>
			<b>{device.name}</b> <MomentFromNow date={device.lastSeen} /> ({unprotectString(device._id)})
		</div>
	)
}
