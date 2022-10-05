import * as React from 'react'
import * as _ from 'underscore'
import renderItem from './ItemRenderers/ItemRendererFactory'
import { PieceUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime } from '../../../lib/lib'
import { BucketAdLibItem } from '../RundownViewBuckets'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { IAdLibListItem } from '../AdLibListItem'
import { UIShowStyleBase } from '../../../../lib/api/showStyles'
import { UIStudio } from '../../../../lib/api/studios'

export { ShelfInspector }

interface IShelfInspectorProps {
	selected: BucketAdLibItem | IAdLibListItem | PieceUi | undefined
	showStyleBase: UIShowStyleBase
	studio: UIStudio
	rundownPlaylist: RundownPlaylist
	onSelectPiece: (piece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined) => void
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
				id="shelf-context-menu"
				attributes={{
					className: 'rundown-view__shelf__contents__pane shelf-inspector',
				}}
				holdToDisplay={contextMenuHoldToDisplayTime()}
			>
				{content || false}
			</ContextMenuTrigger>
		)
	}
}
