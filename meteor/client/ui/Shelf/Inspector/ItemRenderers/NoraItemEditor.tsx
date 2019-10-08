import { NoraPayload } from "tv-automation-sofie-blueprints-integration";
import * as React from "react";
import { createMosObjectXmlStringFromPayload } from "../../../../lib/data/nora/browser-plugin-data";

const MODULE_BROWSER_URL = 'https://nora.nrk.no/module/browser?origin=https://nora.nrk.no&logging=true&dev=true'

export { NoraItemEditor }

interface INoraEditorProps {
	payload: NoraPayload
}

class NoraItemEditor extends React.Component<INoraEditorProps> {
	iframe:HTMLIFrameElement

	componentDidMount () {
		this.postIframePayload()
	}

	componentDidUpdate (prevProps:INoraEditorProps) {
		if (JSON.stringify(prevProps.payload) !== JSON.stringify(this.props.payload)) {
			this.postIframePayload()
		}
	}

	postIframePayload () {
		if (this.iframe && this.iframe.contentWindow) {
			const payloadXmlString = createMosObjectXmlStringFromPayload(this.props.payload)
			//TODO: figure out what the origin should be
			this.iframe.contentWindow.postMessage(payloadXmlString, 'http://localhost:3000')
		}
	}

	render () {
		return React.createElement('iframe', {
			ref: (element) => {this.iframe = element as HTMLIFrameElement},
			src: MODULE_BROWSER_URL,
			style: {
				border: 0,
				height: 720,
				width: 1280
			}
		})
	}
}
