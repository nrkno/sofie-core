import * as React from 'react'
import Tooltip from 'rc-tooltip'
import { Studio } from '../../../../lib/collections/Studios'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons'
import { PeripheralDevice, PeripheralDeviceType } from '../../../../lib/collections/PeripheralDevices'
import { Link } from 'react-router-dom'
import { MomentFromNow } from '../../../lib/Moment'
import { withTranslation } from 'react-i18next'
import { getHelpMode } from '../../../lib/localStorage'
import { unprotectString } from '../../../../lib/lib'
import { PeripheralDevices } from '../../../collections'

interface IStudioDevicesProps {
	studio: Studio
	studioDevices: Array<PeripheralDevice>
	availableDevices: Array<PeripheralDevice>
}
interface IStudioDevicesSettingsState {
	showAvailableDevices: boolean
}
export const StudioDevices = withTranslation()(
	class StudioDevices extends React.Component<Translated<IStudioDevicesProps>, IStudioDevicesSettingsState> {
		constructor(props: Translated<IStudioDevicesProps>) {
			super(props)

			this.state = {
				showAvailableDevices: false,
			}
		}

		onRemoveDevice = (item: PeripheralDevice) => {
			PeripheralDevices.update(item._id, {
				$unset: {
					studioId: 1,
				},
			})
		}

		onAddDevice = (item: PeripheralDevice) => {
			PeripheralDevices.update(item._id, {
				$set: {
					studioId: this.props.studio._id,
				},
			})
		}
		confirmRemove = (device: PeripheralDevice) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this device?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.onRemoveDevice(device)
				},
				message: (
					<p>
						{t('Are you sure you want to remove device "{{deviceId}}"?', {
							deviceId: device && (device.name || device._id),
						})}
					</p>
				),
			})
		}

		renderDevices() {
			return this.props.studioDevices.map((device) => {
				return (
					<tr key={unprotectString(device._id)}>
						<th className="settings-studio-device__name c3">
							<Link to={'/settings/peripheralDevice/' + device._id}>{device.name}</Link>
						</th>
						<td className="settings-studio-device__id c3">{device._id}</td>
						<td className="settings-studio-device__id c3">
							<MomentFromNow date={device.lastSeen} />
						</td>
						<td className="settings-studio-device__actions table-item-actions c3">
							<button className="action-btn" onClick={() => this.confirmRemove(device)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
				)
			})
		}

		showAvailableDevices() {
			this.setState({
				showAvailableDevices: !this.state.showAvailableDevices,
			})
		}

		isPlayoutConnected(): boolean {
			return !!this.props.studioDevices.find((device) => device.type === PeripheralDeviceType.PLAYOUT)
		}

		render(): JSX.Element {
			const { t } = this.props
			return (
				<div>
					<h2 className="mhn">
						<Tooltip
							overlay={t('Devices are needed to control your studio hardware')}
							visible={getHelpMode() && !this.props.studioDevices.length}
							placement="right"
						>
							<span>{t('Attached Devices')}</span>
						</Tooltip>
					</h2>
					&nbsp;
					{!this.props.studioDevices.length ? (
						<div className="error-notice">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No devices connected')}
						</div>
					) : null}
					{!this.isPlayoutConnected() ? (
						<div className="error-notice">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('Playout gateway not connected')}
						</div>
					) : null}
					<table className="expando settings-studio-device-table">
						<tbody>{this.renderDevices()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={() => this.showAvailableDevices()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
						{this.state.showAvailableDevices && (
							<div className="border-box text-s studio-devices-dropdown">
								<div className="ctx-menu">
									{this.props.availableDevices.map((device) => {
										return (
											<div
												className="ctx-menu-item"
												key={unprotectString(device._id)}
												onClick={() => this.onAddDevice(device)}
											>
												<b>{device.name}</b> <MomentFromNow date={device.lastSeen} /> ({unprotectString(device._id)})
											</div>
										)
									})}
								</div>
							</div>
						)}
					</div>
				</div>
			)
		}
	}
)
