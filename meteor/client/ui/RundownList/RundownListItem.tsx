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
	DragSource,
	DragSourceCollector,
	DragSourceConnector,
	DragSourceMonitor,
	DragSourceSpec,
} from 'react-dnd'
import RundownListDragDropTypes from './RundownListDragDropTypes'

export interface IRundownListItemProps {
	rundown: Rundown
	viewLinks: JSX.Element | null
}

interface IRundownDragObject {
	id: RundownId
}

interface IRundownDragSourceProps {
	connectDragSource: ConnectDragSource
	isDragging: boolean
}

const spec: DragSourceSpec<IRundownListItemProps, IRundownDragObject> = {
	beginDrag: (props, monitor, component) => {
		console.debug(`beginDrag #${props.rundown._id}`)
		return { id: props.rundown._id }
	},
	canDrag: (props) => {
		console.debug(`canDrag #${props.rundown._id}`)
		return true
	},
	endDrag: (props) => {
		console.debug(`endDrag #${props.rundown._id}`)
	},
	isDragging: (props, monitor) => {
		const isDragging = props.rundown._id === monitor.getItem().id
		console.debug(`	isDragging #${props.rundown._id}? ${isDragging}`)
		return isDragging
	},
}

const collect: DragSourceCollector<IRundownDragSourceProps, IRundownListItemProps> = function(
	connect: DragSourceConnector,
	monitor: DragSourceMonitor,
	props: IRundownListItemProps
): IRundownDragSourceProps {
	return { connectDragSource: connect.dragSource(), isDragging: monitor.isDragging() }
}

export const RundownListItem = DragSource(
	RundownListDragDropTypes.RUNDOWN,
	spec,
	collect
)(
	withTranslation()(
		class RundownListItem extends React.Component<Translated<IRundownListItemProps> & IRundownDragSourceProps> {
			studio: Studio
			showStyle: ShowStyleBase

			constructor(props: Translated<IRundownListItemProps> & IRundownDragSourceProps) {
				super(props)

				this.studio = this.props.rundown.getStudio()
				this.showStyle = this.props.rundown.getShowStyleBase()

				this.state = {
					selectedView: UIStateStorage.getItemString(`rundownList.${this.studio._id}`, 'defaultView', 'default'),
				}
			}

			render() {
				const { t, rundown, viewLinks, connectDragSource } = this.props
				const userCanConfigure = getAllowConfigure()

				return connectDragSource(
					<tr className={'rundown-list-item'}>
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
							{rundown.unsynced || getAllowConfigure() || getAllowService() ? (
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
