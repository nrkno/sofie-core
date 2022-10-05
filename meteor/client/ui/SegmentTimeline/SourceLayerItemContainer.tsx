import * as React from 'react'
import { ISourceLayerItemProps, SourceLayerItem } from './SourceLayerItem'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { withMediaObjectStatus } from './withMediaObjectStatus'
import { UIStudio } from '../../../lib/api/studios'

interface IPropsHeader extends ISourceLayerItemProps {
	playlist: RundownPlaylist
	studio: UIStudio
}

export const SourceLayerItemContainer = withMediaObjectStatus<IPropsHeader, {}>()((props: IPropsHeader) => (
	<SourceLayerItem {...props} />
))
