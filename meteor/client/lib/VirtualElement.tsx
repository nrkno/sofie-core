import * as React from 'react'
import InView, { useInView } from 'react-intersection-observer'

export interface IProps {
	initialShow?: boolean
	placeholderHeight?: number
	debug?: boolean
	placeholderClassName?: string
	width?: string | number
	margin?: string
}

declare global {
	interface Window {
		requestIdleCallback(callback: Function, options?: {
			timeout: number
		}): number
		cancelIdleCallback(callback: number)
	}
}

interface IState {
	inView: boolean
	isMeasured: boolean

	width: string | number
	clientHeight: number
	marginLeft: string | number | undefined
	marginRight: string | number | undefined
	marginTop: string | number | undefined
	marginBottom: string | number | undefined
}

const OPTIMIZE_PERIOD = 5000
const IN_VIEW_GRACE_PERIOD = 500

export class VirtualElement extends React.Component<IProps, IState> {
	private el: HTMLElement | null = null
	private instance: HTMLElement | null = null
	private optimizeTimeout: NodeJS.Timer | null = null
	private changeRequestIdle: number | null = null
	private refreshSizingTimeout: NodeJS.Timer | null = null

	constructor (props: IProps) {
		super(props)
		this.state = {
			inView: props.initialShow || false,
			isMeasured: false,
			clientHeight: 0,
			width: 'auto',
			marginBottom: undefined,
			marginTop: undefined,
			marginLeft: undefined,
			marginRight: undefined
		}
	}

	visibleChanged = (inView: boolean) => {
		this.props.debug && console.log('Changed', inView)
		if (inView && !this.state.inView) {
			if (this.optimizeTimeout) {
				clearTimeout(this.optimizeTimeout)
				this.optimizeTimeout = null
			}
			if (this.changeRequestIdle) window.cancelIdleCallback(this.changeRequestIdle)
			this.changeRequestIdle = window.requestIdleCallback(() => {
				this.setState({
					inView
				})
			}, {
				timeout: IN_VIEW_GRACE_PERIOD
			})
		} else if (!inView && this.state.inView) {
			if (this.optimizeTimeout) clearTimeout(this.optimizeTimeout)

			this.optimizeTimeout = setTimeout(() => {
				this.optimizeTimeout = null
				if (this.changeRequestIdle) window.cancelIdleCallback(this.changeRequestIdle)
				this.changeRequestIdle = window.requestIdleCallback(() => {
					this.setState({
						inView
					})
				}, {
					timeout: IN_VIEW_GRACE_PERIOD
				})
			}, OPTIMIZE_PERIOD)
		} else {
			if (this.optimizeTimeout) {
				clearTimeout(this.optimizeTimeout)
				this.optimizeTimeout = null
			}
		}
	}

	refreshSizing = () => {
		this.refreshSizingTimeout = null;
		if (this.el) {
			const style = window.getComputedStyle(this.el)
			this.setState({
				isMeasured: true,
				width: style.width || 'auto',
				clientHeight: this.el.clientHeight,
				marginTop: style.marginTop || undefined,
				marginBottom: style.marginBottom || undefined,
				marginLeft: style.marginLeft || undefined,
				marginRight: style.marginRight || undefined
			})
			// console.log('Re-measuring child')
		}
	}

	findChildElement = () => {
		if (!this.el) {
			const el = this.instance ? this.instance.firstElementChild as HTMLElement : null
			if (el && !el.classList.contains('virtual-element-placeholder')) {
				this.el = el
				this.refreshSizingTimeout = setTimeout(this.refreshSizing, 250)
			}
		}
	}

	setRef = (instance: HTMLElement | null) => {
		this.instance = instance
		this.findChildElement()
	}

	componentDidUpdate (prevProps, prevState: IState) {
		if (this.state.inView && prevState.inView !== this.state.inView && !this.state.isMeasured) {
			// console.log('Find actual child')
			this.findChildElement()
		}
	}

	componentWillUnmount () {
		if (this.changeRequestIdle) window.cancelIdleCallback(this.changeRequestIdle)
		if (this.optimizeTimeout) clearTimeout(this.optimizeTimeout)
		if (this.refreshSizingTimeout) clearTimeout(this.refreshSizingTimeout)
	}

	render () {
		this.props.debug && console.log(this.state.inView, this.props.initialShow, this.state.isMeasured, (!this.state.inView && (!this.props.initialShow || this.state.isMeasured)))
		return (
			<InView threshold={0} rootMargin={this.props.margin || '50% 0px 50% 0px'} onChange={this.visibleChanged}>
				<div ref={this.setRef}>
					{(!this.state.inView && (!this.props.initialShow || this.state.isMeasured)) ?
						<div className={'virtual-element-placeholder ' + (this.props.placeholderClassName || '')} style={{
							width: this.props.width || this.state.width,
							height: (this.state.clientHeight || this.props.placeholderHeight || '0') + 'px',
							marginTop: this.state.marginTop,
							marginLeft: this.state.marginLeft,
							marginRight: this.state.marginRight,
							marginBottom: this.state.marginBottom
						}}></div> :
						this.props.children}
				</div>
			</InView>
		)
	}
}
