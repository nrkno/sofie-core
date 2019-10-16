import { NoraPayload } from "tv-automation-sofie-blueprints-integration";
import * as React from "react";
import { createMosObjectXmlStringFromPayload } from "../../../../lib/data/nora/browser-plugin-data";
import { mosXmlString2Js } from "../../../../lib/parsers/mos/mosXml2Js";

//TODO: figure out what the origin should be
const LOCAL_ORIGIN = `${window.location.protocol}//${window.location.host}`
const MODULE_BROWSER_URL = new URL(`https://nora.nrk.no/module/browser?origin=${LOCAL_ORIGIN}&logging=true&dev=true`)
const MODULE_BROWSER_ORIGIN = `${MODULE_BROWSER_URL.protocol}//${MODULE_BROWSER_URL.host}`

export { NoraItemEditor }

interface INoraEditorProps {
	payload: NoraPayload
}

class NoraItemEditor extends React.Component<INoraEditorProps> {
	iframe: HTMLIFrameElement

	componentDidMount () {
		this.setUpEventListeners(window)
	}

	componentDidUpdate (prevProps: INoraEditorProps) {
		console.log('componentDidUpdate')
		if (this.iframe && this.iframe.contentWindow) {
			this.setUpEventListeners(this.iframe.contentWindow)
		}
		this.setUpEventListeners(window)

		// if (JSON.stringify(prevProps.payload) !== JSON.stringify(this.props.payload)) {
		// 	this.postIframePayload()
		// }
	}

	shouldComponentUpdate () {
		console.log('shouldComponentUpdate')

		return false
	}

	postPayload (target: Window | null) {
		console.log('Posting payload', target)
		if (target) {
			const payloadXmlString = createMosObjectXmlStringFromPayload(this.props.payload)
			target.postMessage(payloadXmlString, MODULE_BROWSER_ORIGIN)
			console.log('Sent message', payloadXmlString, target)
		}
	}

	setUpEventListeners (target: Window) {
		target.addEventListener('message', (event) => {
			this.handleMessage(event)
		})
	}

	handleMessage (event: MessageEvent) {
		if (event.origin !== MODULE_BROWSER_ORIGIN) {
			console.log(`Origin rejected (wanted ${MODULE_BROWSER_ORIGIN}, got ${event.origin})`)
			return
		}

		console.log('Received message', event)
		const data: any = event.data && mosXmlString2Js(event.data)
		console.log('Message data', data)

		if (data.mos) {
			return this.handleMosMessage(data.mos)
		}

		console.log('Unknown message', data)
	}

	handleMosMessage (mos: any) {
		if (mos.ncsReqAppInfo) {
			this.postPayload(this.iframe.contentWindow)
		}
	}

	render () {
		console.log('Item editor render')
		return React.createElement('iframe', {
			ref: (element) => { this.iframe = element as HTMLIFrameElement },
			src: MODULE_BROWSER_URL.href,
			style: {
				border: 0,
				height: 720,
				width: 1280
			}
		})
	}
}
