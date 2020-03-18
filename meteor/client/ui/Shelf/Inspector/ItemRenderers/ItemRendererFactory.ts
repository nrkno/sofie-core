import DefaultItemRenderer from './DefaultItemRenderer'
import { NoraItemRenderer, isNoraItem } from './NoraItemRenderer'

import { PieceGeneric } from '../../../../../lib/collections/Pieces'
import * as React from 'react';

export default function renderItem (piece: PieceGeneric):JSX.Element {
	if (isNoraItem(piece)) {
		return React.createElement(NoraItemRenderer, { piece })
	}

	return React.createElement(DefaultItemRenderer, { piece })
}
