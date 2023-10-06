import * as React from 'react'
import { getElementWidth } from '../../../utils/dimensions'

import { TransitionContent } from '@sofie-automation/blueprints-integration'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { FloatingInspector } from '../../FloatingInspector'

// type KeyValue = { key: string, value: string }

type IProps = ICustomLayerItemProps
interface IState {
	iconFailed: boolean
}
export class TransitionSourceRenderer extends CustomLayerItemRenderer<IProps, IState> {
	leftLabel: HTMLElement
	rightLabel: HTMLElement

	constructor(props: IProps) {
		super(props)

		this.state = {
			...this.state,
			iconFailed: false,
		}
	}

	private updateAnchoredElsWidths = () => {
		const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0

		this.setAnchoredElsWidths(leftLabelWidth, 0)
	}

	private setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	componentDidMount(): void {
		this.updateAnchoredElsWidths()
	}

	// this will be triggered if the SVG icon for the transiton will 404.
	private iconFailed = () => {
		this.setState({
			iconFailed: true,
		})
	}

	componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		if (this.props.piece.instance.piece.name !== prevProps.piece.instance.piece.name) {
			this.updateAnchoredElsWidths()
		}
	}

	render(): JSX.Element {
		const content = this.props.piece.instance.piece.content as TransitionContent | undefined
		return (
			<>
				{!this.props.piece.hasOriginInPreceedingPart || this.props.isLiveLine ? (
					<span
						className="segment-timeline__piece__label with-overflow"
						ref={this.setLeftLabelRef}
						style={this.getItemLabelOffsetLeft()}
					>
						{this.props.piece.instance.piece.name}
						{content && content.icon && !this.state.iconFailed && (
							<img
								src={'/blueprints/assets/' + content.icon}
								className="segment-timeline__piece__label__transition-icon"
								onError={this.iconFailed}
								alt={this.props.piece.instance.piece.name}
								role="presentation"
							/>
						)}
					</span>
				) : null}
				<FloatingInspector
					shown={this.props.showMiniInspector && !this.state.iconFailed && this.props.itemElement !== null}
				>
					{content && content.preview && (
						<div
							className="segment-timeline__mini-inspector segment-timeline__mini-inspector--video"
							style={this.getFloatingInspectorStyle()}
						>
							<img src={'/blueprints/assets/' + content.preview} className="thumbnail" />
						</div>
					)}
				</FloatingInspector>
			</>
		)
	}
}
