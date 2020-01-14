import * as ClassNames from 'classnames';
import * as React from 'react';
import * as _ from 'underscore';

import { IOutputLayerUi, ISourceLayerUi, PartUi, PieceUi } from './SegmentTimelineContainer';
import { InjectedTranslateProps, translate } from 'react-i18next';
import { ModalInputResult, SomeEvent, doModalDialog } from '../../lib/ModalDialog';
import {
	PieceLifespan,
	PieceTransitionType,
	SourceLayerType
} from 'tv-automation-sofie-blueprints-integration';
import { Position, getElementDocumentOffset } from '../../utils/positions';

import { DEBUG_MODE } from './SegmentTimelineDebugMode';
import { DefaultLayerItemRenderer } from './Renderers/DefaultLayerItemRenderer';
import { L3rdSourceRenderer } from './Renderers/L3rdSourceRenderer';
import { MicSourceRenderer } from './Renderers/MicSourceRenderer';
import { RundownAPI } from '../../../lib/api/rundown';
import { RundownUtils } from '../../lib/rundown';
import { STKSourceRenderer } from './Renderers/STKSourceRenderer';
import { SplitsSourceRenderer } from './Renderers/SplitsSourceRenderer';
import { TransitionSourceRenderer } from './Renderers/TransitionSourceRenderer';
import { UserActionAPI } from '../../../lib/api/userActions';
import { VTSourceRenderer } from './Renderers/VTSourceRenderer';
import { doUserAction } from '../../lib/userAction';
import { getElementWidth } from '../../utils/dimensions';

const LEFT_RIGHT_ANCHOR_SPACER = 15;

export interface ISourceLayerItemProps {
	layer: ISourceLayerUi;
	outputLayer: IOutputLayerUi;
	mediaPreviewUrl: string;
	// segment: SegmentUi
	part: PartUi;
	partStartsAt: number;
	partDuration: number;
	piece: PieceUi;
	timeScale: number;
	isLiveLine: boolean;
	isNextLine: boolean;
	onFollowLiveLine?: (state: boolean, event: any) => void;
	onClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void;
	onDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void;
	relative?: boolean;
	followLiveLine: boolean;
	autoNextPart: boolean;
	liveLineHistorySize: number;
	livePosition: number | null;
	outputGroupCollapsed: boolean;
	scrollLeft: number;
	scrollWidth: number;
	liveLinePadding: number;
}
interface ISourceLayerItemState {
	showMiniInspector: boolean;
	elementPosition: Position;
	cursorPosition: Position;
	scrollLeftOffset: number;
	cursorTimePosition: number;
	elementWidth: number;
	itemElement: HTMLDivElement | null;
	leftAnchoredWidth: number;
	rightAnchoredWidth: number;
}
export const SourceLayerItem = translate()(
	class extends React.Component<
		ISourceLayerItemProps & InjectedTranslateProps,
		ISourceLayerItemState
	> {
		private _forceSizingRecheck: boolean;
		private _placeHolderElement: boolean;

		constructor(props) {
			super(props);
			this.state = {
				showMiniInspector: false,
				elementPosition: {
					top: 0,
					left: 0
				},
				cursorPosition: {
					top: 0,
					left: 0
				},
				scrollLeftOffset: 0,
				cursorTimePosition: 0,
				elementWidth: 0,
				itemElement: null,
				leftAnchoredWidth: 0,
				rightAnchoredWidth: 0
			};

			this._forceSizingRecheck = false;
		}

		setRef = (e: HTMLDivElement) => {
			this.setState({
				itemElement: e
			});
		};

		getItemLabelOffsetLeft = (): { [key: string]: string } => {
			if (this.props.relative) {
				return {};
			} else {
				const maxLabelWidth = this.props.piece.maxLabelWidth;

				if (this.props.part && this.props.partStartsAt !== undefined) {
					//  && this.props.piece.renderedInPoint !== undefined && this.props.piece.renderedDuration !== undefined
					let piece = this.props.piece;

					let inTransitionDuration =
						piece.transitions && piece.transitions.inTransition
							? piece.transitions.inTransition.duration || 0
							: 0;
					let outTransitionDuration =
						piece.transitions && piece.transitions.outTransition
							? piece.transitions.outTransition.duration || 0
							: 0;

					const inPoint = piece.renderedInPoint || 0;
					const duration = Number.isFinite(piece.renderedDuration || 0)
						? piece.renderedDuration ||
						  this.props.partDuration ||
						  this.props.part.renderedDuration ||
						  0
						: this.props.partDuration || this.props.part.renderedDuration || 0;

					const widthConstrictedMode =
						this.state.leftAnchoredWidth > 0 &&
						this.state.rightAnchoredWidth > 0 &&
						this.state.leftAnchoredWidth + this.state.rightAnchoredWidth > this.state.elementWidth;

					const nextIsTouching = !!(
						this.props.piece.cropped ||
						(this.props.piece.enable.end && _.isString(this.props.piece.enable.end))
					);

					if (this.props.followLiveLine && this.props.isLiveLine) {
						const liveLineHistoryWithMargin = this.props.liveLineHistorySize - 10;
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
								this.props.timeScale;

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
													this.state.elementWidth -
														this.state.rightAnchoredWidth -
														liveLineHistoryWithMargin -
														10
											  )
									).toString() +
									'px, 0, 0) ' +
									'translate3d(' +
									Math.floor(liveLineHistoryWithMargin).toString() +
									'px, 0, 0) ' +
									'translate3d(-100%, 0, 5px)',
								willChange: 'transform'
							};

							return styleObj;
						} else if (
							this.state.rightAnchoredWidth < this.state.elementWidth &&
							this.state.leftAnchoredWidth < this.state.elementWidth &&
							this.props.scrollLeft + liveLineHistoryWithMargin / this.props.timeScale >=
								inPoint + duration + this.props.partStartsAt - outTransitionDuration
						) {
							const targetPos =
								(this.props.scrollLeft - inPoint - this.props.partStartsAt - inTransitionDuration) *
								this.props.timeScale;

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
											this.state.elementWidth -
												this.state.rightAnchoredWidth -
												liveLineHistoryWithMargin -
												10
										)
									).toString() +
									'px, 0, 0) ' +
									'translate3d(' +
									Math.floor(liveLineHistoryWithMargin).toString() +
									'px, 0, 0) ' +
									'translate3d(-100%, 0, 5px)',
								willChange: 'transform'
							};

							return styleObj;
						}
					} else {
						if (
							this.props.scrollLeft > inPoint + this.props.partStartsAt + inTransitionDuration &&
							this.props.scrollLeft <
								inPoint + duration + this.props.partStartsAt - outTransitionDuration
						) {
							const targetPos =
								(this.props.scrollLeft - inPoint - this.props.partStartsAt - inTransitionDuration) *
								this.props.timeScale;

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
										widthConstrictedMode ||
											this.state.leftAnchoredWidth === 0 ||
											this.state.rightAnchoredWidth === 0
											? targetPos
											: Math.min(
													targetPos,
													this.state.elementWidth -
														this.state.leftAnchoredWidth -
														this.state.rightAnchoredWidth
											  )
									).toString() +
									'px,  0, 5px)',
								willChange: 'transform'
							};

							return styleObj;
						} else {
							let styleObj = {
								maxWidth:
									this.state.rightAnchoredWidth > 0
										? (this.state.elementWidth - this.state.rightAnchoredWidth).toString() + 'px'
										: maxLabelWidth !== undefined
										? (maxLabelWidth * this.props.timeScale).toString() + 'px'
										: nextIsTouching
										? '100%'
										: 'none'
							};

							return styleObj;
						}
					}
				}
				return {};
			}
		};

		getItemLabelOffsetRight = (): { [key: string]: string } => {
			if (this.props.relative) {
				return {};
			} else {
				if (this.props.part && this.props.partStartsAt !== undefined) {
					//  && this.props.piece.renderedInPoint !== undefined && this.props.piece.renderedDuration !== undefined
					let piece = this.props.piece;

					// let inTransitionDuration = piece.transitions && piece.transitions.inTransition ? piece.transitions.inTransition.duration || 0 : 0
					let outTransitionDuration =
						piece.transitions && piece.transitions.outTransition
							? piece.transitions.outTransition.duration || 0
							: 0;

					const inPoint = piece.renderedInPoint || 0;
					const duration =
						piece.infiniteMode || piece.renderedDuration === 0
							? this.props.partDuration - inPoint
							: Math.min(piece.renderedDuration || 0, this.props.partDuration - inPoint);
					const outPoint = inPoint + duration;

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
						);

						return {
							transform: 'translate3d(' + Math.floor(targetPos).toString() + 'px,  0, 15px)',
							willChange: 'transform'
						};
					}
				}
				return {};
			}
		};

		getItemDuration = (): number => {
			let piece = this.props.piece;

			const expectedDurationNumber =
				typeof piece.enable.duration === 'number' ? piece.enable.duration || 0 : 0;
			const userDurationNumber =
				piece.userDuration && typeof piece.userDuration.duration === 'number'
					? piece.userDuration.duration || 0
					: 0;
			let itemDuration = Math.min(
				piece.playoutDuration ||
					userDurationNumber ||
					piece.renderedDuration ||
					expectedDurationNumber ||
					0,
				this.props.partDuration - (piece.renderedInPoint || 0)
			);

			if (
				((piece.infiniteMode !== undefined && piece.infiniteMode !== PieceLifespan.Normal) ||
					(piece.enable.start !== undefined &&
						piece.enable.end === undefined &&
						piece.enable.duration === undefined)) &&
				!piece.cropped &&
				!piece.playoutDuration &&
				!piece.userDuration
			) {
				itemDuration = this.props.partDuration - (piece.renderedInPoint || 0);
				// console.log(piece.infiniteMode + ', ' + piece.infiniteId)
			}

			return itemDuration;
		};

		getItemStyle(): { [key: string]: string } {
			let piece = this.props.piece;

			let inTransitionDuration =
				piece.transitions && piece.transitions.inTransition
					? piece.transitions.inTransition.duration || 0
					: 0;
			let outTransitionDuration =
				piece.transitions && piece.transitions.outTransition
					? piece.transitions.outTransition.duration || 0
					: 0;

			// If this is a live line, take duration verbatim from SegmentLayerItemContainer with a fallback on expectedDuration.
			// If not, as-run part "duration" limits renderdDuration which takes priority over MOS-import
			// expectedDuration (editorial duration)

			// let liveLinePadding = this.props.autoNextPart ? 0 : (this.props.isLiveLine ? this.props.liveLinePadding : 0)

			const itemDuration = this.getItemDuration();

			if (this.props.relative) {
				return {
					// also: don't render transitions in relative mode
					left:
						(((piece.renderedInPoint || 0) / (this.props.partDuration || 1)) * 100).toString() +
						'%',
					width: ((itemDuration / (this.props.partDuration || 1)) * 100).toString() + '%'
				};
			} else {
				return {
					left:
						Math.floor(
							((piece.renderedInPoint || 0) + inTransitionDuration) * this.props.timeScale
						).toString() + 'px',
					width:
						Math.round(
							(itemDuration - inTransitionDuration - outTransitionDuration) * this.props.timeScale
						).toString() + 'px'
				};
			}
		}

		checkElementWidth = () => {
			if (this.state.itemElement && this._forceSizingRecheck) {
				this._forceSizingRecheck = false;
				const width = getElementWidth(this.state.itemElement) || 0;
				if (this.state.elementWidth !== width) {
					this.setState({
						elementWidth: width
					});
				}
			}
		};

		componentDidMount() {
			this.checkElementWidth();
		}

		componentDidUpdate(prevProps: ISourceLayerItemProps) {
			this._forceSizingRecheck = true;

			if (prevProps.scrollLeft !== this.props.scrollLeft && this.state.showMiniInspector) {
				this.setState({
					scrollLeftOffset:
						this.state.scrollLeftOffset + (this.props.scrollLeft - prevProps.scrollLeft),
					cursorTimePosition:
						this.state.cursorTimePosition + (this.props.scrollLeft - prevProps.scrollLeft)
				});
			}

			this.checkElementWidth();
		}

		itemClick = (e: React.MouseEvent<HTMLDivElement>) => {
			// this.props.onFollowLiveLine && this.props.onFollowLiveLine(false, e)
			e.preventDefault();
			e.stopPropagation();
			this.props.onClick && this.props.onClick(this.props.piece, e);
		};
		tempDisplayInOutpoints = (e: React.MouseEvent<HTMLDivElement>) => {
			// Note: This is a TEMPORARY way to set in & out points, will be replaced with a much nicer looking way at a later stage
			doModalDialog({
				title: 'Set in point & duration',
				message: 'Please set the in-point & duration below',
				yes: 'Save',
				no: 'Discard',
				// acceptOnly?: boolean
				onAccept: (e: SomeEvent, inputResult: ModalInputResult) => {
					console.log('accept', inputResult);
					doUserAction(this.props.t, e, UserActionAPI.methods.setInOutPoints, [
						this.props.part.rundownId,
						this.props.part._id,
						this.props.piece._id,
						inputResult.inPoint,
						inputResult.outPoint
					]);
				},
				inputs: {
					inPoint: {
						label: 'In point',
						text: 'In point',
						type: 'float',
						defaultValue: 0
					},
					outPoint: {
						label: 'Out point',
						text: 'Out point',
						type: 'float',
						defaultValue: 0
					}
				}
			});
		};

		itemDblClick = (e: React.MouseEvent<HTMLDivElement>) => {
			e.preventDefault();
			e.stopPropagation();

			if (typeof this.props.onDoubleClick === 'function') {
				this.props.onDoubleClick(this.props.piece, e);
			}
		};

		itemMouseUp = (e: any) => {
			let eM = e as MouseEvent;
			if (eM.ctrlKey === true) {
				eM.preventDefault();
				eM.stopPropagation();
			}
			return;
		};

		toggleMiniInspector = (e: MouseEvent | any, v: boolean) => {
			this.setState({
				showMiniInspector: v
			});
			// console.log($(this.itemElement).offset())
			const elementPos = getElementDocumentOffset(this.state.itemElement) || {
				top: 0,
				left: 0
			};

			const cursorPosition = {
				left: e.clientX - elementPos.left,
				top: e.clientY - elementPos.top
			};

			const cursorTimePosition = Math.max(cursorPosition.left, 0) / this.props.timeScale;

			this.setState({
				scrollLeftOffset: 0,
				elementPosition: elementPos,
				cursorPosition,
				cursorTimePosition
			});
		};

		moveMiniInspector = (e: MouseEvent | any) => {
			const cursorPosition = {
				left: e.clientX - this.state.elementPosition.left,
				top: e.clientY - this.state.elementPosition.top
			};
			const cursorTimePosition =
				Math.max(cursorPosition.left, 0) / this.props.timeScale + this.state.scrollLeftOffset;

			this.setState({
				cursorPosition: _.extend(this.state.cursorPosition, cursorPosition),
				cursorTimePosition
			});
		};

		setAnchoredElsWidths = (leftAnchoredWidth: number, rightAnchoredWidth: number) => {
			this.setState({
				leftAnchoredWidth: leftAnchoredWidth,
				rightAnchoredWidth: rightAnchoredWidth
			});
		};

		renderInsideItem(typeClass: string) {
			switch (this.props.layer.type) {
				case SourceLayerType.SCRIPT:
					// case SourceLayerType.MIC:
					return (
						<MicSourceRenderer
							key={this.props.piece._id}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					);
				case SourceLayerType.VT:
					return (
						<VTSourceRenderer
							key={this.props.piece._id}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					);
				case SourceLayerType.GRAPHICS:
				case SourceLayerType.LOWER_THIRD:
					return (
						<L3rdSourceRenderer
							key={this.props.piece._id}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					);
				case SourceLayerType.SPLITS:
					return (
						<SplitsSourceRenderer
							key={this.props.piece._id}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					);
				case SourceLayerType.LIVE_SPEAK:
					// @ts-ignore: intrinsics get lost because of the complicated class structure, this is fine
					return (
						<STKSourceRenderer
							key={this.props.piece._id}
							// @ts-ignore: intrinsics get lost because of the complicated class structure, this is fine
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					);

				case SourceLayerType.TRANSITION:
					return (
						<TransitionSourceRenderer
							key={this.props.piece._id}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					);
				default:
					return (
						<DefaultLayerItemRenderer
							key={this.props.piece._id}
							typeClass={typeClass}
							getItemDuration={this.getItemDuration}
							getItemLabelOffsetLeft={this.getItemLabelOffsetLeft}
							getItemLabelOffsetRight={this.getItemLabelOffsetRight}
							setAnchoredElsWidths={this.setAnchoredElsWidths}
							{...this.props}
							{...this.state}
						/>
					);
			}
		}

		isInsideViewport() {
			if (this.props.relative) {
				return true;
			} else {
				return RundownUtils.isInsideViewport(
					this.props.scrollLeft,
					this.props.scrollWidth,
					this.props.part,
					this.props.partStartsAt,
					this.props.partDuration,
					this.props.piece
				);
			}
		}

		render() {
			if (this.isInsideViewport()) {
				this._placeHolderElement = false;

				const typeClass = RundownUtils.getSourceLayerClassName(this.props.layer.type);

				return (
					<div
						className={ClassNames('segment-timeline__piece', typeClass, {
							'with-in-transition':
								!this.props.relative &&
								this.props.piece.transitions &&
								this.props.piece.transitions.inTransition &&
								(this.props.piece.transitions.inTransition.duration || 0) > 0,
							'with-out-transition':
								!this.props.relative &&
								this.props.piece.transitions &&
								this.props.piece.transitions.outTransition &&
								(this.props.piece.transitions.outTransition.duration || 0) > 0,

							'hide-overflow-labels':
								this.state.leftAnchoredWidth > 0 &&
								this.state.rightAnchoredWidth > 0 &&
								this.state.leftAnchoredWidth + this.state.rightAnchoredWidth >
									this.state.elementWidth,

							infinite: (this.props.piece.playoutDuration === undefined &&
								this.props.piece.userDuration === undefined &&
								this.props.piece.infiniteMode) as boolean, // 0 is a special value
							'next-is-touching': !!(
								this.props.piece.cropped ||
								(this.props.piece.enable.end && _.isString(this.props.piece.enable.end))
							),

							'source-missing':
								this.props.piece.status === RundownAPI.PieceStatusCode.SOURCE_MISSING ||
								this.props.piece.status === RundownAPI.PieceStatusCode.SOURCE_NOT_SET,
							'source-broken': this.props.piece.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
							'unknown-state': this.props.piece.status === RundownAPI.PieceStatusCode.UNKNOWN,
							disabled: this.props.piece.disabled
						})}
						data-obj-id={this.props.piece._id}
						ref={this.setRef}
						onClick={this.itemClick}
						onDoubleClick={this.itemDblClick}
						onMouseUp={this.itemMouseUp}
						onMouseMove={(e) => this.moveMiniInspector(e)}
						onMouseOver={(e) =>
							!this.props.outputGroupCollapsed && this.toggleMiniInspector(e, true)
						}
						onMouseLeave={(e) => this.toggleMiniInspector(e, false)}
						style={this.getItemStyle()}>
						{this.renderInsideItem(typeClass)}
						{DEBUG_MODE && (
							<div className="segment-timeline__debug-info">
								{this.props.piece.enable.start} /{' '}
								{RundownUtils.formatTimeToTimecode(this.props.partDuration).substr(-5)} /{' '}
								{this.props.piece.renderedDuration
									? RundownUtils.formatTimeToTimecode(this.props.piece.renderedDuration).substr(-5)
									: 'X'}{' '}
								/{' '}
								{typeof this.props.piece.enable.duration === 'number'
									? RundownUtils.formatTimeToTimecode(this.props.piece.enable.duration).substr(-5)
									: ''}
							</div>
						)}
						{this.props.piece.transitions &&
						this.props.piece.transitions.inTransition &&
						(this.props.piece.transitions.inTransition.duration || 0) > 0 ? (
							<div
								className={ClassNames('segment-timeline__piece__transition', 'in', {
									mix: this.props.piece.transitions.inTransition.type === PieceTransitionType.MIX,
									wipe: this.props.piece.transitions.inTransition.type === PieceTransitionType.WIPE
								})}
								style={{
									width:
										(
											(this.props.piece.transitions.inTransition.duration || 0) *
											this.props.timeScale
										).toString() + 'px'
								}}
							/>
						) : null}
						{this.props.piece.transitions &&
						this.props.piece.transitions.outTransition &&
						(this.props.piece.transitions.outTransition.duration || 0) > 0 ? (
							<div
								className={ClassNames('segment-timeline__piece__transition', 'out', {
									mix: this.props.piece.transitions.outTransition.type === PieceTransitionType.MIX,
									wipe: this.props.piece.transitions.outTransition.type === PieceTransitionType.WIPE
								})}
								style={{
									width:
										(
											(this.props.piece.transitions.outTransition.duration || 0) *
											this.props.timeScale
										).toString() + 'px'
								}}
							/>
						) : null}
					</div>
				);
			} else {
				// render a placeholder

				this._placeHolderElement = true;

				return (
					<div
						className="segment-timeline__piece"
						data-obj-id={this.props.piece._id}
						ref={this.setRef}
						style={this.getItemStyle()}></div>
				);
			}
		}
	}
);
