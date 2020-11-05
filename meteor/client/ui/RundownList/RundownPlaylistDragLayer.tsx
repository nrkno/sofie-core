import * as React from 'react'
import { DragLayer, DragLayerMonitor } from 'react-dnd'
import { IRundownDragObject, RundownListDragDropTypes } from './DragAndDropTypes'
import { Rundowns } from '../../../lib/collections/Rundowns'
import RundownListItemView from './RundownListItemView'
import { ShowStyleBases } from '../../../lib/collections/ShowStyleBases'

const layerStyles: React.CSSProperties = {
	position: 'fixed',
	pointerEvents: 'none',
	zIndex: 100,
	left: 0,
	top: 0,
	width: '100%',
	height: '100%',
}

function getItemStyles(props) {
	const { currentOffset } = props
	if (!currentOffset) {
		return {
			display: 'none',
		}
	}

	const { x, y } = currentOffset
	const transform = `translate(${x}px, ${y}px)`
	return {
		transform: transform,
		WebkitTransform: transform,
	}
}

function RundownPlaylistDragLayer(props) {
	if (!props.isDragging) {
		return null
	}

	function renderItem(type: RundownListDragDropTypes, item: IRundownDragObject) {
		switch (type) {
			case RundownListDragDropTypes.RUNDOWN:
				const rundown = Rundowns.findOne(item.id)
				const showStyle = ShowStyleBases.findOne(rundown?.showStyleBaseId)
				const classNames = ['drag-preview']
				return (
					<RundownListItemView
						rundown={rundown!}
						classNames={classNames}
						connectDragSource={(props) => props}
						connectDropTarget={(props) => props}
						htmlElementId="drag-preview"
						isDragLayer={true}
						showStyleName={showStyle?.name || ''}
					/>
				)
		}
	}

	return (
		<div style={layerStyles}>
			<div style={getItemStyles(props)}>{renderItem(props.itemType, props.item)}</div>
		</div>
	)
}

function collect(monitor: DragLayerMonitor) {
	return {
		item: monitor.getItem(),
		itemType: monitor.getItemType(),
		currentOffset: monitor.getSourceClientOffset(),
		isDragging: monitor.isDragging(),
	}
}

export default DragLayer(collect)(RundownPlaylistDragLayer)
