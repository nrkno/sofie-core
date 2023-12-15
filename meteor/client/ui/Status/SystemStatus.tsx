import * as React from 'react'
import { Translated, useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import {
	PeripheralDevice,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import * as reacti18next from 'react-i18next'
import * as i18next from 'i18next'
import Moment from 'react-moment'
import { assertNever, getCurrentTime, protectString, unprotectString } from '../../../lib/lib'
import { Link } from 'react-router-dom'
import Tooltip from 'rc-tooltip'
import { faTrash, faEye } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as _ from 'underscore'
import { doModalDialog } from '../../lib/ModalDialog'
import { callPeripheralDeviceAction, PeripheralDevicesAPI } from '../../lib/clientAPI'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications'
import { getAllowConfigure, getAllowDeveloper, getAllowStudio, getHelpMode } from '../../lib/localStorage'
import ClassNames from 'classnames'
import { StatusCode, TSR } from '@sofie-automation/blueprints-integration'
import { ICoreSystem } from '../../../lib/collections/CoreSystem'
import { StatusResponse } from '../../../lib/api/systemStatus'
import { doUserAction, UserAction } from '../../../lib/clientUserAction'
import { MeteorCall } from '../../../lib/api/methods'
import { hashSingleUseToken } from '../../../lib/api/userActions'
import { DEFAULT_TSR_ACTION_TIMEOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'
import { SubdeviceAction } from '@sofie-automation/shared-lib/dist/core/deviceConfigManifest'
import { StatusCodePill } from './StatusCodePill'
import { isTranslatableMessage, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { i18nTranslator } from '../i18n'
import { SchemaFormInPlace } from '../../lib/forms/SchemaFormInPlace'
import { CoreSystem, PeripheralDevices } from '../../collections'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { DebugStateTable } from './DebugState'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { ClientAPI } from '../../../lib/api/client'
import { catchError } from '../../lib/lib'
import { logger } from '../../../lib/logging'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

interface IDeviceItemProps {
	parentDevice: PeripheralDevice | null
	device: PeripheralDevice
	showRemoveButtons?: boolean
	hasChildren?: boolean

	debugState: object | undefined
}
interface IDeviceItemState {}

export function statusCodeToString(t: i18next.TFunction, statusCode: StatusCode): string {
	switch (statusCode) {
		case StatusCode.UNKNOWN:
			return t('Unknown')
		case StatusCode.GOOD:
			return t('Good')
		case StatusCode.WARNING_MINOR:
			return t('Minor Warning')
		case StatusCode.WARNING_MAJOR:
			return t('Warning')
		case StatusCode.BAD:
			return t('Bad')
		case StatusCode.FATAL:
			return t('Fatal')
		default:
			assertNever(statusCode)
			return t('Unknown')
	}
}

export const DeviceItem = reacti18next.withTranslation()(
	class DeviceItem extends React.Component<Translated<IDeviceItemProps>, IDeviceItemState> {
		deviceTypeString() {
			const t = this.props.t

			switch (this.props.device.type) {
				case PeripheralDeviceType.MOS:
					return t('MOS Gateway')
				case PeripheralDeviceType.PLAYOUT:
					return t('Play-out Gateway')
				case PeripheralDeviceType.MEDIA_MANAGER:
					return t('Media Manager')
				case PeripheralDeviceType.LIVE_STATUS:
					return t('Live Status Gateway')
				default:
					return t('Unknown Device')
			}
		}
		deviceVersions() {
			const versions = this.props.device.versions
			if (versions) {
				return _.map(versions, (version, packageName) => {
					return packageName + ': ' + version
				}).join('\n')
			}
		}
		onToggleIgnore(device: PeripheralDevice) {
			PeripheralDevices.update(device._id, {
				$set: {
					ignore: !device.ignore,
				},
			})
		}
		onExecuteAction(event: any, device: PeripheralDevice, action: SubdeviceAction) {
			const { t } = this.props
			const namespaces = ['peripheralDevice_' + device._id]

			const processResponse = (r: TSR.ActionExecutionResult) => {
				if (r?.result === TSR.ActionExecutionResultCode.Error) {
					throw new Error(
						r.response && isTranslatableMessage(r.response)
							? translateMessage(r.response, i18nTranslator)
							: t('Unknown error')
					)
				}
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.NOTIFICATION,
						r?.response && isTranslatableMessage(r.response)
							? t('Executed {{actionName}} on device "{{deviceName}}": {{response}}', {
									actionName: action.name,
									deviceName: device.name,
									response: translateMessage(r.response, i18nTranslator),
							  })
							: t('Executed {{actionName}} on device "{{deviceName}}"...', {
									actionName: action.name,
									deviceName: device.name,
							  }),
						'SystemStatus'
					)
				)
			}
			const processError = (err: any) => {
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.WARNING,
						t('Failed to execute {{actionName}} on device: "{{deviceName}}": {{errorMessage}}', {
							actionName: action.name,
							deviceName: device.name,
							errorMessage: err,
						}),
						'SystemStatus'
					)
				)
			}

			if (action.destructive || action.payload) {
				const payload = {}
				doModalDialog({
					title: translateMessage({ key: action.name, namespaces }, i18nTranslator),
					yes: t('Execute'),
					no: t('Cancel'),
					message: action.payload ? (
						<SchemaFormInPlace
							schema={JSONBlobParse(action.payload)}
							object={payload}
							translationNamespaces={namespaces}
						/>
					) : (
						t('Do you want to execute {{actionName}}? This may the disrupt the output', { actionName: action.name })
					),
					onAccept: (event: any) => {
						callPeripheralDeviceAction(
							event,
							device._id,
							action.timeout || DEFAULT_TSR_ACTION_TIMEOUT_TIME,
							action.id,
							payload
						)
							.then(processResponse)
							.catch(processError)
					},
				})
			} else {
				callPeripheralDeviceAction(event, device._id, action.timeout || DEFAULT_TSR_ACTION_TIMEOUT_TIME, action.id)
					.then(processResponse)
					.catch(processError)
			}
		}

		render(): JSX.Element {
			const { t } = this.props

			const namespaces = ['peripheralDevice_' + this.props.device._id]

			const configManifest = (this.props.parentDevice ?? this.props.device)?.configManifest?.subdeviceManifest?.[
				this.props.device.subType
			]

			return (
				<div key={unprotectString(this.props.device._id)} className="device-item">
					<div className="status-container">
						<StatusCodePill
							connected={this.props.device.connected}
							statusCode={this.props.device?.status.statusCode}
							messages={this.props.device?.status.messages}
						/>

						<div className="device-item__last-seen">
							<label>{t('Last seen')}: </label>
							<div className="value">
								<Moment from={getCurrentTime()} date={this.props.device.lastSeen} />
							</div>
						</div>
					</div>
					<div className="device-item__id">
						<Tooltip
							overlay={t('Connect some devices to the playout gateway')}
							visible={
								getHelpMode() &&
								this.props.device.type === PeripheralDeviceType.PLAYOUT &&
								!this.props.parentDevice &&
								!this.props.hasChildren &&
								this.props.hasChildren !== undefined
							}
							placement="right"
						>
							{getAllowConfigure() ? (
								<div className="value">
									<Link to={'/settings/peripheralDevice/' + this.props.device._id}>{this.props.device.name}</Link>
								</div>
							) : (
								<div className="value">{this.props.device.name}</div>
							)}
						</Tooltip>
					</div>
					{this.props.device.versions ? (
						<div className="device-item__version">
							<label>{t('Version')}: </label>
							<div className="value">
								<a title={this.deviceVersions()} href="#">
									{this.props.device.versions._process || 'N/A'}
								</a>
							</div>
						</div>
					) : null}

					{this.props.debugState ? <DebugStateTable debugState={this.props.debugState} /> : null}

					<div className="actions-container">
						<div className="device-item__actions">
							{configManifest?.actions?.map((action) => (
								<React.Fragment key={action.id}>
									<button
										className="btn btn-secondary"
										onClick={(e) => {
											e.preventDefault()
											e.stopPropagation()
											this.onExecuteAction(e, this.props.device, action)
										}}
									>
										{translateMessage({ key: action.name, namespaces }, i18nTranslator)}
									</button>
								</React.Fragment>
							))}
							{getAllowDeveloper() ? (
								<button
									key="button-ignore"
									className={ClassNames('btn btn-secondary', {
										warn: this.props.device.ignore,
									})}
									onClick={(e) => {
										e.preventDefault()
										e.stopPropagation()
										this.onToggleIgnore(this.props.device)
									}}
									title={
										this.props.device.ignore
											? 'Click to show device status to users'
											: 'Click to hide device status from users'
									}
								>
									<FontAwesomeIcon icon={faEye} />
								</button>
							) : null}
							{this.props.showRemoveButtons ? (
								<button
									key="button-device"
									className="btn btn-primary"
									onClick={(e) => {
										e.preventDefault()
										e.stopPropagation()

										doModalDialog({
											title: t('Delete'),
											message: (
												<p>
													{t('Are you sure you want to delete this device: "{{deviceId}}"?', {
														deviceId: this.props.device.name || this.props.device._id,
													})}
												</p>
											),
											onAccept: () => {
												MeteorCall.peripheralDevice
													.removePeripheralDevice(this.props.device._id)
													.catch(catchError('peripheralDevice.removePeripheralDevice'))
											},
										})
									}}
								>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							) : null}
							{getAllowStudio() && this.props.device.subType === PERIPHERAL_SUBTYPE_PROCESS ? (
								<React.Fragment>
									<button
										className="btn btn-secondary"
										onClick={(e) => {
											e.preventDefault()
											e.stopPropagation()
											e.persist()

											doModalDialog({
												message: t('Are you sure you want to restart this device?'),
												title: t('Restart this Device?'),
												yes: t('Restart'),
												no: t('Cancel'),
												onAccept: () => {
													const { t } = this.props
													PeripheralDevicesAPI.restartDevice(this.props.device, e)
														.then(() => {
															NotificationCenter.push(
																new Notification(
																	undefined,
																	NoticeLevel.NOTIFICATION,
																	t('Device "{{deviceName}}" restarting...', {
																		deviceName: this.props.device.name,
																	}),
																	'SystemStatus'
																)
															)
														})
														.catch((err) => {
															NotificationCenter.push(
																new Notification(
																	undefined,
																	NoticeLevel.WARNING,
																	t('Failed to restart device: "{{deviceName}}": {{errorMessage}}', {
																		deviceName: this.props.device.name,
																		errorMessage: err + '',
																	}),
																	'SystemStatus'
																)
															)
														})
												},
											})
										}}
									>
										{t('Restart')}
									</button>
								</React.Fragment>
							) : null}
						</div>
					</div>

					<div className="clear"></div>
				</div>
			)
		}
	}
)

interface ICoreItemProps {
	systemStatus: StatusResponse | undefined
	coreSystem: ICoreSystem
}

interface ICoreItemState {}

const PackageInfo = require('../../../package.json')

export const CoreItem = reacti18next.withTranslation()(
	class CoreItem extends React.Component<Translated<ICoreItemProps>, ICoreItemState> {
		constructor(props: Translated<ICoreItemProps>) {
			super(props)
			this.state = {}
		}

		render(): JSX.Element {
			const { t } = this.props

			return (
				<div key={unprotectString(this.props.coreSystem._id)} className="device-item">
					<div className="status-container">
						<div
							className={ClassNames(
								'device-status',
								this.props.systemStatus &&
									this.props.systemStatus.status && {
										'device-status--unknown': this.props.systemStatus.status === 'UNDEFINED',
										'device-status--good': this.props.systemStatus.status === 'OK',
										'device-status--warning': this.props.systemStatus.status === 'WARNING',
										'device-status--fatal': this.props.systemStatus.status === 'FAIL',
									}
							)}
						>
							<div className="value">
								<span className="pill device-status__label">
									<a
										href="#"
										title={
											this.props.systemStatus && this.props.systemStatus._internal.messages
												? this.props.systemStatus._internal.messages.join('\n')
												: undefined
										}
									>
										{this.props.systemStatus && this.props.systemStatus.status}
									</a>
								</span>
							</div>
						</div>
					</div>
					<div className="device-item__id">
						<div className="value">
							{t('Sofie Automation Server Core: {{name}}', { name: this.props.coreSystem.name || 'unnamed' })}
						</div>
					</div>
					<div className="device-item__version">
						<label>{t('Version')}: </label>
						<div className="value">{PackageInfo.version || 'UNSTABLE'}</div>
					</div>

					{(getAllowConfigure() || getAllowDeveloper()) && (
						<div className="actions-container">
							<div className="device-item__actions">
								<button
									className="btn btn-secondary"
									onClick={(e) => {
										e.preventDefault()
										e.stopPropagation()

										doModalDialog({
											title: t('Restart this system?'),
											yes: t('Restart'),
											no: t('Cancel'),
											message: (
												<p>
													{t('Are you sure you want to restart this Sofie Automation Server Core: {{name}}?', {
														name: this.props.coreSystem.name || 'unnamed',
													})}
												</p>
											),
											onAccept: (e) => {
												doUserAction(
													t,
													e,
													UserAction.RESTART_CORE,
													(e, ts) =>
														MeteorCall.system.generateSingleUseToken().then((tokenResponse) => {
															if (ClientAPI.isClientResponseError(tokenResponse) || !tokenResponse.result)
																throw tokenResponse
															return MeteorCall.userAction.restartCore(e, ts, hashSingleUseToken(tokenResponse.result))
														}),
													(err, restartMessage) => {
														if (err || !restartMessage) {
															NotificationCenter.push(
																new Notification(
																	undefined,
																	NoticeLevel.CRITICAL,
																	t('Could not restart core: {{err}}', { err }),
																	'SystemStatus'
																)
															)
															return
														}
														let time = 'unknown'
														const match = restartMessage.match(/([\d.]+)s/)
														if (match) {
															time = match[1]
														}
														NotificationCenter.push(
															new Notification(
																undefined,
																NoticeLevel.WARNING,
																t('Sofie Automation Server Core will restart in {{time}}s...', { time }),
																'SystemStatus'
															)
														)
													}
												)
											},
										})
									}}
								>
									{t('Restart')}
								</button>
							</div>
						</div>
					)}

					<div className="clear"></div>
				</div>
			)
		}
	}
)

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

const SystemStatusContent = reacti18next.withTranslation()(
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
						.catch((err) => console.log(`Error fetching device states: ${err}`))
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
