import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTh, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import Tooltip from 'rc-tooltip'
import React from 'react'
import { withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { Link } from 'react-router-dom'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { Studio } from '../../../lib/collections/Studios'
import { getAllowConfigure, getAllowService } from '../../lib/localStorage'
import { MomentFromNow } from '../../lib/Moment'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../lib/rundown'
import {
	confirmDeleteRundown,
	confirmReSyncRundown,
	getRundownPlaylistLink,
	getRundownWithLayoutLink,
	getShowStyleBaseLink,
} from './util'
import { UIStateStorage } from '../../lib/UIStateStorage'
import {
	ConnectDragSource,
	ConnectDropTarget,
	DragElementWrapper,
	DragLayer,
	DragLayerCollector,
	DragPreviewOptions,
	DragSource,
	DragSourceCollector,
	DragSourceConnector,
	DragSourceMonitor,
	DragSourceSpec,
	DropTarget,
	DropTargetCollector,
	DropTargetConnector,
	DropTargetMonitor,
	DropTargetSpec,
	XYCoord,
} from 'react-dnd'
import { IRundownDragObject, RundownListDragDropTypes } from './DragAndDropTypes'
import { getEmptyImage } from 'react-dnd-html5-backend'
import { unprotectString } from '../../../lib/lib'
import { iconDragHandle, iconRemove, iconResync } from './icons'
import { spawn } from 'child_process'
import RundownListItemView from './RundownListItemView'

const HTML_ID_PREFIX = 'rundown-'

export interface IRundownListItemProps {
	rundown: Rundown
	playlistViewUrl: string
	swapRundownOrder: (a: RundownId, b: RundownId) => void
}

interface IRundownDragSourceProps {
	connectDragSource: ConnectDragSource
	dragPreview: DragElementWrapper<DragPreviewOptions>
	isDragging: boolean
}

const dragSpec: DragSourceSpec<IRundownListItemProps, IRundownDragObject> = {
	beginDrag: (props: IRundownListItemProps, monitor, component: React.Component) => {
		const id = props.rundown._id
		return { id }
	},
	isDragging: (props, monitor) => {
		return props.rundown._id === monitor.getItem().id
	},
}

const dragCollector: DragSourceCollector<IRundownDragSourceProps, IRundownListItemProps> = function(
	connect: DragSourceConnector,
	monitor: DragSourceMonitor,
	props: IRundownListItemProps
): IRundownDragSourceProps {
	return {
		connectDragSource: connect.dragSource(),
		dragPreview: connect.dragPreview(),
		isDragging: monitor.isDragging(),
	}
}

interface IRundownDropTargetProps {
	connectDropTarget: ConnectDropTarget
}

const dropSpec: DropTargetSpec<IRundownListItemProps> = {
	canDrop: (props: IRundownListItemProps, monitor: DropTargetMonitor) => {
		// we're only using the droptarget for order swapping
		return false
	},

	hover(props: IRundownListItemProps, monitor: DropTargetMonitor) {
		if (monitor.getItemType() === RundownListDragDropTypes.RUNDOWN) {
			const item = monitor.getItem() as IRundownDragObject

			// if that rundown is not this rundown
			if (item && props.rundown._id !== item.id) {
				props.swapRundownOrder(props.rundown._id, item.id)
			}
		}
	},
}

const dropCollect: DropTargetCollector<IRundownDropTargetProps, IRundownListItemProps> = (
	connect: DropTargetConnector,
	monitor: DropTargetMonitor,
	props: IRundownListItemProps
) => {
	return {
		connectDropTarget: connect.dropTarget(),
	}
}

interface IRundownDragLayerProps {
	currentOffset: XYCoord | null
	clientOffset: XYCoord | null
}

const dragLayerCollect: DragLayerCollector<
	IRundownDragSourceProps & IRundownListItemProps,
	IRundownDragLayerProps
> = function(monitor, props) {
	let currentOffset: XYCoord | null = null
	let clientOffset: XYCoord | null = null

	if (monitor.getItem()?.id === props.rundown._id) {
		currentOffset = monitor.getDifferenceFromInitialOffset()
		clientOffset = monitor.getClientOffset()
	}

	return {
		currentOffset,
		clientOffset,
	}
}

export const RundownListItem = withTranslation()(
	// DragLayer(dragLayerCollect, {
	// 	arePropsEqual: (props, newProps) => {
	// 		if (props.rundown._id !== newProps.rundown._id) {
	// 			return false
	// 		}

	// 		return true
	// 	},
	// })(
	DragSource(
		RundownListDragDropTypes.RUNDOWN,
		dragSpec,
		dragCollector
	)(
		DropTarget(
			RundownListDragDropTypes.RUNDOWN,
			dropSpec,
			dropCollect
		)(
			class RundownListItem extends React.Component<
				Translated<IRundownListItemProps> & IRundownDragSourceProps & IRundownDropTargetProps
			> {
				studio: Studio
				showStyle: ShowStyleBase

				constructor(props: Translated<IRundownListItemProps> & IRundownDragSourceProps & IRundownDropTargetProps) {
					super(props)

					this.studio = this.props.rundown.getStudio()
					this.showStyle = this.props.rundown.getShowStyleBase()

					this.state = {
						selectedView: UIStateStorage.getItemString(`rundownList.${this.studio._id}`, 'defaultView', 'default'),
					}

					this.props.dragPreview(getEmptyImage()) // override default dom node screenshot behavior
				}

				render() {
					const { t, rundown, connectDragSource, connectDropTarget, isDragging, playlistViewUrl } = this.props
					const userCanConfigure = getAllowConfigure()

					const classNames: string[] = ['rundown-list-item']
					if (isDragging) classNames.push('dragging')
					if (rundown.unsynced) classNames.push('unsynced')

					// rundown ids can start with digits, which is illegal for HTML id attributes
					const htmlElementId = `${HTML_ID_PREFIX}${unprotectString(rundown._id)}`

					return (
						<RundownListItemView
							classNames={classNames}
							connectDragSource={connectDragSource}
							connectDropTarget={connectDropTarget}
							htmlElementId={htmlElementId}
							isDragLayer={false}
							playlistViewUrl={playlistViewUrl}
							rundown={rundown}
							showStyle={this.showStyle}
							showStyleBaseURL={getShowStyleBaseLink(rundown.showStyleBaseId)}
							confirmDeleteRundownHandler={
								rundown.unsynced || userCanConfigure || getAllowService()
									? () => confirmDeleteRundown(rundown, t)
									: undefined
							}
							confirmReSyncRundownHandler={rundown.unsynced ? () => confirmReSyncRundown(rundown, t) : undefined}
						/>
					)
				}
			}
		)
	)
)
