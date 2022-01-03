import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import ClassNames from 'classnames'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownAPI } from '../../../lib/api/rundown'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import {
	ISourceLayer,
	IOutputLayer,
	SourceLayerType,
	VTContent,
	Accessor,
} from '@sofie-automation/blueprints-integration'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { IAdLibListItem } from './AdLibListItem'
import SplitInputIcon from '../PieceIcons/Renderers/SplitInput'
import { PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
import { DashboardPieceButtonSplitPreview } from './DashboardPieceButtonSplitPreview'
import { StyledTimecode } from '../../lib/StyledTimecode'
import { VTFloatingInspector } from '../FloatingInspectors/VTFloatingInspector'
import { getNoticeLevelForPieceStatus } from '../../lib/notifications/notifications'
import { Studio } from '../../../lib/collections/Studios'
import { withMediaObjectStatus } from '../SegmentTimeline/withMediaObjectStatus'
import { getSideEffect } from '../../../lib/collections/ExpectedPackages'
import { ensureHasTrailingSlash, isTouchDevice } from '../../lib/lib'
import { AdLibPieceUi } from '../../lib/shelf'

export interface IDashboardButtonProps {
	piece: IAdLibListItem
	studio: Studio
	layer?: ISourceLayer
	outputLayer?: IOutputLayer
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: any) => void
	onSelectAdLib: (aSLine: IAdLibListItem, context: any) => void
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
	Translated<IDashboardButtonProps> & T,
	IState
> {
	private objId: string
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

	constructor(props: IDashboardButtonProps) {
		super(props)

		this.state = {
			isHovered: false,
			timePosition: 0,
			label: this.props.piece.name,
			active: false,
		}
	}

	componentDidUpdate(prevProps) {
		if (prevProps.piece.name !== this.props.piece.name) {
			this.setState({
				label: this.props.piece.name,
			})
		}
	}

	componentWillUnmount() {
		super.componentWillUnmount()
		if (this.hoverTimeout) {
			clearTimeout(this.hoverTimeout)
			this.hoverTimeout = null
		}
	}

	getThumbnailUrl = (piece: IAdLibListItem, studio: Studio): string | undefined => {
		if (piece.expectedPackages) {
			// use Expected packages:
			// Just use the first one we find.
			// TODO: support multiple expected packages?

			let thumbnailContainerId: string | undefined
			let packageThumbnailPath: string | undefined
			for (const expectedPackage of piece.expectedPackages) {
				const sideEffect = getSideEffect(expectedPackage, studio)

				packageThumbnailPath = sideEffect.thumbnailPackageSettings?.path
				thumbnailContainerId = sideEffect.thumbnailContainerId

				if (packageThumbnailPath && thumbnailContainerId) {
					break // don't look further
				}
			}
			if (packageThumbnailPath && thumbnailContainerId) {
				const packageContainer = studio.packageContainers[thumbnailContainerId]
				if (packageContainer) {
					// Look up an accessor we can use:
					for (const accessor of Object.values(packageContainer.container.accessors)) {
						if (
							(accessor.type === Accessor.AccessType.HTTP || accessor.type === Accessor.AccessType.HTTP_PROXY) &&
							accessor.baseUrl
						) {
							// Currently we only support public accessors (ie has no networkId set)
							if (!accessor.networkId) {
								return [
									accessor.baseUrl.replace(/\/$/, ''), // trim trailing slash
									encodeURIComponent(
										packageThumbnailPath.replace(/^\//, '') // trim leading slash
									),
								].join('/')
							}
						}
					}
				}
			}
		} else {
			// Fallback to media objects
			if (this.props.mediaPreviewUrl && piece.contentMetaData) {
				if (piece.contentMetaData && piece.contentMetaData.previewPath && this.props.mediaPreviewUrl) {
					return (
						ensureHasTrailingSlash(this.props.mediaPreviewUrl ?? null) +
						'media/thumbnail/' +
						encodeURIComponent(piece.contentMetaData.mediaId)
					)
				}
			}
		}
		return undefined
	}

	renderGraphics(renderThumbnail?: boolean) {
		const thumbnailUrl = this.getThumbnailUrl(this.props.piece, this.props.studio)
		return (
			<>
				{thumbnailUrl && renderThumbnail && (
					<div className="dashboard-panel__panel__button__thumbnail">
						<img src={thumbnailUrl} />
					</div>
				)}
			</>
		)
	}

	renderVTLiveSpeak(renderThumbnail?: boolean) {
		let thumbnailUrl: string | undefined
		let sourceDuration: number | undefined
		const adLib = this.props.piece as any as AdLibPieceUi
		if (this.props.piece.content && this.props.studio) {
			thumbnailUrl = this.getThumbnailUrl(this.props.piece, this.props.studio!)
			const vtContent = adLib.content as VTContent | undefined
			sourceDuration = vtContent?.sourceDuration
		}
		return (
			<>
				{sourceDuration && (
					<span className="dashboard-panel__panel__button__sub-label">
						{sourceDuration ? <StyledTimecode time={sourceDuration || 0} /> : null}
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
					noticeMessage={this.props.piece.message || null}
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

	renderSplits(renderThumbnail: boolean = false) {
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

	private handleOnTouchStart = (_e: React.TouchEvent<HTMLDivElement>) => {
		if (this.element) {
			const { top, left, width, height } = this.element.getBoundingClientRect()
			this.positionAndSize = {
				top,
				left,
				width,
				height,
			}
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

	private handleOnTouchEnd = (_e: React.TouchEvent<HTMLDivElement>) => {
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
		if (this.pointerId === null && e.button === 0) {
			// this is a main-button-click
			if (toggleOnSingleClick) {
				this.props.onToggleAdLib(this.props.piece, e.shiftKey || !!this.props.queueAllAdlibs, e)
			} else {
				this.props.onSelectAdLib(this.props.piece, e)
			}
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
		} else {
			this.props.onToggleAdLib(this.props.piece, e.shiftKey || !!this.props.queueAllAdlibs, e)
		}
	}

	private handleOnPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerType !== 'mouse') {
			this.pointerId = e.pointerId
			e.preventDefault()
		} else {
			this.pointerId = null
		}
	}

	private handleOnPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.pointerId === this.pointerId) {
			this.props.onToggleAdLib(this.props.piece, e.shiftKey || !!this.props.queueAllAdlibs, e)
			e.preventDefault()
		}
	}

	renderHotkey = () => {
		if (this.props.piece.hotkey) {
			return <div className="dashboard-panel__panel__button__hotkey">{this.props.piece.hotkey}</div>
		}
	}

	render() {
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

						'source-missing': this.props.piece.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
						'source-broken': this.props.piece.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
						'unknown-state': this.props.piece.status === RundownAPI.PieceStatusCode.UNKNOWN,

						live: this.props.isOnAir,
						disabled: this.props.disabled,
						list: isList,
						selected: this.props.isNext || this.props.isSelected,
					},
					this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type),
					...(this.props.piece.tags ? this.props.piece.tags.map((tag) => `piece-tag--${tag}`) : [])
				)}
				style={{
					width: isList
						? 'calc(100% - 8px)'
						: this.props.widthScale
						? //@ts-ignore: widthScale is in a weird state between a number and something else
						  //		      because of the optional generic type argument
						  (this.props.widthScale as number) * DEFAULT_BUTTON_WIDTH + 'em'
						: undefined,
					height:
						!isList && !!this.props.heightScale
							? //@ts-ignore
							  (this.props.heightScale as number) * DEFAULT_BUTTON_HEIGHT + 'em'
							: undefined,
				}}
				onClick={this.handleClick}
				onDoubleClick={this.handleDoubleClick}
				ref={this.setRef}
				onMouseDown={this.handleOnMouseDown}
				onPointerEnter={this.handleOnPointerEnter}
				onPointerLeave={this.handleOnPointerLeave}
				onMouseMove={this.handleOnMouseMove}
				onTouchStart={!this.props.canOverflowHorizontally ? this.handleOnTouchStart : undefined}
				onTouchEnd={!this.props.canOverflowHorizontally ? this.handleOnTouchEnd : undefined}
				onTouchMove={!this.props.canOverflowHorizontally ? this.handleOnTouchMove : undefined}
				onPointerDown={this.handleOnPointerDown}
				onPointerUp={this.handleOnPointerUp}
				data-obj-id={this.props.piece._id}
			>
				<div className="dashboard-panel__panel__button__content">
					{!this.props.layer
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
						{this.props.editableName ? (
							<textarea
								className="dashboard-panel__panel__button__label dashboard-panel__panel__button__label--editable"
								value={this.state.label}
								onChange={this.onNameChanged}
								onBlur={this.onRenameTextBoxBlur}
								ref={this.onRenameTextBoxShow}
							></textarea>
						) : (
							<span className="dashboard-panel__panel__button__label">{this.state.label}</span>
						)}
					</div>
				</div>
			</div>
		)
	}
}

export const DashboardPieceButton = withMediaObjectStatus<IDashboardButtonProps, {}>()(DashboardPieceButtonBase)
