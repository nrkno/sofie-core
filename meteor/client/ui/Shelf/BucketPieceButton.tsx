import { translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { AdLibPieceUi } from './AdLibPanel'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { IDashboardButtonProps, IDashboardButtonTrackedProps, DashboardPieceButtonBase } from './DashboardPieceButton'

import {
	DragSource,
	DropTarget,
	ConnectDragSource,
	ConnectDropTarget,
	DragSourceMonitor,
	DropTargetMonitor,
	ConnectDragPreview,
} from 'react-dnd'
import { DragDropItemTypes } from '../DragDropItemTypes'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { BucketAdLib } from '../../../lib/collections/BucketAdlibs'
import { PieceId } from '../../../lib/collections/Pieces'
import { BucketId } from '../../../lib/collections/Buckets'

type IDashboardButtonPropsCombined = BucketPieceButtonBaseProps & IDashboardButtonProps & IDashboardButtonTrackedProps

const buttonSource = {
	beginDrag(props: IDashboardButtonPropsCombined, monitor: DragSourceMonitor, component: any) {
		return {
			id: props.adLibListItem._id,
			originalIndex: props.findAdLib(props.adLibListItem._id).index,
			bucketId: props.bucketId,
		}
	},

	endDrag(props: IDashboardButtonPropsCombined, monitor: DragSourceMonitor) {
		const { id: droppedId, originalIndex } = monitor.getItem()
		const didDrop = monitor.didDrop()

		if (!didDrop) {
			props.moveAdLib(droppedId, originalIndex)
		} else {
			const { action } = monitor.getDropResult()
			if (action === 'reorder') {
				const { index: newIndex } = props.findAdLib(droppedId)
				props.onAdLibReorder(droppedId, newIndex, originalIndex)
			} else if (action === 'move') {
				const { bucketId } = monitor.getDropResult()
				props.onAdLibMove(droppedId, bucketId)
			}
		}
	},
}

const buttonTarget = {
	canDrop(props: IDashboardButtonPropsCombined, monitor: DropTargetMonitor) {
		return true
	},

	hover(props: IDashboardButtonPropsCombined, monitor: DropTargetMonitor, component: any) {
		const { id: draggedId } = monitor.getItem()
		const overId = props.adLibListItem._id

		if (draggedId !== overId) {
			const { index: overIndex } = props.findAdLib(overId)
			props.moveAdLib(draggedId, overIndex)
		}
	},

	drop(props: IDashboardButtonPropsCombined, monitor: DropTargetMonitor) {
		const { index } = props.findAdLib(props.adLibListItem._id)

		return {
			index,
			action: 'reorder',
		}
	},
}

export interface BucketPieceButtonBaseProps {
	moveAdLib: (id: PieceId, atIndex: number) => void
	findAdLib: (id: PieceId) => { piece: BucketAdLib | undefined; index: number }
	onAdLibReorder: (draggedId: PieceId, newIndex: number, oldIndex: number) => void
	onAdLibMove: (id: PieceId, newBucketId: BucketId) => void
	bucketId: BucketId
}

interface ButtonSourceCollectedProps {
	connectDragSource: ConnectDragSource
	connectDragPreview: ConnectDragPreview
	isDragging: boolean
}

interface ButtonTargetCollectedProps {
	connectDropTarget: ConnectDropTarget
}

export class BucketPieceButtonBase extends DashboardPieceButtonBase<
	ButtonSourceCollectedProps & ButtonTargetCollectedProps
> {
	constructor(props) {
		super(props)
	}

	render() {
		const { isDragging, connectDragSource, connectDragPreview, connectDropTarget } = this.props

		return connectDropTarget(connectDragSource(super.render())) as JSX.Element
	}
}

export const BucketPieceButton = translateWithTracker<
	IDashboardButtonProps & BucketPieceButtonBaseProps,
	{},
	IDashboardButtonTrackedProps
>((props: IDashboardButtonProps) => {
	const piece = (props.adLibListItem as any) as AdLibPieceUi

	const { status, metadata } = checkPieceContentStatus(piece, props.layer, props.playlist.getStudio().settings)

	return {
		status,
		metadata,
	}
})(
	DropTarget(DragDropItemTypes.BUCKET_ADLIB_PIECE, buttonTarget, (connect) => ({
		connectDropTarget: connect.dropTarget(),
	}))(
		DragSource(DragDropItemTypes.BUCKET_ADLIB_PIECE, buttonSource, (connect, monitor) => ({
			connectDragSource: connect.dragSource(),
			connectDragPreview: connect.dragPreview(),
			isDragging: monitor.isDragging(),
		}))(BucketPieceButtonBase)
	) as any
)
