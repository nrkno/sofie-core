import * as React from 'react'
import { IAdLibListItem } from '../AdLibListItem'
import { ISourceLayer, IOutputLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { RundownAPI } from '../../../../lib/api/rundown'
import { DefaultListItemRenderer } from './DefaultListItemRenderer'
import { VTSTKListItemRenderer } from './VTSTKListItemRenderer'

export interface ILayerItemRendererProps {
	adLibListItem: IAdLibListItem
	selected: boolean
	layer: ISourceLayer | undefined
	outputLayer: IOutputLayer | undefined
	status: RundownAPI.PieceStatusCode | undefined
}

export default function renderItem(props: ILayerItemRendererProps): JSX.Element {
	const { adLibListItem, layer } = props
	if (layer?.type === SourceLayerType.LIVE_SPEAK || layer?.type === SourceLayerType.VT) {
		return React.createElement(VTSTKListItemRenderer, props)
	}

	return React.createElement(DefaultListItemRenderer, props)
}
