import React, { useEffect, useImperativeHandle } from 'react'
import { NoraContent } from '@sofie-automation/blueprints-integration'
import Escape from './../../lib/Escape'

interface IPropsHeader {
	noraContent: NoraContent | undefined
	style: React.CSSProperties
}

interface IStateHeader extends IPropsHeader {
	show: boolean
}

export const NoraFloatingInspector = React.forwardRef<HTMLDivElement, IPropsHeader>(function NoraFloatinInspector(
	props: IPropsHeader,
	ref
) {
	useImperativeHandle(
		ref,
		() => {
			return NoraPreviewRenderer._singletonRef.rootElement
		},
		[]
	)

	useEffect(() => {
		if (props.noraContent) {
			NoraPreviewRenderer.show()
		}

		return () => {
			NoraPreviewRenderer.hide()
		}
	}, [])

	useEffect(() => {
		if (props.noraContent) {
			NoraPreviewRenderer.update(props.noraContent, props.style)
		}
	}, [props.noraContent, props.style])

	return null
})

export class NoraPreviewRenderer extends React.Component<{}, IStateHeader> {
	static _singletonRef: NoraPreviewRenderer

	iframeElement: HTMLIFrameElement
	rootElement: HTMLDivElement

	static update(noraContent: NoraContent, style: React.CSSProperties): void {
		NoraPreviewRenderer._singletonRef._update(noraContent, style)
	}

	static show(): void {
		NoraPreviewRenderer._singletonRef._show()
	}

	static hide(): void {
		NoraPreviewRenderer._singletonRef._hide()
	}

	constructor(props: {}) {
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
					step: noraContent.payload.step,
				},
			},
			'*'
		)
	}

	private _show() {
		this.setState({
			show: true,
		})
	}

	private _update(noraContent: NoraContent, style: React.CSSProperties) {
		if (JSON.stringify(this.state.noraContent) !== JSON.stringify(noraContent)) {
			if (this.iframeElement && this.iframeElement.contentWindow) {
				this.postNoraEvent(this.iframeElement.contentWindow, noraContent)
			}
		}

		this.setState({
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

		// set up IntersectionObserver to keep the preview inside the viewport
		const options = {
			threshold: [] as number[],
		}
		for (let i = 0; i < 50; i++) {
			options.threshold.push(i / 50)
		}
	}

	private _setRootElement = (e: HTMLDivElement) => {
		this.rootElement = e
	}

	private getElStyle() {
		const style = { ...this.state.style }
		style.visibility = this.state.show ? 'visible' : 'hidden'
		return style
	}

	render(): JSX.Element {
		const stepContent = this.state.noraContent?.payload?.step
		const isMultiStep = this.state.noraContent?.payload?.step?.enabled === true

		return (
			<React.Fragment>
				<Escape to="document">
					<div
						className="segment-timeline__mini-inspector segment-timeline__mini-inspector--graphics segment-timeline__mini-inspector--graphics--preview"
						style={this.getElStyle()}
						ref={this._setRootElement}
					>
						<div className="preview">
							<img width="100%" src="/images/previewBG.jpg" alt="" />
							<iframe
								sandbox="allow-scripts allow-same-origin"
								src={this.state.noraContent?.previewRenderer}
								ref={this._setPreview}
								width="1920"
								height="1080"
							></iframe>
						</div>
						{isMultiStep && stepContent ? (
							<div className="segment-timeline__mini-inspector--graphics--preview__step-chevron">
								{stepContent.to === 'next' ? (stepContent.from || 0) + 1 : stepContent.to || 1}
								{typeof stepContent.total === 'number' && stepContent.total > 0 ? (
									<span className="segment-timeline__mini-inspector--graphics--preview__step-chevron__total">
										/{stepContent.total}
									</span>
								) : null}
							</div>
						) : null}
					</div>
				</Escape>
			</React.Fragment>
		)
	}
}
