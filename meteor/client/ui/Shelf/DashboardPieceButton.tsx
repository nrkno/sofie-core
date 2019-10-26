import * as React from 'react'
import * as _ from 'underscore'
import * as ClassNames from 'classnames'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownAPI } from '../../../lib/api/rundown'

import { DefaultListItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { mousetrapHelper } from '../../lib/mousetrapHelper'
import { RundownUtils } from '../../lib/rundown'
import { ISourceLayer, IOutputLayer, SourceLayerType, VTContent, LiveSpeakContent } from 'tv-automation-sofie-blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { Rundown } from '../../../lib/collections/Rundowns'
import { PubSub } from '../../../lib/api/pubsub'

export interface IAdLibListItem {
	_id: string,
	name: string,
	status?: RundownAPI.PieceStatusCode
	hotkey?: string
	isHidden?: boolean
	invalid?: boolean
}

interface IDashboardButtonProps {
	item: IAdLibListItem
	layer: ISourceLayer
	outputLayer?: IOutputLayer
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: any) => void
	rundown: Rundown
	mediaPreviewUrl?: string
	isOnAir?: boolean
	widthScale?: number
	heightScale?: number
}
const DEFAULT_BUTTON_WIDTH = 6.40625
const DEFAULT_BUTTON_HEIGHT = 5.625

interface IDashboardButtonTrackedProps {
	status: RundownAPI.PieceStatusCode | undefined
	metadata: MediaObject | null
}

export const DashboardPieceButton = translateWithTracker<IDashboardButtonProps, {}, IDashboardButtonTrackedProps>((props: IDashboardButtonProps) => {
	const piece = props.item as any as AdLibPieceUi

	const { status, metadata } = checkPieceContentStatus(piece, props.layer, props.rundown.getStudio().settings)

	return {
		status,
		metadata
	}
})(class extends MeteorReactComponent<Translated<IDashboardButtonProps & IDashboardButtonTrackedProps>> {
	private objId: string

	constructor (props: IDashboardButtonProps) {
		super(props)
	}

	updateMediaObjectSubscription () {
		if (this.props.item && this.props.layer) {
			const piece = this.props.item as any as AdLibPieceUi
			let objId: string | undefined = undefined

			switch (this.props.layer.type) {
				case SourceLayerType.VT:
					objId = (piece.content as VTContent).fileName.toUpperCase()
					break
				case SourceLayerType.LIVE_SPEAK:
					objId = (piece.content as LiveSpeakContent).fileName.toUpperCase()
					break
			}

			if (objId && objId !== this.objId) {
				// if (this.mediaObjectSub) this.mediaObjectSub.stop()
				this.objId = objId
				this.subscribe(PubSub.mediaObjects, this.props.rundown.studioId, {
					mediaId: this.objId
				})
			}
		} else {
			console.error('One of the Piece\'s is invalid:', this.props.item)
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

	renderVTLiveSpeak () {
		if (this.props.metadata) {
			const previewUrl = this.getPreviewUrl()
			const adLib = this.props.item as AdLibPieceUi
			return <React.Fragment>
				{previewUrl && <img src={previewUrl} className='dashboard-panel__panel__button__thumbnail' />}
				{adLib.content && (adLib.content as VTContent) &&
					<span className='dashboard-panel__panel__button__sub-label'>
						{RundownUtils.formatDiffToTimecode((adLib.content as VTContent).sourceDuration, false, undefined, undefined, undefined, true)}
					</span>}
			</React.Fragment>
		}
	}

	render () {
		return (
			<div className={ClassNames('dashboard-panel__panel__button', {
				'invalid': this.props.item.invalid,

				'source-missing': this.props.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
				'source-broken': this.props.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
				'unknown-state': this.props.status === RundownAPI.PieceStatusCode.UNKNOWN,

				'live': this.props.isOnAir
			}, RundownUtils.getSourceLayerClassName(this.props.layer.type))}
				style={{
					width: this.props.widthScale ?
						(this.props.widthScale * DEFAULT_BUTTON_WIDTH) + 'em' :
						undefined,
					height: this.props.heightScale ?
						(this.props.heightScale * DEFAULT_BUTTON_HEIGHT) + 'em' :
						undefined
				}}
				onClick={(e) => this.props.onToggleAdLib(this.props.item, e.shiftKey, e)}
				data-obj-id={this.props.item._id}
				>
				{
					(this.props.layer.type === SourceLayerType.VT || this.props.layer.type === SourceLayerType.LIVE_SPEAK || true) ?
						this.renderVTLiveSpeak() :
						null
				}
				<span className='dashboard-panel__panel__button__label'>{this.props.item.name}</span>
			</div>
		)
	}
})
