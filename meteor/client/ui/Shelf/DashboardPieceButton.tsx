import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownAPI } from '../../../lib/api/rundown'

import { DefaultListItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { mousetrapHelper } from '../../lib/mousetrapHelper'
import { RundownUtils } from '../../lib/rundown'
import {
	ISourceLayer,
	IOutputLayer,
	SourceLayerType,
	VTContent,
	LiveSpeakContent,
	SplitsContent,
} from 'tv-automation-sofie-blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown } from '../../../lib/collections/Rundowns'
import { PubSub } from '../../../lib/api/pubsub'
import { IAdLibListItem } from './AdLibListItem'
import { PieceId, PieceGeneric } from '../../../lib/collections/Pieces'
import SplitInputIcon from '../PieceIcons/Renderers/SplitInput'
import { PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
import { DashboardPieceButtonSplitPreview } from './DashboardPieceButtonSplitPreview'
import { Studio } from '../../../lib/collections/Studios'
import { withMediaObjectStatus } from '../SegmentTimeline/withMediaObjectStatus'

export interface IDashboardButtonProps {
	piece: IAdLibListItem
	studio: Studio | undefined
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
	displayStyle?: PieceDisplayStyle
	isSelected?: boolean
	queueAllAdlibs?: boolean
	showThumbnailsInList?: boolean
}
export const DEFAULT_BUTTON_WIDTH = 6.40625
export const DEFAULT_BUTTON_HEIGHT = 5.625

export class DashboardPieceButtonBase<T = {}> extends MeteorReactComponent<Translated<IDashboardButtonProps> & T> {
	private objId: string

	constructor(props: IDashboardButtonProps) {
		super(props)
	}

	getPreviewUrl = (): string | undefined => {
		const { metadata } = this.props
		if (this.props.mediaPreviewUrl && metadata) {
			if (metadata && metadata.previewPath && this.props.mediaPreviewUrl) {
				return this.props.mediaPreviewUrl + 'media/thumbnail/' + encodeURIComponent(metadata.mediaId)
			}
		}
		return undefined
	}

	renderVTLiveSpeak(renderThumbnail?: boolean) {
		if (this.props.metadata) {
			const previewUrl = this.getPreviewUrl()
			const adLib = (this.props.piece as any) as AdLibPieceUi
			const vtContent = adLib.content as VTContent | undefined
			return (
				<React.Fragment>
					{previewUrl && renderThumbnail && (
						<img src={previewUrl} className="dashboard-panel__panel__button__thumbnail" />
					)}
					{vtContent && (
						<span className="dashboard-panel__panel__button__sub-label">
							{RundownUtils.formatDiffToTimecode(
								vtContent.sourceDuration || 0,
								false,
								undefined,
								undefined,
								undefined,
								true
							)}
						</span>
					)}
				</React.Fragment>
			)
		}
	}

	renderSplits(renderThumbnail: boolean = false) {
		const splitAdLib = this.props.piece
		if (splitAdLib && splitAdLib.content) {
			const splitContent = splitAdLib.content as SplitsContent
			return (
				<React.Fragment>
					{renderThumbnail ? (
						<DashboardPieceButtonSplitPreview piece={splitAdLib} />
					) : (
						<SplitInputIcon
							abbreviation={this.props.layer ? this.props.layer.abbreviation : undefined}
							piece={splitAdLib}
							hideLabel={true}
						/>
					)}
				</React.Fragment>
			)
		}
	}

	render() {
		const isList = this.props.displayStyle === PieceDisplayStyle.LIST
		const isButtons = this.props.displayStyle === PieceDisplayStyle.BUTTONS
		const hasMediaInfo =
			this.props.layer &&
			this.props.layer.type === SourceLayerType.VT &&
			this.props.piece.metadata &&
			this.props.piece.metadata.mediainfo
		return (
			<div
				className={ClassNames(
					'dashboard-panel__panel__button',
					{
						invalid: this.props.piece.invalid,
						floated: this.props.piece.floated,

						'source-missing': this.props.piece.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
						'source-broken': this.props.piece.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
						'unknown-state': this.props.piece.status === RundownAPI.PieceStatusCode.UNKNOWN,

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
				onClick={(e) => this.props.onToggleAdLib(this.props.piece, e.shiftKey || !!this.props.queueAllAdlibs, e)}
				data-obj-id={this.props.piece._id}>
				{!this.props.layer
					? null
					: this.props.layer.type === SourceLayerType.VT || this.props.layer.type === SourceLayerType.LIVE_SPEAK
					? // VT should have thumbnails in "Button" layout.
					  this.renderVTLiveSpeak(isButtons || (isList && this.props.showThumbnailsInList))
					: this.props.layer.type === SourceLayerType.SPLITS
					? this.renderSplits(isList && this.props.showThumbnailsInList)
					: null}
				<span className="dashboard-panel__panel__button__label">
					{isList && hasMediaInfo ? this.props.piece.metadata!.mediainfo!.name : this.props.piece.name}
				</span>
			</div>
		)
	}
}

export const DashboardPieceButton = withMediaObjectStatus<IDashboardButtonProps, {}>()(DashboardPieceButtonBase)
