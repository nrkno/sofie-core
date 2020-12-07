import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownAPI } from '../../../lib/api/rundown'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import {
	ISourceLayer,
	IOutputLayer,
	SourceLayerType,
	VTContent,
	LiveSpeakContent,
	SplitsContent,
	NoraContent,
} from '@sofie-automation/blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PubSub } from '../../../lib/api/pubsub'
import { IAdLibListItem } from './AdLibListItem'
import SplitInputIcon from '../PieceIcons/Renderers/SplitInput'
import { PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
import { DashboardPieceButtonSplitPreview } from './DashboardPieceButtonSplitPreview'
import { StyledTimecode } from '../../lib/StyledTimecode'
import { VTFloatingInspector } from '../FloatingInspectors/VTFloatingInspector'
import { getNoticeLevelForPieceStatus } from '../../lib/notifications/notifications'
import { L3rdFloatingInspector } from '../FloatingInspectors/L3rdFloatingInspector'
import { protectString } from '../../../lib/lib'

export interface IDashboardButtonProps {
	adLibListItem: IAdLibListItem
	layer?: ISourceLayer
	outputLayer?: IOutputLayer
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: any) => void
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
}
export const DEFAULT_BUTTON_WIDTH = 6.40625
export const DEFAULT_BUTTON_HEIGHT = 5.625

export interface IDashboardButtonTrackedProps {
	status: RundownAPI.PieceStatusCode | undefined
	metadata: MediaObject | null
	message: string | null
}

interface IState {
	isHovered: boolean
	timePosition: number
}

export class DashboardPieceButtonBase<T = {}> extends MeteorReactComponent<
	Translated<IDashboardButtonProps & IDashboardButtonTrackedProps> & T,
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

	constructor(props: IDashboardButtonProps) {
		super(props)

		this.state = {
			isHovered: false,
			timePosition: 0,
		}
	}

	componentDidMount() {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	componentDidUpdate() {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	updateMediaObjectSubscription() {
		if (this.props.adLibListItem && this.props.layer) {
			const piece = (this.props.adLibListItem as any) as AdLibPieceUi
			let objId: string | undefined = undefined

			if (piece.content && piece.content.fileName) {
				switch (this.props.layer.type) {
					case SourceLayerType.VT:
						objId = (piece.content as VTContent).fileName.toUpperCase()
						break
					case SourceLayerType.LIVE_SPEAK:
						objId = (piece.content as LiveSpeakContent).fileName.toUpperCase()
						break
				}
			}

			if (objId && objId !== this.objId) {
				// if (this.mediaObjectSub) this.mediaObjectSub.stop()
				this.objId = objId
				this.subscribe(PubSub.mediaObjects, this.props.playlist.studioId, {
					mediaId: this.objId,
				})
			}
		}
	}

	getThumbnailUrl = (): string | undefined => {
		const { metadata } = this.props
		if (this.props.mediaPreviewUrl && metadata) {
			if (metadata && metadata.previewPath && this.props.mediaPreviewUrl) {
				return this.props.mediaPreviewUrl + 'media/thumbnail/' + encodeURIComponent(metadata.mediaId)
			}
		}
		return undefined
	}

	renderGraphics(renderThumbnail?: boolean) {
		const adLib = (this.props.adLibListItem as any) as AdLibPieceUi
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
					piece={{ ...adLib, enable: { start: 0 }, startPartId: protectString(''), invalid: false }}
					pieceRenderedDuration={adLib.expectedDuration || null}
					pieceRenderedIn={null}
				/>
			</>
		)
	}

	renderVTLiveSpeak(renderThumbnail?: boolean) {
		let thumbnailUrl: string | undefined
		let sourceDuration: number | undefined
		const adLib = (this.props.adLibListItem as any) as AdLibPieceUi
		if (this.props.metadata) {
			thumbnailUrl = this.getThumbnailUrl()
			const vtContent = adLib.content as VTContent | undefined
			sourceDuration = vtContent?.sourceDuration
		}
		return (
			<>
				{thumbnailUrl && renderThumbnail && (
					<img src={thumbnailUrl} className="dashboard-panel__panel__button__thumbnail" />
				)}
				{sourceDuration && (
					<span className="dashboard-panel__panel__button__sub-label">
						{sourceDuration ? <StyledTimecode time={sourceDuration || 0} /> : null}
					</span>
				)}
				<VTFloatingInspector
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
					contentMetaData={this.props.metadata || null}
					noticeMessage={this.props.message || null}
					noticeLevel={
						this.props.status !== null && this.props.status !== undefined
							? getNoticeLevelForPieceStatus(this.props.status as any)
							: null
					}
					mediaPreviewUrl={this.props.mediaPreviewUrl}
				/>
			</>
		)
	}

	renderSplits(renderThumbnail: boolean = false) {
		const splitAdLib = this.props.adLibListItem
		if (splitAdLib && splitAdLib.content) {
			const splitContent = splitAdLib.content as SplitsContent
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

	setRef = (el: HTMLDivElement | null) => {
		this.element = el
	}

	handleOnMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
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

	handleOnMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
		this.setState({ isHovered: false })
		this.positionAndSize = null
	}

	handleOnMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		const timePercentage = Math.max(
			0,
			Math.min((e.clientX - (this.positionAndSize?.left || 0) - 5) / ((this.positionAndSize?.width || 1) - 10), 1)
		)
		const sourceDuration = (this.props.adLibListItem.content as VTContent | undefined)?.sourceDuration || 0
		this.setState({
			timePosition: timePercentage * sourceDuration,
		})
	}

	render() {
		const isList = this.props.displayStyle === PieceDisplayStyle.LIST
		const isButtons = this.props.displayStyle === PieceDisplayStyle.BUTTONS
		const hasMediaInfo =
			this.props.layer &&
			this.props.layer.type === SourceLayerType.VT &&
			this.props.metadata &&
			this.props.metadata.mediainfo
		return (
			<div
				className={ClassNames(
					'dashboard-panel__panel__button',
					{
						invalid: this.props.adLibListItem.invalid,
						floated: this.props.adLibListItem.floated,

						'source-missing': this.props.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
						'source-broken': this.props.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
						'unknown-state': this.props.status === RundownAPI.PieceStatusCode.UNKNOWN,

						live: this.props.isOnAir,
						disabled: this.props.disabled,
						list: isList,
						selected: this.props.isNext || this.props.isSelected,
					},
					this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type)
				)}
				style={{
					width: isList
						? 'calc(100% - 8px)'
						: !!this.props.widthScale
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
				onClick={(e) =>
					this.props.onToggleAdLib(this.props.adLibListItem, e.shiftKey || !!this.props.queueAllAdlibs, e)
				}
				ref={this.setRef}
				onMouseEnter={this.handleOnMouseEnter}
				onMouseLeave={this.handleOnMouseLeave}
				onMouseMove={this.handleOnMouseMove}
				data-obj-id={this.props.adLibListItem._id}>
				{!this.props.layer
					? null
					: this.props.layer.type === SourceLayerType.VT || this.props.layer.type === SourceLayerType.LIVE_SPEAK
					? // VT should have thumbnails in "Button" layout.
					  this.renderVTLiveSpeak(isButtons || (isList && this.props.showThumbnailsInList))
					: this.props.layer.type === SourceLayerType.SPLITS
					? this.renderSplits(isList && this.props.showThumbnailsInList)
					: this.props.layer.type === SourceLayerType.GRAPHICS || this.props.layer.type === SourceLayerType.LOWER_THIRD
					? this.renderGraphics(isButtons || (isList && this.props.showThumbnailsInList))
					: null}
				<span className="dashboard-panel__panel__button__label">
					{isList && hasMediaInfo ? this.props.metadata!.mediainfo!.name : this.props.adLibListItem.name}
				</span>
			</div>
		)
	}
}

export const DashboardPieceButton = translateWithTracker<IDashboardButtonProps, {}, IDashboardButtonTrackedProps>(
	(props: IDashboardButtonProps) => {
		const piece = (props.adLibListItem as any) as AdLibPieceUi

		const { status, metadata, message } = checkPieceContentStatus(
			piece,
			props.layer,
			props.playlist.getStudio().settings
		)

		return {
			status,
			metadata,
			message,
		}
	}
)(DashboardPieceButtonBase)
