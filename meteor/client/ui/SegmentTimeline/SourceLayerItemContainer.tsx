import * as React from 'react'
import { ISourceLayerItemProps, SourceLayerItem } from './SourceLayerItem'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { withMediaObjectStatus } from './withMediaObjectStatus'
import { RoutedMappings, Studio } from '../../../lib/collections/Studios'

interface IPropsHeader extends ISourceLayerItemProps {
	playlist: RundownPlaylist
	studio: Studio
	routedMappings: RoutedMappings
}

export const SourceLayerItemContainer = withMediaObjectStatus<IPropsHeader, {}>()((props: IPropsHeader) => (
	<SourceLayerItem {...props} />
))
