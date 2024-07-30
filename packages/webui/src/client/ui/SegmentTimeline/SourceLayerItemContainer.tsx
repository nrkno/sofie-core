import { ISourceLayerItemProps, SourceLayerItem } from './SourceLayerItem'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { withMediaObjectStatus } from './withMediaObjectStatus'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'

interface IPropsHeader extends ISourceLayerItemProps {
	playlist: DBRundownPlaylist
	studio: UIStudio
}

export const SourceLayerItemContainer = withMediaObjectStatus<IPropsHeader, {}>()((props: IPropsHeader) => (
	<SourceLayerItem {...props} />
))
