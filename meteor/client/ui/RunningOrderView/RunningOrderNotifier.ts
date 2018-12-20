import { Tracker } from 'meteor/tracker'
import { Meteor } from 'meteor/meteor'

import * as _ from 'underscore'

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
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'

export interface RONotificationEvent {
	sourceLocator: {
		name: string,
		roId?: string,
		segmentId?: string,
		segmentLineId?: string,
		segmentLineItemId?: string
	}
}

export class RunningOrderViewNotifier extends WithManagedTracker {
	onRONotificationClick: ((e: RONotificationEvent) => void) | undefined = undefined
	private _notificationList: NotificationList
	private _notifier: NotifierObject

	private _mediaStatus: _.Dictionary<Notification | undefined> = {}
	private _mediaStatusDep: Tracker.Dependency

	private _notes: _.Dictionary<Notification | undefined> = {}
	private _notesDep: Tracker.Dependency

	private _deviceStatus: _.Dictionary<Notification | undefined> = {}
	private _deviceStatusDep: Tracker.Dependency

	constructor (runningOrderId: string) {
		super()
		this._notificationList = new NotificationList([])
		this._mediaStatusDep = new Tracker.Dependency()
		this._deviceStatusDep = new Tracker.Dependency()
		this._notesDep = new Tracker.Dependency()

		this._notifier = NotificationCenter.registerNotifier((): NotificationList => {
			return this._notificationList
		})
		ReactiveDataHelper.registerComputation('RunningOrderView.MediaObjectStatus', this.autorun(() => {
			const rRunningOrderId = reactiveData.getRRunningOrderId(runningOrderId).get()

			if (rRunningOrderId) {
				const studioInstallationId = reactiveData.getRRunningOrderStudioId(rRunningOrderId).get()
				const showStyleBaseId = reactiveData.getRRunningOrderShowStyleBaseId(rRunningOrderId).get()
				ReactiveDataHelper.registerComputation('RunningOrderView.MediaObjectStatus.StudioInstallation', this.autorun(() => {
					// const studioInstallation = StudioInstallations.findOne(studioInstallationId)
					const showStyleBase = ShowStyleBases.findOne(showStyleBaseId)
					if (showStyleBase) {
						this.reactiveMediaStatus(rRunningOrderId, showStyleBase)
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
				this.cleanUpMediaStatus()
			}
		}))

		this.autorun((comp) => {
			this._mediaStatusDep.depend()
			this._deviceStatusDep.depend()
			this._notesDep.depend()

			this._notificationList.set(
				_.compact(_.values(this._mediaStatus))
				.concat(_.compact(_.values(this._deviceStatus)))
				.concat(_.compact(_.values(this._notes)))
			)
		})
	}

	stop () {
		super.stop()

		this._notifier.stop()

		ReactiveDataHelper.stopComputation('RunningOrderView.MediaObjectStatus')
	}

	private reactivePeripheralDeviceStatus (studioInstallationId: string | undefined) {
		let oldDevItemIds: Array<string> = []
		ReactiveDataHelper.registerComputation('RunningOrderView.PeripheralDevices', this.autorun(() => {
			if (studioInstallationId) {
				meteorSubscribe(PubSub.peripheralDevices, { studioInstallationId: studioInstallationId })
			}
			const devices = studioInstallationId ? reactiveData.getRPeripheralDevices(studioInstallationId).get() : []
			const newDevItemIds = devices.map(item => item._id)

			devices.forEach((item) => {
				let newNotification: Notification | undefined = undefined

				if (item.status.statusCode !== PeripheralDeviceAPI.StatusCode.GOOD || !item.connected) {
					newNotification = new Notification(item._id, this.convertDeviceStatus(item), this.makeDeviceMessage(item), 'Devices', getCurrentTime(), true)
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
			const segmentLines = SegmentLines.find({
				runningOrderId: rRunningOrderId
			}).fetch()

			const newNoteIds: Array<string> = []
			_.flatten(_.compact(segmentLines.map(i => i.notes && i.notes.map(j => _.extend(j, {
				rank: i._rank
			}))))).forEach((item: SegmentLineNote & {rank: number}) => {
				const id = item.message + '-' + (item.origin.segmentLineItemId || item.origin.segmentLineId || item.origin.segmentId || item.origin.roId) + '-' + item.origin.name + '-' + item.type
				let newNotification = new Notification(id, item.type === SegmentLineNoteType.ERROR ? NoticeLevel.CRITICAL : NoticeLevel.WARNING, (item.origin.name ? item.origin.name + ': ' : '') + item.message, 'Blueprint', getCurrentTime(), true, [
					{
						label: 'Show issue',
						type: 'default'
					}
				], item.rank)
				newNotification.on('action', (notification, type, e) => {
					switch (type) {
						case 'default':
							if (this.onRONotificationClick && typeof this.onRONotificationClick === 'function') {
								this.onRONotificationClick({
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

	private reactiveMediaStatus (rRunningOrderId: string, showStyleBase: ShowStyleBase) {
		let oldItemIds: Array<string> = []
		ReactiveDataHelper.registerComputation('RunningOrderView.MediaObjectStatus.SegmentLineItems', this.autorun((comp: Tracker.Computation) => {
			const items = reactiveData.getRSegmentLineItems(rRunningOrderId).get()
			const newItemIds = items.map(item => item._id)
			items.forEach((item) => {
				const sourceLayer = reactiveData.getRSourceLayer(showStyleBase, item.sourceLayerId).get()
				if (sourceLayer) {
					ReactiveDataHelper.registerComputation(`RunningOrderView.MediaObjectStatus.SegmentLineItems.${item._id}`, this.autorun(() => {
						const { metadata, status, message } = checkSLIContentStatus(item, sourceLayer, showStyleBase.config)
						let newNotification: Notification | undefined = undefined
						if ((status !== RunningOrderAPI.LineItemStatusCode.OK) && (status !== RunningOrderAPI.LineItemStatusCode.UNKNOWN)) {
							newNotification = new Notification(item._id, NoticeLevel.WARNING, message || 'Media is broken', item._id, getCurrentTime(), true, [
								{
									label: 'Show issue',
									type: 'default'
								}
							], 0)
							newNotification.on('action', (notification, type, e) => {
								switch (type) {
									case 'default':
										if (this.onRONotificationClick && typeof this.onRONotificationClick === 'function') {
											this.onRONotificationClick({
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
