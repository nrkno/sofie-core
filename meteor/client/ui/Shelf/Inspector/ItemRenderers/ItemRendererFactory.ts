import * as React from 'react'
import DefaultItemRenderer from './DefaultItemRenderer'
import { NoraItemRenderer, isNoraItem } from './NoraItemRenderer'

import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../AdLibPanel'

export default function renderItem(piece: AdLibPieceUi | PieceUi): JSX.Element {
	if (isNoraItem(piece)) {
		return React.createElement(NoraItemRenderer, { piece })
	}

	if (Object.prototype.hasOwnProperty.call(piece, 'instance')) {
		const pieceUi = piece as PieceUi
		return React.createElement(DefaultItemRenderer, { piece: pieceUi.instance.piece })
	} else {
		return React.createElement(DefaultItemRenderer, { piece: piece as AdLibPieceUi })
	}
}
