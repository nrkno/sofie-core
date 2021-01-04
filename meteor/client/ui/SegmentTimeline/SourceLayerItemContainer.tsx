import * as React from 'react'
import { ISourceLayerItemProps, SourceLayerItem } from './SourceLayerItem'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { withMediaObjectStatus } from './withMediaObjectStatus'
import { Studio } from '../../../lib/collections/Studios'

interface IPropsHeader extends ISourceLayerItemProps {
	playlist: RundownPlaylist
	studio: Studio
}

export const SourceLayerItemContainer = withMediaObjectStatus<IPropsHeader, {}>()((props: IPropsHeader) => (
	<SourceLayerItem {...props} />
))
