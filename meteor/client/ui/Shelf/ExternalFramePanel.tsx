import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutExternalFrame,
	RundownLayoutBase,
	DashboardLayoutExternalFrame,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementStyle } from './DashboardPanel'
import { assertNever, getRandomString, literal, protectString } from '../../../lib/lib'
import { RundownPlaylist, RundownPlaylistCollectionUtil } from '../../../lib/collections/RundownPlaylists'
import { PartInstances, PartInstance } from '../../../lib/collections/PartInstances'
import { parseMosPluginMessageXml, MosPluginMessage, fixMosData } from '../../lib/parsers/mos/mosXml2Js'
import {
	createMosAppInfoXmlString,
	UIMetric as MOSUIMetric,
	UIMetricMode as MOSUIMetricMode,
	Events as MOSEvents,
} from '../../lib/data/mos/plugin-support'
import { MOS } from '@sofie-automation/corelib'
import { doUserAction, UserAction } from '../../lib/userAction'
import { withTranslation } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { Buckets } from '../../../lib/collections/Buckets'
import { IngestAdlib } from '@sofie-automation/blueprints-integration'
import { MeteorCall } from '../../../lib/api/methods'
import { Rundowns, Rundown } from '../../../lib/collections/Rundowns'
import { check } from '../../../lib/check'
import { BucketId, PartInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

const PackageInfo = require('../../../package.json')

interface IProps {
	layout: RundownLayoutBase
	panel: RundownLayoutExternalFrame
	visible: boolean
	playlist: RundownPlaylist
}

enum SofieExternalMessageType {
	HELLO = 'hello',
	WELCOME = 'welcome',
	ACK = 'ack',
	NAK = 'nak',
	KEYBOARD_EVENT = 'keyboard_event',
	CURRENT_PART_CHANGED = 'current_part_changed',
	NEXT_PART_CHANGED = 'next_part_changed',
	FOCUS_IN = 'focus_in',
}

interface SofieExternalMessage {
	id: string
	replyToId?: string
	type: SofieExternalMessageType
	payload?: any
}

// interface HelloSofieExternalMessage extends SofieExternalMessage {
// 	type: SofieExternalMessageType.HELLO
// 	payload: never
// }

interface WelcomeSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.WELCOME
	payload: {
		host: string
		version: string
		rundownPlaylistId: RundownPlaylistId
	}
}

// interface KeyboardEventSofieExternalMessage extends SofieExternalMessage {
// 	type: SofieExternalMessageType.KEYBOARD_EVENT
// 	payload: KeyboardEvent & {
// 		currentTarget: null
// 		path: null
// 		scrElement: null
// 		target: null
// 		view: null
// 	}
// }

interface CurrentNextPartChangedSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.CURRENT_PART_CHANGED | SofieExternalMessageType.NEXT_PART_CHANGED
	payload: {
		partInstanceId: PartInstanceId | null
		prevPartInstanceId?: PartInstanceId | null
	}
}

export const ExternalFramePanel = withTranslation()(
	class ExternalFramePanel extends React.Component<Translated<IProps>> {
		frame: HTMLIFrameElement
		mounted: boolean = false
		initialized: boolean = false
		failedDragTimeout: number | undefined

		awaitingReply: {
			[key: string]: {
				resolve: Function
				reject: Function
			}
		} = {}

		setElement = (frame: HTMLIFrameElement) => {
			this.frame = frame
			if (this.frame && !this.mounted) {
				this.registerHandlers()
				this.mounted = true
			} else {
				this.unregisterHandlers()
				this.mounted = false
			}
		}

		onKeyEvent = (e: KeyboardEvent) => {
			this.sendSofieMessage(
				literal<SofieExternalMessage>({
					id: getRandomString(),
					type: SofieExternalMessageType.KEYBOARD_EVENT,
					// Send the event sanitized to prevent sending huge objects
					payload: _.omit(
						_.omit(e, ['currentTarget', 'path', 'srcElement', 'target', 'view', 'sourceCapabilities']),
						(value) => typeof value === 'function'
					),
				})
			)
		}

		onReceiveMessage = (e: MessageEvent) => {
			if ((e.origin === 'null' || e.origin === self.origin) && this.frame && e.source === this.frame.contentWindow) {
				const data = e.data || e['message']
				if (!data) return
				if (data.type) {
					this.actSofieMessage(data)
				} else {
					this.actMOSMessage(e, data)
				}
			}
		}

		actMOSMessage = (e: any, message: string) => {
			const data: MosPluginMessage | undefined = parseMosPluginMessageXml(message)

			if (data) {
				return this.handleMosMessage(e, data)
			}
		}

		sendMOSAppInfo() {
			let uiMetrics: MOSUIMetric[] | undefined = undefined
			if (this.frame) {
				const size = this.frame.getClientRects().item(0)
				if (size) {
					uiMetrics = [
						literal<MOSUIMetric>({
							startx: size.left,
							starty: size.top,
							endx: size.left + size.width,
							endy: size.top + size.height,
							mode: MOSUIMetricMode.Contained,
						}),
					]
				}
			}
			this.sendMOSMessage(createMosAppInfoXmlString(uiMetrics))
		}

		private findBucketId(el: HTMLElement): BucketId | undefined {
			while (el.dataset.bucketId === undefined && el.parentElement) {
				el = el.parentElement
			}

			if (el) {
				return protectString(el.dataset.bucketId)
			}

			return undefined
		}

		receiveMOSItem(e: any, mosItem: MOS.IMOSItem) {
			const { t, playlist } = this.props

			console.log('Object received, passing onto blueprints', mosItem)

			const bucketId = this.findBucketId(e.target)
			let targetBucket

			if (bucketId) {
				targetBucket = Buckets.findOne(bucketId)
			} else {
				targetBucket = Buckets.findOne()
			}

			let targetRundown: Rundown | undefined
			let currentPart: PartInstance | undefined
			if (playlist.currentPartInstanceId || playlist.nextPartInstanceId) {
				if (playlist.currentPartInstanceId !== null) {
					currentPart = PartInstances.findOne(playlist.currentPartInstanceId)
				} else if (playlist.nextPartInstanceId !== null) {
					currentPart = PartInstances.findOne(playlist.nextPartInstanceId)
				}

				if (!currentPart) {
					throw new Meteor.Error(
						`Selected part could not be found: "${playlist.currentPartInstanceId || playlist.nextPartInstanceId}"`
					)
				}

				targetRundown = Rundowns.findOne(currentPart.rundownId)
			} else {
				targetRundown = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)[0]
			}

			if (!targetRundown) {
				throw new Meteor.Error('Target rundown could not be determined!')
			}
			const showStyleBaseId = targetRundown.showStyleBaseId

			doUserAction(t, e, UserAction.INGEST_BUCKET_ADLIB, (e, ts) =>
				MeteorCall.userAction.bucketAdlibImport(
					e,
					ts,
					targetBucket ? targetBucket._id : protectString(''),
					showStyleBaseId,
					literal<IngestAdlib>({
						externalId: mosItem.ObjectID ? mosItem.ObjectID.toString() : '',
						name: mosItem.ObjectSlug ? mosItem.ObjectSlug.toString() : '',
						payloadType: 'MOS',
						payload: fixMosData(mosItem),
					})
				)
			)
		}

		handleMosMessage = (e: any, mos: MosPluginMessage) => {
			if (mos.ncsReqAppInfo) {
				this.sendMOSAppInfo()
			} else if (mos.item) {
				this.receiveMOSItem(e, mos.item)
			}
		}

		actSofieMessage = (message: SofieExternalMessage) => {
			check(message.id, String)
			check(message.type, String)

			if (Object.values(SofieExternalMessageType).indexOf(message.type) < 0) {
				console.error(`ExternalFramePanel: Unknown message type: ${message.type}`)
				return
			}

			if (message.replyToId && this.awaitingReply[message.replyToId]) {
				this.awaitingReply[message.replyToId].resolve(message)
				delete this.awaitingReply[message.replyToId]
				return
			}

			switch (message.type) {
				// perform a three-way handshake: HELLO -> WELCOME -> ACK
				case SofieExternalMessageType.HELLO:
					this.sendSofieMessageAwaitReply(
						literal<WelcomeSofieExternalMessage>({
							id: getRandomString(),
							replyToId: message.id,
							type: SofieExternalMessageType.WELCOME,
							payload: {
								host: 'Sofie Automation System',
								version: PackageInfo.version,
								rundownPlaylistId: this.props.playlist._id,
							},
						}),
						true
					)
						.then((response) => {
							if (response.type === SofieExternalMessageType.ACK) {
								this.initialized = true
								this.sendSofieCurrentState()
							}
						})
						.catch((e) => console.warn(e))
					break
				case SofieExternalMessageType.FOCUS_IN: {
					this.sendSofieMessage(
						literal<SofieExternalMessage>({
							id: getRandomString(),
							replyToId: message.id,
							type: SofieExternalMessageType.ACK,
						})
					)
					// select a button on the right-hand side bar, as these are fixed in the viewport and won't cause
					// any automatic scroll behavior
					const randomEl = document.querySelector<HTMLButtonElement>('button.status-bar__controls__button')
					if (randomEl) randomEl.focus()
					break
				}
				case SofieExternalMessageType.ACK:
				case SofieExternalMessageType.NAK:
					// noop
					break
				case SofieExternalMessageType.CURRENT_PART_CHANGED:
				case SofieExternalMessageType.NEXT_PART_CHANGED:
				case SofieExternalMessageType.KEYBOARD_EVENT:
				case SofieExternalMessageType.WELCOME:
					console.warn('Sofie ExternalFramePanel API Message received in unusual direction', message)
					break
				default:
					assertNever(message.type)
					break
			}
		}

		sendSofieMessageAwaitReply = (
			message: SofieExternalMessage,
			uninitialized?: boolean
		): Promise<SofieExternalMessage> => {
			return new Promise((resolve, reject) => {
				if (this.initialized || uninitialized) {
					this.awaitingReply[message.id] = { resolve, reject }
					this.sendSofieMessage(message, uninitialized)
				} else {
					reject(new Error('ExternalFramePanel guest not initialized'))
				}
			})
		}

		sendSofieMessage = (data: SofieExternalMessage, uninitialized?: boolean) => {
			if (this.frame && this.frame.contentWindow && (this.initialized || uninitialized)) {
				const url = new URL(this.props.panel.url)
				this.frame.contentWindow.postMessage(data, `${url.protocol}//${url.host}`) // host already contains the port number, if specified
			}
		}

		sendMOSMessage = (data: string) => {
			if (this.frame && this.frame.contentWindow) {
				const url = new URL(this.props.panel.url)
				this.frame.contentWindow.postMessage(data, `${url.protocol}//${url.host}`) // host already contains the port number, if specified
			}
		}

		sendSofieCurrentState() {
			this.sendSofieMessage(
				literal<CurrentNextPartChangedSofieExternalMessage>({
					id: getRandomString(),
					type: SofieExternalMessageType.CURRENT_PART_CHANGED,
					payload: {
						partInstanceId: this.props.playlist.currentPartInstanceId,
					},
				})
			)
			this.sendSofieMessage(
				literal<CurrentNextPartChangedSofieExternalMessage>({
					id: getRandomString(),
					type: SofieExternalMessageType.NEXT_PART_CHANGED,
					payload: {
						partInstanceId: this.props.playlist.nextPartInstanceId,
					},
				})
			)
		}

		onDragOver = (e: DragEvent) => {
			if (this.failedDragTimeout) {
				Meteor.clearTimeout(this.failedDragTimeout)
			}

			let dragAllowed = false
			if (e.dataTransfer) {
				if (e.dataTransfer.getData('Text').trim().endsWith('</mos>')) {
					// this is quite probably a MOS object
					dragAllowed = true
				} else if (
					e.dataTransfer.items.length > 0 &&
					e.dataTransfer.types.indexOf('text/plain') >= 0 &&
					e.dataTransfer.files.length === 0
				) {
					// it might be a MOS object, but we can't know
					dragAllowed = true
				}
				// else if (
				// 	e.dataTransfer.items.length === 0 &&
				// 	e.dataTransfer.types.length === 0 &&
				// 	e.dataTransfer.files.length === 0
				// ) {
				// 	// it might be a MOS object, but we can't know
				// 	dragAllowed = true
				// 	console.log(e.dataTransfer)
				// }

				if (dragAllowed) {
					e.dataTransfer.dropEffect = 'copy'
					e.dataTransfer.effectAllowed = 'copy'

					const event = new CustomEvent<{}>(MOSEvents.dragenter, {
						cancelable: false,
					})
					window.dispatchEvent(event)
				} else {
					e.dataTransfer.dropEffect = 'none'
					e.dataTransfer.effectAllowed = 'none'
				}
			}

			e.preventDefault()

			this.failedDragTimeout = Meteor.setTimeout(this.onDragLeave, 150)
		}

		onDragEnter = (e: DragEvent) => {
			e.preventDefault()
		}

		onDragLeave = (_e: Event) => {
			this.failedDragTimeout = undefined
			const event = new CustomEvent<{}>(MOSEvents.dragleave, {
				cancelable: false,
			})
			window.dispatchEvent(event)
		}

		onDrop = (e: DragEvent) => {
			if (e.dataTransfer) {
				if (e.dataTransfer.getData('Text').trim().endsWith('</mos>')) {
					// this is quite probably a MOS object, let's try and ingest it
					this.actMOSMessage(e, e.dataTransfer.getData('Text'))
				} else if (
					e.dataTransfer.items.length > 0 &&
					e.dataTransfer.types.indexOf('text/plain') >= 0 &&
					e.dataTransfer.files.length === 0
				) {
					for (const dataTransferItem of e.dataTransfer.items) {
						// skip, if not of text/plain type
						if (dataTransferItem.type !== 'text/plain') continue
						dataTransferItem.getAsString((text: string) => {
							if (text.trim().endsWith('</mos>')) {
								this.actMOSMessage(e, text)
							}
						})
					}
				}
			}
			// else if (
			// 	e.dataTransfer.items.length === 0 &&
			// 	e.dataTransfer.types.length === 0 &&
			// 	e.dataTransfer.files.length === 0
			// ) {
			// 	// there are no items, no data types and no files, this is probably a cross-frame drag-and-drop
			// 	// let's try and ask the plugin for some content maybe?
			// 	console.log('Requesting an object because of a dubious drop event')
			// 	this.sendMOSMessage(createMosItemRequest())
			// }

			const event = new CustomEvent<{}>(MOSEvents.dragleave, {
				cancelable: false,
			})
			window.dispatchEvent(event)

			// When dragging from an iframe, the focus stays within the iframe.
			// This can cause confusion among users, since Sofie-keyboard shortcuts doesn't work, until they click somewhere in Sofie.
			// To solve this, we simply reset the focus so that the iframe doesn't have the focus anymore.
			const activeElement = document.activeElement as HTMLElement | undefined
			if (activeElement?.tagName === 'IFRAME') {
				activeElement.blur?.()
			}
		}

		registerHandlers = () => {
			document.addEventListener('keydown', this.onKeyEvent)
			document.addEventListener('keyup', this.onKeyEvent)

			document.addEventListener('dragover', this.onDragOver)
			document.addEventListener('dragenter', this.onDragEnter)
			document.addEventListener('dragexit', this.onDragLeave)
			document.addEventListener('drop', this.onDrop)
		}

		unregisterHandlers = () => {
			document.removeEventListener('keydown', this.onKeyEvent)
			document.removeEventListener('keydown', this.onKeyEvent)

			document.removeEventListener('dragover', this.onDragOver)
			document.removeEventListener('dragenter', this.onDragEnter)
			document.removeEventListener('dragleave', this.onDragLeave)
			document.removeEventListener('dragexit', this.onDragLeave)
			document.removeEventListener('drop', this.onDrop)
		}

		componentDidUpdate(prevProps: IProps) {
			if (prevProps.playlist.currentPartInstanceId !== this.props.playlist.currentPartInstanceId) {
				this.sendSofieMessage(
					literal<CurrentNextPartChangedSofieExternalMessage>({
						id: getRandomString(),
						type: SofieExternalMessageType.CURRENT_PART_CHANGED,
						payload: {
							partInstanceId: this.props.playlist.currentPartInstanceId,
							prevPartInstanceId: prevProps.playlist.currentPartInstanceId,
						},
					})
				)
			}

			if (prevProps.playlist.nextPartInstanceId !== this.props.playlist.nextPartInstanceId) {
				this.sendSofieMessage(
					literal<CurrentNextPartChangedSofieExternalMessage>({
						id: getRandomString(),
						type: SofieExternalMessageType.NEXT_PART_CHANGED,
						payload: {
							partInstanceId: this.props.playlist.nextPartInstanceId,
							prevPartInstanceId: prevProps.playlist.nextPartInstanceId,
						},
					})
				)
			}
		}

		componentDidMount() {
			window.addEventListener('message', this.onReceiveMessage)
		}

		componentWillUnmount() {
			// reject all outstanding promises for replies
			_.each(this.awaitingReply, (promise) => promise.reject(new Error('ExternalFramePanel unmounting')))
			this.unregisterHandlers()
			window.removeEventListener('message', this.onReceiveMessage)
		}

		render() {
			const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
			const scale = isDashboardLayout ? (this.props.panel as DashboardLayoutExternalFrame).scale || 1 : 1
			const frameStyle = {
				transform: `scale(${scale})`,
				width: `calc(100% / ${scale})`,
				height: `calc(100% / ${scale})`,
			}
			return (
				<div
					className={ClassNames(
						'external-frame-panel',
						RundownLayoutsAPI.isDashboardLayout(this.props.layout)
							? (this.props.panel as DashboardLayoutExternalFrame).customClasses
							: undefined
					)}
					style={{
						visibility: this.props.visible ? 'visible' : 'hidden',
						...(RundownLayoutsAPI.isDashboardLayout(this.props.layout)
							? dashboardElementStyle(this.props.panel as DashboardLayoutExternalFrame)
							: {}),
					}}
				>
					<iframe
						ref={this.setElement}
						className="external-frame-panel__iframe"
						src={this.props.panel.url}
						sandbox="allow-forms allow-popups allow-scripts allow-same-origin"
						style={frameStyle}
					></iframe>
					{this.props.panel.disableFocus && <div className="external-frame-panel__overlay" style={frameStyle}></div>}
				</div>
			)
		}
	}
)
