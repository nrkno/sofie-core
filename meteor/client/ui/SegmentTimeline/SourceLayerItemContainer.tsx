import * as React from 'react'
import { ISourceLayerItemProps, SourceLayerItem } from './SourceLayerItem'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { withMediaObjectStatus, WithMediaObjectStatusProps } from './withMediaObjectStatus'
import { UIStudio } from '../../../lib/api/studios'

interface IPropsHeader extends Omit<ISourceLayerItemProps, 'contentStatus'> {
	playlist: DBRundownPlaylist
	studio: UIStudio
}

export const SourceLayerItemContainer = withMediaObjectStatus<IPropsHeader, {}>()(
	(props: IPropsHeader & WithMediaObjectStatusProps) => <SourceLayerItem {...props} />
)
