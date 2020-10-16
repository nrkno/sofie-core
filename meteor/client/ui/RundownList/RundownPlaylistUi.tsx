import React from 'react'
import ClassNames from 'classnames'
import { withTranslation } from 'react-i18next'
import { RundownLayoutBase } from '../../../lib/collections/RundownLayouts'
import { unprotectString } from '../../../lib/lib'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ActiveProgressBar } from './ActiveProgressBar'
import { RundownListItem } from './RundownListItem'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown, RundownId } from '../../../lib/collections/Rundowns'
import { ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconName } from '@fortawesome/fontawesome-svg-core'
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import { getRundownPlaylistLink, getRundownWithLayoutLink, getShelfLink } from './util'
import { SplitDropdown } from '../../lib/SplitDropdown'
import {
	DragElementWrapper,
	DropTarget,
	DropTargetCollector,
	DropTargetConnector,
	DropTargetMonitor,
	DropTargetSpec,
} from 'react-dnd'
import {
	IRundownPlaylistUiAction,
	isRundownDragObject,
	isRundownPlaylistUiAction,
	RundownListDragDropTypes,
	RundownPlaylistUiActionTypes,
} from './DragAndDropTypes'
import { MeteorCall } from '../../../lib/api/methods'
import { UserActionAPIMethods } from '../../../lib/api/userActions'

export interface RundownPlaylistUi extends RundownPlaylist {
	rundowns: Rundown[]
	rundownStatus: string
	rundownAirStatus: string
	unsyncedRundowns: Rundown[]
	studioName: string
	showStyles: Array<{ id: ShowStyleBaseId; baseName?: string; variantName?: string }>
	handleRundownDrop: (id: string) => void
}

export interface IRundownPlaylistUiProps {
	playlist: RundownPlaylistUi
	rundownLayouts: RundownLayoutBase[]
}

interface IRundownPlaylistUiState {
	selectedView: string
	rundownOrder: RundownId[]
}

interface IRundownPlaylistDropTargetProps {
	connectDropTarget: DragElementWrapper<RundownPlaylistUi>
	isOver: boolean
	isOverCurrent: boolean
	canDrop: boolean
	itemType: string | symbol | null
	action: IRundownPlaylistUiAction | undefined
}

const spec: DropTargetSpec<IRundownPlaylistUiProps> = {
	drop: (
		props: IRundownPlaylistUiProps,
		monitor: DropTargetMonitor,
		component: any
	): IRundownPlaylistUiAction | undefined => {
		const dropped = monitor.getItem()

		console.debug(`Drop on playlist ${props.playlist._id}:`, dropped)

		if (isRundownDragObject(dropped)) {
			return {
				type: 'HANDLE_RUNDOWN_DROP',
				rundownId: dropped.id,
			}
		}
	},
}

const collect: DropTargetCollector<IRundownPlaylistDropTargetProps, IRundownPlaylistUiProps> = function(
	connect: DropTargetConnector,
	monitor: DropTargetMonitor,
	props: IRundownPlaylistUiProps
): IRundownPlaylistDropTargetProps {
	let action: IRundownPlaylistUiAction | undefined = undefined

	const dropResult = monitor.getDropResult()
	if (isRundownPlaylistUiAction(dropResult)) {
		action = dropResult as IRundownPlaylistUiAction
	}

	return {
		connectDropTarget: connect.dropTarget(),
		isOver: monitor.isOver(),
		isOverCurrent: monitor.isOver({ shallow: true }),
		canDrop: monitor.canDrop(),
		itemType: monitor.getItemType(),
		action,
	}
}

export const RundownPlaylistUi = DropTarget(
	RundownListDragDropTypes.RUNDOWN,
	spec,
	collect
)(
	withTranslation()(
		class RundownPlaylistUi extends React.Component<
			Translated<IRundownPlaylistUiProps> & IRundownPlaylistDropTargetProps,
			IRundownPlaylistUiState
		> {
			rundowns: Map<RundownId, Rundown> = new Map<RundownId, Rundown>()

			constructor(props: Translated<IRundownPlaylistUiProps> & IRundownPlaylistDropTargetProps) {
				super(props)

				this.state = {
					rundownOrder: props.playlist.rundowns.map((rundown) => rundown._id),
					selectedView: UIStateStorage.getItemString(
						`rundownList.${this.props.playlist.studioId}`,
						'defaultView',
						'default'
					),
				}

				for (const rundown of props.playlist.rundowns) {
					this.rundowns.set(rundown._id, rundown)
				}
			}

			private handleRundownDrop(rundownId: RundownId) {
				const playlistId = this.props.playlist._id
				const rundownOrder = this.state.rundownOrder.slice()

				if (this.rundowns.has(rundownId)) {
					// finalize order from component state
					MeteorCall.userAction.moveRundown(
						UserActionAPIMethods.reorderRundownPlaylist,
						rundownId,
						playlistId,
						rundownOrder
					)
				} else {
					// add rundown to playlist
					rundownOrder.push(rundownId)
					console.debug(`Rundown ${rundownId} added to end of playlist ${playlistId}`, rundownOrder)

					MeteorCall.userAction.moveRundown(
						UserActionAPIMethods.addRundownToPlaylist,
						rundownId,
						playlistId,
						rundownOrder
					)
				}
			}

			componentDidUpdate() {
				if (this.props.action) {
					const { type, rundownId } = this.props.action
					switch (type) {
						case RundownPlaylistUiActionTypes.HANDLE_RUNDOWN_DROP:
							this.handleRundownDrop(rundownId)
							break
						default:
							console.debug(`Unknown action type ${type}`, this.props.action)
					}
				}
			}

			private saveViewChoice(key: string) {
				UIStateStorage.setItem(`rundownList.${this.props.playlist.studioId}`, 'defaultView', key)
			}

			private renderViewLinkItem(layout: RundownLayoutBase, link: string, key: string) {
				return (
					<Link to={link} onClick={() => this.saveViewChoice(key)} key={key}>
						<div className="action-btn expco-item">
							<div
								className={ClassNames('action-btn layout-icon', { small: !layout.icon })}
								style={{ color: layout.iconColor || 'transparent' }}>
								<FontAwesomeIcon icon={(layout.icon as IconName) || 'circle'} />
							</div>
							<span className="expco-text">{layout.name}</span>
						</div>
					</Link>
				)
			}

			private createPlaylistViewLinks() {
				const { t, playlist } = this.props

				const standaloneLayouts: JSX.Element[] = []
				const shelfLayouts: JSX.Element[] = []

				for (const layout of this.props.rundownLayouts) {
					if (!playlist.showStyles.some((s) => s.id === layout.showStyleBaseId)) {
						continue
					}

					if (layout.exposeAsStandalone) {
						standaloneLayouts.push(
							this.renderViewLinkItem(layout, getShelfLink(playlist._id, layout._id), `standalone${layout._id}`)
						)
					}

					if (layout.exposeAsShelf) {
						shelfLayouts.push(
							this.renderViewLinkItem(layout, getRundownWithLayoutLink(playlist._id, layout._id), `shelf${layout._id}`)
						)
					}
				}

				const allElements = [
					<div className="expco-header" key={`${playlist._id}layoutsheader2`}>
						{t('Standalone Shelf')}
					</div>,
					...standaloneLayouts,
					<div className="expco-header" key={`${playlist._id}layoutsheader1`}>
						{t('Timeline views')}
					</div>,
					...shelfLayouts,
					<Link
						to={getRundownPlaylistLink(playlist._id)}
						onClick={() => this.saveViewChoice('default')}
						key={'default'}>
						<div className="action-btn expco-item">{t('Default')}</div>
					</Link>,
				]

				return shelfLayouts.length > 0 || standaloneLayouts.length > 0 ? (
					<React.Fragment>
						<SplitDropdown selectedKey={this.state.selectedView}>{allElements}</SplitDropdown>
					</React.Fragment>
				) : null
			}

			private swapRundownOrder(a: RundownId, b: RundownId): void {
				const aPos = this.state.rundownOrder.indexOf(a)
				const bPos = this.state.rundownOrder.indexOf(b)

				if (aPos > -1 && bPos > -1) {
					const newOrder = this.state.rundownOrder.slice()
					newOrder[aPos] = b
					newOrder[bPos] = a
					this.setState({ rundownOrder: newOrder })
				} else {
					console.warn(
						`Illegal values for rundown order position swap: ${a} (current position: ${aPos}), ${b} (current position: ${bPos})`
					)
				}
			}

			render() {
				const { playlist, connectDropTarget, isOver } = this.props

				if (playlist.rundowns.length === 0) {
					console.log(`Playlist ${playlist._id} has no rundowns, aborting render`)
					return null
				}

				const playbackProgressBar = createProgressBarRow(playlist)
				const playlistViewLinks = this.createPlaylistViewLinks()
				const handleRundownSwap = (a: RundownId, b: RundownId) => {
					this.swapRundownOrder(a, b)
				}

				if (playlist.rundowns.length === 1) {
					return (
						<>
							<RundownListItem
								key={unprotectString(playlist.rundowns[0]._id)}
								rundown={playlist.rundowns[0]}
								viewLinks={playlistViewLinks}
								swapRundownOrder={handleRundownSwap}
							/>
							{playbackProgressBar}
						</>
					)
				}

				const rundownComponents = this.state.rundownOrder.map((rundownId) => {
					const rundown = this.rundowns.get(rundownId)
					return rundown ? (
						<RundownListItem
							key={unprotectString(rundown._id)}
							rundown={rundown}
							viewLinks={playlistViewLinks}
							swapRundownOrder={handleRundownSwap}
						/>
					) : null
				})

				return connectDropTarget(
					<tr className={`rundown-playlist ${isOver ? 'droptarget' : ''}`}>
						<td colSpan={7}>
							<table className="table system-status-table expando expando-tight">
								<thead>
									<tr>
										<td colSpan={5}>
											<h2>
												<FontAwesomeIcon icon={faFolderOpen} /> {playlist.name}
											</h2>
										</td>
										<td>{playlistViewLinks}</td>
										<td>Actions her</td>
									</tr>
								</thead>
								<tbody>{rundownComponents}</tbody>
								<tfoot>{playbackProgressBar}</tfoot>
							</table>
						</td>
					</tr>
				)
			}
		}
	)
)

function createProgressBarRow(playlist: RundownPlaylistUi): React.ReactElement | null {
	if (playlist.startedPlayback !== undefined && playlist.expectedDuration !== undefined && playlist.startedPlayback) {
		return (
			<tr className="hl expando-addon">
				<td colSpan={7}>
					<ActiveProgressBar rundownPlaylist={playlist} />
				</td>
			</tr>
		)
	}

	return null
}
