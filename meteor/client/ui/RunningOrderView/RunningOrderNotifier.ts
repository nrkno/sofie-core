import * as React from 'react'
import * as _ from 'underscore'
import { Tracker } from 'meteor/tracker'
import { Meteor } from 'meteor/meteor'


import { NotificationCenter, NotificationList, NotifierObject, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RunningOrderAPI } from '../../../lib/api/runningOrder'

import { ReactiveDataHelper, WithManagedTracker } from '../../lib/reactiveData/reactiveDataHelper'
import { reactiveData } from '../../lib/reactiveData/reactiveData'
import { checkSLIContentStatus } from '../../../lib/mediaObjects'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { ShowStyleBases, ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { SegmentLines, SegmentLineNote, SegmentLineNoteType } from '../../../lib/collections/SegmentLines'
import { getCurrentTime } from '../../../lib/lib'
import { ReactiveVar } from 'meteor/reactive-var'
import { Segments } from '../../../lib/collections/Segments'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { RunningOrders } from '../../../lib/collections/RunningOrders'

export const onRONotificationClick = new ReactiveVar<((e: RONotificationEvent) => void) | undefined>(undefined)

export interface RONotificationEvent {
	sourceLocator: {
		name: string,
		roId?: string,
		segmentId?: string,
		segmentLineId?: string,
		segmentLineItemId?: string
	}
}

class RunningOrderViewNotifier extends WithManagedTracker {
	private _notificationList: NotificationList
	private _notifier: NotifierObject

	private _mediaStatus: _.Dictionary<Notification | undefined> = {}
	private _mediaStatusDep: Tracker.Dependency

	private _notes: _.Dictionary<Notification | undefined> = {}
	private _notesDep: Tracker.Dependency

	private _deviceStatus: _.Dictionary<Notification | undefined> = {}
	private _deviceStatusDep: Tracker.Dependency

	private _runningOrderId: ReactiveVar<string | undefined>
	private _studioId: ReactiveVar<string | undefined>

	constructor () {
		super()
		this._notificationList = new NotificationList([])
		this._mediaStatusDep = new Tracker.Dependency()
		this._deviceStatusDep = new Tracker.Dependency()
		this._notesDep = new Tracker.Dependency()
		this._runningOrderId = new ReactiveVar<string | undefined>(undefined)
		this._studioId = new ReactiveVar<string | undefined>(undefined)

		this._notifier = NotificationCenter.registerNotifier((): NotificationList => {
			return this._notificationList
		})
		ReactiveDataHelper.registerComputation('RunningOrderView.MediaObjectStatus', this.autorun(() => {
			let roId = this._runningOrderId.get()
			if (roId === undefined) {
				const studioId = this._studioId.get()
				const ro = RunningOrders.findOne({
					active: true,
					studioInstallationId: studioId
				})
				if (ro) {
					roId = ro._id
				} else {
					roId = ''
				}
			}
			const rRunningOrderId = reactiveData.getRRunningOrderId(roId).get()

			if (rRunningOrderId) {
				const studioInstallationId = reactiveData.getRRunningOrderStudioId(rRunningOrderId).get()
				const showStyleBaseId = reactiveData.getRRunningOrderShowStyleBaseId(rRunningOrderId).get()
				ReactiveDataHelper.registerComputation('RunningOrderView.MediaObjectStatus.StudioInstallation', this.autorun(() => {
					const studioInstallation = StudioInstallations.findOne(studioInstallationId)
					const showStyleBase = ShowStyleBases.findOne(showStyleBaseId)
					if (showStyleBase && studioInstallation) {
						this.reactiveMediaStatus(rRunningOrderId, showStyleBase, studioInstallation)
						this.reactiveSLNotes(rRunningOrderId)
						this.reactivePeripheralDeviceStatus(studioInstallationId)
					} else {
						ReactiveDataHelper.stopComputation('RunningOrderView.MediaObjectStatus.SegmentLineItems')
						ReactiveDataHelper.stopComputation('RunningOrderView.PeripheralDevices')
						ReactiveDataHelper.stopComputation('RunningOrderView.SegmentLineNotes')
						this.cleanUpMediaStatus()
					}
				}))
			} else {
				ReactiveDataHelper.stopComputation('RunningOrderView.MediaObjectStatus.StudioInstallation')
				this._mediaStatus = {}
				this._deviceStatus = {}
				this._notes = {}
				this.cleanUpMediaStatus()
			}
		}))

		this.autorun((comp) => {
			this._mediaStatusDep.depend()
			this._deviceStatusDep.depend()
			this._notesDep.depend()

			const notifications = _.compact(_.values(this._mediaStatus))
				.concat(_.compact(_.values(this._deviceStatus)))
				.concat(_.compact(_.values(this._notes)))

			this._notificationList.set(
				notifications
			)
		})
	}

	setRunningOrderId (id: string | undefined) {
		this._runningOrderId.set(id)
	}

	setStudioId (id: string | undefined) {
		this._studioId.set(id)
	}

	stop () {
		super.stop()

		this._notifier.stop()

		ReactiveDataHelper.stopComputation('RunningOrderView.MediaObjectStatus')
	}

	private reactivePeripheralDeviceStatus (studioInstallationId: string | undefined) {
		let oldDevItemIds: Array<string> = []
		let reactivePeripheralDevices: ReactiveVar<PeripheralDevice[]>
		if (studioInstallationId) {
			Meteor.subscribe('peripheralDevicesAndSubDevices', { studioInstallationId: studioInstallationId })
			reactivePeripheralDevices = reactiveData.getRPeripheralDevices(studioInstallationId)
		}
		ReactiveDataHelper.registerComputation('RunningOrderView.PeripheralDevices', this.autorun(() => {
			const devices = reactivePeripheralDevices ? reactivePeripheralDevices.get() : []
			const newDevItemIds = devices.map(item => item._id)

			devices.forEach((item) => {
				let newNotification: Notification | undefined = undefined

				if (item.status.statusCode !== PeripheralDeviceAPI.StatusCode.GOOD || !item.connected) {
					newNotification = new Notification(item._id, this.convertDeviceStatus(item), this.makeDeviceMessage(item), 'Devices', getCurrentTime(), true, undefined, -1)
				}
				if (newNotification && !Notification.isEqual(this._deviceStatus[item._id], newNotification)) {
					this._deviceStatus[item._id] = newNotification
					this._deviceStatusDep.changed()
				} else if (!newNotification && this._deviceStatus[item._id]) {
					delete this._deviceStatus[item._id]
					this._deviceStatusDep.changed()
				}
			})

			_.difference(oldDevItemIds, newDevItemIds).forEach((item) => {
				delete this._deviceStatus[item]
				this._deviceStatusDep.changed()
			})
			oldDevItemIds = newDevItemIds
		}))
	}

	private reactiveSLNotes (rRunningOrderId: string) {
		let oldNoteIds: Array<string> = []
		ReactiveDataHelper.registerComputation('RunningOrderView.SegmentLineNotes', this.autorun(() => {
			const segments = Segments.find({
				runningOrderId: rRunningOrderId
			}).fetch()

			const newNoteIds: Array<string> = []
			_.flatten(_.compact(segments.map(i => i.getNotes(true).map(j => _.extend(j, {
				rank: i._rank
			}))))).forEach((item: SegmentLineNote & {rank: number}) => {
				const id = item.message + '-' + (item.origin.segmentLineItemId || item.origin.segmentLineId || item.origin.segmentId || item.origin.roId) + '-' + item.origin.name + '-' + item.type
				let newNotification = new Notification(id, item.type === SegmentLineNoteType.ERROR ? NoticeLevel.CRITICAL : NoticeLevel.WARNING, (item.origin.name ? item.origin.name + ': ' : '') + item.message, item.origin.segmentId || 'unknown', getCurrentTime(), true, [
					{
						label: 'Show issue',
						type: 'default'
					}
				], item.rank)
				newNotification.on('action', (notification, type, e) => {
					switch (type) {
						case 'default':
							const handler = onRONotificationClick.get()
							if (handler && typeof handler === 'function') {
								handler({
									sourceLocator: item.origin
								})
							}
					}
				})
				newNoteIds.push(id)

				if (!this._notes[id] || (!Notification.isEqual(newNotification, this._notes[id]))) {
					this._notes[id] = newNotification
					this._notesDep.changed()
				}
			})

			_.difference(oldNoteIds, newNoteIds).forEach((item) => {
				delete this._notes[item]
				this._notesDep.changed()
			})
			oldNoteIds = newNoteIds
		}))
	}

	private reactiveMediaStatus (rRunningOrderId: string, showStyleBase: ShowStyleBase, studioInstallation: StudioInstallation) {
		let oldItemIds: Array<string> = []
		ReactiveDataHelper.registerComputation('RunningOrderView.MediaObjectStatus.SegmentLineItems', this.autorun((comp: Tracker.Computation) => {
			const items = reactiveData.getRSegmentLineItems(rRunningOrderId).get()
			const newItemIds = items.map(item => item._id)
			items.forEach((item) => {
				const sourceLayer = reactiveData.getRSourceLayer(showStyleBase, item.sourceLayerId).get()
				const segmentLine = SegmentLines.findOne(item.segmentLineId)
				const segment = segmentLine ? Segments.findOne(segmentLine.segmentId) : undefined
				if (sourceLayer && segmentLine) {
					ReactiveDataHelper.registerComputation(`RunningOrderView.MediaObjectStatus.SegmentLineItems.${item._id}`, this.autorun(() => {
						const { metadata, status, message } = checkSLIContentStatus(item, sourceLayer, studioInstallation.config)
						let newNotification: Notification | undefined = undefined
						if ((status !== RunningOrderAPI.LineItemStatusCode.OK) && (status !== RunningOrderAPI.LineItemStatusCode.UNKNOWN)) {
							newNotification = new Notification(item._id, NoticeLevel.WARNING, message || 'Media is broken', segment ? segment._id : 'line_' + item.segmentLineId, getCurrentTime(), true, [
								{
									label: 'Show issue',
									type: 'default'
								}
							], segmentLine._rank)
							if (newNotification.message && newNotification.message.toString().startsWith('Source format')) {
								debugger
							}
							newNotification.on('action', (notification, type, e) => {
								switch (type) {
									case 'default':
										const handler = onRONotificationClick.get()
										if (handler && typeof handler === 'function') {
											handler({
												sourceLocator: {
													name: item.name,
													roId: item.runningOrderId,
													segmentLineItemId: item._id,
													segmentLineId: item.segmentLineId
												}
											})
										}
								}
							})
						}

						if (newNotification && !Notification.isEqual(this._mediaStatus[item._id], newNotification)) {
							this._mediaStatus[item._id] = newNotification
							this._mediaStatusDep.changed()
						} else if (!newNotification && this._mediaStatus[item._id]) {
							delete this._mediaStatus[item._id]
							this._mediaStatusDep.changed()
						}
					}))
				} else {
					ReactiveDataHelper.stopComputation(`RunningOrderView.MediaObjectStatus.SegmentLineItems.${item._id}`)

					delete this._mediaStatus[item._id]
					this._mediaStatusDep.changed()
				}
			})

			_.difference(oldItemIds, newItemIds).forEach((item) => {
				delete this._mediaStatus[item]
				this._mediaStatusDep.changed()
			})
			oldItemIds = newItemIds
		}))
	}

	private cleanUpMediaStatus () {
		this._mediaStatus = {}
		this._mediaStatusDep.changed()
	}

	private convertDeviceStatus (device: PeripheralDevice): NoticeLevel {
		if (!device.connected) {
			return NoticeLevel.CRITICAL
		}
		switch (device.status.statusCode) {
			case PeripheralDeviceAPI.StatusCode.GOOD:
				return NoticeLevel.NOTIFICATION
			case PeripheralDeviceAPI.StatusCode.UNKNOWN:
				return NoticeLevel.CRITICAL
			case PeripheralDeviceAPI.StatusCode.WARNING_MAJOR:
				return NoticeLevel.WARNING
			case PeripheralDeviceAPI.StatusCode.WARNING_MINOR:
				return NoticeLevel.WARNING
			case PeripheralDeviceAPI.StatusCode.BAD:
				return NoticeLevel.CRITICAL
			case PeripheralDeviceAPI.StatusCode.FATAL:
				return NoticeLevel.CRITICAL
			default:
				return NoticeLevel.NOTIFICATION
		}
	}

	private makeDeviceMessage (device: PeripheralDevice): string {
		if (!device.connected) {
			return `Device ${device.name} is disconnected`
		}
		return `${device.name}: ` + (device.status.messages || ['']).join(', ')
	}
}

export interface IProps {
	match?: {
		params: {
			runningOrderId?: string
			studioId?: string
		}
	}
	onRONotificationClick?: (e: RONotificationEvent) => void
}

export const RunningOrderNotifier = class extends React.Component<IProps> {
	private notifier: RunningOrderViewNotifier

	constructor (props: IProps) {
		super(props)
		this.notifier = new RunningOrderViewNotifier()
	}

	componentDidMount () {
		const roId = this.props.match ? this.props.match.params.runningOrderId : undefined
		const studioId = this.props.match ? this.props.match.params.studioId : undefined
		this.notifier.setRunningOrderId(roId)
		this.notifier.setStudioId(studioId)
	}

	componentDidUpdate () {
		const roId = this.props.match ? this.props.match.params.runningOrderId : undefined
		const studioId = this.props.match ? this.props.match.params.studioId : undefined
		this.notifier.setRunningOrderId(roId)
		this.notifier.setStudioId(studioId)
	}

	componentWillUnmount () {
		this.notifier.stop()
	}

	render () {
		// this.props.connected
		return null
	}
}
