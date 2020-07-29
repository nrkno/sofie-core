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
	GraphicsContent,
	LiveSpeakContent,
} from 'tv-automation-sofie-blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown } from '../../../lib/collections/Rundowns'
import { PubSub } from '../../../lib/api/pubsub'
import { PieceId, PieceGeneric } from '../../../lib/collections/Pieces'
import { unprotectString } from '../../../lib/lib'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'

export interface IAdLibListItem extends PieceGeneric {
	status: RundownAPI.PieceStatusCode
	hotkey?: string
	isHidden?: boolean
	invalid?: boolean
	floated?: boolean
}

interface IListViewItemProps {
	adLibListItem: IAdLibListItem
	selected: boolean
	layer: ISourceLayer | undefined
	outputLayer: IOutputLayer | undefined
	onSelectAdLib: (aSLine: PieceGeneric) => void
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: any) => void
	playlist: RundownPlaylist
}

interface IAdLibListItemTrackedProps {
	status: RundownAPI.PieceStatusCode | undefined
}

const _isMacLike = !!navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)

export const AdLibListItem = translateWithTracker<IListViewItemProps, {}, IAdLibListItemTrackedProps>(
	(props: IListViewItemProps) => {
		const piece = (props.adLibListItem as any) as AdLibPieceUi

		const { status } = checkPieceContentStatus(piece, props.layer, props.playlist.getStudio().settings)

		return {
			status,
		}
	}
)(
	class AdLibListItem extends MeteorReactComponent<Translated<IListViewItemProps & IAdLibListItemTrackedProps>> {
		private objId: string

		constructor(props: IListViewItemProps) {
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
				const piece = (this.props.adLibListItem as any) as AdLibPieceUi
				let objId: string | undefined = undefined

				if (piece.content && piece.content.fileName) {
					switch (this.props.layer.type) {
						case SourceLayerType.VT:
							objId = (piece.content as VTContent).fileName?.toUpperCase()
							break
						case SourceLayerType.LIVE_SPEAK:
							objId = (piece.content as LiveSpeakContent).fileName?.toUpperCase()
							break
						/*case SourceLayerType.GRAPHICS:
							objId = (piece.content as GraphicsContent).fileName?.toUpperCase()
							break*/
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

		render() {
			return (
				<tr
					className={ClassNames('adlib-panel__list-view__list__segment__item', {
						selected: this.props.selected,
						invalid: this.props.adLibListItem.invalid,
						floated: this.props.adLibListItem.floated,
					})}
					key={unprotectString(this.props.adLibListItem._id)}
					onClick={(e) => this.props.onSelectAdLib(this.props.adLibListItem)}
					onDoubleClick={(e) => this.props.onToggleAdLib(this.props.adLibListItem, e.shiftKey, e)}
					data-obj-id={this.props.adLibListItem._id}>
					<td
						className={ClassNames(
							'adlib-panel__list-view__list__table__cell--icon',
							this.props.layer && RundownUtils.getSourceLayerClassName(this.props.layer.type),
							{
								'source-missing': this.props.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
								'source-broken': this.props.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
								'unknown-state': this.props.status === RundownAPI.PieceStatusCode.UNKNOWN,
							}
						)}>
						{this.props.layer && (this.props.layer.abbreviation || this.props.layer.name)}
					</td>
					<td className="adlib-panel__list-view__list__table__cell--shortcut">
						{this.props.adLibListItem.hotkey &&
							mousetrapHelper.shortcutLabel(this.props.adLibListItem.hotkey, _isMacLike)}
					</td>
					<td className="adlib-panel__list-view__list__table__cell--output">
						{this.props.outputLayer && this.props.outputLayer.name}
					</td>
					<DefaultListItemRenderer {...this.props} />
				</tr>
			)
		}
	}
)
