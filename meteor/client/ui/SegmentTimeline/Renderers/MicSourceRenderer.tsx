import * as React from 'react'
import * as $ from 'jquery'

import { ScriptContent } from 'tv-automation-sofie-blueprints-integration'

import { FloatingInspector } from '../../FloatingInspector'
import Moment from 'react-moment'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { translate, InjectedTranslateProps } from 'react-i18next'

const BREAK_SCRIPT_BREAKPOINT = 620
const SCRIPT_PART_LENGTH = 250
interface IProps extends ICustomLayerItemProps {
}
interface IState {
}

export const MicSourceRenderer = translate()(class extends CustomLayerItemRenderer<IProps & InjectedTranslateProps, IState> {

	itemPosition: number
	itemWidth: number
	itemElement: HTMLDivElement | null
	lineItem: JQuery<HTMLDivElement>
	linePosition: number
	leftLabel: HTMLSpanElement
	rightLabel: HTMLSpanElement

	readTime: number

	private _forceSizingRecheck: boolean

	constructor (props: IProps & InjectedTranslateProps) {
		super(props)
	}

	repositionLine = () => {
		this.lineItem.css('left', this.linePosition + 'px')
	}

	refreshLine = () => {
		if (this.itemElement) {
			this.itemPosition = $(this.itemElement).position().left || 0
			const content = this.props.piece.content as ScriptContent
			let scriptReadTime = 0
			if (content && content.sourceDuration) {
				scriptReadTime = content.sourceDuration * this.props.timeScale
				this.readTime = content.sourceDuration
			} else {
				scriptReadTime = $(this.itemElement).width() || 0
			}

			if (this.itemPosition + scriptReadTime !== this.linePosition) {
				this.linePosition = Math.min(this.itemPosition + scriptReadTime, this.props.partDuration * this.props.timeScale)
				this.repositionLine()
			}
		}
	}

	setLeftLabelRef = (e: HTMLSpanElement) => {
		this.leftLabel = e
	}

	setRightLabelRef = (e: HTMLSpanElement) => {
		this.rightLabel = e
	}

	componentWillReceiveProps (nextProps: IProps & InjectedTranslateProps, nextContext: any) {
		if (super.componentWillReceiveProps && typeof super.componentWillReceiveProps === 'function') {
			super.componentWillReceiveProps(nextProps, nextContext)
		}

		if ((nextProps.partDuration !== this.props.partDuration) ||
			(nextProps.piece.renderedInPoint !== this.props.piece.renderedInPoint) ||
			(nextProps.piece.renderedDuration !== this.props.piece.renderedDuration) ||
			(nextProps.piece.duration !== this.props.piece.duration) ||
			(nextProps.piece.expectedDuration !== this.props.piece.expectedDuration) ||
			(nextProps.piece.trigger !== this.props.piece.trigger)) {
			this._forceSizingRecheck = true
		}
	}

	componentDidMount () {
		// Create line element
		this.lineItem = $('<div class="segment-timeline__layer-item-appendage script-line"></div>') as JQuery<HTMLDivElement>
		this.updateAnchoredElsWidths()
		if (this.props.itemElement) {
			this.itemElement = this.props.itemElement
			$(this.itemElement).parent().parent().append(this.lineItem)
			this.refreshLine()
		}
	}

	updateAnchoredElsWidths = () => {
		let leftLabelWidth = $(this.leftLabel).width() || 0
		let rightLabelWidth = $(this.rightLabel).width() || 0

		this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
	}

	componentDidUpdate (prevProps: Readonly<IProps & InjectedTranslateProps>, prevState: Readonly<IState>) {
		if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
			super.componentDidUpdate(prevProps, prevState)
		}

		// Move the line element
		if (this.itemElement !== this.props.itemElement) {
			if (this.itemElement) {
				this.lineItem.remove()
			}
			this.itemElement = this.props.itemElement
			if (this.itemElement) {
				$(this.itemElement).parent().parent().append(this.lineItem)
				this._forceSizingRecheck = true
			}
		}

		const content = this.props.piece.content as ScriptContent
		if (content.sourceDuration && content.sourceDuration !== this.readTime) {
			this._forceSizingRecheck = true
		}
		if (this._forceSizingRecheck) {
			// Update sizing information
			this._forceSizingRecheck = false

			this.refreshLine()
		}

		if (this.props.piece.name !== prevProps.piece.name) {
			this.updateAnchoredElsWidths()
		}
	}

	componentWillUnmount () {
		// Remove the line element
		this.lineItem.remove()
	}

	render () {
		const { t } = this.props
		let labelItems = (this.props.piece.name || '').split('||')
		let begin = labelItems[0] || ''
		let end = labelItems[1] || ''

		// function shorten (str: string, maxLen: number, separator: string = ' ') {
		// 	if (str.length <= maxLen) return str
		// 	return str.substr(0, str.substr(0, maxLen).lastIndexOf(separator))
		// }

		const content = this.props.piece.content as ScriptContent
		let startOfScript = content.fullScript || ''
		let cutLength = startOfScript.length
		if (startOfScript.length > SCRIPT_PART_LENGTH) {
			startOfScript = startOfScript.substring(0, startOfScript.substr(0, SCRIPT_PART_LENGTH).lastIndexOf(' '))
			cutLength = startOfScript.length
		}
		let endOfScript = content.fullScript || ''
		if (endOfScript.length > SCRIPT_PART_LENGTH) {
			endOfScript = endOfScript.substring(endOfScript.indexOf(' ', Math.max(cutLength, endOfScript.length - SCRIPT_PART_LENGTH)), endOfScript.length)
		}

		const breakScript = !!(content && content.fullScript && content.fullScript.length > BREAK_SCRIPT_BREAKPOINT)

		return <React.Fragment>
			<span className='segment-timeline__layer-item__label first-words overflow-label' ref={this.setLeftLabelRef} style={this.getItemLabelOffsetLeft()}>
				{begin}
			</span>
			<span className='segment-timeline__layer-item__label right-side' ref={this.setRightLabelRef} style={this.getItemLabelOffsetRight()}>
				<span className='segment-timeline__layer-item__label last-words'>{end}</span>
				{this.renderInfiniteIcon()}
				{this.renderOverflowTimeLabel()}
			</span>
			<FloatingInspector shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
				<div className={'segment-timeline__mini-inspector ' + this.props.typeClass + ' segment-timeline__mini-inspector--pop-down'} style={this.getFloatingInspectorStyle()}>
					<div>
						{content && content.fullScript ?
							breakScript ?
								<React.Fragment>
									<span className='mini-inspector__full-text text-broken'>{startOfScript + '\u2026'}</span>
									<span className='mini-inspector__full-text text-broken text-end'>{'\u2026' + endOfScript}</span>
								</React.Fragment>
								: <span className='mini-inspector__full-text'>{content.fullScript}</span>
							: <span className='mini-inspector__system'>{t('Script is empty')}</span>
						}
					</div>
					{content && content.lastModified ?
						<div className='mini-inspector__footer'>
							<span className='mini-inspector__changed'><Moment date={content.lastModified} calendar={true} /></span>
						</div>
						: null
					}
				</div>
			</FloatingInspector>
		</React.Fragment>
	}
})
