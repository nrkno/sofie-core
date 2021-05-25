import * as React from 'react'
import DefaultItemRenderer from './DefaultItemRenderer'
import NoraItemRenderer, { isNoraItem } from './NoraItemRenderer'
import ActionItemRenderer, { isActionItem } from './ActionItemRenderer'

import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import { Studio } from '../../../../../lib/collections/Studios'
import { BucketAdLibItem } from '../../RundownViewBuckets'
import { RundownPlaylist } from '../../../../../lib/collections/RundownPlaylists'
import { IAdLibListItem } from '../../AdLibListItem'
import { AdLibPieceUi } from '../../../../lib/shelf'

export default function renderItem(
	piece: BucketAdLibItem | IAdLibListItem | PieceUi,
	showStyleBase: ShowStyleBase,
	studio: Studio,
	rundownPlaylist: RundownPlaylist,
	onSelectPiece: (piece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined) => void
): JSX.Element {
	if (!piece['isAction'] && isNoraItem(piece as AdLibPieceUi | PieceUi)) {
		const noraPiece = piece as AdLibPieceUi | PieceUi
		return React.createElement(NoraItemRenderer, { piece: noraPiece, showStyleBase, studio })
	} else if (isActionItem(piece)) {
		return React.createElement(ActionItemRenderer, {
			piece,
			showStyleBase,
			studio,
			rundownPlaylist,
			onSelectPiece,
		})
	}

	return React.createElement(DefaultItemRenderer, { piece, showStyleBase, studio })
}
