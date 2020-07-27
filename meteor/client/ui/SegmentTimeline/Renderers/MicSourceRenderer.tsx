import * as React from 'react'

import { ScriptContent } from 'tv-automation-sofie-blueprints-integration'

import { FloatingInspector } from '../../FloatingInspector'
import Moment from 'react-moment'

import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { withTranslation, WithTranslation } from 'react-i18next'
import * as _ from 'underscore'

import { getElementWidth } from '../../../utils/dimensions'

const BREAK_SCRIPT_BREAKPOINT = 620
const SCRIPT_PART_LENGTH = 250
interface IProps extends ICustomLayerItemProps {}
interface IState {}

export const MicSourceRenderer = withTranslation()(
	class MicSourceRenderer extends CustomLayerItemRenderer<IProps & WithTranslation, IState> {
		itemPosition: number
		itemWidth: number
		itemElement: HTMLElement | null
		lineItem: HTMLElement
		linePosition: number
		leftLabel: HTMLSpanElement
		rightLabel: HTMLSpanElement

		readTime: number

		private _forceSizingRecheck: boolean

		constructor(props: IProps & WithTranslation) {
			super(props)
		}

		repositionLine = () => {
			this.lineItem.style.left = this.linePosition + 'px'
		}

		addClassToLine = (className: string) => {
			this.lineItem.classList.add(className)
		}

		removeClassFromLine = (className: string) => {
			this.lineItem.classList.remove(className)
		}

		refreshLine = () => {
			if (this.itemElement) {
				this.itemPosition = this.itemElement.offsetLeft
				const content = this.props.piece.instance.piece.content as ScriptContent | undefined
				let scriptReadTime = 0
				if (content && content.sourceDuration) {
					scriptReadTime = content.sourceDuration * this.props.timeScale
					this.readTime = content.sourceDuration
					const positionByReadTime = this.itemPosition + scriptReadTime
					const positionByPartEnd = this.props.partDuration * this.props.timeScale
					const positionByExpectedPartEnd =
						(this.props.part.instance.part.expectedDuration || this.props.partDuration) * this.props.timeScale
					if (positionByReadTime !== this.linePosition) {
						this.linePosition = Math.min(positionByReadTime, positionByPartEnd)
						this.repositionLine()
						if (Math.abs(positionByReadTime - positionByExpectedPartEnd) <= 1) {
							this.addClassToLine('at-end')
						} else {
							this.removeClassFromLine('at-end')
						}
					}
					this.removeClassFromLine('hidden')
				} else {
					this.addClassToLine('hidden')
				}
			}
		}

		setLeftLabelRef = (e: HTMLSpanElement) => {
			this.leftLabel = e
		}

		setRightLabelRef = (e: HTMLSpanElement) => {
			this.rightLabel = e
		}

		componentDidMount() {
			// Create line element
			this.lineItem = document.createElement('div')
			this.lineItem.classList.add('segment-timeline__piece-appendage', 'script-line')
			this.updateAnchoredElsWidths()
			if (this.props.itemElement) {
				this.itemElement = this.props.itemElement
				this.itemElement.parentNode &&
					this.itemElement.parentNode.parentNode &&
					this.itemElement.parentNode.parentNode.appendChild(this.lineItem)
				this.refreshLine()
			}
		}

		updateAnchoredElsWidths = () => {
			const leftLabelWidth = getElementWidth(this.leftLabel)
			const rightLabelWidth = getElementWidth(this.rightLabel)

			this.setAnchoredElsWidths(leftLabelWidth, rightLabelWidth)
		}

		componentDidUpdate(prevProps: Readonly<IProps & WithTranslation>, prevState: Readonly<IState>) {
			let _forceSizingRecheck = false

			if (super.componentDidUpdate && typeof super.componentDidUpdate === 'function') {
				super.componentDidUpdate(prevProps, prevState)
			}

			if (
				prevProps.partDuration !== this.props.partDuration ||
				prevProps.piece.renderedInPoint !== this.props.piece.renderedInPoint ||
				prevProps.piece.renderedDuration !== this.props.piece.renderedDuration ||
				prevProps.piece.instance.piece.playoutDuration !== this.props.piece.instance.piece.playoutDuration ||
				!_.isEqual(prevProps.piece.instance.piece.userDuration, this.props.piece.instance.piece.userDuration) ||
				!_.isEqual(prevProps.piece.instance.piece.enable, this.props.piece.instance.piece.enable)
			) {
				_forceSizingRecheck = true
			}

			// Move the line element
			if (this.itemElement !== this.props.itemElement) {
				if (this.itemElement) {
					this.lineItem.remove()
				}
				this.itemElement = this.props.itemElement
				if (this.itemElement) {
					this.itemElement.parentNode &&
						this.itemElement.parentNode.parentNode &&
						this.itemElement.parentNode.parentNode.appendChild(this.lineItem)
					this._forceSizingRecheck = true
				}
			}

			const content = this.props.piece.instance.piece.content as ScriptContent | undefined
			if (content && content.sourceDuration && content.sourceDuration !== this.readTime) {
				_forceSizingRecheck = true
			}

			if (_forceSizingRecheck) {
				this.refreshLine()
			}

			if (this.props.piece.instance.piece.name !== prevProps.piece.instance.piece.name) {
				this.updateAnchoredElsWidths()
			}
		}

		componentWillUnmount() {
			// Remove the line element
			this.lineItem.remove()
		}

		render() {
			const { t } = this.props
			let labelItems = (this.props.piece.instance.piece.name || '').split('||')
			let begin = labelItems[0] || ''
			let end = labelItems[1] || ''

			// function shorten (str: string, maxLen: number, separator: string = ' ') {
			// 	if (str.length <= maxLen) return str
			// 	return str.substr(0, str.substr(0, maxLen).lastIndexOf(separator))
			// }

			const content = this.props.piece.instance.piece.content as ScriptContent | undefined
			let startOfScript = (content && content.fullScript) || ''
			let cutLength = startOfScript.length
			if (startOfScript.length > SCRIPT_PART_LENGTH) {
				startOfScript = startOfScript.substring(0, startOfScript.substr(0, SCRIPT_PART_LENGTH).lastIndexOf(' '))
				cutLength = startOfScript.length
			}
			let endOfScript = (content && content.fullScript) || ''
			if (endOfScript.length > SCRIPT_PART_LENGTH) {
				endOfScript = endOfScript.substring(
					endOfScript.indexOf(' ', Math.max(cutLength, endOfScript.length - SCRIPT_PART_LENGTH)),
					endOfScript.length
				)
			}

			const breakScript = !!(content && content.fullScript && content.fullScript.length > BREAK_SCRIPT_BREAKPOINT)

			return (
				<React.Fragment>
					<span
						className="segment-timeline__piece__label first-words overflow-label"
						ref={this.setLeftLabelRef}
						style={this.getItemLabelOffsetLeft()}>
						{begin}
					</span>
					<span
						className="segment-timeline__piece__label right-side"
						ref={this.setRightLabelRef}
						style={this.getItemLabelOffsetRight()}>
						<span className="segment-timeline__piece__label last-words">{end}</span>
						{this.renderInfiniteIcon()}
						{this.renderOverflowTimeLabel()}
					</span>
					<FloatingInspector shown={this.props.showMiniInspector && this.props.itemElement !== undefined}>
						<div
							className={
								'segment-timeline__mini-inspector ' +
								this.props.typeClass +
								' segment-timeline__mini-inspector--pop-down'
							}
							style={this.getFloatingInspectorStyle()}>
							<div>
								{content && content.fullScript ? (
									breakScript ? (
										<React.Fragment>
											<span className="mini-inspector__full-text text-broken">{startOfScript + '\u2026'}</span>
											<span className="mini-inspector__full-text text-broken text-end">{'\u2026' + endOfScript}</span>
										</React.Fragment>
									) : (
										<span className="mini-inspector__full-text">{content.fullScript}</span>
									)
								) : (
									<span className="mini-inspector__system">{t('Script is empty')}</span>
								)}
							</div>
							{content && content.lastModified ? (
								<div className="mini-inspector__footer">
									<span className="mini-inspector__changed">
										<Moment date={content.lastModified} calendar={true} />
									</span>
								</div>
							) : null}
						</div>
					</FloatingInspector>
				</React.Fragment>
			)
		}
	}
)
