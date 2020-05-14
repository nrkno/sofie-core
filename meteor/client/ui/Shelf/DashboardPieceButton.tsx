import * as React from 'react'
import * as _ from 'underscore'
import * as ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownAPI } from '../../../lib/api/rundown'

import { DefaultListItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { mousetrapHelper } from '../../lib/mousetrapHelper'
import { RundownUtils } from '../../lib/rundown'
import { ISourceLayer, IOutputLayer, SourceLayerType, VTContent, LiveSpeakContent, SplitsContent } from 'tv-automation-sofie-blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown } from '../../../lib/collections/Rundowns'
import { PubSub } from '../../../lib/api/pubsub'
import { IAdLibListItem } from './AdLibListItem'
import { PieceId } from '../../../lib/collections/Pieces'
import SplitInputIcon from '../PieceIcons/Renderers/SplitInput'


export interface IDashboardButtonProps {
	adLibListItem: IAdLibListItem
	layer: ISourceLayer
	outputLayer?: IOutputLayer
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: any) => void
	playlist: RundownPlaylist
	mediaPreviewUrl?: string
	isOnAir?: boolean
	widthScale?: number
	heightScale?: number
	disabled?: boolean
}
export const DEFAULT_BUTTON_WIDTH = 6.40625
export const DEFAULT_BUTTON_HEIGHT = 5.625

export interface IDashboardButtonTrackedProps {
	status: RundownAPI.PieceStatusCode | undefined
	metadata: MediaObject | null
}

export class DashboardPieceButtonBase<T = {}> extends MeteorReactComponent<Translated<IDashboardButtonProps & IDashboardButtonTrackedProps> & T> {
	private objId: string

	constructor(props: IDashboardButtonProps) {
		super(props)
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
			const piece = this.props.adLibListItem as any as AdLibPieceUi
			let objId: string | undefined = undefined

			if (piece.content) {
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
					mediaId: this.objId
				})
			}
		} else {
			console.error('One of the Piece\'s is invalid:', this.props.adLibListItem)
		}
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

	renderVTLiveSpeak() {
		if (this.props.metadata) {
			const previewUrl = this.getPreviewUrl()
			const adLib = this.props.adLibListItem as any as AdLibPieceUi
			const vtContent = adLib.content as VTContent | undefined
			return <React.Fragment>
				{previewUrl && <img src={previewUrl} className='dashboard-panel__panel__button__thumbnail' />}
				{vtContent &&
					<span className='dashboard-panel__panel__button__sub-label'>
						{RundownUtils.formatDiffToTimecode(vtContent.sourceDuration || 0, false, undefined, undefined, undefined, true)}
					</span>}
			</React.Fragment>
		}
	}

	renderSplits() {
		const splitAdLib = this.props.adLibListItem as any as AdLibPieceUi
		if (splitAdLib && splitAdLib.content) {
			return (
				<SplitInputIcon abbreviation={this.props.layer.abbreviation} piece={splitAdLib} hideLabel={true} />
			)
		}
	}

	render() {
		return (
			<div className={ClassNames('dashboard-panel__panel__button', {
				'invalid': this.props.adLibListItem.invalid,
				'floated': this.props.adLibListItem.floated,

				'source-missing': this.props.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
				'source-broken': this.props.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
				'unknown-state': this.props.status === RundownAPI.PieceStatusCode.UNKNOWN,

				'live': this.props.isOnAir,

				'disabled': this.props.disabled
			}, this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type))}
				style={{
					width: this.props.widthScale ?
						//@ts-ignore: widthScale is in a weird state between a number and something else
						//		      because of the optional generic type argument
						(this.props.widthScale * DEFAULT_BUTTON_WIDTH) + 'em' :
						undefined,
					height: this.props.heightScale ?
						//@ts-ignore
						(this.props.heightScale * DEFAULT_BUTTON_HEIGHT) + 'em' :
						undefined
				}}
				onClick={(e) => this.props.onToggleAdLib(this.props.adLibListItem, e.shiftKey, e)}
				data-obj-id={this.props.adLibListItem._id}
			>
				{
					!this.props.layer ?
						null :
						(this.props.layer.type === SourceLayerType.VT || this.props.layer.type === SourceLayerType.LIVE_SPEAK) ?
							this.renderVTLiveSpeak() :
							(this.props.layer.type === SourceLayerType.SPLITS) ?
								this.renderSplits() :
								null
				}
				<span className='dashboard-panel__panel__button__label'>{this.props.adLibListItem.name}</span>
			</div>
		)
	}
}

export const DashboardPieceButton = translateWithTracker<IDashboardButtonProps, {}, IDashboardButtonTrackedProps>((props: IDashboardButtonProps) => {
	const piece = props.adLibListItem as any as AdLibPieceUi

	const { status, metadata } = checkPieceContentStatus(piece, props.layer, props.playlist.getStudio().settings)

	return {
		status,
		metadata
	}
})(DashboardPieceButtonBase)
