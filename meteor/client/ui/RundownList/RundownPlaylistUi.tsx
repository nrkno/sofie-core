import React from 'react'
import ClassNames from 'classnames'
import { withTranslation } from 'react-i18next'
import { RundownLayoutBase } from '../../../lib/collections/RundownLayouts'
import { unprotectString } from '../../../lib/lib'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ActiveProgressBar } from './ActiveProgressBar'
import { RundownListItem } from './RundownListItem'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconName } from '@fortawesome/fontawesome-svg-core'
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
import RundownListDragDropTypes from './RundownListDragDropTypes'

export interface RundownPlaylistUi extends RundownPlaylist {
	rundowns: Rundown[]
	rundownStatus: string
	rundownAirStatus: string
	unsyncedRundowns: Rundown[]
	studioName: string
	showStyles: Array<{ id: ShowStyleBaseId; baseName?: string; variantName?: string }>
}

export interface IRundownPlaylistUiProps {
	playlist: RundownPlaylistUi
	rundownLayouts: RundownLayoutBase[]
}

interface IRundownPlaylistUiState {
	selectedView: string
}

interface IRundownPlaylistDropTargetProps {
	connectDropTarget: DragElementWrapper<RundownPlaylistUi>
	isOver: boolean
	isOverCurrent: boolean
	canDrop: boolean
	itemType: string | symbol | null
}

const spec: DropTargetSpec<IRundownPlaylistUiProps> = {
	canDrop: (props: IRundownPlaylistUiProps, monitor: DropTargetMonitor) => {
		// console.debug(`canDrop #${props.playlist._id}`, monitor.getItem())
		return true
	},
	drop: (props: IRundownPlaylistUiProps, monitor: DropTargetMonitor, component: RundownPlaylistUi) => {
		// console.debug(`drop #${props.playlist._id}`, monitor.getItem(), component)
		return undefined
	},
	hover: (props: IRundownPlaylistUiProps, monitor: DropTargetMonitor, component: RundownPlaylistUi) => {
		// console.debug(`hover #${props.playlist._id}`, monitor.getItem(), component)
		// console.debug(`is hovering over this component? ${monitor.isOver({ shallow: true })}`)
	},
}

const collect: DropTargetCollector<IRundownPlaylistDropTargetProps, IRundownPlaylistUiProps> = function(
	connect: DropTargetConnector,
	monitor: DropTargetMonitor,
	props: IRundownPlaylistUiProps
): IRundownPlaylistDropTargetProps {
	return {
		connectDropTarget: connect.dropTarget(),
		isOver: monitor.isOver(),
		isOverCurrent: monitor.isOver({ shallow: true }),
		canDrop: monitor.canDrop(),
		itemType: monitor.getItemType(),
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
			constructor(props: Translated<IRundownPlaylistUiProps> & IRundownPlaylistDropTargetProps) {
				super(props)
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

			// MeteorCall.userAction.moveRundown(e, rundownIdTHatWasMoved, movedIntoPlaylistId, rundownsIdsInPlaylistInOrder)

			// onDragEnd (magic: any) {
			// 	console.log({
			// 		rundownIdTHatWasMoved: RundownId, // always
			// 		movedIntoPlaylistId: PlaylistId | null, // if null, move to (new) separate playlist containing only this items
			// 		rundownsIdsInPlaylistInOrder: RundownId[] // new order of playlist, ignore if moved to single item playlist
			// 	})

			// 	// reorder inside a playlist
			// 	console.log({
			// 		rundownIdTHatWasMoved: 'C',
			// 		movedIntoPlaylistId: 'P',
			// 		rundownsIdsInPlaylistInOrder: ['A', 'C', 'B']
			// 	})
			// 	// move into a playlist
			// 	console.log({
			// 		rundownIdTHatWasMoved: 'D',
			// 		movedIntoPlaylistId: 'P',
			// 		rundownsIdsInPlaylistInOrder: ['A', 'B', 'D', 'C']
			// 	})

			// 	// move out from a playlist
			// 	console.log({
			// 		rundownIdTHatWasMoved: 'C',
			// 		movedIntoPlaylistId: null, // backend: create new playlist -> C, delete playlist C was originally in (if empty)?
			// 		rundownsIdsInPlaylistInOrder: ['C'] // but who cares
			// 	})
			// }

			render() {
				const { playlist, connectDropTarget, isOver } = this.props
				const playbackProgressBar = createProgressBarRow(playlist)
				const playlistViewLinks = this.createPlaylistViewLinks()

				if (playlist.rundowns.length === 1) {
					return (
						<>
							<RundownListItem
								key={unprotectString(playlist.rundowns[0]._id)}
								rundown={playlist.rundowns[0]}
								viewLinks={playlistViewLinks}
							/>
							{playbackProgressBar}
						</>
					)
				}

				const rundownComponents = playlist.rundowns.map((rundown) => (
					<RundownListItem key={unprotectString(rundown._id)} rundown={rundown} viewLinks={playlistViewLinks} />
				))

				const styles: any = {}
				if (isOver) {
					styles['borderColor'] = 'red'
				}

				return connectDropTarget(
					<tr style={styles}>
						<td colSpan={10}>
							<table className="table">
								<thead>
									<tr>
										<td colSpan={8}>
											<h2>{playlist.name}</h2>
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
				<td colSpan={10}>
					<ActiveProgressBar rundownPlaylist={playlist} />
				</td>
			</tr>
		)
	}

	return null
}
