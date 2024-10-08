import React from 'react'
import { Translated, useSubscription, useTracker } from '../../../lib/ReactMeteorData/react-meteor-data'
import { PeripheralDevice, PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { withTranslation } from 'react-i18next'
import { protectString, unprotectString } from '../../../lib/tempLib'
import * as _ from 'underscore'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { StatusResponse } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { MeteorCall } from '../../../lib/meteorApi'
import { CoreSystem, PeripheralDevices } from '../../../collections'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { logger } from '../../../lib/logging'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { CoreItem } from './CoreItem'
import { DeviceItem } from './DeviceItem'

interface ISystemStatusProps {}
interface ISystemStatusState {
	systemStatus: StatusResponse | undefined
	deviceDebugState: Map<PeripheralDeviceId, object>
}

interface ISystemStatusTrackedProps {
	coreSystem: ICoreSystem | undefined
	devices: Array<PeripheralDevice>
}

interface DeviceInHierarchy {
	device: PeripheralDevice
	children: Array<DeviceInHierarchy>
}

export default function SystemStatus(props: Readonly<ISystemStatusProps>): JSX.Element {
	// Subscribe to data:
	useSubscription(CorelibPubSub.peripheralDevices, null)

	const coreSystem = useTracker(() => CoreSystem.findOne(), [])
	const devices = useTracker(() => PeripheralDevices.find({}, { sort: { lastConnected: -1 } }).fetch(), [], [])

	return <SystemStatusContent {...props} coreSystem={coreSystem} devices={devices} />
}

const SystemStatusContent = withTranslation()(
	class SystemStatusContent extends React.Component<
		Translated<ISystemStatusProps & ISystemStatusTrackedProps>,
		ISystemStatusState
	> {
		private refreshInterval: NodeJS.Timer | undefined = undefined
		private refreshDebugStatesInterval: NodeJS.Timer | undefined = undefined
		private destroyed = false

		constructor(props: Translated<ISystemStatusProps & ISystemStatusTrackedProps>) {
			super(props)

			this.state = {
				systemStatus: undefined,
				deviceDebugState: new Map(),
			}
		}

		componentDidMount(): void {
			this.refreshSystemStatus()
			this.refreshInterval = setInterval(this.refreshSystemStatus, 5000)
			this.refreshDebugStatesInterval = setInterval(this.refreshDebugStates, 1000)
		}

		componentWillUnmount(): void {
			if (this.refreshInterval) clearInterval(this.refreshInterval)
			if (this.refreshDebugStatesInterval) clearInterval(this.refreshDebugStatesInterval)
			this.destroyed = true
		}

		refreshSystemStatus = () => {
			const { t } = this.props
			MeteorCall.systemStatus
				.getSystemStatus()
				.then((systemStatus: StatusResponse) => {
					if (this.destroyed) return

					this.setState({
						systemStatus: systemStatus,
					})
				})
				.catch((err) => {
					if (this.destroyed) return

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

		refreshDebugStates = () => {
			for (const device of this.props.devices) {
				if (device.type === PeripheralDeviceType.PLAYOUT && device.settings && (device.settings as any)['debugState']) {
					MeteorCall.systemStatus
						.getDebugStates(device._id)
						.then((res) => {
							const states: Map<PeripheralDeviceId, object> = new Map()
							for (const [key, state] of Object.entries<any>(res)) {
								states.set(protectString(key), state)
							}
							this.setState({
								deviceDebugState: states,
							})
						})
						.catch((err) => console.log(`Error fetching device states: ${stringifyError(err)}`))
				}
			}
		}

		renderPeripheralDevices() {
			const devices: Array<DeviceInHierarchy> = []
			const refs: Record<string, DeviceInHierarchy | undefined> = {}
			const devicesToAdd: Record<string, DeviceInHierarchy> = {}
			// First, add all as references:
			_.each(this.props.devices, (device) => {
				const d: DeviceInHierarchy = {
					device: device,
					children: [],
				}
				refs[unprotectString(device._id)] = d
				devicesToAdd[unprotectString(device._id)] = d
			})
			// Then, map and add devices:
			_.each(devicesToAdd, (d: DeviceInHierarchy) => {
				if (d.device.parentDeviceId) {
					const parent = refs[unprotectString(d.device.parentDeviceId)]
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

			const getDeviceContent = (parentDevice: DeviceInHierarchy | null, d: DeviceInHierarchy): JSX.Element => {
				const content: JSX.Element[] = [
					<DeviceItem
						key={'device' + d.device._id}
						parentDevice={parentDevice?.device ?? null}
						device={d.device}
						hasChildren={d.children.length !== 0}
						debugState={this.state.deviceDebugState.get(d.device._id)}
					/>,
				]
				if (d.children.length) {
					const children: JSX.Element[] = []
					_.each(d.children, (child: DeviceInHierarchy) =>
						children.push(
							<li key={'childdevice' + child.device._id} className="child-device-li">
								{getDeviceContent(d, child)}
							</li>
						)
					)
					content.push(
						<div key={d.device._id + '_children'} className="children">
							<ul className="childlist">{children}</ul>
						</div>
					)
				}
				return (
					<div key={d.device._id + '_parent'} className="device-item-container">
						{content}
					</div>
				)
			}

			return (
				<React.Fragment>
					{this.props.coreSystem && (
						<CoreItem coreSystem={this.props.coreSystem} systemStatus={this.state.systemStatus} />
					)}
					{_.map(devices, (d) => getDeviceContent(null, d))}
				</React.Fragment>
			)
		}

		render(): JSX.Element {
			const { t } = this.props

			return (
				<div className="mhl gutter system-status">
					<header className="mbs">
						<h1>{t('System Status')}</h1>
					</header>
					<div className="mod mvl">{this.renderPeripheralDevices()}</div>
				</div>
			)
		}
	}
)
