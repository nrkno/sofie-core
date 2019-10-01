import * as React from 'react'
import { NoraContent } from 'tv-automation-sofie-blueprints-integration'
import * as Escape from 'react-escape'

interface IPropsHeader {
	noraContent: NoraContent
	style: { [key: string]: any }
}

interface IStateHeader extends IPropsHeader {
	show: boolean
}

export class NoraPreviewController extends React.Component<IPropsHeader> {
	componentDidMount () {
		NoraPreviewRenderer.show(this.props.noraContent, this.props.style)
	}

	componentDidUpdate () {
		NoraPreviewRenderer.show(this.props.noraContent, this.props.style)
	}

	componentWillUnmount () {
		NoraPreviewRenderer.hide()
	}

	render () {
		return null
	}
}

export class NoraPreviewRenderer extends React.Component<{}, IStateHeader> {
	static __singletonRef: NoraPreviewRenderer

	iframeElement: HTMLIFrameElement

	static show (noraContent: NoraContent, style: { [key: string]: any }) {
		NoraPreviewRenderer.__singletonRef.__show(noraContent, style)
	}

	static hide () {
		NoraPreviewRenderer.__singletonRef.__hide()
	}

	constructor (props) {
		super(props)

		NoraPreviewRenderer.__singletonRef = this
	}

	__show (noraContent: NoraContent, style: { [key: string]: any }) {
		if (this.state && JSON.stringify(this.state.noraContent) !== JSON.stringify(noraContent)) {
			if (this.iframeElement && this.iframeElement.contentWindow) {
				this.iframeElement.contentWindow.postMessage({
					event: 'nora',
					contentToShow: {
						'manifest': noraContent.payload.manifest,
						'template': {
							'event': 'preview',
							'name': noraContent.payload.template.name,
							'channel': 'gfx1',
							'layer': noraContent.payload.template.layer,
							'system': 'html'
						},
						'content': {
							...noraContent.payload.content,
							_valid: false
						},
						'timing': {
							duration: '00:05',
							in: 'auto',
							out: 'auto',
							timeIn: '00:00'
						}
					}
				}, '*')
			}
		}
		this.setState({
			show: true,
			noraContent,
			style
		})
	}

	__hide () {
		this.setState({
			...this.state,
			show: false
		})
	}

	private __setPreview = (e: HTMLIFrameElement) => {
		if (!e) return
		this.iframeElement = e
		const noraContent = this.state.noraContent
		window.onmessage = msg => {
			if (msg.data.source === 'nora-render') console.log(msg)
		}
		setTimeout(() => {
			if (e.contentWindow) {
				e.contentWindow.postMessage({
					event: 'nora',
					contentToShow: {
						'manifest': noraContent.payload.manifest,
						'template': {
							'event': 'preview',
							'name': noraContent.payload.template.name,
							'channel': 'gfx1',
							'layer': noraContent.payload.template.layer,
							'system': 'html'
						},
						'content': {
							...noraContent.payload.content,
							_valid: false
						},
						'timing': {
							duration: '00:05',
							in: 'auto',
							out: 'auto',
							timeIn: '00:00'
						}
					}
				}, '*')
			}
		}, 1000)
	}

	render () {
		if (!this.state) return null

		const style = { ...this.state.style }
		style['display'] = this.state.show ? 'block' : 'none'


		return <React.Fragment>
			<Escape to='document'>
				<div className='segment-timeline__mini-inspector segment-timeline__mini-inspector--graphics' style={style}>
					<div className='preview'>
						<img width='100%' src='../images/previewBG.png' alt=''/>
						<iframe
							sandbox='allow-scripts'
							src={this.state.noraContent.previewRenderer as string}
							ref={this.__setPreview}
							width='1920'
							height='1080'
						></iframe>
					</div>
				</div>
			</Escape>
		</React.Fragment>
	}
}
