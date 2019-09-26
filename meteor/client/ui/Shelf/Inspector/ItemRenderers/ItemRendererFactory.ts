import DefaultItemRenderer from './DefaultItemRenderer'
import { NoraItemRenderer, isNoraItem } from './NoraItemRenderer'

import { IBlueprintPieceGeneric } from 'tv-automation-sofie-blueprints-integration';
import * as React from 'react';

export default function renderItem (item:IBlueprintPieceGeneric):JSX.Element {
	if (isNoraItem(item)) {
		return React.createElement(NoraItemRenderer, {item})
	}

	return React.createElement(DefaultItemRenderer, {item})
}
