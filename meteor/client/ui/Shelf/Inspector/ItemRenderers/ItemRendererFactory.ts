import * as React from 'react'
import DefaultItemRenderer from './DefaultItemRenderer'
import NoraItemRenderer, { isNoraItem } from './NoraItemRenderer'
import ActionItemRenderer, { isActionItem } from './ActionItemRenderer'

import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../AdLibPanel'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'

export default function renderItem(piece: AdLibPieceUi | PieceUi, showStyleBase: ShowStyleBase): JSX.Element {
	if (isNoraItem(piece)) {
		return React.createElement(NoraItemRenderer, { piece, showStyleBase })
	} else if (isActionItem(piece)) {
		return React.createElement(ActionItemRenderer, { piece, showStyleBase })
	}

	return React.createElement(DefaultItemRenderer, { piece, showStyleBase })
}
