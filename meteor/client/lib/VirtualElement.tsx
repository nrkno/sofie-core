import * as React from 'react'
import InView, { useInView } from 'react-intersection-observer'

export interface IProps {
	noFirstRender?: boolean
	placeholderHeight?: number
}

interface IState {
	inView: boolean
	isMeasured: boolean

	
	width: string | number
	clientHeight: number
	marginLeft: string | number
	marginRight: string | number
	marginTop: string | number
	marginBottom: string | number
}

const OPTIMIZE_PERIOD = 5000
const IN_VIEW_GRACE_PERIOD = 500

export class VirtualElement extends React.Component<IProps, IState> {
	private el: HTMLElement | null = null
	private instance: HTMLElement | null = null
	private optimizeTimeout: NodeJS.Timer | null = null
	private changeRequestIdle: number | null = null

	constructor (props: IProps) {
		super(props)
		this.state = {
			inView: true,
			isMeasured: false,
			clientHeight: 0,
			width: 'auto',
			marginBottom: 0,
			marginTop: 0,
			marginLeft: 0,
			marginRight: 0
		}
	}

	visibleChanged = (inView: boolean) => {
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
		if (this.el) {
			const style = window.getComputedStyle(this.el)
			this.setState({
				isMeasured: true,
				width: style.width || 'auto',
				clientHeight: this.el.clientHeight,
				marginTop: style.marginTop || '0px',
				marginBottom: style.marginBottom || '0px',
				marginLeft: style.marginLeft || '0px',
				marginRight: style.marginRight || '0px'
			})
		}
	}

	findChildElement = () => {
		if (!this.el) {
			const el = this.instance ? this.instance.firstElementChild as HTMLElement : null
			if (el && !el.classList.contains('virtual-element-placeholder')) {
				this.el = el
				setTimeout(this.refreshSizing, 250)
			}
		}
	}

	setRef = (instance: HTMLElement | null) => {
		this.instance = instance
		this.findChildElement()
	}

	render () {
		return (
			<InView threshold={0} rootMargin='100% 0px 100% 0px' onChange={this.visibleChanged}>
				<div ref={this.setRef}>
					{(!this.state.inView && (this.state.isMeasured || this.props.noFirstRender)) ?
						<div className='virtual-element-placeholder placeholder-shimmer-element' style={{
							width: this.state.width,
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
