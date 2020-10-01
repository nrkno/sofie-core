import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
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
import { getShowStyleBaseLink, getStudioLink } from './util'
import { doModalDialog } from '../../lib/ModalDialog'
import { doUserAction, UserAction } from '../../lib/userAction'
import { MeteorCall } from '../../../lib/api/methods'
import { UIStateStorage } from '../../lib/UIStateStorage'
import {
	ConnectDragSource,
	DragElementWrapper,
	DragLayer,
	DragLayerCollector,
	DragPreviewOptions,
	DragSource,
	DragSourceCollector,
	DragSourceConnector,
	DragSourceMonitor,
	DragSourceSpec,
	XYCoord,
} from 'react-dnd'
import RundownListDragDropTypes from './RundownListDragDropTypes'
import { getEmptyImage } from 'react-dnd-html5-backend'

export interface IRundownListItemProps {
	rundown: Rundown
	viewLinks: JSX.Element | null
}

interface IRundownDragObject {
	id: RundownId
}

interface IRundownDragSourceProps {
	connectDragSource: ConnectDragSource
	dragPreview: DragElementWrapper<DragPreviewOptions>
	isDragging: boolean
}

const spec: DragSourceSpec<IRundownListItemProps, IRundownDragObject> = {
	beginDrag: (props, monitor, component) => {
		// console.debug(`beginDrag #${props.rundown._id}`)
		return { id: props.rundown._id }
	},
	canDrag: (props) => {
		// console.debug(`canDrag #${props.rundown._id}`)
		return true
	},
	endDrag: (props) => {
		// console.debug(`endDrag #${props.rundown._id}`)
	},
	isDragging: (props, monitor) => {
		const isDragging = props.rundown._id === monitor.getItem().id
		// if (isDragging) {
		// 	console.debug(`	isDragging #${props.rundown.name}? ${isDragging}`)
		// }
		return isDragging
	},
}

const collect: DragSourceCollector<IRundownDragSourceProps, IRundownListItemProps> = function(
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

interface IRundownDragLayerProps {
	currentOffset: XYCoord | null
}

const dragLayerCollect: DragLayerCollector<
	IRundownDragSourceProps & IRundownListItemProps,
	IRundownDragLayerProps
> = function(monitor, props) {
	let currentOffset: XYCoord | null = null

	if (monitor.getItem()?.id === props.rundown._id) {
		currentOffset = monitor.getDifferenceFromInitialOffset()
	}

	return {
		currentOffset,
	}
}

export const RundownListItem = withTranslation()(
	DragLayer(dragLayerCollect, {
		arePropsEqual: (props, newProps) => {
			if (props.rundown._id !== newProps.rundown._id) {
				return false
			}

			return true
		},
	})(
		DragSource(
			RundownListDragDropTypes.RUNDOWN,
			spec,
			collect
		)(
			class RundownListItem extends React.Component<
				Translated<IRundownListItemProps> & IRundownDragSourceProps & IRundownDragLayerProps
			> {
				studio: Studio
				showStyle: ShowStyleBase

				constructor(props: Translated<IRundownListItemProps> & IRundownDragSourceProps & IRundownDragLayerProps) {
					super(props)

					this.studio = this.props.rundown.getStudio()
					this.showStyle = this.props.rundown.getShowStyleBase()

					this.state = {
						selectedView: UIStateStorage.getItemString(`rundownList.${this.studio._id}`, 'defaultView', 'default'),
					}

					this.props.dragPreview(getEmptyImage()) // override default dom node screenshot behavior
				}

				shouldComponentUpdate(nextProps) {
					const unequal: string[] = []
					if (this.props.connectDragSource !== nextProps.connectDragSource) unequal.push('connectDragSource')
					if (this.props.currentOffset?.y !== nextProps.currentOffset?.y)
						unequal.push(`currentOffset (${this.props.currentOffset?.y},${nextProps.currentOffset?.y})`)
					if (this.props.dragPreview !== nextProps.dragPreview) unequal.push('dragPreview')
					if (this.props.rundown?._id !== nextProps.rundown?._id) unequal.push('rundown')
					if (this.props.t !== nextProps.t) unequal.push('t')
					if (this.props.tReady !== nextProps.tReady) unequal.push('tReady')
					if (this.props.viewLinks !== nextProps.viewLinks) unequal.push('viewLinks')

					if (unequal.length > 0) {
						console.log(this.props.rundown._id, this.props.rundown.name, unequal)
						return true
					}
					// console.log(this.props.rundown._id, this.props, nextProps)
					return false
				}

				render() {
					const { t, rundown, viewLinks, connectDragSource, isDragging, currentOffset } = this.props
					const userCanConfigure = getAllowConfigure()

					const styles = {}
					if (isDragging && currentOffset) {
						// console.debug(`#${rundown.name} is dragging, yOffset: ${y}`)
						styles['transform'] = `translate3d(0, ${currentOffset.y}px, 0) scale(var(--scaleFactor))`
					} else {
						styles['transform'] = `translate3d(0, 0, 0) scale(var(--scaleFactor))`
					}

					console.debug(`RundownListItem render: ${rundown.name}`)

					return connectDragSource(
						<tr className={`rundown-list-item ${isDragging ? 'dragging' : ''}`} style={styles}>
							<th className="rundown-list-item__name">{rundown.name}</th>
							<td className="rundown-list-item__studio">
								{userCanConfigure ? (
									<Link to={getStudioLink(rundown.studioId)}>{this.studio.name}</Link>
								) : (
									this.studio.name
								)}
							</td>
							<td className="rundown-list-item__showStyle">
								{userCanConfigure ? (
									<Link to={getShowStyleBaseLink(rundown.showStyleBaseId)}>{this.showStyle.name}</Link>
								) : (
									this.showStyle.name
								)}
							</td>
							<td className="rundown-list-item__created">
								<MomentFromNow>{rundown.created}</MomentFromNow>
							</td>
							<td className="rundown-list-item__airTime">
								{rundown.expectedStart && <Moment format="YYYY/MM/DD HH:mm:ss">{rundown.expectedStart}</Moment>}
							</td>
							<td className="rundown-list-item__duration">
								{rundown.expectedDuration &&
									RundownUtils.formatDiffToTimecode(rundown.expectedDuration, false, false, true, false, true)}
							</td>
							<td className="rundown-list-item__status">{rundown.status}</td>
							<td className="rundown-list-item__air-status">{rundown.airStatus}</td>
							<td className="rundown-list-item__views">{viewLinks}</td>
							<td className="rundown-list-item__actions">
								{rundown.unsynced || userCanConfigure || getAllowService() ? (
									<Tooltip overlay={t('Delete')} placement="top">
										<button className="action-btn" onClick={() => this.confirmDeleteRundown(rundown)}>
											<FontAwesomeIcon icon={faTrash} />
										</button>
									</Tooltip>
								) : null}
								{rundown.unsynced ? (
									<Tooltip overlay={t('Re-sync all rundowns in playlist')} placement="top">
										<button className="action-btn" onClick={() => this.confirmReSyncRundown(rundown)}>
											<FontAwesomeIcon icon={faSync} />
										</button>
									</Tooltip>
								) : null}
							</td>
						</tr>
					)
				}

				private confirmDeleteRundown(rundown: Rundown) {
					const { t } = this.props

					doModalDialog({
						title: t('Delete rundown?'),
						yes: t('Delete'),
						no: t('Cancel'),
						onAccept: (e) => {
							doUserAction(t, e, UserAction.REMOVE_RUNDOWN, (e) => MeteorCall.userAction.removeRundown(e, rundown._id))
						},
						message:
							t('Are you sure you want to delete the "{{name}}" rundown?', { name: rundown.name }) +
							'\n' +
							t('Please note: This action is irreversible!'),
					})
				}

				private confirmReSyncRundown(rundown: Rundown): void {
					const { t } = this.props

					doModalDialog({
						title: t('Re-Sync rundown?'),
						yes: t('Re-Sync'),
						no: t('Cancel'),
						onAccept: (e) => {
							doUserAction(t, e, UserAction.RESYNC_RUNDOWN, (e) => MeteorCall.userAction.resyncRundown(e, rundown._id))
						},
						message: t('Are you sure you want to re-sync the "{{name}}" rundown?', {
							name: rundown.name,
						}),
					})
				}
			}
		)
	)
)
