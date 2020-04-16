import * as React from 'react'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { NotificationCenter, NotificationList, NotifierHandle, Notification, NoticeLevel } from '../../lib/notifications/notifications'
import { RundownAPI } from '../../../lib/api/rundown'
import { WithManagedTracker } from '../../lib/reactiveData/reactiveDataHelper'
import { reactiveData } from '../../lib/reactiveData/reactiveData'
import { checkPieceContentStatus, getMediaObjectMediaId } from '../../../lib/mediaObjects'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice, PeripheralDevices, PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { Parts, PartId } from '../../../lib/collections/Parts'
import { getCurrentTime, unprotectString } from '../../../lib/lib'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { ReactiveVar } from 'meteor/reactive-var'
import { Segments, SegmentId } from '../../../lib/collections/Segments'
import { Studio, StudioId } from '../../../lib/collections/Studios'
import { Rundowns, RundownId, Rundown } from '../../../lib/collections/Rundowns'
import { doModalDialog } from '../../lib/ModalDialog'
import { doUserAction } from '../../lib/userAction'
// import { translate, getI18n, getDefaults } from 'react-i18next'
import { i18nTranslator } from '../i18n'
import { PartNote, NoteType } from '../../../lib/api/notes'
import { Pieces, PieceId } from '../../../lib/collections/Pieces'
import { PeripheralDevicesAPI } from '../../lib/clientAPI'
import { handleRundownPlaylistReloadResponse } from '../RundownView'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { MeteorCall } from '../../../lib/api/methods'

export const onRONotificationClick = new ReactiveVar<((e: RONotificationEvent) => void) | undefined>(undefined)
export const reloadRundownPlaylistClick = new ReactiveVar<((e: any) => void) | undefined>(undefined)

export interface RONotificationEvent {
	sourceLocator: {
		name: string,
		rundownId?: RundownId,
		segmentId?: SegmentId,
		partId?: PartId,
		pieceId?: PieceId
	}
}

class RundownViewNotifier extends WithManagedTracker {
	private _notificationList: NotificationList
	private _notifier: NotifierHandle

	private _mediaStatus: _.Dictionary<Notification | undefined> = {}
	private _mediaStatusComps: _.Dictionary<Tracker.Computation> = {}
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

	constructor (playlistId: RundownPlaylistId | undefined, showStyleBase: ShowStyleBase, studio: Studio) {
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

			if (playlistId) {
				this.reactiveRundownStatus(playlistId)
				this.reactiveVersionStatus(playlistId)

				this.autorun(() => {
					// console.log('RundownViewNotifier 1-1')
					if (showStyleBase && studio) {
						this.reactiveMediaStatus(playlistId, showStyleBase, studio)
						this.reactivePartNotes(playlistId)
						this.reactivePeripheralDeviceStatus(studio._id)
						this.reactiveQueueStatus(studio._id, playlistId)
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

		_.forEach(this._mediaStatusComps, (element, key) => element.stop())
		this._notifier.stop()
	}

	private reactiveRundownStatus (playlistId: RundownPlaylistId) {
		const t = i18nTranslator
		let oldNoteIds: Array<string> = []

		const rRundowns = reactiveData.getRRundowns(playlistId)
		this.autorun(() => {
			const newNoteIds: Array<string> = []

			const playlist = RundownPlaylists.findOne(playlistId)
			const rundowns = rRundowns.get()

			if (playlist && rundowns) {
				rundowns.forEach((rundown) => {
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
											message: t('Are you sure you want to re-sync the Rundown?\n(If the currently playing Part has been changed, this can affect the output)'),
											yes: t('Re-sync'),
											no: t('Cancel'),
											onAccept: (event) => {
												doUserAction(t, event, 'Re-Syncing Rundown Playlist', (e) => MeteorCall.userAction.resyncRundownPlaylist(e, playlist._id), (err, reloadResult) => {
													if (!err && reloadResult) {
														handleRundownPlaylistReloadResponse(t, playlist, reloadResult)
													}
												})
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
								note.message,
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
				})
			}

			_.difference(oldNoteIds, newNoteIds).forEach((item) => {
				delete this._rundownStatus[item]
				this._rundownStatusDep.changed()
			})

			oldNoteIds = newNoteIds
		})
	}

	private reactivePeripheralDeviceStatus (studioId: StudioId | undefined) {
		const t = i18nTranslator

		let oldDevItemIds: PeripheralDeviceId[] = []
		let reactivePeripheralDevices: ReactiveVar<PeripheralDevice[]> | undefined
		if (studioId) {
			meteorSubscribe(PubSub.peripheralDevicesAndSubDevices, { studioId: studioId })
			reactivePeripheralDevices = reactiveData.getRPeripheralDevices(studioId)
		}
		this.autorun(() => {
			// console.log('RundownViewNotifier 3')
			const devices = reactivePeripheralDevices ? reactivePeripheralDevices.get() : []
			const newDevItemIds = devices.map(item => item._id)

			devices.filter(i => !i.ignore).forEach((item) => {
				let newNotification: Notification | undefined = undefined

				const parent = devices.find(i => i._id === item.parentDeviceId)

				if (item.status.statusCode !== PeripheralDeviceAPI.StatusCode.GOOD || !item.connected) {
					newNotification = new Notification(
						item._id,
						this.convertDeviceStatus(item),
						this.makeDeviceMessage(item),
						'Devices',
						getCurrentTime(),
						true,
						parent && parent.connected ? [
							{
								label: t('Restart'),
								type: 'primary',
								action: () => {
									doModalDialog({
										title: t('Restart {{device}}', { device: parent.name }),
										message: t('Fixing this problem requires a restart to the host device. Are you sure you want to restart {{device}}?\n(This might affect output)', { device: parent.name }),
										yes: t('Restart'),
										no: t('Cancel'),
										onAccept: (e) => {
											PeripheralDevicesAPI.restartDevice(parent, e)
											.then(() => {
												NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, t('Device "{{deviceName}}" restarting...', { deviceName: parent.name }), 'RundownNotifier'))
											}).catch((err) => {
												NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, t('Failed to restart device: "{{deviceName}}": {{errorMessage}}', { deviceName: parent.name, errorMessage: err + '' }), 'RundownNotifier'))
											})
										}
									})
								}
							}
						] : undefined,
						-1)
				}
				if (newNotification && !Notification.isEqual(this._deviceStatus[unprotectString(item._id)], newNotification)) {
					this._deviceStatus[unprotectString(item._id)] = newNotification
					this._deviceStatusDep.changed()
				} else if (!newNotification && this._deviceStatus[unprotectString(item._id)]) {
					delete this._deviceStatus[unprotectString(item._id)]
					this._deviceStatusDep.changed()
				}
			})

			_.difference(oldDevItemIds, newDevItemIds).forEach((deviceId) => {
				delete this._deviceStatus[unprotectString(deviceId)]
				this._deviceStatusDep.changed()
			})
			oldDevItemIds = newDevItemIds
		})
	}

	private reactivePartNotes (playlistId: RundownPlaylistId) {
		const t = i18nTranslator

		function getSegmentPartNotes (rRundownIds: RundownId[]) {
			let notes: Array<PartNote & {rank: number}> = []
			const segments = Segments.find({
				rundownId: {
					$in: rRundownIds
				}
			}, { sort: { _rank: 1 } }).fetch()

			const segmentNotes = _.object(segments.map(segment => [ segment._id, {
				rank: segment._rank,
				notes: segment.notes
			} ])) as { [key: string ]: { notes: PartNote[], rank: number } }
			Parts.find({
				rundownId: { $in: rRundownIds },
				segmentId: { $in: segments.map(segment => segment._id) }
			}, { sort: { _rank: 1 } }).map(part => {
				if (part.notes) {
					const sn = segmentNotes[unprotectString(part.segmentId)]
					if (sn) {
						return sn.notes.concat(part.notes)
					}
				}
			})
			notes = notes.concat(_.flatten(_.map(_.values(segmentNotes), (o) => {
				return o.notes.map(note => _.extend(note, {
					rank: o.rank
				}))
			})))

			return notes
		}

		const rRundowns = reactiveData.getRRundowns(playlistId)

		let oldNoteIds: Array<string> = []
		this.autorun(() => {
			const rundownIds = rRundowns.get().map(r => r._id)
			// console.log('RundownViewNotifier 4')
			const newNoteIds: Array<string> = []
			getSegmentPartNotes(rundownIds).forEach((item: PartNote & {rank: number}) => {
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

	private reactiveMediaStatus (playlistId: RundownPlaylistId, showStyleBase: ShowStyleBase, studio: Studio) {
		const t = i18nTranslator

		let oldPieceIds: PieceId[] = []
		const rPieces = reactiveData.getRPieces(playlistId)
		this.autorun((comp: Tracker.Computation) => {
			const pieces = rPieces.get()
			const newPieceIds = pieces.map(item => item._id)
			pieces.forEach((piece) => {
				const sourceLayer = showStyleBase.sourceLayers.find(i => i._id === piece.sourceLayerId)
				const part = Parts.findOne(piece.partId)
				const segment = part ? Segments.findOne(part.segmentId) : undefined
				if (segment && sourceLayer && part) {
					// we don't want this to be in a non-reactive context, so we manage this computation manually
					this._mediaStatusComps[unprotectString(piece._id)] = Tracker.autorun(() => {
						const mediaId = getMediaObjectMediaId(piece, sourceLayer)
						if (mediaId) {
							this.subscribe(PubSub.mediaObjects, studio._id, {
								mediaId: mediaId.toUpperCase()
							})
						}
						const { status, message } = checkPieceContentStatus(piece, sourceLayer, studio.settings)
						let newNotification: Notification | undefined = undefined
						if ((status !== RundownAPI.PieceStatusCode.OK) && (status !== RundownAPI.PieceStatusCode.UNKNOWN) && (status !== RundownAPI.PieceStatusCode.SOURCE_NOT_SET)) {
							newNotification = new Notification(piece._id, NoticeLevel.WARNING, message || 'Media is broken', segment ? segment._id : 'line_' + piece.partId, getCurrentTime(), true, [
								{
									label: t('Show issue'),
									type: 'default'
								}
							], segment._rank * 1000 + part._rank)
							newNotification.on('action', (notification, type, e) => {
								switch (type) {
									case 'default':
										const handler = onRONotificationClick.get()
										if (handler && typeof handler === 'function') {
											handler({
												sourceLocator: {
													name: piece.name,
													rundownId: piece.rundownId,
													pieceId: piece._id,
													partId: piece.partId
												}
											})
										}
								}
							})
						}

						if (newNotification && !Notification.isEqual(this._mediaStatus[unprotectString(piece._id)], newNotification)) {
							this._mediaStatus[unprotectString(piece._id)] = newNotification
							this._mediaStatusDep.changed()
						} else if (!newNotification && this._mediaStatus[unprotectString(piece._id)]) {
							delete this._mediaStatus[unprotectString(piece._id)]
							this._mediaStatusDep.changed()
						}
					})
				} else {
					delete this._mediaStatus[unprotectString(piece._id)]
					this._mediaStatusDep.changed()
				}
			})

			const removedPieceIds = _.difference(oldPieceIds, newPieceIds)
			removedPieceIds.forEach((pieceId) => {
				const pId = unprotectString(pieceId)
				delete this._mediaStatus[pId]
				this._mediaStatusComps[pId].stop()
				delete this._mediaStatusComps[pId]

				this._mediaStatusDep.changed()
			})
			oldPieceIds = newPieceIds
		})
	}

	private reactiveVersionStatus (playlistId: RundownPlaylistId) {

		const updatePeriod = 30000 // every 30s

		if (this._rundownImportVersionInterval) Meteor.clearInterval(this._rundownImportVersionInterval)
		this._rundownImportVersionInterval = playlistId ? Meteor.setInterval(() => this.updateVersionStatus(playlistId), updatePeriod) : undefined

		// const rundowns = reactiveData.getRRundowns()
		this.autorun((comp: Tracker.Computation) => {
			// console.log('RundownViewNotifier 5')

			// Track the rundown as a dependency of this autorun
			this.updateVersionStatus(playlistId)
		})
	}

	private reactiveQueueStatus (studioId: StudioId, playlistId: RundownPlaylistId) {
		const t = i18nTranslator
		let reactiveUnsentMessageCount: ReactiveVar<number>
		meteorSubscribe(PubSub.externalMessageQueue, { studioId: studioId, playlistId })
		reactiveUnsentMessageCount = reactiveData.getUnsentExternalMessageCount(studioId, playlistId)
		this.autorun(() => {
			if (reactiveUnsentMessageCount.get() > 0 && this._unsentExternalMessagesStatus === undefined) {
				this._unsentExternalMessagesStatus = new Notification(`unsent_${studioId}`, NoticeLevel.WARNING, t('External message queue has unsent messages.'), 'ExternalMessageQueue', getCurrentTime(), true, undefined, -1)
				this._unsentExternalMessageStatusDep.changed()
			}
			if (reactiveUnsentMessageCount.get() === 0 && this._unsentExternalMessagesStatus !== undefined) {
				this._unsentExternalMessagesStatus = undefined
				this._unsentExternalMessageStatusDep.changed()
			}
		})
	}

	private updateVersionStatus (playlistId: RundownPlaylistId) {
		const t = i18nTranslator

		// console.log('update_version_status, ' + rundownId)

		// Doing the check server side, to avoid needing to subscribe to the blueprint and showStyleVariant
		MeteorCall.rundown.rundownPlaylistNeedsResync(playlistId)
			.then((versionMismatch: string[]) => {
				let newNotification: Notification | undefined = undefined
				if (versionMismatch && versionMismatch.length) {
					newNotification = new Notification('rundown_importVersions', NoticeLevel.WARNING, t('The system configuration has been changed since importing this rundown. It might not run correctly'), `rundownPlaylist_${playlistId}`, getCurrentTime(), true, [
						{
							label: t('Reload ENPS Data'),
							type: 'primary',
							action: (e) => {
								const reloadFunc = reloadRundownPlaylistClick.get()
								if (reloadFunc) {
									reloadFunc(e)
								}
							}
						}
					], -1)
				}

				if (
					(newNotification && !Notification.isEqual(this._rundownImportVersionStatus, newNotification)) ||
					(!newNotification && this._rundownImportVersionStatus)
				) {
					this._rundownImportVersionStatus = newNotification
					this._rundownImportVersionStatusDep.changed()
				}
			}).catch(err => {
				console.error(err)
				let newNotification = new Notification('rundown_importVersions', NoticeLevel.WARNING, t('Unable to check the system configuration for changes'), `rundownPlaylist_${playlistId}`, getCurrentTime(), true, undefined, -1)
				if (!Notification.isEqual(this._rundownImportVersionStatus, newNotification)) {
					this._rundownImportVersionStatus = newNotification
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
	// 		rundownId?: RundownId
	// 		studioId?: StudioId
	// 	}
	// }
	playlistId: RundownPlaylistId,
	studio: Studio
	showStyleBase: ShowStyleBase
}

export const RundownNotifier = class RundownNotifier extends React.Component<IProps> {
	private notifier: RundownViewNotifier

	constructor (props: IProps) {
		super(props)
		this.notifier = new RundownViewNotifier(props.playlistId, props.showStyleBase, props.studio)
	}

	shouldComponentUpdate (nextProps: IProps): boolean {
		if ((this.props.playlistId === nextProps.playlistId) &&
			(this.props.showStyleBase._id === nextProps.showStyleBase._id) &&
			(this.props.studio._id === nextProps.studio._id)) {
			return false
		}
		return true
	}

	componentDidUpdate () {
		this.notifier.stop()
		this.notifier = new RundownViewNotifier(this.props.playlistId, this.props.showStyleBase, this.props.studio)
	}

	componentWillUnmount () {
		this.notifier.stop()
	}

	render () {
		// this.props.connected
		return null
	}
}
