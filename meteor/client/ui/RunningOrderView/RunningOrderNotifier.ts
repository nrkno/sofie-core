import * as React from 'react'
import * as _ from 'underscore'
import { Tracker } from 'meteor/tracker'
import { NotificationCenter, NotificationList, NotifierObject, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RunningOrderAPI } from '../../../lib/api/runningOrder'
import { WithManagedTracker } from '../../lib/reactiveData/reactiveDataHelper'
import { reactiveData } from '../../lib/reactiveData/reactiveData'
import { checkSLIContentStatus } from '../../../lib/mediaObjects'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { ShowStyleBases, ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { SegmentLines, SegmentLineNote, SegmentLineNoteType } from '../../../lib/collections/SegmentLines'
import { getCurrentTime } from '../../../lib/lib'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { ReactiveVar } from 'meteor/reactive-var'
import { Segments } from '../../../lib/collections/Segments'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { RunningOrders } from '../../../lib/collections/RunningOrders'
import { doModalDialog } from '../../lib/ModalDialog'
import { UserActionAPI } from '../../../lib/api/userActions'
import { doUserAction } from '../../lib/userAction'
// import { translate, getI18n, getDefaults } from 'react-i18next'
import { i18nTranslator } from '../i18n'

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

	private _runningOrderStatus: _.Dictionary<Notification | undefined> = {}
	private _runningOrderStatusDep: Tracker.Dependency

	private _deviceStatus: _.Dictionary<Notification | undefined> = {}
	private _deviceStatusDep: Tracker.Dependency

	private _runningOrderId: ReactiveVar<string | undefined>
	private _studioId: ReactiveVar<string | undefined>

	constructor () {
		super()
		this._notificationList = new NotificationList([])
		this._mediaStatusDep = new Tracker.Dependency()
		this._runningOrderStatusDep = new Tracker.Dependency()
		this._deviceStatusDep = new Tracker.Dependency()

		this._notesDep = new Tracker.Dependency()
		this._runningOrderId = new ReactiveVar<string | undefined>(undefined)
		this._studioId = new ReactiveVar<string | undefined>(undefined)

		this._notifier = NotificationCenter.registerNotifier((): NotificationList => {
			return this._notificationList
		})
		this.autorun(() => {
			// console.log('RunningOrderViewNotifier 1')
			let roId = this._runningOrderId.get()
			// console.log('roId: ' + roId)
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
			// console.log('rRunningOrderId: ' + rRunningOrderId)

			this.reactiveRunningOrderStatus(rRunningOrderId)

			if (rRunningOrderId) {
				const studioInstallationId = reactiveData.getRRunningOrderStudioId(rRunningOrderId).get()
				const showStyleBaseId = reactiveData.getRRunningOrderShowStyleBaseId(rRunningOrderId).get()
				this.autorun(() => {
					// console.log('RunningOrderViewNotifier 1-1')
					const studioInstallation = StudioInstallations.findOne(studioInstallationId)
					const showStyleBase = ShowStyleBases.findOne(showStyleBaseId)
					if (showStyleBase && studioInstallation) {
						this.reactiveMediaStatus(rRunningOrderId, showStyleBase, studioInstallation)
						this.reactiveSLNotes(rRunningOrderId)
						this.reactivePeripheralDeviceStatus(studioInstallationId)
					} else {
						this.cleanUpMediaStatus()
					}
				})
			} else {
				this._mediaStatus = {}
				this._deviceStatus = {}
				this._notes = {}
				this.cleanUpMediaStatus()
			}
		})

		this.autorun((comp) => {
			// console.log('RunningOrderViewNotifier 2')
			this._mediaStatusDep.depend()
			this._deviceStatusDep.depend()
			this._runningOrderStatusDep.depend()
			this._notesDep.depend()

			const notifications = _.compact(_.values(this._mediaStatus))
				.concat(_.compact(_.values(this._deviceStatus)))
				.concat(_.compact(_.values(this._notes)))
				.concat(_.compact(_.values(this._runningOrderStatus)))

			this._notificationList.set(
				notifications
			)
			// console.log(this._notificationList)
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
	}

	private reactiveRunningOrderStatus (runningOrderId: string | undefined) {
		const t = i18nTranslator

		this.autorun(() => {

			const runningOrder = RunningOrders.findOne(runningOrderId)
			if (runningOrder) {
				let unsyncedId = runningOrder._id + '_unsynced'
				let newNotification: Notification | undefined = undefined
				if (runningOrder.unsynced) {
					newNotification = new Notification(
						unsyncedId,
						NoticeLevel.CRITICAL,
						t('Running-order has been UNSYNCED from ENPS! No data updates will currently come through.'),
						'RunningOrder',
						getCurrentTime(),
						true,
						[
							{
								label: t('Re-sync'),
								type: 'primary',
								action: () => {
									doModalDialog({
										title: t('Re-sync runningOrder'),
										message: t('Are you sure you want to re-sync the runningOrder?\n(If the currently playing segmentLine has been changed, this can affect the output.)'),
										onAccept: () => {
											doUserAction(t, event, UserActionAPI.methods.resyncRunningOrder, [runningOrderId])
										}
									})
								}
							},
							// {
							// 	label: t('Delete'),
							// 	type: 'delete'
							// }
						],
						-1
					)
				}
				if (newNotification && !Notification.isEqual(this._runningOrderStatus[unsyncedId], newNotification)) {
					this._runningOrderStatus[unsyncedId] = newNotification
					this._runningOrderStatusDep.changed()
				} else if (!newNotification && this._runningOrderStatus[unsyncedId]) {
					delete this._runningOrderStatus[unsyncedId]
					this._deviceStatusDep.changed()
				}
			}
		})
	}

	private reactivePeripheralDeviceStatus (studioInstallationId: string | undefined) {
		let oldDevItemIds: Array<string> = []
		let reactivePeripheralDevices: ReactiveVar<PeripheralDevice[]>
		if (studioInstallationId) {
			meteorSubscribe(PubSub.peripheralDevicesAndSubDevices, { studioInstallationId: studioInstallationId })
			reactivePeripheralDevices = reactiveData.getRPeripheralDevices(studioInstallationId)
		}
		this.autorun(() => {
			// console.log('RunningOrderViewNotifier 3')
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
		})
	}

	private reactiveSLNotes (rRunningOrderId: string) {
		const t = i18nTranslator

		let oldNoteIds: Array<string> = []
		this.autorun(() => {
			// console.log('RunningOrderViewNotifier 4')
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
						label: t('Show issue'),
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
		})
	}

	private reactiveMediaStatus (rRunningOrderId: string, showStyleBase: ShowStyleBase, studioInstallation: StudioInstallation) {
		const t = i18nTranslator

		let oldItemIds: Array<string> = []
		this.autorun((comp: Tracker.Computation) => {
			// console.log('RunningOrderViewNotifier 5')
			const items = reactiveData.getRSegmentLineItems(rRunningOrderId).get()
			const newItemIds = items.map(item => item._id)
			items.forEach((item) => {
				const sourceLayer = reactiveData.getRSourceLayer(showStyleBase, item.sourceLayerId).get()
				const segmentLine = SegmentLines.findOne(item.segmentLineId)
				const segment = segmentLine ? Segments.findOne(segmentLine.segmentId) : undefined
				if (sourceLayer && segmentLine) {
					this.autorun(() => {
						// console.log('RunningOrderViewNotifier 5-1')
						const { status, message } = checkSLIContentStatus(item, sourceLayer, studioInstallation.config)
						let newNotification: Notification | undefined = undefined
						if ((status !== RunningOrderAPI.LineItemStatusCode.OK) && (status !== RunningOrderAPI.LineItemStatusCode.UNKNOWN) && (status !== RunningOrderAPI.LineItemStatusCode.SOURCE_NOT_SET)) {
							newNotification = new Notification(item._id, NoticeLevel.WARNING, message || 'Media is broken', segment ? segment._id : 'line_' + item.segmentLineId, getCurrentTime(), true, [
								{
									label: t('Show issue'),
									type: 'default'
								}
							], segmentLine._rank)
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
					})
				} else {
					delete this._mediaStatus[item._id]
					this._mediaStatusDep.changed()
				}
			})

			_.difference(oldItemIds, newItemIds).forEach((item) => {
				delete this._mediaStatus[item]
				this._mediaStatusDep.changed()
			})
			oldItemIds = newItemIds
		})
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
		const t = i18nTranslator

		if (!device.connected) {
			return t('Device {{deviceName}} is disconnected', {deviceName: device.name})
		}
		return `${device.name}: ` + (device.status.messages || ['']).join(', ')
	}
}

interface IProps {
	// match?: {
	// 	params: {
	// 		runningOrderId?: string
	// 		studioId?: string
	// 	}
	// }
	runningOrderId: string,
	studioId: string
	onRONotificationClick?: (e: RONotificationEvent) => void
}

export const RunningOrderNotifier = class extends React.Component<IProps> {
	private notifier: RunningOrderViewNotifier

	constructor (props: IProps) {
		super(props)
		this.notifier = new RunningOrderViewNotifier()
	}

	componentDidMount () {
		const roId = this.props.runningOrderId // || (this.props.match ? this.props.match.params.runningOrderId : undefined)
		const studioId = this.props.studioId // || (this.props.match ? this.props.match.params.studioId : undefined)
		// console.log('Setting running order id to: ', roId, studioId)
		this.notifier.setRunningOrderId(roId)
		this.notifier.setStudioId(studioId)
	}

	componentDidUpdate () {
		const roId = this.props.runningOrderId // || (this.props.match ? this.props.match.params.runningOrderId : undefined)
		const studioId = this.props.studioId // || (this.props.match ? this.props.match.params.studioId : undefined)
		// console.log('Setting running order id to: ', roId, studioId)
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
