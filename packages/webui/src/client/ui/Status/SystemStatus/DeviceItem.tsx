import React, { useContext } from 'react'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import {
	PeripheralDevice,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { unprotectString } from '../../../lib/tempLib'
import { getCurrentTime } from '../../../lib/systemTime'
import { Link } from 'react-router-dom'
import Tooltip from 'rc-tooltip'
import { faTrash, faEye } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { doModalDialog } from '../../../lib/ModalDialog'
import { callPeripheralDeviceAction, PeripheralDevicesAPI } from '../../../lib/clientAPI'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications'
import { getHelpMode } from '../../../lib/localStorage'
import ClassNames from 'classnames'
import { TSR } from '@sofie-automation/blueprints-integration'
import { MeteorCall } from '../../../lib/meteorApi'
import { DEFAULT_TSR_ACTION_TIMEOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'
import { SubdeviceAction } from '@sofie-automation/shared-lib/dist/core/deviceConfigManifest'
import { StatusCodePill } from '../StatusCodePill'
import { isTranslatableMessage, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { i18nTranslator } from '../../i18n'
import { SchemaFormInPlace } from '../../../lib/forms/SchemaFormInPlace'
import { PeripheralDevices } from '../../../collections'
import { DebugStateTable } from '../DebugState'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { catchError } from '../../../lib/lib'
import { UserPermissionsContext, UserPermissions } from '../../UserPermissions'

interface IDeviceItemProps {
	parentDevice: PeripheralDevice | null
	device: PeripheralDevice
	showRemoveButtons?: boolean
	hasChildren?: boolean

	debugState: object | undefined
}
interface IDeviceItemState {}

export function DeviceItem(props: IDeviceItemProps): JSX.Element {
	const { t, i18n, ready } = useTranslation()

	const userPermissions = useContext(UserPermissionsContext)

	return <DeviceItemInner {...props} t={t} tReady={ready} i18n={i18n} userPermissions={userPermissions} />
}

interface DeviceItemInnerProps extends Translated<IDeviceItemProps> {
	userPermissions: Readonly<UserPermissions>
}

class DeviceItemInner extends React.Component<DeviceItemInnerProps, IDeviceItemState> {
	private deviceVersions() {
		const versions = this.props.device.versions
		if (versions) {
			return Object.entries<string>(versions)
				.map((version, packageName) => {
					return packageName + ': ' + version
				})
				.join('\n')
		}
	}
	private onToggleIgnore(device: PeripheralDevice) {
		PeripheralDevices.update(device._id, {
			$set: {
				ignore: !device.ignore,
			},
		})
	}
	private onExecuteAction(event: any, device: PeripheralDevice, action: SubdeviceAction) {
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
						{this.props.userPermissions.configure ? (
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
						{this.props.userPermissions.developer ? (
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
						{this.props.userPermissions.studio && this.props.device.subType === PERIPHERAL_SUBTYPE_PROCESS ? (
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
