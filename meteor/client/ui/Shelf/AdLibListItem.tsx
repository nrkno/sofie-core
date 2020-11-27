import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownAPI } from '../../../lib/api/rundown'

import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import {
	ISourceLayer,
	IOutputLayer,
	SourceLayerType,
	VTContent,
	LiveSpeakContent,
} from '@sofie-automation/blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PubSub } from '../../../lib/api/pubsub'
import { PieceGeneric } from '../../../lib/collections/Pieces'
import { unprotectString } from '../../../lib/lib'
import renderItem from './Renderers/ItemRendererFactory'
import { MediaObject } from '../../../lib/collections/MediaObjects'

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
	message: string | null
	metadata: MediaObject | null
}

export const AdLibListItem = translateWithTracker<IListViewItemProps, {}, IAdLibListItemTrackedProps>(
	(props: IListViewItemProps) => {
		const piece = (props.adLibListItem as any) as AdLibPieceUi

		const { status, message, metadata } = checkPieceContentStatus(
			piece,
			props.layer,
			props.playlist.getStudio().settings
		)

		return {
			status,
			message,
			metadata,
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
					{renderItem({
						adLibListItem: this.props.adLibListItem,
						layer: this.props.layer,
						outputLayer: this.props.outputLayer,
						selected: this.props.selected,
						status: this.props.status,
						message: this.props.message,
						metadata: this.props.metadata,
					})}
				</tr>
			)
		}
	}
)
