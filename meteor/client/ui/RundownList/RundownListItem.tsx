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
import {
	IRundownDragObject,
	IRundownPlaylistUiAction,
	isRundownDragObject,
	RundownListDragDropTypes,
	RundownPlaylistUiActionTypes,
} from './DragAndDropTypes'
import { getEmptyImage } from 'react-dnd-html5-backend'
import { unprotectString } from '../../../lib/lib'
import { iconDragHandle, iconRemove, iconResync } from './icons'
import { spawn } from 'child_process'
import RundownListItemView from './RundownListItemView'
import { Settings } from '../../../lib/Settings'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { MeteorCall } from '../../../lib/api/methods'

const HTML_ID_PREFIX = 'rundown-'

export interface IRundownListItemProps {
	rundown: Rundown
	playlistViewUrl: string
	swapRundownOrder: (a: RundownId, b: RundownId) => void
	playlistId: RundownPlaylistId
	isOnlyRundownInPlaylist?: boolean
	action?: IRundownPlaylistUiAction
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
	canDrop: (props: IRundownListItemProps, monitor: DropTargetMonitor): boolean => {
		/*
		 * Dropping a rundown on a rundown will add that rundown to the rundown's
		 * parent playlist. This is only allowed if enabled in settings.
		 * In addition it also should not be handled if the rundown is part of a
		 * playlist with multiple rundowns, because then the playlist component
		 * will be the legal drop target and handle the drop itself.
		 */
		return (
			Settings.allowMultiplePlaylistsInGUI === true &&
			props.isOnlyRundownInPlaylist === true &&
			props.playlistId !== undefined &&
			monitor.getItemType() === RundownListDragDropTypes.RUNDOWN
		)
	},

	drop(props: IRundownListItemProps, monitor: DropTargetMonitor) {
		if (monitor.didDrop()) {
			return
		}

		const dropped = monitor.getItem()

		console.debug(`Drop on rundown ${props.rundown._id} (playlist ${props.playlistId}):`, dropped)

		if (isRundownDragObject(dropped)) {
			return {
				type: 'HANDLE_RUNDOWN_DROP',
				rundownId: dropped.id,
				targetPlaylistId: props.playlistId,
			}
		}
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

				handleRundownDrop(rundownId: RundownId) {
					const { rundown, playlistId } = this.props
					MeteorCall.userAction.moveRundown('Drag and drop add rundown to playlist', rundownId, playlistId, [
						rundown._id,
						rundownId,
					])
				}

				componentDidUpdate() {
					const { action } = this.props
					if (action && action.targetPlaylistId === this.props.playlistId) {
						const { type, rundownId } = action
						switch (type) {
							case RundownPlaylistUiActionTypes.HANDLE_RUNDOWN_DROP:
								this.handleRundownDrop(rundownId)
								break
							default:
								console.debug(`Unknown action type ${type}`, this.props.action)
						}
					}
				}

				render() {
					const { t, rundown, connectDragSource, connectDropTarget, isDragging, playlistViewUrl } = this.props
					const userCanConfigure = getAllowConfigure()

					const classNames: string[] = []
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
