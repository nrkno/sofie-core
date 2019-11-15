import * as React from 'react'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { RundownLayoutExternalFrame, RundownLayoutBase, DashboardLayoutExternalFrame } from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import { literal } from '../../../lib/lib'

const PackageInfo = require('../../../package.json')

interface IProps {
	layout: RundownLayoutBase
	panel: RundownLayoutExternalFrame
	visible: boolean
}

enum SofieExternalMessageType {
	HELLO = 'hello',
	WELCOME = 'welcome',
	ACK = 'ack',
	NAK = 'nak',
	KEYBOARD_EVENT = 'keyboard_event'
}

interface SofieExternalMessage {
	id: string,
	replyToId?: string
	type: SofieExternalMessageType
	payload?: any
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
			payload: _.extend({}, e, {
				currentTarget: null,
				path: null,
				srcElement: null,
				target: null,
				view: null
			})
		}))
	}

	onReceiveMessage = (e: MessageEvent) => {
		if (e.origin === this.props.panel.url) {
			try {
				const data = JSON.parse(e.data || e['message'])
				this.actMessage(data)
			} catch (e) {
				console.error(`ExternalFramePanel: Unable to parse data from: ${e.origin}`, e)
			}
		}
	}

	actMessage = (message: SofieExternalMessage) => {
		if (!message.type || SofieExternalMessageType[message.type] === undefined) {
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
				this.sendMessageAwaitReply(literal<SofieExternalMessage>({
					id: Random.id(),
					replyToId: message.id,
					type: SofieExternalMessageType.WELCOME,
					payload: {
						host: 'Sofie Automation System',
						version: PackageInfo.version
					}
				})).then((e) => {
					if (e.type === SofieExternalMessageType.ACK) {
						this.initialized = true
					}
				})
				break;
		}
	}

	sendMessageAwaitReply = (message: SofieExternalMessage): Promise<SofieExternalMessage> => {
		return new Promise((resolve, reject) => {
			this.awaitingReply[message.id] = { resolve, reject }
			this.sendMessage(message)
		})
	}

	sendMessage = (data: SofieExternalMessage) => {
		if (this.frame && this.frame.contentWindow && this.initialized) {
			this.frame.contentWindow.postMessage(JSON.stringify(data), "*")
		}
	}

	registerHandlers = () => {
		document.addEventListener('keydown', this.onKeyEvent)
		document.addEventListener('keyup', this.onKeyEvent)
	}

	unregisterHandlers = () => {
		document.removeEventListener('keydown', this.onKeyEvent)
		document.removeEventListener('keydown', this.onKeyEvent)
	}

	componentDidMount () {
		window.addEventListener('message', this.onReceiveMessage)
	}

	componentWillUnmount () {
		// reject all outstanding promises for replies
		_.each(this.awaitingReply, (promise) => promise.reject())
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
			sandbox='allow-forms allow-popups allow-scripts'></iframe>
		</div> 
	}
}