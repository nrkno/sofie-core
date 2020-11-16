import * as React from 'react'
import * as _ from 'underscore'
import { IBlueprintPieceGeneric } from 'tv-automation-sofie-blueprints-integration'
import { IModalAttributes, Modal } from '../../../lib/ui/containers/modals/Modal'
import renderItem from './ItemRenderers/ItemRendererFactory'
import { PieceUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../AdLibPanel'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime } from '../../../lib/lib'
import { Studio } from '../../../../lib/collections/Studios'
import { BucketAdLibItem } from '../RundownViewBuckets'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'

export { ShelfInspector }

interface IShelfInspectorProps {
	selected: BucketAdLibItem | AdLibPieceUi | PieceUi | undefined
	showStyleBase: ShowStyleBase
	studio: Studio
	rundownPlaylist: RundownPlaylist
	onSelectPiece: (piece: BucketAdLibItem | AdLibPieceUi | PieceUi | undefined) => void
}

class ShelfInspector extends React.Component<IShelfInspectorProps> {
	constructor(props: IShelfInspectorProps) {
		super(props)
	}

	shouldComponentUpdate(nextProps: IShelfInspectorProps) {
		if (_.isEqual(nextProps, this.props)) return false
		return true
	}

	render() {
		const { selected, showStyleBase, studio, rundownPlaylist, onSelectPiece } = this.props
		const content = selected && renderItem(selected, showStyleBase, studio, rundownPlaylist, onSelectPiece)

		return (
			<ContextMenuTrigger
				id="bucket-context-menu"
				attributes={{
					className: 'rundown-view__shelf__contents__pane shelf-inspector',
				}}
				holdToDisplay={contextMenuHoldToDisplayTime()}>
				{content || false}
			</ContextMenuTrigger>
		)
	}
}
