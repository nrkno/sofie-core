import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import {
	PeripheralDevice,
	PeripheralDevices
} from '../../../lib/collections/PeripheralDevices'
import * as i18next from 'react-i18next'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import Moment from 'react-moment'
import { getCurrentTime, getHash } from '../../../lib/lib'
import { Link } from 'react-router-dom'
const Tooltip = require('rc-tooltip')
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faEye from '@fortawesome/fontawesome-free-solid/faEye'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as _ from 'underscore'
import { ModalDialog, doModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { callMethod, callPeripheralDeviceFunction, PeripheralDevicesAPI } from '../../lib/clientAPI'
import { NotificationCenter, NoticeLevel, Notification } from '../../lib/notifications/notifications'
import { getAllowConfigure, getAllowDeveloper, getHelpMode, getAllowService } from '../../lib/localStorage'
import { PubSub } from '../../../lib/api/pubsub'
import * as ClassNames from 'classnames'
import { TSR } from 'tv-automation-sofie-blueprints-integration'
import { CoreSystem, ICoreSystem } from '../../../lib/collections/CoreSystem'
import { SystemStatusAPI, StatusResponse } from '../../../lib/api/systemStatus'
import { doUserAction } from '../../lib/userAction'
import { UserActionAPI } from '../../../lib/api/userActions'

interface IDeviceItemProps {
	// key: string,
	device: PeripheralDevice
	showRemoveButtons?: boolean
	toplevel?: boolean
	hasChildren?: boolean
}
interface IDeviceItemState {
	showDeleteDeviceConfirm: PeripheralDevice | null
	showKillDeviceConfirm: PeripheralDevice | null
}

export function statusCodeToString (t: i18next.TranslationFunction, statusCode: PeripheralDeviceAPI.StatusCode) {
	return (
		statusCode === PeripheralDeviceAPI.StatusCode.UNKNOWN ?
			t('Unknown') :
		statusCode === PeripheralDeviceAPI.StatusCode.GOOD ?
			t('Good') :
		statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MINOR ?
			t('Minor Warning') :
		statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MAJOR ?
			t('Warning') :
		statusCode === PeripheralDeviceAPI.StatusCode.BAD ?
			t('Bad') :
		statusCode === PeripheralDeviceAPI.StatusCode.FATAL ?
			t('Fatal') :
			t('Unknown')
	)
}

export const DeviceItem = i18next.translate()(class extends React.Component<Translated<IDeviceItemProps>, IDeviceItemState> {
	constructor (props: Translated<IDeviceItemProps>) {
		super(props)
		this.state = {
			showDeleteDeviceConfirm: null,
			showKillDeviceConfirm: null
		}
	}
	deviceTypeString () {
		let t = this.props.t

		switch (this.props.device.type) {
			case PeripheralDeviceAPI.DeviceType.MOS:
				return t('MOS Gateway')
			case PeripheralDeviceAPI.DeviceType.PLAYOUT:
				return t('Play-out Gateway')
			case PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER:
				return t('Media Manager')
			default:
				return t('Unknown Device')
		}
	}
	deviceVersions () {
		let versions = this.props.device.versions
		if (versions) {
			return _.map(versions, (version, packageName) => {
				return packageName + ': ' + version
			}).join('\n')
		}
	}
	onDeleteDevice (device: PeripheralDevice) {
		this.setState({
			showDeleteDeviceConfirm: device
		})
	}
	handleConfirmDeleteShowStyleAccept = (e) => {
		if (this.state.showDeleteDeviceConfirm) {
			callMethod(e, 'temporaryRemovePeripheralDevice', this.state.showDeleteDeviceConfirm._id)
			// PeripheralDevices.remove(this.state.showDeleteDeviceConfirm._id)
		}
		// ShowStyles.remove(this.state.deleteConfirmItem._id)
		this.setState({
			showDeleteDeviceConfirm: null
		})
	}

	handleConfirmDeleteShowStyleCancel = (e) => {
		this.setState({
			showDeleteDeviceConfirm: null
		})
	}

	onKillDevice (device: PeripheralDevice) {
		this.setState({
			showKillDeviceConfirm: device
		})
	}
	handleConfirmKillAccept = (e) => {
		const { t } = this.props
		if (this.state.showKillDeviceConfirm) {
			const device = this.state.showKillDeviceConfirm
			PeripheralDevicesAPI.restartDevice(device, e).then((res) => {
				// console.log(res)
				NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, t('Device "{{deviceName}}" restarting...', { deviceName: device.name }), 'SystemStatus'))
			}).catch((err) => {
				// console.error(err)
				NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, t('Failed to restart device: "{{deviceName}}": {{errorMessage}}', { deviceName: device.name, errorMessage: err + '' }), 'SystemStatus'))
			})
		}
		// ShowStyles.remove(this.state.KillConfirmItem._id)
		this.setState({
			showKillDeviceConfirm: null
		})
	}

	handleConfirmKillCancel = (e) => {
		this.setState({
			showKillDeviceConfirm: null
		})
	}

	onToggleIgnore (device: PeripheralDevice) {
		PeripheralDevices.update(device._id, {
			$set: {
				'ignore': !device.ignore
			}
		})
	}

	onRestartCasparCG (device: PeripheralDevice) {
		const { t } = this.props

		doModalDialog({
			title: t('Restart CasparCG Server'),
			message: t('Do you want to restart CasparCG Server?'),
			onAccept: (event: any) => {

				callPeripheralDeviceFunction(event, device._id, 'restartCasparCG', (err, result) => {
					if (err) {
						// console.error(err)
						NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, t('Failed to restart CasparCG on device: "{{deviceName}}": {{errorMessage}}', { deviceName: device.name, errorMessage: err + '' }), 'SystemStatus'))
					} else {
						// console.log(result)
						NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, t('CasparCG on device "{{deviceName}}" restarting...', { deviceName: device.name }), 'SystemStatus'))
					}
				})
			},
		})
	}

	onRestartQuantel (device: PeripheralDevice) {
		const { t } = this.props

		doModalDialog({
			title: t('Restart Quantel Gateway'),
			message: t('Do you want to restart Quantel Gateway?'),
			onAccept: (event: any) => {

				callPeripheralDeviceFunction(event, device._id, 'restartQuantel', (err, result) => {
					if (err) {
						// console.error(err)
						NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, t('Failed to restart Quantel Gateway: {{errorMessage}}', { errorMessage: err + '' }), 'SystemStatus'))
					} else {
						// console.log(result)
						NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, t('Quantel Gateway restarting...'), 'SystemStatus'))
					}
				})
			},
		})
	}

	onFormatHyperdeck (device: PeripheralDevice) {
		const { t } = this.props

		doModalDialog({
			title: t('Format HyperDeck disks'),
			message: t('Do you want to format the HyperDeck disks? This is a destructive action and cannot be undone.'),
			onAccept: (event: any) => {

				callPeripheralDeviceFunction(event, device._id, 'formatHyperdeck', (err, result) => {
					if (err) {
						// console.error(err)
						NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, t('Failed to format HyperDecks on device: "{{deviceName}}": {{errorMessage}}', { deviceName: device.name, errorMessage: err + '' }), 'SystemStatus'))
					} else {
						// console.log(result)
						NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, t('Formatting HyperDeck disks on device "{{deviceName}}"...', { deviceName: device.name }), 'SystemStatus'))
					}
				})
			},
		})
	}

	render () {
		const { t } = this.props

		return (
			<div key={this.props.device._id} className='device-item'>
				<div className='status-container'>
					<PeripheralDeviceStatus device={this.props.device} />

					<div className='device-item__last-seen'>
						<label>{t('Last seen')}: </label>
						<div className='value'>
							<Moment from={getCurrentTime()} date={this.props.device.lastSeen} />
						</div>
					</div>
				</div>
				<div className='device-item__id'>
					<Tooltip
						overlay={t('Connect some devices to the playout gateway')}
						visible={getHelpMode() &&
						this.props.device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT &&
						this.props.toplevel === true &&
						(!this.props.hasChildren && this.props.hasChildren !== undefined)} placement='right'>
						{getAllowConfigure() ?
							<div className='value'><Link to={'/settings/peripheralDevice/' + this.props.device._id}>{this.props.device.name}</Link></div> :
							<div className='value'>{this.props.device.name}</div>
						}
					</Tooltip>
				</div>
				{this.props.device.versions ?
					<div className='device-item__version'>
						<label>{t('Version')}: </label>
						<div className='value'>
							<a title={this.deviceVersions()} href='#'>
								{this.props.device.versions._process || 'N/A'}
							</a>
						</div>
					</div>
				: null}

				<div className='actions-container'>
					<div className='device-item__actions'>
						{(
							this.props.device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT &&
							this.props.device.subType === TSR.DeviceType.CASPARCG ? <React.Fragment>
								<button className='btn btn-secondary' onClick={
									(e) => {
										e.preventDefault()
										e.stopPropagation()
										this.onRestartCasparCG(this.props.device)
									}
								}>
									{t('Restart')}
									{/** IDK what this does, but it doesn't seem to make a lot of sense: JSON.stringify(this.props.device.settings) */}
								</button>
							</React.Fragment> : null
						)}
						{(
							this.props.device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT &&
							this.props.device.subType === TSR.DeviceType.HYPERDECK ? <React.Fragment>
								<button className='btn btn-secondary' onClick={
									(e) => {
										e.preventDefault()
										e.stopPropagation()
										this.onFormatHyperdeck(this.props.device)
									}
								}>
									{t('Format disks')}
								</button>
							</React.Fragment> : null
						)}
						{(
							this.props.device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT &&
							this.props.device.subType === TSR.DeviceType.QUANTEL ? <React.Fragment>
								<button className='btn btn-secondary' onClick={
									(e) => {
										e.preventDefault()
										e.stopPropagation()
										this.onRestartQuantel(this.props.device)
									}
								}>
									{t('Restart Quantel Gateway')}
								</button>
							</React.Fragment> : null
						)}
						<ModalDialog key='modal-device' title={t('Delete this item?')} acceptText={t('Delete')}
							secondaryText={t('Cancel')}
							show={!!this.state.showDeleteDeviceConfirm}
							onAccept={(e) => this.handleConfirmDeleteShowStyleAccept(e)}
							onSecondary={(e) => this.handleConfirmDeleteShowStyleCancel(e)}>
							<p>{t('Are you sure you want to delete this device: "{{deviceId}}"?', { deviceId: this.state.showDeleteDeviceConfirm && (this.state.showDeleteDeviceConfirm.name || this.state.showDeleteDeviceConfirm._id) })}</p>
						</ModalDialog>
						{getAllowDeveloper() && <button key='button-ignore' className={ClassNames('btn btn-secondary', {
							'warn': this.props.device.ignore
						})} onClick={
							(e) => {
								e.preventDefault()
								e.stopPropagation()
								this.onToggleIgnore(this.props.device)
							}
						}>
							<FontAwesomeIcon icon={faEye} />
						</button>}
						{this.props.showRemoveButtons && <button key='button-device' className='btn btn-primary' onClick={
							(e) => {
								e.preventDefault()
								e.stopPropagation()
								this.onDeleteDevice(this.props.device)
							}
						}>
							<FontAwesomeIcon icon={faTrash} />
						</button>}
						{(
							this.props.device.subType === PeripheralDeviceAPI.SUBTYPE_PROCESS
							? <React.Fragment>
								<ModalDialog title={t('Restart this device?')} acceptText={t('Restart')}
									secondaryText={t('Cancel')}
									show={!!this.state.showKillDeviceConfirm}
									onAccept={(e) => this.handleConfirmKillAccept(e)}
									onSecondary={(e) => this.handleConfirmKillCancel(e)}>
									<p>{t('Are you sure you want to restart this device?')}</p>
								</ModalDialog>
								<button className='btn btn-secondary' onClick={
									(e) => {
										e.preventDefault()
										e.stopPropagation()
										this.onKillDevice(this.props.device)
									}
								}>
									{t('Restart')}
								</button>
							</React.Fragment> : null
						)}
					</div>
				</div>

				<div className='clear'></div>
			</div>
		)
	}
})

interface ICoreItemProps {
	systemStatus: StatusResponse | undefined
	coreSystem: ICoreSystem
}

interface ICoreItemState {
	showKillCoreConfirm: boolean
}

const PackageInfo = require('../../../package.json')

export const CoreItem = i18next.translate()(class extends React.Component<Translated<ICoreItemProps>, ICoreItemState> {
	constructor (props: Translated<ICoreItemProps>) {
		super(props)
		this.state = {
			showKillCoreConfirm: false,
		}
	}
	
	onKillCore () {
		this.setState({
			showKillCoreConfirm: true
		})
	}
	handleConfirmKillAccept = (e) => {
		const { t } = this.props
		if (this.state.showKillCoreConfirm) {
			doUserAction(t, e, UserActionAPI.methods.generateRestartToken, [], (err, res) => {
				if (err || !res || !res.result) {
					NotificationCenter.push(new Notification(undefined, NoticeLevel.CRITICAL, t('Could not generate restart token!'), 'SystemStatus'))	
					return
				}

				const restartToken = getHash(UserActionAPI.RESTART_SALT + res.result)

				doUserAction(t, {}, UserActionAPI.methods.restartCore, [ restartToken ], (err, res) => {
					if (err || !res || !res.result) {
						NotificationCenter.push(new Notification(undefined, NoticeLevel.CRITICAL, t('Could not generate restart core: {{err}}', { err }), 'SystemStatus'))	
						return
					}
					let time = 'unknown';
					const match = res.result.match(/([\d\.]+)s/)
					if (match) {
						time = match[1] 
					}
					NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, t('Sofie Automation Server Core will restart in {{time}}s...', { time }), 'SystemStatus'))
				})
			})
		}
		this.setState({
			showKillCoreConfirm: false
		})
	}

	handleConfirmKillCancel = (e) => {
		this.setState({
			showKillCoreConfirm: false
		})
	}

	render () {
		const { t } = this.props

		return (
			<div key={this.props.coreSystem._id} className='device-item'>
				<div className='status-container'>
					<div className={ClassNames('device-status',
							this.props.systemStatus && this.props.systemStatus.status && {
								'device-status--unknown': this.props.systemStatus.status === 'UNDEFINED',
								'device-status--good': this.props.systemStatus.status === 'OK',
								'device-status--warning': this.props.systemStatus.status === 'WARNING',
								'device-status--fatal': this.props.systemStatus.status === 'FAIL',
							}
						)}>
						<div className='value'>
							<span className='pill device-status__label'>
								<a href="#" title={(this.props.systemStatus && this.props.systemStatus._internal.messages) ? this.props.systemStatus._internal.messages.join('\n') : undefined}>{this.props.systemStatus && this.props.systemStatus.status}</a>
							</span>
						</div>
					</div>
				</div>
				<div className='device-item__id'>
					<div className='value'>{t('Sofie Automation Server Core: {{name}}', {name: this.props.coreSystem.name || 'unnamed'})}</div>
				</div>
				<div className='device-item__version'>
					<label>{t('Version')}: </label>
					<div className='value'>
						{PackageInfo.version || 'UNSTABLE'}
					</div>
				</div>

				{(getAllowConfigure() || getAllowDeveloper()) && <div className='actions-container'>
					<div className='device-item__actions'>
						<ModalDialog key='modal-device' title={t('Restart this system?')} acceptText={t('Restart')}
							secondaryText={t('Cancel')}
							show={!!this.state.showKillCoreConfirm}
							onAccept={(e) => this.handleConfirmKillAccept(e)}
							onSecondary={(e) => this.handleConfirmKillCancel(e)}>
							<p>{t('Are you sure you want to restart this Sofie Automation Server Core: {{name}}?', {name: this.props.coreSystem.name || 'unnamed'})}</p>
						</ModalDialog>
						<button className='btn btn-secondary' onClick={
							(e) => {
								e.preventDefault()
								e.stopPropagation()
								this.onKillCore()
							}
						}>
							{t('Restart')}
						</button>
					</div>
				</div>}

				<div className='clear'></div>
			</div>
		)
	}
})

interface ISystemStatusProps {
}
interface ISystemStatusState {
	systemStatus: StatusResponse | undefined
}
interface ISystemStatusTrackedProps {
	coreSystem: ICoreSystem | undefined
	devices: Array<PeripheralDevice>
}

interface DeviceInHierarchy {
	device: PeripheralDevice
	children: Array<DeviceInHierarchy>
}

export default translateWithTracker<ISystemStatusProps, ISystemStatusState, ISystemStatusTrackedProps>((props: ISystemStatusProps) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	return {
		coreSystem: CoreSystem.findOne(),
		devices: PeripheralDevices.find({}, { sort: { lastConnected: -1 } }).fetch()
	}
})(class SystemStatus extends MeteorReactComponent<Translated<ISystemStatusProps & ISystemStatusTrackedProps>, ISystemStatusState> {
	private refreshInterval: NodeJS.Timer | undefined = undefined
	private destroyed: boolean = false

	constructor (props) {
		super(props)

		this.state = {
			systemStatus: undefined
		}
	}

	componentDidMount () {
		this.refreshSystemStatus()
		this.refreshInterval = setInterval(this.refreshSystemStatus, 5000)		

		// Subscribe to data:
		this.subscribe(PubSub.peripheralDevices, {})
	}

	componentWillUnmount () {
		if (this.refreshInterval) clearInterval(this.refreshInterval)
		this.destroyed = true
	}

	refreshSystemStatus = () => {
		const { t } = this.props
		Meteor.call(SystemStatusAPI.getSystemStatus, (err: any, systemStatus: StatusResponse) => {
			if (this.destroyed) return
			if (err) {
				// console.error(err)
				NotificationCenter.push(new Notification('systemStatus_failed', NoticeLevel.CRITICAL, t('Could not get system status. Please consult system administrator.'), 'RundownList'))
				return
			}

			this.setState({
				systemStatus: systemStatus
			})
		})
	}

	renderPeripheralDevices () {
		let devices: Array<DeviceInHierarchy> = []
		let refs = {}
		let devicesToAdd = {}
		// First, add all as references:
		_.each(this.props.devices, (device) => {
			let d: DeviceInHierarchy = {
				device: device,
				children: []
			}
			refs[device._id] = d
			devicesToAdd[device._id] = d
		})
		// Then, map and add devices:
		_.each(devicesToAdd, (d: DeviceInHierarchy) => {
			if (d.device.parentDeviceId) {
				let parent: DeviceInHierarchy = refs[d.device.parentDeviceId]
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

		const getDeviceContent = (d: DeviceInHierarchy, toplevel: boolean): JSX.Element => {
			let content: JSX.Element[] = [
				<DeviceItem key={'device' + d.device._id } device={d.device} toplevel={toplevel} hasChildren={d.children.length !== 0} />
			]
			if (d.children.length) {
				let children: JSX.Element[] = []
				_.each(d.children, (child: DeviceInHierarchy) => (
					children.push(
						<li key={'childdevice' + child.device._id} className='child-device-li'>
							{getDeviceContent(child, false)}
						</li>
					)
				))
				content.push(
					<div key={d.device._id + '_children'} className='children'>
						<ul className='childlist'>
							{children}
						</ul>
					</div>
				)
			}
			return (
				<div key={d.device._id + '_parent'} className='device-item-container'>
					{content}
				</div>
			)
		}

		return <React.Fragment>
			{this.props.coreSystem && <CoreItem coreSystem={this.props.coreSystem} systemStatus={this.state.systemStatus} />}
			{_.map(devices, (d) => getDeviceContent(d, true))}
		</React.Fragment>
	}

	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter system-status'>
				<header className='mbs'>
					<h1>{t('System Status')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderPeripheralDevices()}
				</div>
			</div>
		)
	}
})

interface PeripheralDeviceStatusProps {
	device: PeripheralDevice
}
interface PeripheralDeviceStatusState {

}
export const PeripheralDeviceStatus = i18next.translate()(class PeripheralDeviceStatus extends React.Component<PeripheralDeviceStatusProps & i18next.InjectedTranslateProps, PeripheralDeviceStatusState> {
	constructor (props: PeripheralDeviceStatusProps & i18next.InjectedTranslateProps) {
		super(props)

	}
	statusCodeString () {
		const { t } = this.props

		return this.props.device.connected ? statusCodeToString(t, this.props.device.status.statusCode) : t('Not Connected')
	}
	statusMessages () {
		let messages = ((this.props.device || {}).status || {}).messages || []
		return (
			messages.length ?
			'"' + messages.join(', ') + '"' :
			''
		)
	}
	render () {

		const statusClassNames = [
			'device-status',
			(
				(
					this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.UNKNOWN
					|| !this.props.device.connected
				) ?
					'device-status--unknown' :
				(this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.GOOD) ?
					'device-status--good' :
				(this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MINOR) ?
					'device-status--minor-warning' :
				(this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.WARNING_MAJOR) ?
					'device-status--warning' :
				(this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.BAD) ?
					'device-status--bad' :
				(this.props.device.status.statusCode === PeripheralDeviceAPI.StatusCode.FATAL) ?
					'device-status--fatal' :
				''
			)
		].join(' ')
		return (
			<div className={statusClassNames}>
				<div className='value'>
					<span className='pill device-status__label'>
						{this.statusCodeString()}
					</span>
				</div>
				<div className='device-item__device-status-message'><i>{this.statusMessages()}</i></div>
			</div>
		)
	}
})
