import React, { useEffect } from 'react'
import { NoraContent } from '@sofie-automation/blueprints-integration'
import Escape from 'react-escape'

interface IPropsHeader {
	noraContent: NoraContent | undefined
	style: React.CSSProperties
}

interface IStateHeader extends IPropsHeader {
	show: boolean
}

export const NoraFloatingInspector: React.FunctionComponent<IPropsHeader> = (props: IPropsHeader) => {
	useEffect(() => {
		if (props.noraContent) {
			NoraPreviewRenderer.show(props.noraContent, props.style)
		}

		return () => {
			NoraPreviewRenderer.hide()
		}
	})
	return null
}

export class NoraPreviewRenderer extends React.Component<{}, IStateHeader> {
	static _singletonRef: NoraPreviewRenderer

	iframeElement: HTMLIFrameElement

	static show(noraContent: NoraContent, style: React.CSSProperties) {
		NoraPreviewRenderer._singletonRef._show(noraContent, style)
	}

	static hide() {
		NoraPreviewRenderer._singletonRef._hide()
	}

	constructor(props) {
		super(props)

		this.state = {
			show: false,
			noraContent: undefined,
			style: {},
		}
		NoraPreviewRenderer._singletonRef = this
	}

	private postNoraEvent(contentWindow: Window, noraContent: NoraContent) {
		contentWindow.postMessage(
			{
				event: 'nora',
				contentToShow: {
					manifest: noraContent.payload.manifest,
					template: {
						event: 'preview',
						name: noraContent.payload.template.name,
						channel: 'gfx1',
						layer: noraContent.payload.template.layer,
						system: 'html',
					},
					content: {
						...noraContent.payload.content,
						_valid: false,
					},
					timing: {
						duration: '00:05',
						in: 'auto',
						out: 'auto',
						timeIn: '00:00',
					},
				},
			},
			'*'
		)
	}

	private _show(noraContent: NoraContent, style: React.CSSProperties) {
		if (JSON.stringify(this.state.noraContent) !== JSON.stringify(noraContent)) {
			if (this.iframeElement && this.iframeElement.contentWindow) {
				this.postNoraEvent(this.iframeElement.contentWindow, noraContent)
			}
		}
		this.setState({
			show: true,
			noraContent,
			style,
		})
	}

	private _hide() {
		this.setState({
			show: false,
		})
	}

	private _setPreview = (e: HTMLIFrameElement) => {
		if (!e) return
		this.iframeElement = e
		const noraContent = this.state.noraContent
		window.onmessage = (msg) => {
			if (msg.data.source === 'nora-render') console.log(msg)
		}
		setTimeout(() => {
			if (e.contentWindow && noraContent) {
				this.postNoraEvent(e.contentWindow, noraContent)
			}
		}, 1000)
	}

	render() {
		if (!this.state) return null

		const style = { ...this.state.style }
		style.visibility = this.state.show ? 'visible' : 'hidden'

		return (
			<React.Fragment>
				<Escape to="document">
					<div
						className="segment-timeline__mini-inspector segment-timeline__mini-inspector--graphics segment-timeline__mini-inspector--graphics--preview"
						style={style}>
						<div className="preview">
							<img width="100%" src="../images/previewBG.png" alt="" />
							<iframe
								sandbox="allow-scripts allow-same-origin"
								src={this.state.noraContent?.previewRenderer}
								ref={this._setPreview}
								width="1920"
								height="1080"></iframe>
						</div>
					</div>
				</Escape>
			</React.Fragment>
		)
	}
}
