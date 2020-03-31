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
import { ISourceLayer, IOutputLayer, SourceLayerType, VTContent, LiveSpeakContent } from 'tv-automation-sofie-blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
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

interface IListViewItemProps {
	item: IAdLibListItem
	selected: boolean
	layer: ISourceLayer
	outputLayer?: IOutputLayer
	onSelectAdLib: (aSLine: IAdLibListItem) => void
	onToggleAdLib: (context: any, aSLine: IAdLibListItem, queue: boolean) => void
	rundown: Rundown
}

interface IAdLibListItemTrackedProps {
	status: RundownAPI.PieceStatusCode | undefined
}

const _isMacLike = !!navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)

export const AdLibListItem = translateWithTracker<IListViewItemProps, {}, IAdLibListItemTrackedProps>((props: IListViewItemProps) => {
	const piece = props.item as any as AdLibPieceUi

	const { status } = checkPieceContentStatus(piece, props.layer, props.rundown.getStudio().settings)

	return {
		status
	}
})(class extends MeteorReactComponent<Translated<IListViewItemProps & IAdLibListItemTrackedProps>> {
	private objId: string

	constructor (props: IListViewItemProps) {
		super(props)
	}

	componentDidMount () {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	componentDidUpdate () {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	updateMediaObjectSubscription () {
		if (this.props.item && this.props.layer) {
			const piece = this.props.item as any as AdLibPieceUi
			let objId: string | undefined = undefined

			if (piece.content) {
				switch (this.props.layer.type) {
					case SourceLayerType.VT:
						objId = (piece.content as VTContent).fileName.toUpperCase()
						break
					case SourceLayerType.LIVE_SPEAK:
						objId = (piece.content as LiveSpeakContent).fileName.toUpperCase()
						break
					case SourceLayerType.TRANSITION:
						if (piece.content.fileName) {
							objId = (piece.content as VTContent).fileName.toUpperCase()
						}
						break
				}
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

	render () {
		return (
			<tr className={ClassNames('adlib-panel__list-view__list__segment__item', {
				'selected': this.props.selected,
				'invalid': this.props.item.invalid
			})} key={this.props.item._id}
				onClick={(e) => this.props.onSelectAdLib(this.props.item)}
				onDoubleClick={(e) => this.props.onToggleAdLib(e, this.props.item, e.shiftKey)}
				data-obj-id={this.props.item._id}
				>
				<td className={ClassNames(
					'adlib-panel__list-view__list__table__cell--icon',
					this.props.layer ? RundownUtils.getSourceLayerClassName(this.props.layer.type) : undefined,
					{
						'source-missing': this.props.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
						'source-broken': this.props.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
						'unknown-state': this.props.status === RundownAPI.PieceStatusCode.UNKNOWN
					}
				)}>
					{this.props.layer && (this.props .layer.abbreviation || this.props.layer.name)}
				</td>
				<td className='adlib-panel__list-view__list__table__cell--shortcut'>
					{this.props.item.hotkey && mousetrapHelper.shortcutLabel(this.props.item.hotkey, _isMacLike)}
				</td>
				<td className='adlib-panel__list-view__list__table__cell--output'>
					{this.props.outputLayer && this.props.outputLayer.name}
				</td>
				<DefaultListItemRenderer {...this.props} />
			</tr>
		)
	}
})
