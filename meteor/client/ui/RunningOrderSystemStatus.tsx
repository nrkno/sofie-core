import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import { translateWithTracker, Translated } from '../lib/ReactMeteorData/ReactMeteorData'
import { PeripheralDevice, PeripheralDevices, MosDevice } from '../../lib/collections/PeripheralDevices'
import { RunningOrder } from '../../lib/collections/RunningOrders'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { Time, getCurrentTime } from '../../lib/lib'
import { translate, InjectedTranslateProps } from 'react-i18next'

interface IMOSStatusProps {
	lastUpdate: Time
}

export const MOSLastUpdateStatus = translate()(class extends React.Component<IMOSStatusProps & InjectedTranslateProps> {
	_interval: number

	componentDidMount () {
		this._interval = Meteor.setInterval(() => {
			this.tick()
		}, 5000)
	}

	componentWillUnmount () {
		Meteor.clearInterval(this._interval)
	}

	tick () {
		this.forceUpdate()
	}

	render () {
		const { t } = this.props
		const timeDiff = getCurrentTime() - this.props.lastUpdate
		return (
			<span>
				{ timeDiff < 3000 && t('Just now') }
				{ timeDiff >= 3000 && timeDiff < 60 * 1000 && t('Less than a minute ago') }
				{ timeDiff >= 60 * 1000 && timeDiff < 5 * 60 * 1000 && t('Less than five minutes ago') }
				{ timeDiff >= 5 * 60 * 1000 && timeDiff < 10 * 60 * 1000 && t('Around 10 minutes ago') }
				{ timeDiff >= 10 * 60 * 1000 && timeDiff < 30 * 60 * 1000 && t('More than 10 minutes ago') }
				{ timeDiff >= 30 * 60 * 1000 && timeDiff < 2 * 60 * 60 * 1000 && t('More than 30 minutes ago') }
				{ timeDiff >= 2 * 60 * 60 * 1000 && timeDiff < 5 * 60 * 60 * 1000 && t('More than 2 hours ago') }
				{ timeDiff >= 5 * 60 * 60 * 1000 && timeDiff < 24 * 60 * 60 * 1000 && t('More than 5 hours ago') }
				{ timeDiff >= 24 * 60 * 60 * 1000 && t('More than a day ago')}
			</span>
		)
	}
})

interface IProps {
	studioInstallation?: StudioInstallation
}

interface IState {
	mosDiff: OnLineOffLineList
	playoutDiff: OnLineOffLineList
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

function diffOnLineOffLineList (prevList: OnLineOffLineList, list: OnLineOffLineList): OnLineOffLineList {
	const diff: OnLineOffLineList = {
		onLine: [],
		offLine: []
	}

	list.onLine.forEach((i) => {
		if (!prevList.onLine.find(j => j._id === i._id)) {
			diff.onLine.push(i)
		}
	})
	list.offLine.forEach((i) => {
		if (!prevList.offLine.find(j => j._id === i._id)) {
			diff.offLine.push(i)
		}
	})

	return diff
}

export const RunningOrderSystemStatus = translateWithTracker((props: IProps) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());
	if (!props.studioInstallation) {
		return {}
	}

	const attachedDevices = PeripheralDevices.find({
		studioInstallationId: props.studioInstallation._id
	}).fetch()

	let mosDevices = attachedDevices.filter(i => i.type === PeripheralDeviceAPI.DeviceType.MOSDEVICE)
	let playoutDevices = attachedDevices.filter(i => i.type === PeripheralDeviceAPI.DeviceType.PLAYOUT)

	let playoutChildren: PeripheralDevice[] = []
	playoutDevices.forEach((i) => {
		playoutChildren = playoutChildren.concat(attachedDevices.filter(j => j.parentDeviceId === i._id))
	})

	let mosChildren: PeripheralDevice[] = []
	mosDevices.forEach((i) => {
		mosChildren = mosChildren.concat(attachedDevices.filter(j => j.parentDeviceId === i._id))
	})

	playoutDevices = playoutDevices.concat(playoutChildren)
	mosDevices = mosDevices.concat(mosChildren)

	const mosStatus = _.reduce(mosDevices, (memo: PeripheralDeviceAPI.StatusCode, item: PeripheralDevice) => {
		if (item.connected && memo.valueOf() < item.status.statusCode.valueOf()) {
			return item.status.statusCode
		} else if (!item.connected) {
			return PeripheralDeviceAPI.StatusCode.FATAL
		} else {
			return memo
		}
	})
	const mosOnlineOffline: OnLineOffLineList = {
		onLine: mosDevices.filter(i => i.connected),
		offLine: mosDevices.filter(i => !i.connected)
	}
	const mosLastUpdate = _.reduce(mosDevices, (memo, item: MosDevice) => Math.max(item.lastDataReceived || 0, memo), 0)
	const playoutStatus = _.reduce(playoutDevices, (memo: PeripheralDeviceAPI.StatusCode, item: PeripheralDevice) => {
		if (item.connected && memo.valueOf() < item.status.statusCode.valueOf()) {
			return item.status.statusCode
		} else if (!item.connected) {
			return PeripheralDeviceAPI.StatusCode.FATAL
		} else {
			return memo
		}
	}, PeripheralDeviceAPI.StatusCode.UNKNOWN)
	const playoutOnlineOffline: OnLineOffLineList = {
		onLine: playoutDevices.filter(i => i.connected),
		offLine: playoutDevices.filter(i => !i.connected)
	}

	return {
		mosStatus,
		mosLastUpdate,
		playoutStatus,
		mosDevices: mosOnlineOffline,
		playoutDevices: playoutOnlineOffline
	}
})(class extends React.Component<Translated<IProps & ITrackedProps>, IState> {
	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)

		this.state = {
			mosDiff: {
				onLine: [],
				offLine: props.mosDevices.offLine
			},
			playoutDiff: {
				onLine: [],
				offLine: props.playoutDevices.offLine
			}
		}
	}

	componentDidUpdate (prevProps: IProps & ITrackedProps) {
		if (prevProps !== this.props) {
			this.setState({
				mosDiff: diffOnLineOffLineList(prevProps.mosDevices, this.props.mosDevices),
				playoutDiff: diffOnLineOffLineList(prevProps.playoutDevices, this.props.playoutDevices)
			})
		}
	}

	render () {
		return (
			<div className='running-order-system-status'>
				<div className='running-order-system-status__indicators'>
					<div className={ClassNames('indicator', 'mos', {
						'good': this.props.mosStatus === PeripheralDeviceAPI.StatusCode.GOOD,
						'minor': this.props.mosStatus === PeripheralDeviceAPI.StatusCode.WARNING_MINOR,
						'major': this.props.mosStatus === PeripheralDeviceAPI.StatusCode.WARNING_MAJOR,
						'bad': this.props.mosStatus === PeripheralDeviceAPI.StatusCode.BAD,
						'fatal': this.props.mosStatus === PeripheralDeviceAPI.StatusCode.FATAL,
					})}>
						<div className='indicator__tooltip'>
							<h4>MOS Connection</h4>
							<div>
								<h5>Last update</h5>
								<MOSLastUpdateStatus lastUpdate={this.props.mosLastUpdate} />
							</div>
							<div>
								{
									this.props.mosDevices.offLine.length > 0 ?
										<React.Fragment>
											<h5>Off-line devices</h5>
											<ul>
												{ this.props.mosDevices.offLine.map((dev) => {
													return <li key={dev._id}>{dev.name}</li>
												})}
											</ul>
										</React.Fragment>
									:
										<span>All connections working correctly</span>
								}
							</div>
						</div>
					</div>
					<div className={ClassNames('indicator', 'playout', {
						'good': this.props.playoutStatus === PeripheralDeviceAPI.StatusCode.GOOD,
						'minor': this.props.playoutStatus === PeripheralDeviceAPI.StatusCode.WARNING_MINOR,
						'major': this.props.playoutStatus === PeripheralDeviceAPI.StatusCode.WARNING_MAJOR,
						'bad': this.props.playoutStatus === PeripheralDeviceAPI.StatusCode.BAD,
						'fatal': this.props.playoutStatus === PeripheralDeviceAPI.StatusCode.FATAL,
					})}>
						<div className='indicator__tooltip'>
							<h4>Playout</h4>
							<div>
								{
									this.props.playoutDevices.offLine.length > 0 ?
										<React.Fragment>
											<h5>Off-line devices</h5>
											<ul>
												{this.props.playoutDevices.offLine.map((dev) => {
													return <li key={dev._id}>{dev.name}</li>
												})}
											</ul>
										</React.Fragment>
									:
										<span>All devices working correctly</span>
								}
							</div>
						</div>
					</div>
				</div>
				<div className='running-order-system-status__message'>
					{this.makeNotification()}
				</div>
			</div>
		)
	}

	private makeNotification (): string {
		let result = ''
		if (this.state.mosDiff.offLine.length > 0 || this.state.playoutDiff.offLine.length > 0) {
			result += this.state.mosDiff.offLine.map((i) => i.name)
				.concat(this.state.playoutDiff.offLine.map((i) => i.name)).join(', ') + ' have gone off-line.'
		}
		if (this.state.mosDiff.onLine.length > 0 || this.state.playoutDiff.onLine.length > 0) {
			result += this.state.mosDiff.onLine.map((i) => i.name)
				.concat(this.state.playoutDiff.onLine.map((i) => i.name)).join(', ') + ' is back on-line.'
		}
		return result
	}
})
