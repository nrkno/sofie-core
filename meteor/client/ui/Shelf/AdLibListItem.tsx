import * as React from 'react'
import ClassNames from 'classnames'
import { ISourceLayer, IOutputLayer, IBlueprintActionTriggerMode } from '@sofie-automation/blueprints-integration'
import { unprotectString } from '../../../lib/lib'
import renderItem from './Renderers/ItemRendererFactory'
import { useContentStatusForAdlibPiece } from '../SegmentTimeline/withMediaObjectStatus'
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
}

export function AdLibListItem({
	piece,
	studio,
	layer,
	selected,
	disabled,
	onSelectAdLib,
	onToggleAdLib,
}: IListViewItemProps): JSX.Element {
	const contentStatus = useContentStatusForAdlibPiece(piece)

	return (
		<ContextMenuTrigger
			id="shelf-context-menu"
			attributes={{
				className: ClassNames('adlib-panel__list-view__list__segment__item', {
					selected: selected,
					invalid: piece.invalid,
					floated: piece.floated,
					disabled: disabled,
				}),
				//@ts-expect-error React.HTMLAttributes does not list data attributes, but that's fine
				'data-obj-id': piece._id,
				onClick: () => onSelectAdLib && onSelectAdLib(piece),
				onContextMenu: () => onSelectAdLib && onSelectAdLib(piece),
				onDoubleClick: (e) => !disabled && onToggleAdLib && onToggleAdLib(piece, e.shiftKey, e),
			}}
			collect={() =>
				setShelfContextMenuContext({
					type: MenuContextType.ADLIB,
					details: {
						adLib: piece,
						onToggle: !disabled ? onToggleAdLib : undefined,
						disabled: disabled,
					},
				})
			}
			holdToDisplay={contextMenuHoldToDisplayTime()}
			renderTag="tr"
			key={unprotectString(piece._id)}
		>
			{renderItem({
				adLibListItem: piece,
				contentStatus: contentStatus,
				layer: layer,
				outputLayer: piece.outputLayer,
				selected: selected,
				status: contentStatus?.status,
				messages: contentStatus?.messages,
				studio: studio,
			})}
		</ContextMenuTrigger>
	)
}
