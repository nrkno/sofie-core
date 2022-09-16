import * as React from 'react'
import { IAdLibListItem } from '../AdLibListItem'
import { ISourceLayer, IOutputLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { MediaObject } from '../../../../lib/collections/MediaObjects'
import { DefaultListItemRenderer } from './DefaultListItemRenderer'
import { VTListItemRenderer } from './VTListItemRenderer'
import { L3rdListItemRenderer } from './L3rdListItemRenderer'
import { ScanInfoForPackages } from '../../../../lib/mediaObjects'
import { Studio } from '../../../../lib/collections/Studios'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'

export interface ILayerItemRendererProps {
	adLibListItem: IAdLibListItem
	selected: boolean
	layer: ISourceLayer | undefined
	outputLayer: IOutputLayer | undefined
	status?: PieceStatusCode | null
	message?: string | null
	metadata?: MediaObject | null
	mediaPreviewUrl: string | undefined
	packageInfos: ScanInfoForPackages | undefined
	studio: Studio | undefined
}

export default function renderItem(props: ILayerItemRendererProps): JSX.Element {
	const { layer } = props
	switch (layer?.type) {
		case SourceLayerType.LIVE_SPEAK:
		case SourceLayerType.VT:
			return React.createElement(VTListItemRenderer, props)
		case SourceLayerType.GRAPHICS:
		case SourceLayerType.LOWER_THIRD:
			return React.createElement(L3rdListItemRenderer, props)
	}

	return React.createElement(DefaultListItemRenderer, props)
}
