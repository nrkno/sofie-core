import * as React from 'react'
import { ISourceLayerItemProps, SourceLayerItem } from './SourceLayerItem'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { withMediaObjectStatus } from './withMediaObjectStatus'
import { UIStudio } from '../../../lib/api/studios'

interface IPropsHeader extends ISourceLayerItemProps {
	playlist: DBRundownPlaylist
	studio: UIStudio
}

export const SourceLayerItemContainer = withMediaObjectStatus<IPropsHeader, {}>()((props: IPropsHeader) => (
	<SourceLayerItem {...props} />
))
