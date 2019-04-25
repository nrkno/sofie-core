import * as React from 'react'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { NotificationCenter, NotificationList, NotifierHandle, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RundownAPI } from '../../../lib/api/rundown'
import { WithManagedTracker } from '../../lib/reactiveData/reactiveDataHelper'
import { reactiveData } from '../../lib/reactiveData/reactiveData'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { Parts } from '../../../lib/collections/Parts'
import { getCurrentTime } from '../../../lib/lib'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { ReactiveVar } from 'meteor/reactive-var'
import { Segments } from '../../../lib/collections/Segments'
import { Studio } from '../../../lib/collections/Studios'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { doModalDialog } from '../../lib/ModalDialog'
import { UserActionAPI } from '../../../lib/api/userActions'
import { doUserAction } from '../../lib/userAction'
// import { translate, getI18n, getDefaults } from 'react-i18next'
import { i18nTranslator } from '../i18n'
import { PartNote, NoteType } from '../../../lib/api/notes'

export const onRONotificationClick = new ReactiveVar<((e: RONotificationEvent) => void) | undefined>(undefined)
export const reloadRundownClick = new ReactiveVar<((e: any) => void) | undefined>(undefined)

export interface RONotificationEvent {
	sourceLocator: {
		name: string,
		rundownId?: string,
		segmentId?: string,
		partId?: string,
		pieceId?: string
	}
}

class RundownViewNotifier extends WithManagedTracker {
	private _notificationList: NotificationList
	private _notifier: NotifierHandle

	private _mediaStatus: _.Dictionary<Notification | undefined> = {}
	private _mediaStatusDep: Tracker.Dependency

	private _notes: _.Dictionary<Notification | undefined> = {}
	private _notesDep: Tracker.Dependency

	private _rundownStatus: _.Dictionary<Notification | undefined> = {}
	private _rundownStatusDep: Tracker.Dependency

	private _deviceStatus: _.Dictionary<Notification | undefined> = {}
	private _deviceStatusDep: Tracker.Dependency

	private _rundownImportVersionStatus: Notification | undefined = undefined
	private _rundownImportVersionStatusDep: Tracker.Dependency
	private _rundownImportVersionInterval: number | undefined = undefined

	private _unsentExternalMessagesStatus: Notification | undefined = undefined
	private _unsentExternalMessageStatusDep: Tracker.Dependency

	constructor (rundownId: string, showStyleBase: ShowStyleBase, studio: Studio) {
		super()
		this._notificationList = new NotificationList([])
		this._mediaStatusDep = new Tracker.Dependency()
		this._rundownStatusDep = new Tracker.Dependency()
		this._deviceStatusDep = new Tracker.Dependency()
		this._rundownImportVersionStatusDep = new Tracker.Dependency()
		this._unsentExternalMessageStatusDep = new Tracker.Dependency()
		this._notesDep = new Tracker.Dependency()

		this._notifier = NotificationCenter.registerNotifier((): NotificationList => {
			return this._notificationList
		})
		this.autorun(() => {
			// console.log('RundownViewNotifier 1')
			const rRundownId = rundownId
			// console.log('rRundownId: ' + rRundownId)

			this.reactiveRundownStatus(rRundownId)
			this.reactiveVersionStatus(rRundownId)

			if (rRundownId) {
				this.autorun(() => {
					// console.log('RundownViewNotifier 1-1')
					if (showStyleBase && studio) {
						this.reactiveMediaStatus(rRundownId, showStyleBase, studio)
						this.reactivePartNotes(rRundownId)
						this.reactivePeripheralDeviceStatus(studio._id)
						this.reactiveQueueStatus(studio._id)
					} else {
						this.cleanUpMediaStatus()
					}
				})
			} else {
				this._mediaStatus = {}
				this._deviceStatus = {}
				this._notes = {}
				this._rundownImportVersionStatus = undefined
				this._unsentExternalMessagesStatus = undefined
				this.cleanUpMediaStatus()
			}
		})

		this.autorun((comp) => {
			// console.log('RundownViewNotifier 2')
			this._mediaStatusDep.depend()
			this._deviceStatusDep.depend()
			this._rundownStatusDep.depend()
			this._notesDep.depend()
			this._rundownImportVersionStatusDep.depend()
			this._unsentExternalMessageStatusDep.depend()

			const notifications = _.compact(_.values(this._mediaStatus))
				.concat(_.compact(_.values(this._deviceStatus)))
				.concat(_.compact(_.values(this._notes)))
				.concat(_.compact(_.values(this._rundownStatus)))
				.concat(_.compact([this._rundownImportVersionStatus]))
				.concat(_.compact([this._unsentExternalMessagesStatus]))

			this._notificationList.set(
				notifications
			)
			// console.log(this._notificationList)
		})
	}

	stop () {
		super.stop()

		if (this._rundownImportVersionInterval) Meteor.clearInterval(this._rundownImportVersionInterval)

		this._notifier.stop()
	}

	private reactiveRundownStatus (rundownId: string | undefined) {
		const t = i18nTranslator
		let oldNoteIds: Array<string> = []

		this.autorun(() => {
			const newNoteIds: Array<string> = []

			const rundown = Rundowns.findOne(rundownId)
			if (rundown) {
				let unsyncedId = rundown._id + '_unsynced'
				let newNotification: Notification | undefined = undefined

				if (rundown.unsynced) {
					newNotification = new Notification(
						unsyncedId,
						NoticeLevel.CRITICAL,
						t('The Rundown has been UNSYNCED from ENPS! No data updates will currently come through.'),
						'Rundown',
						getCurrentTime(),
						true,
						[
							{
								label: t('Re-sync'),
								type: 'primary',
								action: () => {
									doModalDialog({
										title: t('Re-sync Rundown'),
										message: t('Are you sure you want to re-sync the Rundown?\n(If the currently playing Part has been changed, this can affect the output.)'),
										onAccept: (event) => {
											doUserAction(t, event, UserActionAPI.methods.resyncRundown, [rundownId])
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
					newNoteIds.push(unsyncedId)
				}
				if (newNotification && !Notification.isEqual(this._rundownStatus[unsyncedId], newNotification)) {
					this._rundownStatus[unsyncedId] = newNotification
					this._rundownStatusDep.changed()
				} else if (!newNotification && this._rundownStatus[unsyncedId]) {
					delete this._rundownStatus[unsyncedId]
					this._rundownStatusDep.changed()
				}

				let rundownNotesId = rundown._id + '_ronotes_'
				if (rundown.notes) {
					rundown.notes.forEach((note) => {
						const rundownNoteId = rundownNotesId + note.origin.name + '_' + note.origin.rundownId + '_' + note.message + '_' + note.type
						const newNotification = new Notification(
							rundownNoteId,
							note.type === NoteType.ERROR ? NoticeLevel.CRITICAL : NoticeLevel.WARNING,
							rundown.notes,
							'Rundown',
							getCurrentTime(),
							true,
							[],
							-1
						)
						if (!Notification.isEqual(this._rundownStatus[rundownNoteId], newNotification)) {
							this._rundownStatus[rundownNoteId] = newNotification
							this._rundownStatusDep.changed()
						}
						newNoteIds.push(rundownNoteId)
					})
				}
			}

			_.difference(oldNoteIds, newNoteIds).forEach((item) => {
				delete this._rundownStatus[item]
				this._rundownStatusDep.changed()
			})

			oldNoteIds = newNoteIds
		})
	}

	private reactivePeripheralDeviceStatus (studioId: string | undefined) {
		let oldDevItemIds: Array<string> = []
		let reactivePeripheralDevices: ReactiveVar<PeripheralDevice[]>
		if (studioId) {
			meteorSubscribe(PubSub.peripheralDevicesAndSubDevices, { studioId: studioId })
			reactivePeripheralDevices = reactiveData.getRPeripheralDevices(studioId)
		}
		this.autorun(() => {
			// console.log('RundownViewNotifier 3')
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

	private reactivePartNotes (rRundownId: string) {
		const t = i18nTranslator

		let oldNoteIds: Array<string> = []
		this.autorun(() => {
			// console.log('RundownViewNotifier 4')
			const segments = Segments.find({
				rundownId: rRundownId
			}).fetch()

			const newNoteIds: Array<string> = []
			_.flatten(_.compact(segments.map(i => i.getNotes(true).map(j => _.extend(j, {
				rank: i._rank
			}))))).forEach((item: PartNote & {rank: number}) => {
				const id = item.message + '-' + (item.origin.pieceId || item.origin.partId || item.origin.segmentId || item.origin.rundownId) + '-' + item.origin.name + '-' + item.type
				let newNotification = new Notification(id, item.type === NoteType.ERROR ? NoticeLevel.CRITICAL : NoticeLevel.WARNING, (item.origin.name ? item.origin.name + ': ' : '') + item.message, item.origin.segmentId || 'unknown', getCurrentTime(), true, [
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

	private reactiveMediaStatus (rRundownId: string, showStyleBase: ShowStyleBase, studio: Studio) {
		const t = i18nTranslator

		let oldItemIds: Array<string> = []
		const rPieces = reactiveData.getRPieces(rRundownId)
		this.autorun((comp: Tracker.Computation) => {
			// console.log('RundownViewNotifier 5')
			const items = rPieces.get()
			const newItemIds = items.map(item => item._id)
			items.forEach((item) => {
				const sourceLayer = showStyleBase.sourceLayers.find(i => i._id === item.sourceLayerId)
				const part = Parts.findOne(item.partId)
				const segment = part ? Segments.findOne(part.segmentId) : undefined
				if (sourceLayer && part) {
					this.autorun(() => {
						// console.log('RundownViewNotifier 5-1')
						const { status, message } = checkPieceContentStatus(item, sourceLayer, studio.config)
						let newNotification: Notification | undefined = undefined
						if ((status !== RundownAPI.LineItemStatusCode.OK) && (status !== RundownAPI.LineItemStatusCode.UNKNOWN) && (status !== RundownAPI.LineItemStatusCode.SOURCE_NOT_SET)) {
							newNotification = new Notification(item._id, NoticeLevel.WARNING, message || 'Media is broken', segment ? segment._id : 'line_' + item.partId, getCurrentTime(), true, [
								{
									label: t('Show issue'),
									type: 'default'
								}
							], part._rank)
							newNotification.on('action', (notification, type, e) => {
								switch (type) {
									case 'default':
										const handler = onRONotificationClick.get()
										if (handler && typeof handler === 'function') {
											handler({
												sourceLocator: {
													name: item.name,
													rundownId: item.rundownId,
													pieceId: item._id,
													partId: item.partId
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

	private reactiveVersionStatus (rRundownId: string) {

		const updatePeriod = 30000 // every 30s

		if (this._rundownImportVersionInterval) Meteor.clearInterval(this._rundownImportVersionInterval)
		this._rundownImportVersionInterval = rRundownId ? Meteor.setInterval(() => this.updateVersionStatus(rRundownId), updatePeriod) : undefined

		this.autorun((comp: Tracker.Computation) => {
			// console.log('RundownViewNotifier 5')

			// Track the rundown as a dependency of this autorun
			const rundown = Rundowns.findOne(rRundownId)
			if (rundown) {
				this.updateVersionStatus(rundown._id)
			}
		})
	}

	private reactiveQueueStatus (studioId: string) {
		let reactiveUnsentMessageCount: ReactiveVar<number>
		meteorSubscribe(PubSub.externalMessageQueue, { studioId: studioId })
		reactiveUnsentMessageCount = reactiveData.getUnsentExternalMessageCount(studioId)
		this.autorun(() => {
			if (reactiveUnsentMessageCount.get() > 0 && this._unsentExternalMessagesStatus === undefined) {
				this._unsentExternalMessagesStatus = new Notification(`unsent_${studioId}`, NoticeLevel.WARNING, 'External message queue has unsent messages.', 'ExternalMessageQueue', getCurrentTime(), true, undefined, -1)
				this._unsentExternalMessageStatusDep.changed()
			}
			if (reactiveUnsentMessageCount.get() === 0 && this._unsentExternalMessagesStatus !== undefined) {
				this._unsentExternalMessagesStatus = undefined
				this._unsentExternalMessageStatusDep.changed()
			}
		})
	}

	private updateVersionStatus (rundownId: string) {
		const t = i18nTranslator

		// console.log('update_version_status, ' + rundownId)

		// Doing the check server side, to avoid needing to subscribe to the blueprint and showStyleVariant
		Meteor.call(RundownAPI.methods.rundownNeedsUpdating, rundownId, (err: Error, versionMismatch: string) => {
			let newNotification: Notification | undefined = undefined
			if (err) {
				newNotification = new Notification('rundown_importVersions', NoticeLevel.WARNING, t('Unable to check the system configuration for changes'), 'rundown_' + rundownId, getCurrentTime(), true, undefined, -1)
			} else if (versionMismatch) {
				newNotification = new Notification('rundown_importVersions', NoticeLevel.WARNING, t('The system configuration has been changed since importing this rundown. It might not run correctly'), 'rundown_' + rundownId, getCurrentTime(), true, [
					{
						label: t('Reload ENPS Data'),
						type: 'primary',
						action: (e) => {
							const reloadFunc = reloadRundownClick.get()
							if (reloadFunc) {
								reloadFunc(e)
							}
						}
					}
				], -1)
			}

			if (newNotification && !Notification.isEqual(this._rundownImportVersionStatus, newNotification)) {
				this._rundownImportVersionStatus = newNotification
				this._rundownImportVersionStatusDep.changed()
			} else if (!newNotification && this._rundownImportVersionStatus) {
				this._rundownImportVersionStatus = undefined
				this._rundownImportVersionStatusDep.changed()
			}
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
			return t('Device {{deviceName}} is disconnected', { deviceName: device.name })
		}
		return `${device.name}: ` + (device.status.messages || ['']).join(', ')
	}
}

interface IProps {
	// match?: {
	// 	params: {
	// 		rundownId?: string
	// 		studioId?: string
	// 	}
	// }
	rundownId: string,
	studio: Studio
	showStyleBase: ShowStyleBase
}

export const RundownNotifier = class extends React.Component<IProps> {
	private notifier: RundownViewNotifier

	constructor (props: IProps) {
		super(props)
		this.notifier = new RundownViewNotifier(props.rundownId, props.showStyleBase, props.studio)
	}

	shouldComponentUpdate (nextProps: IProps): boolean {
		if ((this.props.rundownId === nextProps.rundownId) &&
			(this.props.showStyleBase._id === nextProps.showStyleBase._id) &&
			(this.props.studio._id === nextProps.studio._id)) {
			return false
		}
		return true
	}

	componentDidUpdate () {
		this.notifier.stop()
		this.notifier = new RundownViewNotifier(this.props.rundownId, this.props.showStyleBase, this.props.studio)
	}

	componentWillUnmount () {
		this.notifier.stop()
	}

	render () {
		// this.props.connected
		return null
	}
}
