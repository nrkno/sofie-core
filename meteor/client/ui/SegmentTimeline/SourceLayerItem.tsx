import * as React from 'react'
import * as _ from 'underscore'
import { ISourceLayerUi, IOutputLayerUi, PartUi, PieceUi } from './SegmentTimelineContainer'
import { RundownAPI } from '../../../lib/api/rundown'
import { SourceLayerType, PieceLifespan, PieceTransitionType } from 'tv-automation-sofie-blueprints-integration'
import { RundownUtils } from '../../lib/rundown'
import ClassNames from 'classnames'
import { DefaultLayerItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { MicSourceRenderer } from './Renderers/MicSourceRenderer'
import { VTSourceRenderer } from './Renderers/VTSourceRenderer'
import { STKSourceRenderer } from './Renderers/STKSourceRenderer'
import { L3rdSourceRenderer } from './Renderers/L3rdSourceRenderer'
import { SplitsSourceRenderer } from './Renderers/SplitsSourceRenderer'
import { TransitionSourceRenderer } from './Renderers/TransitionSourceRenderer'

import { DEBUG_MODE } from './SegmentTimelineDebugMode'
import { doModalDialog, SomeEvent, ModalInputResult } from '../../lib/ModalDialog'
import { doUserAction, UserAction } from '../../lib/userAction'
import { withTranslation, WithTranslation } from 'react-i18next'
import { getElementWidth } from '../../utils/dimensions'
import { getElementDocumentOffset, OffsetPosition } from '../../utils/positions'
import { unprotectString } from '../../../lib/lib'
import { MeteorCall } from '../../../lib/api/methods'
import { Rundowns } from '../../../lib/collections/Rundowns'

const LEFT_RIGHT_ANCHOR_SPACER = 15

export interface ISourceLayerItemProps {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	mediaPreviewUrl: string
	// segment: SegmentUi
	part: PartUi
	partStartsAt: number
	partDuration: number
	piece: PieceUi
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	onClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	relative?: boolean
	followLiveLine: boolean
	autoNextPart: boolean
	liveLineHistorySize: number
	livePosition: number | null
	outputGroupCollapsed: boolean
	scrollLeft: number
	scrollWidth: number
	liveLinePadding: number
}
interface ISourceLayerItemState {
	showMiniInspector: boolean
	elementPosition: OffsetPosition
	cursorPosition: OffsetPosition
	scrollLeftOffset: number
	cursorTimePosition: number
	elementWidth: number
	itemElement: HTMLDivElement | null
	leftAnchoredWidth: number
	rightAnchoredWidth: number
}
export const SourceLayerItem = withTranslation()(
	class SourceLayerItem extends React.Component<ISourceLayerItemProps & WithTranslation, ISourceLayerItemState> {
		private _resizeObserver: ResizeObserver | undefined

		constructor(props) {
			super(props)
			this.state = {
				showMiniInspector: false,
				elementPosition: {
					top: 0,
					left: 0,
				},
				cursorPosition: {
					top: 0,
					left: 0,
				},
				scrollLeftOffset: 0,
				cursorTimePosition: 0,
				elementWidth: 0,
				itemElement: null,
				leftAnchoredWidth: 0,
				rightAnchoredWidth: 0,
			}
		}

		setRef = (e: HTMLDivElement) => {
			this.setState({
				itemElement: e,
			})
		}

		getItemLabelOffsetLeft = (): { [key: string]: string } => {
			if (this.props.relative) {
				return {}
			} else {
				const maxLabelWidth = this.props.piece.maxLabelWidth

				if (this.props.part && this.props.partStartsAt !== undefined) {
					//  && this.props.piece.renderedInPoint !== undefined && this.props.piece.renderedDuration !== undefined
					const piece = this.props.piece
					const innerPiece = piece.instance.piece

					let inTransitionDuration =
						innerPiece.transitions && innerPiece.transitions.inTransition
							? innerPiece.transitions.inTransition.duration || 0
							: 0
					let outTransitionDuration =
						innerPiece.transitions && innerPiece.transitions.outTransition
							? innerPiece.transitions.outTransition.duration || 0
							: 0

					const inPoint = piece.renderedInPoint || 0
					const duration = Number.isFinite(piece.renderedDuration || 0)
						? piece.renderedDuration || this.props.partDuration || this.props.part.renderedDuration || 0
						: this.props.partDuration || this.props.part.renderedDuration || 0

					const widthConstrictedMode =
						this.state.leftAnchoredWidth > 0 &&
						this.state.rightAnchoredWidth > 0 &&
						this.state.leftAnchoredWidth + this.state.rightAnchoredWidth > this.state.elementWidth

					const nextIsTouching = !!piece.cropped

					if (this.props.followLiveLine && this.props.isLiveLine) {
						const liveLineHistoryWithMargin = this.props.liveLineHistorySize - 10
						if (
							this.props.scrollLeft + liveLineHistoryWithMargin / this.props.timeScale >
								inPoint +
									this.props.partStartsAt +
									inTransitionDuration +
									this.state.leftAnchoredWidth / this.props.timeScale &&
							this.props.scrollLeft + liveLineHistoryWithMargin / this.props.timeScale <
								inPoint + duration + this.props.partStartsAt - outTransitionDuration
						) {
							const targetPos =
								(this.props.scrollLeft - inPoint - this.props.partStartsAt - inTransitionDuration) *
								this.props.timeScale

							// console.log(this.state.itemElement)

							// || (this.state.leftAnchoredWidth === 0 || this.state.rightAnchoredWidth === 0)
							let styleObj = {
								maxWidth:
									this.state.rightAnchoredWidth > 0
										? (this.state.elementWidth - this.state.rightAnchoredWidth).toString() + 'px'
										: maxLabelWidth !== undefined
										? (maxLabelWidth * this.props.timeScale).toString() + 'px'
										: nextIsTouching
										? '100%'
										: 'none',
								transform:
									'translate3d(' +
									Math.floor(
										widthConstrictedMode
											? targetPos
											: Math.min(
													targetPos,
													this.state.elementWidth - this.state.rightAnchoredWidth - liveLineHistoryWithMargin - 10
											  )
									).toString() +
									'px, 0, 0) ' +
									'translate3d(' +
									Math.floor(liveLineHistoryWithMargin).toString() +
									'px, 0, 0) ' +
									'translate3d(-100%, 0, 5px)',
								willChange: 'transform',
							}

							return styleObj
						} else if (
							this.state.rightAnchoredWidth < this.state.elementWidth &&
							this.state.leftAnchoredWidth < this.state.elementWidth &&
							this.props.scrollLeft + liveLineHistoryWithMargin / this.props.timeScale >=
								inPoint + duration + this.props.partStartsAt - outTransitionDuration
						) {
							const targetPos =
								(this.props.scrollLeft - inPoint - this.props.partStartsAt - inTransitionDuration) *
								this.props.timeScale

							let styleObj = {
								maxWidth:
									this.state.rightAnchoredWidth > 0
										? (this.state.elementWidth - this.state.rightAnchoredWidth).toString() + 'px'
										: maxLabelWidth !== undefined
										? (maxLabelWidth * this.props.timeScale).toString() + 'px'
										: nextIsTouching
										? '100%'
										: 'none',
								transform:
									'translate3d(' +
									Math.floor(
										Math.min(
											targetPos,
											this.state.elementWidth - this.state.rightAnchoredWidth - liveLineHistoryWithMargin - 10
										)
									).toString() +
									'px, 0, 0) ' +
									'translate3d(' +
									Math.floor(liveLineHistoryWithMargin).toString() +
									'px, 0, 0) ' +
									'translate3d(-100%, 0, 5px)',
								willChange: 'transform',
							}

							return styleObj
						}
					} else {
						if (
							this.props.scrollLeft > inPoint + this.props.partStartsAt + inTransitionDuration &&
							this.props.scrollLeft < inPoint + duration + this.props.partStartsAt - outTransitionDuration
						) {
							const targetPos =
								(this.props.scrollLeft - inPoint - this.props.partStartsAt - inTransitionDuration) *
								this.props.timeScale

							let styleObj = {
								maxWidth:
									this.state.rightAnchoredWidth > 0
										? (this.state.elementWidth - this.state.rightAnchoredWidth).toString() + 'px'
										: maxLabelWidth !== undefined
										? (maxLabelWidth * this.props.timeScale).toString() + 'px'
										: nextIsTouching
										? '100%'
										: 'none',
								transform:
									'translate3d(' +
									Math.floor(
										widthConstrictedMode || this.state.leftAnchoredWidth === 0 || this.state.rightAnchoredWidth === 0
											? targetPos
											: Math.min(
													targetPos,
													this.state.elementWidth - this.state.leftAnchoredWidth - this.state.rightAnchoredWidth
											  )
									).toString() +
									'px,  0, 5px)',
								willChange: 'transform',
							}

							return styleObj
						} else {
							let styleObj = {
								maxWidth:
									this.state.rightAnchoredWidth > 0
										? (this.state.elementWidth - this.state.rightAnchoredWidth).toString() + 'px'
										: maxLabelWidth !== undefined
										? (maxLabelWidth * this.props.timeScale).toString() + 'px'
										: nextIsTouching
										? '100%'
										: 'none',
							}

							return styleObj
						}
					}
				}
				return {}
			}
		}

		getItemLabelOffsetRight = (): { [key: string]: string } => {
			if (this.props.relative) {
				return {}
			} else {
				if (this.props.part && this.props.partStartsAt !== undefined) {
					//  && this.props.piece.renderedInPoint !== undefined && this.props.piece.renderedDuration !== undefined
					const piece = this.props.piece
					const innerPiece = piece.instance.piece

					// let inTransitionDuration = piece.transitions && piece.transitions.inTransition ? piece.transitions.inTransition.duration || 0 : 0
					let outTransitionDuration =
						innerPiece.transitions && innerPiece.transitions.outTransition
							? innerPiece.transitions.outTransition.duration || 0
							: 0

					const inPoint = piece.renderedInPoint || 0
					const duration =
						innerPiece.lifespan !== PieceLifespan.WithinPart || piece.renderedDuration === 0
							? this.props.partDuration - inPoint
							: Math.min(piece.renderedDuration || 0, this.props.partDuration - inPoint)
					const outPoint = inPoint + duration

					// const widthConstrictedMode = this.state.leftAnchoredWidth > 0 && this.state.rightAnchoredWidth > 0 && ((this.state.leftAnchoredWidth + this.state.rightAnchoredWidth) > this.state.elementWidth)

					if (
						this.props.scrollLeft + this.props.scrollWidth <
							outPoint - outTransitionDuration + this.props.partStartsAt &&
						this.props.scrollLeft + this.props.scrollWidth > inPoint + this.props.partStartsAt
					) {
						const targetPos = Math.max(
							(this.props.scrollLeft +
								this.props.scrollWidth -
								outPoint -
								this.props.partStartsAt -
								outTransitionDuration) *
								this.props.timeScale,
							(this.state.elementWidth -
								this.state.leftAnchoredWidth -
								this.state.rightAnchoredWidth -
								LEFT_RIGHT_ANCHOR_SPACER) *
								-1
						)

						return {
							transform: 'translate3d(' + Math.floor(targetPos).toString() + 'px,  0, 15px)',
							willChange: 'transform',
						}
					}
				}
				return {}
			}
		}

		getItemDuration = (): number => {
			const piece = this.props.piece
			const innerPiece = piece.instance.piece

			const expectedDurationNumber =
				typeof innerPiece.enable.duration === 'number' ? innerPiece.enable.duration || 0 : 0
			const userDurationNumber =
				piece.instance.userDuration && typeof piece.instance.userDuration.end === 'number' && innerPiece.startedPlayback
					? piece.instance.userDuration.end - innerPiece.startedPlayback
					: 0
			let itemDuration = Math.min(
				userDurationNumber || piece.renderedDuration || expectedDurationNumber || 0,
				this.props.partDuration - (piece.renderedInPoint || 0)
			)

			if (
				(innerPiece.lifespan !== PieceLifespan.WithinPart ||
					(innerPiece.enable.start !== undefined && innerPiece.enable.duration === undefined)) &&
				!piece.cropped &&
				!piece.instance.userDuration
			) {
				itemDuration = this.props.partDuration - (piece.renderedInPoint || 0)
				// console.log(piece.infiniteMode + ', ' + piece.infiniteId)
			}

			return itemDuration
		}

		getItemStyle(): { [key: string]: string } {
			const piece = this.props.piece
			const innerPiece = piece.instance.piece

			let inTransitionDuration =
				innerPiece.transitions && innerPiece.transitions.inTransition
					? innerPiece.transitions.inTransition.duration || 0
					: 0
			let outTransitionDuration =
				innerPiece.transitions && innerPiece.transitions.outTransition
					? innerPiece.transitions.outTransition.duration || 0
					: 0

			// If this is a live line, take duration verbatim from SegmentLayerItemContainer with a fallback on expectedDuration.
			// If not, as-run part "duration" limits renderdDuration which takes priority over MOS-import
			// expectedDuration (editorial duration)

			// let liveLinePadding = this.props.autoNextPart ? 0 : (this.props.isLiveLine ? this.props.liveLinePadding : 0)

			const itemDuration = this.getItemDuration()

			if (this.props.relative) {
				return {
					// also: don't render transitions in relative mode
					left: (((piece.renderedInPoint || 0) / (this.props.partDuration || 1)) * 100).toString() + '%',
					width: ((itemDuration / (this.props.partDuration || 1)) * 100).toString() + '%',
				}
			} else {
				return {
					left:
						Math.floor(((piece.renderedInPoint || 0) + inTransitionDuration) * this.props.timeScale).toString() + 'px',
					width:
						Math.round(
							(itemDuration - inTransitionDuration - outTransitionDuration) * this.props.timeScale
						).toString() + 'px',
				}
			}
		}

		// TODO(Performance): use ResizeObserver to avoid style recalculations
		// checkElementWidth = () => {
		// 	if (this.state.itemElement && this._forceSizingRecheck) {
		// 		this._forceSizingRecheck = false
		// 		const width = getElementWidth(this.state.itemElement) || 0
		// 		if (this.state.elementWidth !== width) {
		// 			this.setState({
		// 				elementWidth: width
		// 			})
		// 		}
		// 	}
		// }

		private onResize = (entries: ResizeObserverEntry[]) => {
			const firstEntry = entries && entries[0]

			if (firstEntry && firstEntry.contentBoxSize && firstEntry.contentBoxSize.width) {
				const width = firstEntry.contentBoxSize!.width
				if (this.state.elementWidth !== width) {
					this.setState({
						elementWidth: width,
					})
				}
			} else if (firstEntry && firstEntry.borderBoxSize && firstEntry.borderBoxSize.width) {
				const width = firstEntry.borderBoxSize!.width
				if (this.state.elementWidth !== width) {
					this.setState({
						elementWidth: width,
					})
				}
			} else if (firstEntry && firstEntry.contentRect && firstEntry.contentRect.width) {
				const width = firstEntry.contentRect!.width
				if (this.state.elementWidth !== width) {
					this.setState({
						elementWidth: width,
					})
				}
			}
		}

		private mountResizeObserver() {
			if (this.props.isLiveLine && !this._resizeObserver && this.state.itemElement) {
				this._resizeObserver = new ResizeObserver(this.onResize)
				this._resizeObserver.observe(this.state.itemElement)

				const width = getElementWidth(this.state.itemElement) || 0
				if (this.state.elementWidth !== width) {
					this.setState({
						elementWidth: width,
					})
				}
			}
		}

		private unmountResizeObserver() {
			if (this._resizeObserver) {
				this._resizeObserver.disconnect()
				this._resizeObserver = undefined
			}
		}

		componentDidMount() {
			if (this.props.isLiveLine) {
				this.mountResizeObserver()
			}
		}

		componentDidUpdate(prevProps: ISourceLayerItemProps) {
			if (prevProps.scrollLeft !== this.props.scrollLeft && this.state.showMiniInspector) {
				const scrollLeftOffset = this.state.scrollLeftOffset + (this.props.scrollLeft - prevProps.scrollLeft)
				const cursorTimePosition = this.state.cursorTimePosition + (this.props.scrollLeft - prevProps.scrollLeft)
				if (this.state.scrollLeftOffset !== scrollLeftOffset && this.state.cursorTimePosition !== cursorTimePosition) {
					this.setState({
						scrollLeftOffset,
						cursorTimePosition,
					})
				}
			}

			if (this.props.isLiveLine && this.state.itemElement && !this._resizeObserver) {
				this.mountResizeObserver()
			} else if (!this.props.isLiveLine && this._resizeObserver) {
				this.unmountResizeObserver()
			}
		}

		itemClick = (e: React.MouseEvent<HTMLDivElement>) => {
			// this.props.onFollowLiveLine && this.props.onFollowLiveLine(false, e)
			e.preventDefault()
			e.stopPropagation()
			this.props.onClick && this.props.onClick(this.props.piece, e)
		}
		tempDisplayInOutpoints = (e: React.MouseEvent<HTMLDivElement>) => {
			// Note: This is a TEMPORARY way to set in & out points, will be replaced with a much nicer looking way at a later stage
			doModalDialog({
				title: 'Set in point & duration',
				message: 'Please set the in-point & duration below',
				yes: 'Save',
				no: 'Discard',
				// acceptOnly?: boolean
				onAccept: (e: SomeEvent, inputResult: ModalInputResult) => {
					const rundown = Rundowns.findOne(this.props.part.instance.rundownId)
					if (!rundown) throw Error(`Rundown ${this.props.part.instance.rundownId} not found (in/out)`)

					doUserAction(this.props.t, e, UserAction.SET_IN_OUT_POINTS, (e) =>
						MeteorCall.userAction.setInOutPoints(
							e,
							rundown.playlistId,
							this.props.part.instance.part._id,
							this.props.piece.instance.piece._id,
							inputResult.inPoint,
							inputResult.outPoint
						)
					)
				},
				inputs: {
					inPoint: {
						label: 'In point',
						text: 'In point',
						type: 'float',
						defaultValue: 0,
					},
					outPoint: {
						label: 'Out point',
						text: 'Out point',
						type: 'float',
						defaultValue: 0,
					},
				},
			})
		}

		itemDblClick = (e: React.MouseEvent<HTMLDivElement>) => {
			e.preventDefault()
			e.stopPropagation()

			if (typeof this.props.onDoubleClick === 'function') {
				this.props.onDoubleClick(this.props.piece, e)
			}
		}

		itemMouseUp = (e: any) => {
			let eM = e as MouseEvent
			if (eM.ctrlKey === true) {
				eM.preventDefault()
				eM.stopPropagation()
			}
			return
		}

		toggleMiniInspector = (e: MouseEvent | any, v: boolean) => {
			this.setState({
				showMiniInspector: v,
			})
			// console.log($(this.itemElement).offset())
			const elementPos = getElementDocumentOffset(this.state.itemElement) || {
				top: 0,
				left: 0,
			}

			const cursorPosition = {
				left: e.clientX - elementPos.left,
				top: e.clientY - elementPos.top,
			}

			const cursorTimePosition = Math.max(cursorPosition.left, 0) / this.props.timeScale

			this.setState({
				scrollLeftOffset: 0,
				elementPosition: elementPos,
				cursorPosition,
				cursorTimePosition,
			})
		}

		moveMiniInspector = (e: MouseEvent | any) => {
			const cursorPosition = {
				left: e.clientX - this.state.elementPosition.left,
				top: e.clientY - this.state.elementPosition.top,
			}
			const cursorTimePosition = Math.max(cursorPosition.left, 0) / this.props.timeScale + this.state.scrollLeftOffset

			this.setState({
				cursorPosition: _.extend(this.state.cursorPosition, cursorPosition),
				cursorTimePosition,
			})
		}

		setAnchoredElsWidths = (leftAnchoredWidth: number, rightAnchoredWidth: number) => {
			this.setState({
				leftAnchoredWidth: leftAnchoredWidth,
				rightAnchoredWidth: rightAnchoredWidth,
			})
		}

		renderInsideItem(typeClass: string) {
			switch (this.props.layer.type) {
				case SourceLayerType.SCRIPT:
					// case SourceLayerType.MIC:
					return (
						<MicSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
				case SourceLayerType.VT:
					return (
						<VTSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
				case SourceLayerType.GRAPHICS:
				case SourceLayerType.LOWER_THIRD:
					return (
						<L3rdSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
				case SourceLayerType.SPLITS:
					return (
						<SplitsSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
				case SourceLayerType.LIVE_SPEAK:
					// @ts-ignore: intrinsics get lost because of the complicated class structure, this is fine
					return (
						<STKSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							// @ts-ignore: intrinsics get lost because of the complicated class structure, this is fine
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)

				case SourceLayerType.TRANSITION:
					return (
						<TransitionSourceRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
				default:
					return (
						<DefaultLayerItemRenderer
							key={unprotectString(this.props.piece.instance._id)}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					)
			}
		}

		isInsideViewport() {
			if (this.props.relative) {
				return true
			} else {
				return RundownUtils.isInsideViewport(
					this.props.scrollLeft,
					this.props.scrollWidth,
					this.props.part,
					this.props.partStartsAt,
					this.props.partDuration,
					this.props.piece
				)
			}
		}

		render() {
			if (this.isInsideViewport()) {
				const typeClass = RundownUtils.getSourceLayerClassName(this.props.layer.type)

				const piece = this.props.piece
				const innerPiece = piece.instance.piece

				return (
					<div
						className={ClassNames('segment-timeline__piece', typeClass, {
							'with-in-transition':
								!this.props.relative &&
								innerPiece.transitions &&
								innerPiece.transitions.inTransition &&
								(innerPiece.transitions.inTransition.duration || 0) > 0,
							'with-out-transition':
								!this.props.relative &&
								innerPiece.transitions &&
								innerPiece.transitions.outTransition &&
								(innerPiece.transitions.outTransition.duration || 0) > 0,

							'hide-overflow-labels':
								this.state.leftAnchoredWidth > 0 &&
								this.state.rightAnchoredWidth > 0 &&
								this.state.leftAnchoredWidth + this.state.rightAnchoredWidth > this.state.elementWidth,

							infinite: piece.instance.userDuration === undefined && innerPiece.lifespan !== PieceLifespan.WithinPart, // 0 is a special value
							'next-is-touching': this.props.piece.cropped,

							'source-missing':
								innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_MISSING ||
								innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_NOT_SET,
							'source-broken': innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
							'unknown-state': innerPiece.status === RundownAPI.PieceStatusCode.UNKNOWN,
							disabled: piece.instance.disabled,
						})}
						data-obj-id={piece.instance._id}
						ref={this.setRef}
						onClick={this.itemClick}
						onDoubleClick={this.itemDblClick}
						onMouseUp={this.itemMouseUp}
						onMouseMove={(e) => this.moveMiniInspector(e)}
						onMouseOver={(e) => !this.props.outputGroupCollapsed && this.toggleMiniInspector(e, true)}
						onMouseLeave={(e) => this.toggleMiniInspector(e, false)}
						style={this.getItemStyle()}>
						{this.renderInsideItem(typeClass)}
						{DEBUG_MODE && (
							<div className="segment-timeline__debug-info">
								{innerPiece.enable.start} / {RundownUtils.formatTimeToTimecode(this.props.partDuration).substr(-5)} /{' '}
								{piece.renderedDuration ? RundownUtils.formatTimeToTimecode(piece.renderedDuration).substr(-5) : 'X'} /{' '}
								{typeof innerPiece.enable.duration === 'number'
									? RundownUtils.formatTimeToTimecode(innerPiece.enable.duration).substr(-5)
									: ''}
							</div>
						)}
						{innerPiece.transitions &&
						innerPiece.transitions.inTransition &&
						(innerPiece.transitions.inTransition.duration || 0) > 0 ? (
							<div
								className={ClassNames('segment-timeline__piece__transition', 'in', {
									mix: innerPiece.transitions.inTransition.type === PieceTransitionType.MIX,
									wipe: innerPiece.transitions.inTransition.type === PieceTransitionType.WIPE,
								})}
								style={{
									width: ((innerPiece.transitions.inTransition.duration || 0) * this.props.timeScale).toString() + 'px',
								}}
							/>
						) : null}
						{innerPiece.transitions &&
						innerPiece.transitions.outTransition &&
						(innerPiece.transitions.outTransition.duration || 0) > 0 ? (
							<div
								className={ClassNames('segment-timeline__piece__transition', 'out', {
									mix: innerPiece.transitions.outTransition.type === PieceTransitionType.MIX,
									wipe: innerPiece.transitions.outTransition.type === PieceTransitionType.WIPE,
								})}
								style={{
									width:
										((innerPiece.transitions.outTransition.duration || 0) * this.props.timeScale).toString() + 'px',
								}}
							/>
						) : null}
					</div>
				)
			} else {
				// render a placeholder
				return (
					<div
						className="segment-timeline__piece"
						data-obj-id={this.props.piece.instance._id}
						ref={this.setRef}
						style={this.getItemStyle()}></div>
				)
			}
		}
	}
)
