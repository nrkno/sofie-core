import { NoraPayload } from "tv-automation-sofie-blueprints-integration";
import * as React from "react";
import { createMosObjectXmlStringFromPayload } from "../../../../lib/data/nora/browser-plugin-data";

//TODO: figure out what the origin should be
const origin = 'http://localhost:3000'
const MODULE_BROWSER_URL = `https://nora.nrk.no/module/browser?origin=${origin}&logging=true&dev=true`

export { NoraItemEditor }

interface INoraEditorProps {
	payload: NoraPayload
}

class NoraItemEditor extends React.Component<INoraEditorProps> {
	iframe: HTMLIFrameElement

	componentDidMount () {
		console.log('ComponentDidMount')
		this.setUpEventListeners()
	}

	componentDidUpdate (prevProps: INoraEditorProps) {
		console.log('componentDidUpdate')
		this.setUpEventListeners()

		// if (JSON.stringify(prevProps.payload) !== JSON.stringify(this.props.payload)) {
		// 	this.postIframePayload()
		// }
	}

	shouldComponentUpdate () {
		console.log('shouldComponentUpdate')

		return false
	}

	postIframePayload () {
		if (this.iframe && this.iframe.contentWindow) {
			const payloadXmlString = createMosObjectXmlStringFromPayload(this.props.payload)
			this.iframe.contentWindow.postMessage(payloadXmlString, origin)
			console.log('Sent message', payloadXmlString)
		}
	}

	setUpEventListeners () {
		console.log('setUpEventListeners')
		if (this.iframe && this.iframe.contentWindow) {
			this.iframe.contentWindow.addEventListener('load', (e) => { console.log('iframe window load', e) })
			this.iframe.contentWindow.addEventListener('DOMContentLoaded ', (e) => { console.log('iframe window DOMContentLoaded', e) })
			this.iframe.contentWindow.addEventListener('unload', (e) => { console.log('iframe window unload', e) })

			console.log('Registering iframe content window event listener...')
			this.iframe.contentWindow.addEventListener('message', (event) => {
				console.log('Got message', event.origin, event.data)
				this.handlePluginMessages(event)
			})
			console.log('Done.')
		}

	}

	handlePluginMessages (event: MessageEvent) {
		console.log('handlePluginMessage', event)
	}

	createReference (element: HTMLElement | null) {
		console.log('createReference')
		if (!element) {
			console.log('createReference got no element, this should never happen')
			return
		}

		this.iframe = element as HTMLIFrameElement
	}

	render () {
		console.log('Item editor render')
		return React.createElement('iframe', {
			ref: (event) => { this.createReference(event) },
			src: MODULE_BROWSER_URL,
			style: {
				border: 0,
				height: 720,
				width: 1280
			}
		})
	}
}
