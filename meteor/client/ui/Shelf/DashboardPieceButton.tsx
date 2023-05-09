import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import ClassNames from 'classnames'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import {
	ISourceLayer,
	IOutputLayer,
	SourceLayerType,
	VTContent,
	NoraContent,
	IBlueprintPieceType,
} from '@sofie-automation/blueprints-integration'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { IAdLibListItem } from './AdLibListItem'
import SplitInputIcon from '../PieceIcons/Renderers/SplitInputIcon'
import { PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
import { DashboardPieceButtonSplitPreview } from './DashboardPieceButtonSplitPreview'
import { StyledTimecode } from '../../lib/StyledTimecode'
import { VTFloatingInspector } from '../FloatingInspectors/VTFloatingInspector'
import { getNoticeLevelForPieceStatus } from '../../../lib/notifications/notifications'
import { L3rdFloatingInspector } from '../FloatingInspectors/L3rdFloatingInspector'
import { withMediaObjectStatus } from '../SegmentTimeline/withMediaObjectStatus'
import { getThumbnailUrlForAdLibPieceUi } from '../../lib/ui/clipPreview'

import { isTouchDevice } from '../../lib/lib'
import { AdLibPieceUi } from '../../lib/shelf'
import { protectString } from '../../../lib/lib'
import { UIStudio } from '../../../lib/api/studios'

export interface IDashboardButtonProps {
	piece: IAdLibListItem
	studio: UIStudio
	layer?: ISourceLayer
	outputLayer?: IOutputLayer
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: React.SyntheticEvent) => void
	onSelectAdLib: (aSLine: IAdLibListItem, context: React.SyntheticEvent) => void
	playlist: RundownPlaylist
	mediaPreviewUrl?: string
	isOnAir?: boolean
	isNext?: boolean
	widthScale?: number
	heightScale?: number
	disabled?: boolean
	displayStyle: PieceDisplayStyle
	isSelected?: boolean
	queueAllAdlibs?: boolean
	showThumbnailsInList?: boolean
	disableHoverInspector?: boolean
	editableName?: boolean
	onNameChanged?: (e: any, value: string) => void
	toggleOnSingleClick?: boolean
	canOverflowHorizontally?: boolean
	lineBreak?: string
}
export const DEFAULT_BUTTON_WIDTH = 6.40625
export const DEFAULT_BUTTON_HEIGHT = 5.625
export const HOVER_TIMEOUT = 5000

interface IState {
	label: string
	isHovered: boolean
	timePosition: number
	active: boolean
}

export class DashboardPieceButtonBase<T = {}> extends MeteorReactComponent<
	React.PropsWithChildren<IDashboardButtonProps> & T,
	IState
> {
	private element: HTMLDivElement | null = null
	private positionAndSize: {
		top: number
		left: number
		width: number
		height: number
	} | null = null
	private _labelEl: HTMLTextAreaElement
	private pointerId: number | null = null
	private hoverTimeout: number | null = null
	protected inBucket = false

	constructor(props: IDashboardButtonProps & T) {
		super(props)

		this.state = {
			isHovered: false,
			timePosition: 0,
			label: this.props.piece.name,
			active: false,
		}
	}

	componentDidUpdate(prevProps: IDashboardButtonProps & T): void {
		if (prevProps.piece.name !== this.props.piece.name) {
			this.setState({
				label: this.props.piece.name,
			})
		}
	}

	componentWillUnmount(): void {
		super.componentWillUnmount()
		if (this.hoverTimeout) {
			clearTimeout(this.hoverTimeout)
			this.hoverTimeout = null
		}
	}

	private renderGraphics(_renderThumbnail?: boolean) {
		const adLib = this.props.piece as any as AdLibPieceUi
		const noraContent = adLib.content as NoraContent | undefined
		return (
			<>
				<L3rdFloatingInspector
					showMiniInspector={this.state.isHovered}
					content={noraContent}
					floatingInspectorStyle={{
						top: this.positionAndSize?.top + 'px',
						left: this.positionAndSize?.left + 'px',
						transform: 'translate(0, -100%)',
					}}
					typeClass={this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type)}
					itemElement={this.element}
					piece={{
						...adLib,
						enable: { start: 0 },
						startPartId: protectString(''),
						invalid: false,
						pieceType: IBlueprintPieceType.Normal,
					}}
					pieceRenderedDuration={adLib.expectedDuration || null}
					pieceRenderedIn={null}
					displayOn="viewport"
				/>
			</>
		)
	}

	private renderVTLiveSpeak(renderThumbnail?: boolean) {
		let thumbnailUrl: string | undefined
		let sourceDuration: number | undefined
		const adLib = this.props.piece as any as AdLibPieceUi
		if (this.props.piece.content && this.props.studio) {
			thumbnailUrl = getThumbnailUrlForAdLibPieceUi(this.props.piece, this.props.studio!, this.props.mediaPreviewUrl)
			const vtContent = adLib.content as VTContent | undefined
			sourceDuration = vtContent?.sourceDuration
		}
		return (
			<>
				{sourceDuration && (
					<span className="dashboard-panel__panel__button__sub-label">
						{sourceDuration ? (
							<StyledTimecode time={sourceDuration || 0} studioSettings={this.props.studio?.settings} />
						) : null}
					</span>
				)}
				<VTFloatingInspector
					status={this.props.piece.status}
					showMiniInspector={this.state.isHovered}
					timePosition={this.state.timePosition}
					content={adLib.content as VTContent | undefined}
					floatingInspectorStyle={{
						top: this.positionAndSize?.top + 'px',
						left: this.positionAndSize?.left + 'px',
						transform: 'translate(0, -100%)',
					}}
					typeClass={this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type)}
					itemElement={null}
					contentMetaData={this.props.piece.contentMetaData || null}
					noticeMessages={this.props.piece.messages || null}
					noticeLevel={
						this.props.piece.status !== null && this.props.piece.status !== undefined
							? getNoticeLevelForPieceStatus(this.props.piece.status)
							: null
					}
					mediaPreviewUrl={this.props.mediaPreviewUrl}
					contentPackageInfos={this.props.piece.contentPackageInfos}
					pieceId={this.props.piece._id}
					expectedPackages={this.props.piece.expectedPackages}
					studio={this.props.studio}
					displayOn="viewport"
				/>
				{thumbnailUrl && renderThumbnail && (
					<div className="dashboard-panel__panel__button__thumbnail">
						<img src={thumbnailUrl} />
					</div>
				)}
			</>
		)
	}

	private renderSplits(renderThumbnail: boolean = false) {
		const splitAdLib = this.props.piece
		if (splitAdLib && splitAdLib.content) {
			return (
				<>
					{renderThumbnail ? (
						<DashboardPieceButtonSplitPreview piece={splitAdLib} />
					) : (
						<SplitInputIcon
							abbreviation={this.props.layer ? this.props.layer.abbreviation : undefined}
							piece={splitAdLib}
							hideLabel={true}
						/>
					)}
				</>
			)
		}
	}

	private setRef = (el: HTMLDivElement | null) => {
		this.element = el
	}

	private handleOnMouseEnter = (_e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
		if (this.element) {
			const { top, left, width, height } = this.element.getBoundingClientRect()
			this.positionAndSize = {
				top,
				left,
				width,
				height,
			}
		}
		this.setState({ isHovered: true })
	}

	private handleOnMouseLeave = (_e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
		this.setState({ isHovered: false })
		this.positionAndSize = null
	}

	private handleOnPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
		if (this.element) {
			const { top, left, width, height } = this.element.getBoundingClientRect()
			this.positionAndSize = {
				top,
				left,
				width,
				height,
			}
		}
		if (e.pointerType === 'mouse') {
			this.setState({ isHovered: true })
			this.startHoverTimeout()
		}
	}

	private handleOnPointerLeave = (_e: React.PointerEvent<HTMLDivElement>) => {
		this.setState({ isHovered: false })
		if (this.hoverTimeout) {
			Meteor.clearTimeout(this.hoverTimeout)
			this.hoverTimeout = null
		}
		this.positionAndSize = null
	}

	private handleOnMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		this.handleMove(e.clientX)
	}

	private handleOnTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
		if (e.changedTouches && e.changedTouches.length) {
			this.handleMove(e.changedTouches[0].clientX)
		}
	}

	private handleMove = (clientX: number) => {
		const timePercentage = Math.max(
			0,
			Math.min((clientX - (this.positionAndSize?.left || 0) - 5) / ((this.positionAndSize?.width || 1) - 10), 1)
		)
		const sourceDuration = (this.props.piece.content as VTContent | undefined)?.sourceDuration || 0
		this.setState({
			timePosition: timePercentage * sourceDuration,
		})
		if (this.hoverTimeout) {
			Meteor.clearTimeout(this.hoverTimeout)
			this.startHoverTimeout()
		}
	}

	private startHoverTimeout = () => {
		this.hoverTimeout = Meteor.setTimeout(() => {
			this.hoverTimeout = null
			this.setState({ isHovered: false })
		}, HOVER_TIMEOUT)
	}

	private onNameChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		this.setState({
			label: e.currentTarget.value || '',
		})
	}

	private onRenameTextBoxKeyUp = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			this.setState(
				{
					label: this.props.piece.name,
				},
				() => {
					this._labelEl && this._labelEl.blur()
				}
			)
			e.preventDefault()
			e.stopPropagation()
			e.stopImmediatePropagation()
		} else if (e.key === 'Enter') {
			this._labelEl && this._labelEl.blur()
			e.preventDefault()
			e.stopPropagation()
			e.stopImmediatePropagation()
		}
	}

	private onRenameTextBoxBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
		if (!this.state.label.trim()) {
			e.persist()
			this.setState(
				{
					label: this.props.piece.name,
				},
				() => {
					this.props.onNameChanged && this.props.onNameChanged(e, this.state.label)
				}
			)
		} else {
			this.props.onNameChanged && this.props.onNameChanged(e, this.state.label)
		}
	}

	private renameTextBoxFocus = (input: HTMLTextAreaElement) => {
		input.focus()
		input.setSelectionRange(0, input.value.length)
	}

	private onRenameTextBoxShow = (ref: HTMLTextAreaElement) => {
		if (ref && !this._labelEl) {
			ref.addEventListener('keyup', this.onRenameTextBoxKeyUp)
			this.renameTextBoxFocus(ref)
		}
		this._labelEl = ref
	}

	private handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		const { toggleOnSingleClick } = this.props
		// if pointerId is not set, it means we are dealing with a mouse and not an emulated mouse event
		if (this.pointerId !== null || e.button !== 0) {
			return
		}
		// this is a main-button-click
		if (toggleOnSingleClick) {
			this.props.onToggleAdLib(this.props.piece, e.shiftKey || !!this.props.queueAllAdlibs, e)
		} else {
			this.props.onSelectAdLib(this.props.piece, e)
		}
	}

	private handleOnMouseDown = (e: React.PointerEvent<HTMLDivElement>) => {
		// if mouseDown event is fired, that means that pointerDown did not fire, which means we are dealing with a mouse
		this.pointerId = null
		if (e.button) {
			// this is some other button, main button is 0
			this.props.onSelectAdLib(this.props.piece, e)
		}
		if (isTouchDevice()) {
			// hide the hoverscrub
			this.handleOnPointerLeave(e)
		}
	}

	private handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		const { toggleOnSingleClick } = this.props
		if (toggleOnSingleClick) {
			return
		}
		this.props.onToggleAdLib(this.props.piece, e.shiftKey || !!this.props.queueAllAdlibs, e)
	}

	private handleOnPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			const pointerCopy = e.pointerId
			this.pointerId = pointerCopy
		} else {
			this.pointerId = null
		}
	}

	private handleOnPointerOut = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerId === this.pointerId) {
			this.pointerId = null
		}
	}

	private handleOnPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		const { toggleOnSingleClick } = this.props
		if (e.pointerType === 'mouse' || e.pointerId === null || e.pointerId !== this.pointerId) {
			return
		}
		if (!toggleOnSingleClick) {
			this.props.onToggleAdLib(this.props.piece, e.shiftKey || !!this.props.queueAllAdlibs, e)
		}
		e.preventDefault()
	}

	private renderHotkey = () => {
		if (this.props.piece.hotkey) {
			return <div className="dashboard-panel__panel__button__hotkey">{this.props.piece.hotkey}</div>
		}
	}

	render(): JSX.Element {
		const isList = this.props.displayStyle === PieceDisplayStyle.LIST
		const isButtons = this.props.displayStyle === PieceDisplayStyle.BUTTONS
		return (
			<div
				className={ClassNames(
					'dashboard-panel__panel__button',
					{
						invalid: this.props.piece.invalid,
						floated: this.props.piece.floated,
						active: this.state.active,
						live: this.props.isOnAir,
						disabled: this.props.disabled,
						list: isList,
						selected: this.props.isNext || this.props.isSelected,
					},
					!this.inBucket && this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type),
					RundownUtils.getPieceStatusClassName(this.props.piece.status),
					...(this.props.piece.tags ? this.props.piece.tags.map((tag) => `piece-tag--${tag}`) : [])
				)}
				style={{
					width: isList
						? 'calc(100% - 8px)'
						: this.props.widthScale
						? (this.props.widthScale as number) * DEFAULT_BUTTON_WIDTH + 'em'
						: undefined,
					height:
						!isList && !!this.props.heightScale
							? (this.props.heightScale as number) * DEFAULT_BUTTON_HEIGHT + 'em'
							: undefined,
				}}
				onClick={this.handleClick}
				onDoubleClick={this.handleDoubleClick}
				ref={this.setRef}
				onMouseDown={this.handleOnMouseDown}
				onPointerEnter={this.handleOnPointerEnter}
				onPointerLeave={this.handleOnPointerLeave}
				onMouseMove={this.handleOnMouseMove}
				onPointerDown={this.handleOnPointerDown}
				onPointerOut={this.handleOnPointerOut}
				onPointerUp={this.handleOnPointerUp}
				onTouchStart={!this.props.canOverflowHorizontally ? this.handleOnMouseEnter : undefined}
				onTouchEnd={!this.props.canOverflowHorizontally ? this.handleOnMouseLeave : undefined}
				onTouchMove={!this.props.canOverflowHorizontally ? this.handleOnTouchMove : undefined}
				data-obj-id={this.props.piece._id}
			>
				<div className="dashboard-panel__panel__button__content">
					{this.props.disableHoverInspector || !this.props.layer
						? null
						: this.props.layer.type === SourceLayerType.VT || this.props.layer.type === SourceLayerType.LIVE_SPEAK
						? // VT should have thumbnails in "Button" layout.
						  this.renderVTLiveSpeak(isButtons || (isList && this.props.showThumbnailsInList))
						: this.props.layer.type === SourceLayerType.SPLITS
						? this.renderSplits(isList && this.props.showThumbnailsInList)
						: this.props.layer.type === SourceLayerType.GRAPHICS ||
						  this.props.layer.type === SourceLayerType.LOWER_THIRD
						? this.renderGraphics(isButtons || (isList && this.props.showThumbnailsInList))
						: null}

					{this.renderHotkey()}
					<div className="dashboard-panel__panel__button__label-container">
						{this.inBucket && (
							<div
								className={ClassNames(
									'dashboard-panel__panel__button__tag-container',
									this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type)
								)}
							>
								&nbsp;
							</div>
						)}
						{this.props.editableName ? (
							<textarea
								className="dashboard-panel__panel__button__label dashboard-panel__panel__button__label--editable"
								value={this.state.label}
								onChange={this.onNameChanged}
								onBlur={this.onRenameTextBoxBlur}
								ref={this.onRenameTextBoxShow}
							></textarea>
						) : (
							<div className="dashboard-panel__panel__button__label">{this.state.label}</div>
						)}
					</div>
				</div>
			</div>
		)
	}
}

export const DashboardPieceButton = withMediaObjectStatus<React.PropsWithChildren<IDashboardButtonProps>, {}>()(
	DashboardPieceButtonBase
)
