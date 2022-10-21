import * as React from 'react'
import { InView } from 'react-intersection-observer'

export interface IProps {
	initialShow?: boolean
	placeholderHeight?: number
	_debug?: boolean
	placeholderClassName?: string
	width?: string | number
	margin?: string
	id?: string | undefined
	className?: string
}

declare global {
	interface Window {
		requestIdleCallback(
			callback: Function,
			options?: {
				timeout: number
			}
		): number
		cancelIdleCallback(callback: number)
	}
}

interface IElementMeasurements {
	width: string | number
	clientHeight: number
	marginLeft: string | number | undefined
	marginRight: string | number | undefined
	marginTop: string | number | undefined
	marginBottom: string | number | undefined
	id: string | undefined
}

interface IState extends IElementMeasurements {
	inView: boolean
	isMeasured: boolean
}

const OPTIMIZE_PERIOD = 5000
/**
 * This is a component that allows optimizing the amount of elements present in the DOM through replacing them
 * with placeholders when they aren't visible in the viewport.
 *
 * @export
 * @class VirtualElement
 * @extends {React.Component<IProps, IState>}
 */
export class VirtualElement extends React.Component<IProps, IState> {
	private el: HTMLElement | null = null
	private instance: HTMLElement | null = null
	private optimizeTimeout: NodeJS.Timer | null = null
	private refreshSizingTimeout: NodeJS.Timer | null = null
	private styleObj: CSSStyleDeclaration | undefined

	constructor(props: IProps) {
		super(props)
		this.state = {
			inView: props.initialShow || false,
			isMeasured: false,
			clientHeight: 0,
			width: 'auto',
			marginBottom: undefined,
			marginTop: undefined,
			marginLeft: undefined,
			marginRight: undefined,
			id: undefined,
		}
	}

	visibleChanged = (inView: boolean) => {
		this.props._debug && console.log(this.props.id, 'Changed', inView)
		if (this.optimizeTimeout) {
			clearTimeout(this.optimizeTimeout)
			this.optimizeTimeout = null
		}
		if (inView && !this.state.inView) {
			this.setState({
				inView,
			})
		} else if (!inView && this.state.inView) {
			this.optimizeTimeout = setTimeout(() => {
				this.optimizeTimeout = null
				const measurements = this.measureElement() || undefined
				this.setState({
					inView,

					isMeasured: measurements ? true : false,
					...measurements,
				} as IState)
			}, OPTIMIZE_PERIOD)
		}
	}

	measureElement = (): IElementMeasurements | null => {
		if (this.el) {
			const style = this.styleObj || window.getComputedStyle(this.el)
			this.styleObj = style
			this.props._debug && console.log(this.props.id, 'Re-measuring child', this.el.clientHeight)

			return {
				width: style.width || 'auto',
				clientHeight: this.el.clientHeight,
				marginTop: style.marginTop || undefined,
				marginBottom: style.marginBottom || undefined,
				marginLeft: style.marginLeft || undefined,
				marginRight: style.marginRight || undefined,
				id: this.el.id,
			}
		}

		return null
	}

	refreshSizing = () => {
		this.refreshSizingTimeout = null
		const measurements = this.measureElement()
		if (measurements) {
			this.setState({
				isMeasured: true,
				...measurements,
			})
		}
	}

	findChildElement = () => {
		if (!this.el || !this.el.parentElement) {
			const el = this.instance ? (this.instance.firstElementChild as HTMLElement) : null
			if (el && !el.classList.contains('virtual-element-placeholder')) {
				this.el = el
				this.styleObj = undefined
				this.refreshSizingTimeout = setTimeout(this.refreshSizing, 250)
			}
		}
	}

	setRef = (instance: HTMLElement | null) => {
		this.instance = instance
		this.findChildElement()
	}

	componentDidUpdate(_, prevState: IState) {
		if (this.state.inView && prevState.inView !== this.state.inView) {
			this.findChildElement()
		}
	}

	componentWillUnmount() {
		if (this.optimizeTimeout) clearTimeout(this.optimizeTimeout)
		if (this.refreshSizingTimeout) clearTimeout(this.refreshSizingTimeout)
	}

	render() {
		this.props._debug &&
			console.log(
				this.props.id,
				this.state.inView,
				this.props.initialShow,
				this.state.isMeasured,
				!this.state.inView && (!this.props.initialShow || this.state.isMeasured)
			)
		return (
			<InView
				threshold={0}
				rootMargin={this.props.margin || '50% 0px 50% 0px'}
				onChange={this.visibleChanged}
				className={this.props.className}
				as="div"
			>
				<div ref={this.setRef}>
					{!this.state.inView && (!this.props.initialShow || this.state.isMeasured) ? (
						<div
							id={this.state.id || this.props.id}
							className={'virtual-element-placeholder ' + (this.props.placeholderClassName || '')}
							style={{
								width: this.props.width || this.state.width,
								height: (this.state.clientHeight || this.props.placeholderHeight || '0') + 'px',
								marginTop: this.state.marginTop,
								marginLeft: this.state.marginLeft,
								marginRight: this.state.marginRight,
								marginBottom: this.state.marginBottom,
							}}
						></div>
					) : (
						this.props.children
					)}
				</div>
			</InView>
		)
	}
}
