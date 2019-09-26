import * as React from 'react'
import DefaultItemRenderer from './DefaultItemRenderer'
import { NoraItemRenderer, isNoraItem } from './NoraItemRenderer'

import { InternalIBlueprintPieceGeneric } from '../../../../../lib/collections/Pieces'

export default function renderItem(item: InternalIBlueprintPieceGeneric): JSX.Element {
	if (isNoraItem(item)) {
		return React.createElement(NoraItemRenderer, { item })
	}

	return React.createElement(DefaultItemRenderer, { item })
}
