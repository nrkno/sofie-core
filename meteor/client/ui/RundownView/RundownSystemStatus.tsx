import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import ClassNames from 'classnames'
import * as _ from 'underscore'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { Segments } from '../../../lib/collections/Segments'
import { Studio } from '../../../lib/collections/Studios'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { Time, getCurrentTime, unprotectString } from '../../../lib/lib'
import { withTranslation, WithTranslation } from 'react-i18next'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { Parts } from '../../../lib/collections/Parts'
import { scrollToSegment } from '../../lib/viewPort'
import { PartNote, NoteType, GenericNote, TrackedNote } from '../../../lib/api/notes'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PubSub } from '../../../lib/api/pubsub'
import { Settings } from '../../../lib/Settings'

interface IMOSStatusProps {
	lastUpdate: Time
}

export const MOSLastUpdateStatus = withTranslation()(
	class MOSLastUpdateStatus extends React.Component<IMOSStatusProps & WithTranslation> {
		_interval: number

		componentDidMount() {
			this._interval = Meteor.setInterval(() => {
				this.tick()
			}, 5000)
		}

		componentWillUnmount() {
			Meteor.clearInterval(this._interval)
		}

		tick() {
			this.forceUpdate()
		}

		render() {
			const { t } = this.props
			const timeDiff = getCurrentTime() - this.props.lastUpdate
			return (
				<span>
					{timeDiff < 3000 && t('Just now')}
					{timeDiff >= 3000 && timeDiff < 60 * 1000 && t('Less than a minute ago')}
					{timeDiff >= 60 * 1000 && timeDiff < 5 * 60 * 1000 && t('Less than five minutes ago')}
					{timeDiff >= 5 * 60 * 1000 && timeDiff < 10 * 60 * 1000 && t('Around 10 minutes ago')}
					{timeDiff >= 10 * 60 * 1000 && timeDiff < 30 * 60 * 1000 && t('More than 10 minutes ago')}
					{timeDiff >= 30 * 60 * 1000 && timeDiff < 2 * 60 * 60 * 1000 && t('More than 30 minutes ago')}
					{timeDiff >= 2 * 60 * 60 * 1000 && timeDiff < 5 * 60 * 60 * 1000 && t('More than 2 hours ago')}
					{timeDiff >= 5 * 60 * 60 * 1000 && timeDiff < 24 * 60 * 60 * 1000 && t('More than 5 hours ago')}
					{timeDiff >= 24 * 60 * 60 * 1000 && t('More than a day ago')}
				</span>
			)
		}
	}
)

interface IProps {
	studio: Studio
	playlist: RundownPlaylist
	rundownIds: RundownId[]
}

interface IState {
	mosDiff: OnLineOffLineList
	playoutDiff: OnLineOffLineList
	displayNotes: boolean
	forceHideNotification: boolean
	displayNotification: boolean
}

interface OnLineOffLineList {
	onLine: PeripheralDevice[]
	offLine: PeripheralDevice[]
}

interface ITrackedProps {
	mosStatus: PeripheralDeviceAPI.StatusCode
	mosLastUpdate: Time
	mosDevices: OnLineOffLineList
	playoutStatus: PeripheralDeviceAPI.StatusCode
	playoutDevices: OnLineOffLineList
}

function diffOnLineOffLineList(prevList: OnLineOffLineList, list: OnLineOffLineList): OnLineOffLineList {
	const diff: OnLineOffLineList = {
		onLine: [],
		offLine: [],
	}

	list.onLine.forEach((i) => {
		if (!prevList.onLine.find((j) => j._id === i._id)) {
			diff.onLine.push(i)
		}
	})
	list.offLine.forEach((i) => {
		if (!prevList.offLine.find((j) => j._id === i._id)) {
			diff.offLine.push(i)
		}
	})

	return diff
}

export const RundownSystemStatus = translateWithTracker(
	(props: IProps) => {
		let attachedDevices: PeripheralDevice[] = []

		const parentDevices = PeripheralDevices.find({
			studioId: props.studio._id,
		}).fetch()
		attachedDevices = attachedDevices.concat(parentDevices)

		const subDevices = PeripheralDevices.find({
			parentDeviceId: { $in: _.pluck(parentDevices, '_id') },
		}).fetch()
		attachedDevices = attachedDevices.concat(subDevices)

		let ingestDevices = attachedDevices.filter(
			(i) =>
				i.category === PeripheralDeviceAPI.DeviceCategory.INGEST ||
				i.category === PeripheralDeviceAPI.DeviceCategory.MEDIA_MANAGER
		)
		let playoutDevices = attachedDevices.filter((i) => i.type === PeripheralDeviceAPI.DeviceType.PLAYOUT)

		const [ingest, playout] = _.map([ingestDevices, playoutDevices], (devices) => {
			const status = _.reduce(
				devices.filter((i) => !i.ignore),
				(memo: PeripheralDeviceAPI.StatusCode, device: PeripheralDevice) => {
					if (device.connected && memo.valueOf() < device.status.statusCode.valueOf()) {
						return device.status.statusCode
					} else if (!device.connected) {
						return PeripheralDeviceAPI.StatusCode.FATAL
					} else {
						return memo
					}
				},
				PeripheralDeviceAPI.StatusCode.UNKNOWN
			)
			const onlineOffline: OnLineOffLineList = {
				onLine: devices.filter(
					(device) => device.connected && device.status.statusCode < PeripheralDeviceAPI.StatusCode.WARNING_MINOR
				),
				offLine: devices.filter(
					(device) => !device.connected || device.status.statusCode >= PeripheralDeviceAPI.StatusCode.WARNING_MINOR
				),
			}
			const lastUpdate = _.reduce(devices, (memo, device) => Math.max(device.lastDataReceived || 0, memo), 0)
			return {
				status: status,
				lastUpdate: lastUpdate,
				onlineOffline: onlineOffline,
			}
		})

		return {
			mosStatus: ingest.status,
			mosDevices: ingest.onlineOffline,
			mosLastUpdate: ingest.lastUpdate,

			playoutStatus: playout.status,
			playoutDevices: playout.onlineOffline,
		}
	},
	(data, props: IProps, nextProps: IProps) => {
		if (props.playlist._id === nextProps.playlist._id && props.studio._id === nextProps.studio._id) return false
		return true
	}
)(
	class RundownSystemStatus extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
		private notificationTimeout: number
		private STATE_CHANGE_NOTIFICATION_DURATION = 7000

		constructor(props: Translated<IProps & ITrackedProps>) {
			super(props)

			this.state = {
				mosDiff: {
					onLine: [],
					offLine: props.mosDevices.offLine,
				},
				playoutDiff: {
					onLine: [],
					offLine: props.playoutDevices.offLine,
				},
				displayNotes: false,
				forceHideNotification: false,
				displayNotification: false,
			}
		}

		componentDidMount() {
			this.subscribe(PubSub.peripheralDevicesAndSubDevices, {
				studioId: this.props.studio._id,
			})
		}

		componentWillUnmount() {
			super.componentWillUnmount()

			if (this.notificationTimeout) Meteor.clearTimeout(this.notificationTimeout)
		}

		componentDidUpdate(prevProps: IProps & ITrackedProps) {
			if (prevProps !== this.props) {
				if (this.notificationTimeout) Meteor.clearTimeout(this.notificationTimeout)

				const mosDiff = diffOnLineOffLineList(prevProps.mosDevices, this.props.mosDevices)
				const playoutDiff = diffOnLineOffLineList(prevProps.playoutDevices, this.props.playoutDevices)

				this.setState({
					mosDiff,
					playoutDiff,
					forceHideNotification: false,
					displayNotification:
						mosDiff.offLine.length !== 0 ||
						playoutDiff.offLine.length !== 0 ||
						mosDiff.onLine.length !== 0 ||
						playoutDiff.onLine.length !== 0,
				})

				this.notificationTimeout = Meteor.setTimeout(() => {
					this.setState({
						displayNotification: false,
					})
				}, this.STATE_CHANGE_NOTIFICATION_DURATION)
			}
		}
		clickNote(e, note: TrackedNote) {
			e.preventDefault()

			let segmentId = note.origin.segmentId

			if (!segmentId) {
				if (note.origin.partId) {
					let part = Parts.findOne(note.origin.partId)
					if (part) {
						segmentId = part.segmentId
					}
				}
			}
			if (segmentId) {
				scrollToSegment(segmentId).catch(console.error)
			}
		}
		clickNotes() {
			this.setState({
				displayNotes: !this.state.displayNotes,
			})
		}
		forceHideNotification = () => {
			this.setState({
				forceHideNotification: true,
			})
		}
		render() {
			const { t } = this.props
			const playoutDevicesIssues = this.props.playoutDevices.offLine.filter((dev) => dev.connected)
			const mosDevicesIssues = this.props.mosDevices.offLine.filter((dev) => dev.connected)
			const mosDisconnected = this.props.mosDevices.offLine.filter((dev) => !dev.connected)
			const playoutDisconnected = this.props.playoutDevices.offLine.filter((dev) => !dev.connected)

			return (
				<div className="rundown-system-status">
					<div className="rundown-system-status__indicators">
						<div
							className={ClassNames('indicator', 'mos', {
								good: this.props.mosStatus === PeripheralDeviceAPI.StatusCode.GOOD,
								minor: this.props.mosStatus === PeripheralDeviceAPI.StatusCode.WARNING_MINOR,
								major: this.props.mosStatus === PeripheralDeviceAPI.StatusCode.WARNING_MAJOR,
								bad: this.props.mosStatus === PeripheralDeviceAPI.StatusCode.BAD,
								fatal: this.props.mosStatus === PeripheralDeviceAPI.StatusCode.FATAL,
							})}>
							<div className="indicator__tooltip">
								<h4>{t('{{nrcsName}} Connection', { nrcsName: Settings.nrcsName })}</h4>
								<div>
									<h5>{t('Last update')}</h5>
									<MOSLastUpdateStatus lastUpdate={this.props.mosLastUpdate} />
								</div>
								<div>
									{this.props.mosDevices.offLine.length > 0 ? (
										<React.Fragment>
											{mosDisconnected.length ? (
												<React.Fragment>
													<h5>{t('Off-line devices')}</h5>
													<ul>
														{mosDisconnected.map((device) => {
															return <li key={unprotectString(device._id)}>{device.name}</li>
														})}
													</ul>
												</React.Fragment>
											) : null}
											{mosDevicesIssues.length ? (
												<React.Fragment>
													<h5>{t('Devices with issues')}</h5>
													<ul>
														{mosDevicesIssues.map((device) => {
															return <li key={unprotectString(device._id)}>{device.name}</li>
														})}
													</ul>
												</React.Fragment>
											) : null}
										</React.Fragment>
									) : (
										<span>{t('All connections working correctly')}</span>
									)}
								</div>
							</div>
						</div>
						<div
							className={ClassNames('indicator', 'playout', {
								good: this.props.playoutStatus === PeripheralDeviceAPI.StatusCode.GOOD,
								minor: this.props.playoutStatus === PeripheralDeviceAPI.StatusCode.WARNING_MINOR,
								major: this.props.playoutStatus === PeripheralDeviceAPI.StatusCode.WARNING_MAJOR,
								bad: this.props.playoutStatus === PeripheralDeviceAPI.StatusCode.BAD,
								fatal: this.props.playoutStatus === PeripheralDeviceAPI.StatusCode.FATAL,
							})}>
							<div className="indicator__tooltip">
								<h4>{t('Play-out')}</h4>
								<div>
									{this.props.playoutDevices.offLine.length > 0 ? (
										<React.Fragment>
											{playoutDisconnected.length ? (
												<React.Fragment>
													<h5>{t('Off-line devices')}</h5>
													<ul>
														{playoutDisconnected.map((device) => {
															return <li key={unprotectString(device._id)}>{device.name}</li>
														})}
													</ul>
												</React.Fragment>
											) : null}
											{playoutDevicesIssues.length ? (
												<React.Fragment>
													<h5>{t('Devices with issues')}</h5>
													<ul>
														{playoutDevicesIssues.map((device) => {
															return <li key={unprotectString(device._id)}>{device.name}</li>
														})}
													</ul>
												</React.Fragment>
											) : null}
										</React.Fragment>
									) : (
										<span>{t('All devices working correctly')}</span>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			)
		}
	}
)
