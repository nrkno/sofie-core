import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownAPI } from '../../../lib/api/rundown'

import { DefaultListItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { mousetrapHelper } from '../../lib/mousetrapHelper'
import { RundownUtils } from '../../lib/rundown'
import {
	ISourceLayer,
	IOutputLayer,
	SourceLayerType,
	VTContent,
	LiveSpeakContent,
} from 'tv-automation-sofie-blueprints-integration'
import { AdLibPieceUi } from './AdLibPanel'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { Rundown } from '../../../lib/collections/Rundowns'
import { PubSub } from '../../../lib/api/pubsub'
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

	const { status, metadata, contentDuration } = checkPieceContentStatus(
		piece,
		props.layer,
		props.playlist.getStudio().settings
	)

	return {
		status,
		metadata,
		contentDuration,
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
