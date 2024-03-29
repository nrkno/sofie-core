import { IDashboardButtonProps, DashboardPieceButtonBase } from './DashboardPieceButton'

import {
	DragSource,
	DropTarget,
	ConnectDragSource,
	ConnectDropTarget,
	DragSourceMonitor,
	DropTargetMonitor,
	ConnectDragPreview,
	ConnectableElement,
} from 'react-dnd'
import { DragDropItemTypes } from '../DragDropItemTypes'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { withMediaObjectStatus } from '../SegmentTimeline/withMediaObjectStatus'
import { BucketAdLibActionUi, BucketAdLibItem } from './RundownViewBuckets'
import { IBlueprintActionTriggerMode } from '@sofie-automation/blueprints-integration'
import { BucketId, PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

type IDashboardButtonPropsCombined = BucketPieceButtonBaseProps & IDashboardButtonProps

interface IBucketPieceDragObject {
	id: PieceId
	bucketId: BucketId
	originalIndex: number
}

export interface IBucketPieceDropResult {
	index: number
	bucketId: BucketId
	action: 'reorder' | 'move' | undefined
}

const buttonSource = {
	beginDrag(props: IDashboardButtonPropsCombined, _monitor: DragSourceMonitor, _component: any) {
		return {
			id: props.piece._id,
			originalIndex: props.findAdLib(props.piece._id).index,
			bucketId: props.bucketId,
		}
	},

	endDrag(
		props: IDashboardButtonPropsCombined,
		monitor: DragSourceMonitor<IBucketPieceDragObject, IBucketPieceDropResult>
	) {
		const { id: droppedId, originalIndex } = monitor.getItem()
		const didDrop = monitor.didDrop()

		if (!didDrop) {
			props.moveAdLib(droppedId, originalIndex)
		} else {
			const dropResult = monitor.getDropResult()
			if (!dropResult) return

			const { action } = dropResult
			if (action === 'reorder') {
				const { index: newIndex } = props.findAdLib(droppedId)
				props.onAdLibReorder(droppedId, newIndex, originalIndex)
			} else if (action === 'move') {
				const { bucketId } = dropResult
				props.onAdLibMove(droppedId, bucketId)
			}
		}
	},
}

const buttonTarget = {
	canDrop(_props: IDashboardButtonPropsCombined, _monitor: DropTargetMonitor) {
		return true
	},

	hover(
		props: IDashboardButtonPropsCombined,
		monitor: DropTargetMonitor<IBucketPieceDragObject, IBucketPieceDropResult>,
		_component: any
	) {
		const { id: draggedId } = monitor.getItem()
		const overId = props.piece._id

		if (draggedId !== overId) {
			const { index: overIndex } = props.findAdLib(overId)
			props.moveAdLib(draggedId, overIndex)
		}
	},

	drop(props: IDashboardButtonPropsCombined, _monitor: DropTargetMonitor) {
		const { index } = props.findAdLib(props.piece._id)

		return {
			index,
			action: 'reorder',
		}
	},
}

export interface BucketPieceButtonBaseProps {
	moveAdLib: (id: PieceId, atIndex: number) => void
	findAdLib: (id: PieceId) => { piece: BucketAdLib | BucketAdLibActionUi | undefined; index: number }
	onAdLibReorder: (draggedId: PieceId, newIndex: number, oldIndex: number) => void
	onAdLibMove: (id: PieceId, newBucketId: BucketId) => void
	bucketId: BucketId
	onToggleAdLib: (piece: BucketAdLibItem, queue: boolean, e: any, mode?: IBlueprintActionTriggerMode) => void
}

interface ButtonSourceCollectedProps {
	connectDragSource: ConnectDragSource
	connectDragPreview: ConnectDragPreview
	isDragging: boolean
}

interface ButtonTargetCollectedProps {
	connectDropTarget: ConnectDropTarget
}

class BucketPieceButtonBase extends DashboardPieceButtonBase<ButtonSourceCollectedProps & ButtonTargetCollectedProps> {
	inBucket = true
	render(): JSX.Element {
		const { connectDragSource, connectDropTarget } = this.props

		return connectDropTarget(connectDragSource(super.render() as ConnectableElement)) as JSX.Element
	}
}

export const BucketPieceButton = withMediaObjectStatus<
	React.PropsWithChildren<IDashboardButtonProps> & BucketPieceButtonBaseProps,
	{}
>()(
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
