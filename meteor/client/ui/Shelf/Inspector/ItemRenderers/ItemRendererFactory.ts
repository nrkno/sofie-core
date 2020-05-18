import * as React from 'react'
import DefaultItemRenderer from './DefaultItemRenderer'
import NoraItemRenderer, { isNoraItem } from './NoraItemRenderer'
import ActionItemRenderer, { isActionItem } from './ActionItemEditor'

import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../AdLibPanel'

export default function renderItem(piece: AdLibPieceUi | PieceUi): JSX.Element {
	if (isNoraItem(piece)) {
		return React.createElement(NoraItemRenderer, { piece })
	} else if (isActionItem(piece)) {
		return React.createElement(ActionItemRenderer, { piece })
	}

	return React.createElement(DefaultItemRenderer, { piece })
}
