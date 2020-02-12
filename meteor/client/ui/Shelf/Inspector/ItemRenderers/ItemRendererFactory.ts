import DefaultItemRenderer from './DefaultItemRenderer'
import { NoraItemRenderer, isNoraItem } from './NoraItemRenderer'

import { IBlueprintPieceGeneric } from 'tv-automation-sofie-blueprints-integration';
import * as React from 'react';

export default function renderItem (piece:IBlueprintPieceGeneric):JSX.Element {
	if (isNoraItem(piece)) {
		return React.createElement(NoraItemRenderer, {piece})
	}

	return React.createElement(DefaultItemRenderer, {piece})
}
