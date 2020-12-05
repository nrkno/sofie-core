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
	IBlueprintActionTriggerMode,
} from '@sofie-automation/blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown } from '../../../lib/collections/Rundowns'
import { PubSub } from '../../../lib/api/pubsub'
import { PieceId, PieceGeneric } from '../../../lib/collections/Pieces'
import { unprotectString } from '../../../lib/lib'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { withMediaObjectStatus } from '../SegmentTimeline/withMediaObjectStatus'
import { Studio } from '../../../lib/collections/Studios'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { setShelfContextMenuContext, ContextType as MenuContextType } from './ShelfContextMenu'

export interface IAdLibListItem extends PieceGeneric {
	status: RundownAPI.PieceStatusCode
	contentMetaData?: any
	sourceLayer?: ISourceLayer
	outputLayer?: IOutputLayer
	hotkey?: string
	isHidden?: boolean
	invalid?: boolean
	floated?: boolean
}

interface IListViewItemProps {
	piece: IAdLibListItem
	studio: Studio
	selected: boolean
	onSelectAdLib: (aSLine: PieceGeneric) => void
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: any, mode?: IBlueprintActionTriggerMode) => void
	playlist: RundownPlaylist
}

const _isMacLike = !!navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)

export const AdLibListItem = withMediaObjectStatus<IListViewItemProps, {}>()(
	class AdLibListItem extends MeteorReactComponent<Translated<IListViewItemProps>> {
		private objId: string

		constructor(props: IListViewItemProps) {
			super(props)
		}

		render() {
			return (
				<ContextMenuTrigger
					id="shelf-context-menu"
					attributes={{
						className: ClassNames('adlib-panel__list-view__list__segment__item', {
							selected: this.props.selected,
							invalid: this.props.piece.invalid,
							floated: this.props.piece.floated,
						}),
						//@ts-ignore React.HTMLAttributes does not list data attributes, but that's fine
						'data-obj-id': this.props.piece._id,
						onClick: (e) => this.props.onSelectAdLib(this.props.piece),
						onContextMenu: (e) => this.props.onSelectAdLib(this.props.piece),
						onDoubleClick: (e) => this.props.onToggleAdLib(this.props.piece, e.shiftKey, e),
					}}
					collect={() =>
						setShelfContextMenuContext({
							type: MenuContextType.ADLIB,
							details: {
								adLib: this.props.piece,
								onToggle: this.props.onToggleAdLib,
							},
						})
					}
					holdToDisplay={contextMenuHoldToDisplayTime()}
					renderTag="tr"
					key={unprotectString(this.props.piece._id)}>
					<td
						className={ClassNames(
							'adlib-panel__list-view__list__table__cell--icon',
							this.props.piece.sourceLayer && RundownUtils.getSourceLayerClassName(this.props.piece.sourceLayer.type),
							{
								'source-missing': this.props.piece.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
								'source-broken': this.props.piece.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
								'unknown-state': this.props.piece.status === RundownAPI.PieceStatusCode.UNKNOWN,
							}
						)}>
						{this.props.piece.sourceLayer &&
							(this.props.piece.sourceLayer.abbreviation || this.props.piece.sourceLayer.name)}
					</td>
					<td className="adlib-panel__list-view__list__table__cell--shortcut">
						{this.props.piece.hotkey && mousetrapHelper.shortcutLabel(this.props.piece.hotkey, _isMacLike)}
					</td>
					<td className="adlib-panel__list-view__list__table__cell--output">
						{this.props.piece.outputLayer && this.props.piece.outputLayer.name}
					</td>
					<DefaultListItemRenderer {...this.props} />
				</ContextMenuTrigger>
			)
		}
	}
)
