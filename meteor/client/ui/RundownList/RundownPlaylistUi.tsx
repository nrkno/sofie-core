import React, { ReactElement } from 'react'
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
import { RundownUtils } from '../../lib/rundown'
import { MomentFromNow } from '../../lib/Moment'

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
	itemType: string | symbol | null
	action: IRundownPlaylistUiAction | undefined
}

const spec: DropTargetSpec<IRundownPlaylistUiProps> = {
	drop: (
		props: IRundownPlaylistUiProps,
		monitor: DropTargetMonitor,
		component: any
	): IRundownPlaylistUiAction | undefined => {
		if (monitor.didDrop()) {
			return
		}

		const dropped = monitor.getItem()

		console.debug(`Drop on playlist ${props.playlist._id}:`, dropped)

		if (isRundownDragObject(dropped)) {
			return {
				type: 'HANDLE_RUNDOWN_DROP',
				rundownId: dropped.id,
				targetPlaylistId: props.playlist._id,
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

			private handleRundownDrop(rundownId: RundownId): void {
				const playlistId = this.props.playlist._id
				const rundownOrder = this.state.rundownOrder.slice()

				console.debug(`${this.props.playlist._id} drop handler`, rundownId)

				if (this.rundowns.has(rundownId)) {
					console.debug(`Found ${rundownId} in ${Array.from(this.rundowns.keys())}, finalizing order in local state`)
					// finalize order from component state
					MeteorCall.userAction.moveRundown(
						'Drag and drop rundown playlist reorder',
						rundownId,
						playlistId,
						rundownOrder
					)
				} else {
					console.debug(`${rundownId} not found in ${Array.from(this.rundowns.keys())}, adding to playlist`)
					// add rundown to playlist
					rundownOrder.push(rundownId)
					console.debug(`Rundown ${rundownId} added to end of playlist ${playlistId}`, rundownOrder)

					MeteorCall.userAction.moveRundown(
						'Drag and drop add rundown to playlist',
						rundownId,
						playlistId,
						rundownOrder
					)
				}
			}

			private handleResetRundownOrderClick() {
				MeteorCall.userAction.restoreRundownOrder(
					'User clicked the playlist rundown order toggle to reset',
					this.props.playlist._id
				)
			}

			private rundownsHaveChanged(prevProps: IRundownPlaylistUiProps): boolean {
				if (prevProps.playlist.rundowns.length !== this.props.playlist.rundowns.length) {
					return true
				}

				for (let i = 0; i < prevProps.playlist.rundowns.length; i++) {
					if (prevProps.playlist.rundowns[i]._id !== this.props.playlist.rundowns[i]._id) {
						return true
					}
				}

				return false
			}

			private resetLocalRundownState(): void {
				const rundownOrder = this.props.playlist.rundowns.map((rundown) => rundown._id)

				const currentRundowns = new Map<RundownId, Rundown>()
				for (const rundown of this.props.playlist.rundowns) {
					currentRundowns.set(rundown._id, rundown)
				}

				this.rundowns = currentRundowns
				this.setState({ rundownOrder })
			}

			componentDidUpdate(prevProps: IRundownPlaylistUiProps) {
				const { action } = this.props
				if (action && action.targetPlaylistId === this.props.playlist._id) {
					const { type, rundownId } = action
					switch (type) {
						case RundownPlaylistUiActionTypes.HANDLE_RUNDOWN_DROP:
							this.handleRundownDrop(rundownId)
							break
						default:
							console.debug(`Unknown action type ${type}`, this.props.action)
					}
				}

				if (this.rundownsHaveChanged(prevProps)) {
					console.debug(`componentDidUpdate ${this.props.playlist._id}: rundowns have changed, resetting local state`)
					this.resetLocalRundownState()
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

			private createPlaylistViewLinks(): ReactElement | null {
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
					console.debug(`Swapped [${aPos}:${a}] with [${bPos}:${b}]`)
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
				const playlistViewURL = getRundownPlaylistLink(playlist._id)
				const handleRundownSwap = (a: RundownId, b: RundownId) => {
					this.swapRundownOrder(a, b)
				}

				if (playlist.rundowns.length === 1 && playlist.name === playlist.rundowns[0].name) {
					// For the time being, playlists with only one rundown aren't considered
					// playlists. Therefore they are rendered without playlist markup/styling
					// and also won't be connected as drop targets (preventing other rundowns
					// from being dropped onto them and being added to them)
					// An exception is made for named playlists (which come from ENPS/blueprints,
					// and therefore should be preserved)
					return (
						<>
							<RundownListItem
								key={unprotectString(playlist.rundowns[0]._id)}
								rundown={playlist.rundowns[0]}
								rundownViewUrl={playlistViewURL}
								swapRundownOrder={handleRundownSwap}
								playlistId={playlist._id}
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
							swapRundownOrder={handleRundownSwap}
							playlistId={playlist._id}
						/>
					) : null
				})

				const expectedDuration =
					playlist.expectedDuration &&
					RundownUtils.formatDiffToTimecode(playlist.expectedDuration, false, true, true, false, true)

				return connectDropTarget(
					<li className={`rundown-playlist ${isOver ? 'droptarget' : ''}`}>
						<header className="rundown-playlist__header">
							<span className="rundown-list-item__name">
								<h2 className="rundown-playlist__heading">
									<FontAwesomeIcon icon={faFolderOpen} />
									<span className="rundown-playlist__heading-text">
										<Link to={playlistViewURL}>{playlist.name}</Link>
									</span>
								</h2>
								<span
									onClick={() => {
										this.handleResetRundownOrderClick()
									}}>{`rundownRanksAreSetInSofie: ${playlist.rundownRanksAreSetInSofie === true}`}</span>
							</span>
							<span className="rundown-list-item__showStyle">{playlistViewLinks}</span>
							<span className="rundown-list-item__airTime"></span>
							<span className="rundown-list-item__problems"></span>
							<span className="rundown-list-item__duration">{expectedDuration}</span>
							<span className="rundown-list-item__modified">
								<MomentFromNow>{playlist.modified}</MomentFromNow>
							</span>
							<span className="rundown-list-item__actions"></span>
						</header>
						<ol className="rundown-playlist__rundowns">{rundownComponents}</ol>
						<footer>{playbackProgressBar ? playbackProgressBar : null}</footer>
					</li>
				)
			}
		}
	)
)

function createProgressBarRow(playlist: RundownPlaylistUi): React.ReactElement | null {
	if (playlist.startedPlayback !== undefined && playlist.expectedDuration !== undefined && playlist.startedPlayback) {
		return <ActiveProgressBar rundownPlaylist={playlist} />
	}

	return null
}
