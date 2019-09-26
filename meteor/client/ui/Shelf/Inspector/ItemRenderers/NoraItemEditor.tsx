import { NoraPayload } from "tv-automation-sofie-blueprints-integration";
import * as React from "react";

const MODULE_BROWSER_URL = 'https://nora.nrk.no/module/browser?origin=https://nora.nrk.no&logging=true&dev=true'

export { NoraItemEditor }

interface INoraEditorProps {
	payload: NoraPayload
}

class NoraItemEditor extends React.Component<INoraEditorProps> {
	render () {
		return React.createElement('iframe', {
			src: MODULE_BROWSER_URL,
			style: {
				border: 0,
				height: 720,
				width: 1280
			}
		})
	}
}
