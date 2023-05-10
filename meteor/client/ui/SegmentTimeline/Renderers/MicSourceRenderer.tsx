import * as React from 'react'

import ClassNames from 'classnames'
import { ScriptContent } from '@sofie-automation/blueprints-integration'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { withTranslation, WithTranslation } from 'react-i18next'
import * as _ from 'underscore'

import { getElementWidth } from '../../../utils/dimensions'
import { MicFloatingInspector } from '../../FloatingInspectors/MicFloatingInspector'
import { calculatePartInstanceExpectedDurationWithPreroll } from '@sofie-automation/corelib/dist/playout/timings'
import { unprotectString } from '../../../../lib/lib'

type IProps = ICustomLayerItemProps
interface IState {}

export const MicSourceRenderer = withTranslation()(
	class MicSourceRenderer extends CustomLayerItemRenderer<IProps & WithTranslation, IState> {
		itemPosition: number
		itemWidth: number
		itemElement: HTMLElement | null
		lineItem: HTMLElement
		linePosition: number
		leftLabel: HTMLSpanElement | null
		rightLabel: HTMLSpanElement | null

		readTime: number
		lastPartDuration: number

		private _lineAtEnd: boolean = false

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
			if (this.itemElement && !this.props.relative) {
				this.itemPosition = this.itemElement.offsetLeft
				const content = this.props.piece.instance.piece.content as ScriptContent | undefined
				if (
					content &&
					content.sourceDuration &&
					!this.props.piece.instance.piece.virtual &&
					(this.props.piece.renderedDuration === null || this.props.piece.renderedDuration > 0)
				) {
					const scriptReadTime = Math.round(content.sourceDuration * this.props.timeScale)
					this.readTime = content.sourceDuration
					const positionByReadTime = this.itemPosition + scriptReadTime
					const positionByPartEnd = Math.round(this.props.partDuration * this.props.timeScale)

					if (
						positionByReadTime !== this.linePosition ||
						(this._lineAtEnd && positionByPartEnd !== this.lastPartDuration)
					) {
						this.linePosition = positionByReadTime
						this.lastPartDuration = positionByPartEnd
						this.repositionLine()

						if (
							!this._lineAtEnd &&
							(positionByReadTime >= positionByPartEnd || Math.abs(positionByReadTime - positionByPartEnd) <= 4)
						) {
							// difference is less than a frame
							this.addClassToLine('at-end')
							this._lineAtEnd = true
						} else if (this._lineAtEnd && positionByReadTime < positionByPartEnd) {
							this.removeClassFromLine('at-end')
							this._lineAtEnd = false
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

		componentDidMount(): void {
			// Create line element
			this.lineItem = document.createElement('div')
			this.lineItem.dataset['ownerObjId'] = unprotectString(this.props.piece.instance._id)
			this.lineItem.classList.add('segment-timeline__piece-appendage', 'script-line', 'hidden')
			this.updateAnchoredElsWidths()
			if (this.props.itemElement) {
				this.itemElement = this.props.itemElement
				this.itemElement.parentElement?.parentElement?.parentElement?.appendChild(this.lineItem)
				this.refreshLine()
			}
		}

		updateAnchoredElsWidths = () => {
			const leftLabelWidth = this.leftLabel ? getElementWidth(this.leftLabel) : 0
			const rightLabelWidth = this.rightLabel ? getElementWidth(this.rightLabel) : 0

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
				!_.isEqual(prevProps.piece.instance.userDuration, this.props.piece.instance.userDuration) ||
				!_.isEqual(prevProps.piece.instance.piece.enable, this.props.piece.instance.piece.enable) ||
				prevProps.timeScale !== this.props.timeScale
			) {
				_forceSizingRecheck = true
			}

			if (
				!_forceSizingRecheck &&
				this._lineAtEnd === true &&
				(calculatePartInstanceExpectedDurationWithPreroll(this.props.part.instance, this.props.pieces) ||
					this.props.partDuration) *
					this.props.timeScale !==
					(calculatePartInstanceExpectedDurationWithPreroll(prevProps.part.instance, this.props.pieces) ||
						prevProps.partDuration) *
						prevProps.timeScale
			) {
				_forceSizingRecheck = true
			}

			// Move the line element
			if (this.itemElement !== this.props.itemElement) {
				if (this.itemElement) {
					try {
						this.lineItem.remove()
					} catch (err) {
						console.error('Error in MicSourceRenderer.componentDidUpdate', err)
					}
				}
				this.itemElement = this.props.itemElement
				if (this.itemElement) {
					this.itemElement.parentElement?.parentElement?.parentElement?.appendChild(this.lineItem)
					_forceSizingRecheck = true
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

		componentWillUnmount(): void {
			try {
				// Remove the line element
				this.lineItem?.remove()
			} catch (err) {
				console.error('Error in MicSourceRenderer.componentWillUnmount', err)
			}
		}

		render(): JSX.Element {
			const labelItems = (this.props.piece.instance.piece.name || '').split('||')
			const begin = labelItems[0] || ''
			const end = labelItems[1] || ''

			// function shorten (str: string, maxLen: number, separator: string = ' ') {
			// 	if (str.length <= maxLen) return str
			// 	return str.substr(0, str.substr(0, maxLen).lastIndexOf(separator))
			// }

			const content = this.props.piece.instance.piece.content as ScriptContent | undefined

			return (
				<>
					{!this.props.isTooSmallForText && (
						<>
							{!this.props.piece.hasOriginInPreceedingPart || this.props.isLiveLine ? (
								<span
									className={ClassNames('segment-timeline__piece__label', 'first-words', {
										'overflow-label': end !== '',
									})}
									ref={this.setLeftLabelRef}
									style={this.getItemLabelOffsetLeft()}
								>
									{begin}
								</span>
							) : null}
							<span
								className="segment-timeline__piece__label right-side"
								ref={this.setRightLabelRef}
								style={this.getItemLabelOffsetRight()}
							>
								<span className="segment-timeline__piece__label last-words">{end}</span>
								{this.renderInfiniteIcon()}
								{/* this.renderOverflowTimeLabel() */}
							</span>
						</>
					)}
					{content && (
						<MicFloatingInspector
							content={content}
							floatingInspectorStyle={this.getFloatingInspectorStyle()}
							itemElement={this.props.itemElement}
							showMiniInspector={this.props.showMiniInspector}
							typeClass={this.props.typeClass}
						/>
					)}
				</>
			)
		}
	}
)
