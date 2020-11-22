import { IconName } from '@fortawesome/fontawesome-svg-core'
import { faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ClassNames from 'classnames'
import Tooltip from 'rc-tooltip'
import React from 'react'
import { withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { Link } from 'react-router-dom'
import { MeteorCall } from '../../../../lib/api/methods'
import { RundownLayoutBase } from '../../../../lib/collections/RundownLayouts'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { ShowStyleBaseId } from '../../../../lib/collections/ShowStyleBases'
import { getAllowConfigure, getAllowService, getHelpMode } from '../../../lib/localStorage'
import { doModalDialog } from '../../../lib/ModalDialog'
import { MomentFromNow } from '../../../lib/Moment'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../../lib/rundown'
import { SplitDropdown } from '../../../lib/SplitDropdown'
import { UIStateStorage } from '../../../lib/UIStateStorage'
import { doUserAction, UserAction } from '../../../lib/userAction'
import { ActiveProgressBar } from '../ActiveProgressBar'
import {
	getRundownPlaylistLink,
	getRundownWithLayoutLink,
	getShelfLink,
	getShowStyleBaseLink,
	getStudioLink,
} from '../util'

export interface RundownPlaylistUi extends RundownPlaylist {
	rundownStatus: string
	rundownAirStatus: string
	unsyncedRundowns: Rundown[]
	studioName: string
	showStyles: Array<{ id: ShowStyleBaseId; baseName?: string; variantName?: string }>
}

interface IRundownListItemProps {
	key: string
	rundownPlaylist: RundownPlaylistUi
	rundownLayouts: Array<RundownLayoutBase>
}

interface IRundownListItemState {
	selectedView: string
}

export const RundownListItem = withTranslation()(
	class RundownListItem extends React.Component<Translated<IRundownListItemProps>, IRundownListItemState> {
		constructor(props) {
			super(props)

			this.state = {
				selectedView: UIStateStorage.getItemString(
					`rundownList.${this.props.rundownPlaylist.studioId}`,
					'defaultView',
					'default'
				),
			}
		}

		private confirmDeleteRundownPlaylist(rundownPlaylist: RundownPlaylist) {
			const { t } = this.props

			doModalDialog({
				title: t('Delete this RundownPlaylist?'),
				yes: t('Delete'),
				no: t('Cancel'),
				onAccept: (e) => {
					doUserAction(t, e, UserAction.REMOVE_RUNDOWN_PLAYLIST, (e) =>
						MeteorCall.userAction.removeRundownPlaylist(e, rundownPlaylist._id)
					)
				},
				message:
					t('Are you sure you want to delete the "{{name}}" RundownPlaylist?', { name: rundownPlaylist.name }) +
					'\n' +
					t('Please note: This action is irreversible!'),
			})
		}

		private confirmReSyncRundownPlaylist(rundownPlaylist: RundownPlaylist) {
			const { t } = this.props
			doModalDialog({
				title: t('Re-Sync this rundownPlaylist?'),
				yes: t('Re-Sync'),
				no: t('Cancel'),
				onAccept: (e) => {
					doUserAction(t, e, UserAction.RESYNC_RUNDOWN_PLAYLIST, (e) =>
						MeteorCall.userAction.resyncRundownPlaylist(e, rundownPlaylist._id)
					)
				},
				message: t('Are you sure you want to re-sync all rundowns in playlist "{{name}}"?', {
					name: rundownPlaylist.name,
				}),
			})
		}

		private saveViewChoice(key: string) {
			UIStateStorage.setItem(`rundownList.${this.props.rundownPlaylist.studioId}`, 'defaultView', key)
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

		private renderViewLinks() {
			const { t, rundownPlaylist } = this.props

			const standaloneLayouts: JSX.Element[] = []
			const shelfLayouts: JSX.Element[] = []

			for (const layout of this.props.rundownLayouts) {
				if (!rundownPlaylist.showStyles.some((s) => s.id === layout.showStyleBaseId)) {
					continue
				}

				if (layout.exposeAsStandalone) {
					standaloneLayouts.push(
						this.renderViewLinkItem(layout, getShelfLink(rundownPlaylist._id, layout._id), `standalone${layout._id}`)
					)
				}

				if (layout.exposeAsShelf) {
					shelfLayouts.push(
						this.renderViewLinkItem(
							layout,
							getRundownWithLayoutLink(rundownPlaylist._id, layout._id),
							`shelf${layout._id}`
						)
					)
				}
			}

			const allElements = [
				<div className="expco-header" key={`${rundownPlaylist._id}layoutsheader2`}>
					{t('Standalone Shelf')}
				</div>,
				...standaloneLayouts,
				<div className="expco-header" key={`${rundownPlaylist._id}layoutsheader1`}>
					{t('Timeline views')}
				</div>,
				...shelfLayouts,
				<Link
					to={getRundownPlaylistLink(rundownPlaylist._id)}
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

		render() {
			const { t, rundownPlaylist } = this.props
			const labelFirstShowStyle = `${rundownPlaylist.showStyles[0].baseName} - ${rundownPlaylist.showStyles[0].variantName}`
			const userCanConfigure = getAllowConfigure()

			return (
				<React.Fragment>
					<tr className="rundown-list-item">
						<th className="rundown-list-item__name">
							{rundownPlaylist.active ? (
								<Tooltip overlay={t('This rundown is currently active')} visible={getHelpMode()} placement="bottom">
									<div className="origo-pulse small right mrs">
										<div className="pulse-marker">
											<div className="pulse-rays"></div>
											<div className="pulse-rays delay"></div>
										</div>
									</div>
								</Tooltip>
							) : null}
							<Link to={getRundownPlaylistLink(rundownPlaylist._id)}>{rundownPlaylist.name}</Link>
						</th>
						<td className="rundown-list-item__studio">
							{userCanConfigure ? (
								<Link to={getStudioLink(rundownPlaylist.studioId)}>{rundownPlaylist.studioName}</Link>
							) : (
								rundownPlaylist.studioName
							)}
						</td>
						<td className="rundown-list-item__showStyle">
							{userCanConfigure ? (
								rundownPlaylist.showStyles.length === 1 ? (
									<Link to={getShowStyleBaseLink(rundownPlaylist.showStyles[0].id)}>{labelFirstShowStyle}</Link>
								) : (
									t('Multiple ({{count}})', { count: rundownPlaylist.showStyles.length })
								)
							) : rundownPlaylist.showStyles.length === 1 ? (
								labelFirstShowStyle
							) : (
								t('Multiple ({{count}})', { count: rundownPlaylist.showStyles.length })
							)}
						</td>
						<td className="rundown-list-item__created">
							<MomentFromNow>{rundownPlaylist.created}</MomentFromNow>
						</td>
						<td className="rundown-list-item__airTime">
							{rundownPlaylist.expectedStart && (
								<Moment format="YYYY/MM/DD HH:mm:ss">{rundownPlaylist.expectedStart}</Moment>
							)}
						</td>
						<td className="rundown-list-item__duration">
							{rundownPlaylist.expectedDuration &&
								RundownUtils.formatDiffToTimecode(rundownPlaylist.expectedDuration, false, false, true, false, true)}
						</td>
						<td className="rundown-list-item__status">{rundownPlaylist.rundownStatus}</td>
						<td className="rundown-list-item__air-status">{rundownPlaylist.rundownAirStatus}</td>
						<td className="rundown-list-item__views">{this.renderViewLinks()}</td>
						<td className="rundown-list-item__actions">
							{rundownPlaylist.unsyncedRundowns.length > 0 || getAllowConfigure() || getAllowService() ? (
								<Tooltip overlay={t('Delete')} placement="top">
									<button className="action-btn" onClick={() => this.confirmDeleteRundownPlaylist(rundownPlaylist)}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
								</Tooltip>
							) : null}
							{rundownPlaylist.unsyncedRundowns.length > 0 ? (
								<Tooltip overlay={t('Re-sync all rundowns in playlist')} placement="top">
									<button className="action-btn" onClick={() => this.confirmReSyncRundownPlaylist(rundownPlaylist)}>
										<FontAwesomeIcon icon={faSync} />
									</button>
								</Tooltip>
							) : null}
						</td>
					</tr>
					{rundownPlaylist.startedPlayback !== undefined &&
						rundownPlaylist.expectedDuration !== undefined &&
						rundownPlaylist.active && (
							<tr className="hl expando-addon">
								<td colSpan={10}>
									<ActiveProgressBar rundownPlaylist={rundownPlaylist} />
								</td>
							</tr>
						)}
				</React.Fragment>
			)
		}
	}
)
