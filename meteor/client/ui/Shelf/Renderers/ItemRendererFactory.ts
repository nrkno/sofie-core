import * as React from 'react'
import { IAdLibListItem } from '../AdLibListItem'
import { ISourceLayer, IOutputLayer } from '@sofie-automation/blueprints-integration'
import { RundownAPI } from '../../../../lib/api/rundown'
import { DefaultListItemRenderer } from './DefaultListItemRenderer'

export interface ILayerItemRendererProps {
	adLibListItem: IAdLibListItem
	selected: boolean
	layer: ISourceLayer | undefined
	outputLayer: IOutputLayer | undefined
	status: RundownAPI.PieceStatusCode | undefined
}

export default function renderItem(props: ILayerItemRendererProps): JSX.Element {
	const { adLibListItem, layer } = props
	/* if (layer) {
		return React.createElement(NoraItemRenderer, { piece, showStyleBase })
	} else if (isActionItem(piece)) {
		return React.createElement(ActionItemRenderer, { piece, showStyleBase })
	} */

	return React.createElement(DefaultListItemRenderer, props)
}
