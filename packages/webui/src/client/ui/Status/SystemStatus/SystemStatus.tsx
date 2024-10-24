import { useEffect, useMemo, useState } from 'react'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/react-meteor-data'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { useTranslation } from 'react-i18next'
import { protectString, unprotectString } from '../../../lib/tempLib'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications'
import { StatusResponse } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { MeteorCall } from '../../../lib/meteorApi'
import { CoreSystem, PeripheralDevices } from '../../../collections'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { logger } from '../../../lib/logging'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { CoreItem } from './CoreItem'
import { DeviceItem } from './DeviceItem'

export function SystemStatus(): JSX.Element {
	const { t } = useTranslation()

	// Subscribe to data:
	useSubscription(CorelibPubSub.peripheralDevices, null)

	const coreSystem = useTracker(() => CoreSystem.findOne(), [])
	const devices = useTracker(() => PeripheralDevices.find({}, { sort: { lastConnected: -1 } }).fetch(), [], [])

	const systemStatus = useSystemStatus()
	const playoutDebugStates = usePlayoutDebugStates(devices)

	const devicesHierarchy = convertDevicesIntoHeirarchy(devices)

	return (
		<div className="mhl gutter system-status">
			<header className="mbs">
				<h1>{t('System Status')}</h1>
			</header>
			<div className="mod mvl">
				{coreSystem && <CoreItem coreSystem={coreSystem} systemStatus={systemStatus} />}

				{devicesHierarchy.map((d) => (
					<DeviceItemWithChildren
						key={unprotectString(d.device._id)}
						playoutDebugStates={playoutDebugStates}
						parentDevice={null}
						device={d}
					/>
				))}
			</div>
		</div>
	)
}

interface DeviceInHierarchy {
	device: PeripheralDevice
	children: Array<DeviceInHierarchy>
}

function useSystemStatus(): StatusResponse | undefined {
	const { t } = useTranslation()

	const [sytemStatus, setSystemStatus] = useState<StatusResponse | undefined>()

	useEffect(() => {
		let destroyed = false

		const refreshSystemStatus = () => {
			MeteorCall.systemStatus
				.getSystemStatus()
				.then((newSystemStatus: StatusResponse) => {
					if (destroyed) return

					setSystemStatus(newSystemStatus)
				})
				.catch((err) => {
					if (destroyed) return

					logger.error('systemStatus.getSystemStatus', err)
					NotificationCenter.push(
						new Notification(
							'systemStatus_failed',
							NoticeLevel.CRITICAL,
							t('Could not get system status. Please consult system administrator.'),
							'RundownList'
						)
					)
				})
		}

		refreshSystemStatus()

		const interval = setInterval(refreshSystemStatus, 5000)

		return () => {
			clearInterval(interval)
			destroyed = true
		}
	}, [t])

	return sytemStatus
}

function usePlayoutDebugStates(devices: PeripheralDevice[]): Map<PeripheralDeviceId, object> {
	const { t } = useTranslation()

	const [playoutDebugStates, setPlayoutDebugStates] = useState<Map<PeripheralDeviceId, object>>(new Map())

	const playoutDeviceIds = useMemo(() => {
		const deviceIds: PeripheralDeviceId[] = []

		for (const device of devices) {
			if (device.type === PeripheralDeviceType.PLAYOUT && device.settings && (device.settings as any)['debugState']) {
				deviceIds.push(device._id)
			}
		}

		deviceIds.sort()
		return deviceIds
	}, [devices])

	useEffect(() => {
		let destroyed = false

		const refreshDebugStates = () => {
			for (const deviceId of playoutDeviceIds) {
				MeteorCall.systemStatus
					.getDebugStates(deviceId)
					.then((res) => {
						if (destroyed) return

						setPlayoutDebugStates((oldState) => {
							// Create a new map based on the old one
							const newStates = new Map(oldState.entries())
							for (const [key, state] of Object.entries<any>(res)) {
								newStates.set(protectString(key), state)
							}
							return newStates
						})
					})
					.catch((err) => console.log(`Error fetching device states: ${stringifyError(err)}`))
			}
		}

		const interval = setInterval(refreshDebugStates, 1000)

		return () => {
			clearInterval(interval)
			destroyed = true
		}
	}, [t, JSON.stringify(playoutDeviceIds)])

	return playoutDebugStates
}

function convertDevicesIntoHeirarchy(devices: PeripheralDevice[]): DeviceInHierarchy[] {
	const devicesMap = new Map<PeripheralDeviceId, DeviceInHierarchy>()
	const devicesToAdd: DeviceInHierarchy[] = []

	// First, add all as references:
	for (const device of devices) {
		const entry: DeviceInHierarchy = {
			device: device,
			children: [],
		}
		devicesMap.set(device._id, entry)
		devicesToAdd.push(entry)
	}

	// Then, map and add devices:
	const devicesHeirarchy: Array<DeviceInHierarchy> = []
	for (const entry of devicesToAdd) {
		if (entry.device.parentDeviceId) {
			const parent = devicesMap.get(entry.device.parentDeviceId)
			if (parent) {
				parent.children.push(entry)
			} else {
				// not found, add on top level then:
				devicesHeirarchy.push(entry)
			}
		} else {
			devicesHeirarchy.push(entry)
		}
	}

	return devicesHeirarchy
}

interface DeviceItemWithChildrenProps {
	playoutDebugStates: Map<PeripheralDeviceId, object>
	parentDevice: DeviceInHierarchy | null
	device: DeviceInHierarchy
}

function DeviceItemWithChildren({ playoutDebugStates, device, parentDevice }: DeviceItemWithChildrenProps) {
	return (
		<div key={device.device._id + '_parent'} className="device-item-container">
			<DeviceItem
				parentDevice={parentDevice?.device ?? null}
				device={device.device}
				hasChildren={device.children.length !== 0}
				debugState={playoutDebugStates.get(device.device._id)}
			/>

			{device.children.length > 0 && (
				<div className="children">
					<ul className="childlist">
						{device.children.map((child) => (
							<li key={unprotectString(child.device._id)} className="child-device-li">
								<DeviceItemWithChildren playoutDebugStates={playoutDebugStates} parentDevice={device} device={child} />
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}
