import * as React from 'react'
import ClassNames from 'classnames'
import { ISourceLayer, IOutputLayer, IBlueprintActionTriggerMode } from '@sofie-automation/blueprints-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { unprotectString } from '../../../lib/lib'
import renderItem from './Renderers/ItemRendererFactory'
import { withMediaObjectStatus } from '../SegmentTimeline/withMediaObjectStatus'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { setShelfContextMenuContext, ContextType as MenuContextType } from './ShelfContextMenu'
import { AdLibPieceUi } from '../../lib/shelf'
import { UIStudio } from '../../../lib/api/studios'

export interface IAdLibListItem extends AdLibPieceUi {
	sourceLayer?: ISourceLayer
	outputLayer?: IOutputLayer
	isHidden?: boolean
	invalid?: boolean
	floated?: boolean
}

interface IListViewItemProps {
	piece: IAdLibListItem
	studio: UIStudio
	layer: ISourceLayer | undefined
	selected: boolean
	disabled?: boolean
	onSelectAdLib?: (aSLine: IAdLibListItem) => void
	onToggleAdLib?: (aSLine: IAdLibListItem, queue: boolean, context: any, mode?: IBlueprintActionTriggerMode) => void
	playlist: DBRundownPlaylist
}

export const AdLibListItem = withMediaObjectStatus<IListViewItemProps, {}>()(
	class AdLibListItem extends React.Component<IListViewItemProps> {
		constructor(props: IListViewItemProps) {
			super(props)
		}

		render(): JSX.Element {
			return (
				<ContextMenuTrigger
					id="shelf-context-menu"
					attributes={{
						className: ClassNames('adlib-panel__list-view__list__segment__item', {
							selected: this.props.selected,
							invalid: this.props.piece.invalid,
							floated: this.props.piece.floated,
							disabled: this.props.disabled,
						}),
						//@ts-expect-error React.HTMLAttributes does not list data attributes, but that's fine
						'data-obj-id': this.props.piece._id,
						onClick: () => this.props.onSelectAdLib && this.props.onSelectAdLib(this.props.piece),
						onContextMenu: () => this.props.onSelectAdLib && this.props.onSelectAdLib(this.props.piece),
						onDoubleClick: (e) =>
							!this.props.disabled &&
							this.props.onToggleAdLib &&
							this.props.onToggleAdLib(this.props.piece, e.shiftKey, e),
					}}
					collect={() =>
						setShelfContextMenuContext({
							type: MenuContextType.ADLIB,
							details: {
								adLib: this.props.piece,
								onToggle: !this.props.disabled ? this.props.onToggleAdLib : undefined,
								disabled: this.props.disabled,
							},
						})
					}
					holdToDisplay={contextMenuHoldToDisplayTime()}
					renderTag="tr"
					key={unprotectString(this.props.piece._id)}
				>
					{renderItem({
						adLibListItem: this.props.piece,
						layer: this.props.layer,
						outputLayer: this.props.piece.outputLayer,
						selected: this.props.selected,
						status: this.props.piece.contentStatus?.status,
						messages: this.props.piece.contentStatus?.messages,
						studio: this.props.studio,
					})}
				</ContextMenuTrigger>
			)
		}
	}
)
