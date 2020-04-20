import * as React from 'react'
import { Random } from 'meteor/random'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import { RundownLayoutExternalFrame, RundownLayoutBase, DashboardLayoutExternalFrame } from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import { literal } from '../../../lib/lib'
import { RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { PartInstanceId } from '../../../lib/collections/PartInstances'

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
	FOCUS_IN = 'focus_in'
}

interface SofieExternalMessage {
	id: string,
	replyToId?: string
	type: SofieExternalMessageType
	payload?: any
}

interface HelloSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.HELLO
	payload: never
}

interface WelcomeSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.WELCOME
	payload: {
		host: string
		version: string
		rundownPlaylistId: RundownPlaylistId
	}
}

interface KeyboardEventSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.KEYBOARD_EVENT
	payload: KeyboardEvent & {
		currentTarget: null,
		path: null,
		scrElement: null,
		target: null,
		view: null
	}
}

interface CurrentNextPartChangedSofieExternalMessage extends SofieExternalMessage {
	type: SofieExternalMessageType.CURRENT_PART_CHANGED | SofieExternalMessageType.NEXT_PART_CHANGED
	payload: {
		partInstanceId: PartInstanceId | null
		prevPartInstanceId?: PartInstanceId | null
	}
}

export class ExternalFramePanel extends React.Component<IProps> {
	frame: HTMLIFrameElement
	mounted: boolean = false
	initialized: boolean = false

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
		this.sendMessage(literal<SofieExternalMessage>({
			id: Random.id(),
			type: SofieExternalMessageType.KEYBOARD_EVENT,
			// Send the event sanitized to prevent sending huge objects
			payload: _.omit(_.omit(e,
				['currentTarget',
					'path',
					'srcElement',
					'target',
					'view',
					'sourceCapabilities']
			), (value, key) => typeof value === 'function')
		}))
	}

	onReceiveMessage = (e: MessageEvent) => {
		if (e.origin === 'null' && this.frame && e.source === this.frame.contentWindow) {
			const data = e.data || e['message']
			if (!data) return
			this.actMessage(data)
		}
	}

	actMessage = (message: SofieExternalMessage) => {
		check(message.id, String)
		check(message.type, String)

		if (_.values(SofieExternalMessageType).indexOf(message.type) < 0) {
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
				this.sendMessageAwaitReply(literal<WelcomeSofieExternalMessage>({
					id: Random.id(),
					replyToId: message.id,
					type: SofieExternalMessageType.WELCOME,
					payload: {
						host: 'Sofie Automation System',
						version: PackageInfo.version,
						rundownPlaylistId: this.props.playlist._id
					}
				}), true).then((e) => {
					if (e.type === SofieExternalMessageType.ACK) {
						this.initialized = true
						this.sendCurrentState()
					}
				}).catch(e => console.warn)
				break
			case SofieExternalMessageType.FOCUS_IN:
				this.sendMessage(literal<SofieExternalMessage>({
					id: Random.id(),
					replyToId: message.id,
					type: SofieExternalMessageType.ACK
				}))
				const randomEl = document.querySelector('button')
				if (randomEl) randomEl.focus()
				break
		}
	}

	sendMessageAwaitReply = (message: SofieExternalMessage, uninitialized?: boolean): Promise<SofieExternalMessage> => {
		return new Promise((resolve, reject) => {
			if (this.initialized || uninitialized) {
				this.awaitingReply[message.id] = { resolve, reject }
				this.sendMessage(message, uninitialized)
			} else {
				reject(new Error('ExternalFramePanel guest not initialized'))
			}
		})
	}

	sendMessage = (data: SofieExternalMessage, uninitialized?: boolean) => {
		if (this.frame && this.frame.contentWindow && (this.initialized || uninitialized)) {
			this.frame.contentWindow.postMessage(data, '*')
		}
	}

	sendCurrentState () {
		this.sendMessage(literal<CurrentNextPartChangedSofieExternalMessage>({
			id: Random.id(),
			type: SofieExternalMessageType.CURRENT_PART_CHANGED,
			payload: {
				partInstanceId: this.props.playlist.currentPartInstanceId
			}
		}))
		this.sendMessage(literal<CurrentNextPartChangedSofieExternalMessage>({
			id: Random.id(),
			type: SofieExternalMessageType.NEXT_PART_CHANGED,
			payload: {
				partInstanceId: this.props.playlist.nextPartInstanceId
			}
		}))
	}

	registerHandlers = () => {
		document.addEventListener('keydown', this.onKeyEvent)
		document.addEventListener('keyup', this.onKeyEvent)
	}

	unregisterHandlers = () => {
		document.removeEventListener('keydown', this.onKeyEvent)
		document.removeEventListener('keydown', this.onKeyEvent)
	}

	componentDidUpdate (prevProps: IProps) {
		if (prevProps.playlist.currentPartInstanceId !== this.props.playlist.currentPartInstanceId) {
			this.sendMessage(literal<CurrentNextPartChangedSofieExternalMessage>({
				id: Random.id(),
				type: SofieExternalMessageType.CURRENT_PART_CHANGED,
				payload: {
					partInstanceId: this.props.playlist.currentPartInstanceId,
					prevPartInstanceId: prevProps.playlist.currentPartInstanceId
				}
			}))
		}

		if (prevProps.playlist.nextPartInstanceId !== this.props.playlist.nextPartInstanceId) {
			this.sendMessage(literal<CurrentNextPartChangedSofieExternalMessage>({
				id: Random.id(),
				type: SofieExternalMessageType.NEXT_PART_CHANGED,
				payload: {
					partInstanceId: this.props.playlist.nextPartInstanceId,
					prevPartInstanceId: prevProps.playlist.nextPartInstanceId
				}
			}))
		}
	}

	componentDidMount () {
		window.addEventListener('message', this.onReceiveMessage)
	}

	componentWillUnmount () {
		// reject all outstanding promises for replies
		_.each(this.awaitingReply, (promise) => promise.reject(new Error('ExternalFramePanel unmounting')))
		this.unregisterHandlers()
		window.removeEventListener('message', this.onReceiveMessage)
	}

	render () {
		return <div className='external-frame-panel'
			style={
				_.extend(
					RundownLayoutsAPI.isDashboardLayout(this.props.layout) ?
						dashboardElementPosition(this.props.panel as DashboardLayoutExternalFrame) :
						{},
					{
						'visibility': this.props.visible ? 'visible' : 'hidden'
					}
				)
			}>
			<iframe
			ref={this.setElement}
			className='external-frame-panel__iframe'
			src={this.props.panel.url}
			sandbox='allow-forms allow-popups allow-scripts allow-same-origin'></iframe>
		</div>
	}
}
