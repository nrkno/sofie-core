import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
import Tooltip from 'rc-tooltip'
import timer from 'react-timer-hoc'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import Moment from 'react-moment'
import { RundownUtils } from '../lib/rundown'
import { getCurrentTime, literal, unprotectString } from '../../lib/lib'
import { MomentFromNow } from '../lib/Moment'
import { faTrash, faSync, IconName } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { doModalDialog } from '../lib/ModalDialog'
import { StatusResponse } from '../../lib/api/systemStatus'
import { ManualPlayout } from './manualPlayout'
import { getAllowDeveloper, getAllowConfigure, getAllowService, getHelpMode } from '../lib/localStorage'
import { doUserAction, UserAction } from '../lib/userAction'
import { getCoreSystem, ICoreSystem, GENESIS_SYSTEM_VERSION } from '../../lib/collections/CoreSystem'
import { NotificationCenter, Notification, NoticeLevel, NotificationAction } from '../lib/notifications/notifications'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { ShowStyleBases, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { PubSub } from '../../lib/api/pubsub'
import { ReactNotification } from '../lib/notifications/ReactNotification'
import { Spinner } from '../lib/Spinner'
import { MeteorCall } from '../../lib/api/methods'
import { SplitDropdown } from '../lib/SplitDropdown'
import { RundownLayoutBase, RundownLayouts } from '../../lib/collections/RundownLayouts'
import { UIStateStorage } from '../lib/UIStateStorage'
import ClassNames from 'classnames'
import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { Settings } from '../../lib/Settings'

const PackageInfo = require('../../package.json')

interface RundownPlaylistUi extends RundownPlaylist {
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

export class RundownListItem extends React.Component<Translated<IRundownListItemProps>, IRundownListItemState> {
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

	private getRundownPlaylistLink(rundownPlaylistId: RundownPlaylistId) {
		// double encoding so that "/" are handled correctly
		return '/rundown/' + encodeURIComponent(encodeURIComponent(unprotectString(rundownPlaylistId)))
	}
	private getStudioLink(studioId: StudioId) {
		// double encoding so that "/" are handled correctly
		return '/settings/studio/' + encodeURIComponent(encodeURIComponent(unprotectString(studioId)))
	}
	private getShowStyleBaseLink(showStyleBaseId: ShowStyleBaseId) {
		// double encoding so that "/" are handled correctly
		return '/settings/showStyleBase/' + encodeURIComponent(encodeURIComponent(unprotectString(showStyleBaseId)))
	}
	private getShelfLink(rundownId, layoutId) {
		// double encoding so that "/" are handled correctly
		return (
			'/rundown/' +
			encodeURIComponent(encodeURIComponent(rundownId)) +
			'/shelf/?layout=' +
			encodeURIComponent(encodeURIComponent(layoutId))
		)
	}
	private getRundownWithLayoutLink(rundownId, layoutId) {
		// double encoding so that "/" are handled correctly
		return (
			'/rundown/' +
			encodeURIComponent(encodeURIComponent(rundownId)) +
			'?layout=' +
			encodeURIComponent(encodeURIComponent(layoutId))
		)
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
		const { t } = this.props
		const standaloneLayouts = this.props.rundownLayouts
			.filter(
				(layout) =>
					layout.exposeAsStandalone &&
					this.props.rundownPlaylist.showStyles.some((s) => s.id === layout.showStyleBaseId)
			)
			.map((layout) => {
				return this.renderViewLinkItem(
					layout,
					this.getShelfLink(this.props.rundownPlaylist._id, layout._id),
					`standalone${layout._id}`
				)
			})
		const shelfLayouts = this.props.rundownLayouts
			.filter(
				(layout) =>
					layout.exposeAsShelf && this.props.rundownPlaylist.showStyles.some((s) => s.id === layout.showStyleBaseId)
			)
			.map((layout) => {
				return this.renderViewLinkItem(
					layout,
					this.getRundownWithLayoutLink(this.props.rundownPlaylist._id, layout._id),
					`shelf${layout._id}`
				)
			})
		const allElements = [
			<div className="expco-header" key={`${this.props.rundownPlaylist._id}layoutsheader2`}>
				{t('Standalone Shelf')}
			</div>,
			...standaloneLayouts,
			<div className="expco-header" key={`${this.props.rundownPlaylist._id}layoutsheader1`}>
				{t('Timeline views')}
			</div>,
			...shelfLayouts,
			<Link
				to={this.getRundownPlaylistLink(this.props.rundownPlaylist._id)}
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
		const { t } = this.props
		return (
			<React.Fragment>
				<tr className="rundown-list-item">
					<th className="rundown-list-item__name">
						{this.props.rundownPlaylist.active ? (
							<Tooltip overlay={t('This rundown is currently active')} visible={getHelpMode()} placement="bottom">
								<div className="origo-pulse small right mrs">
									<div className="pulse-marker">
										<div className="pulse-rays"></div>
										<div className="pulse-rays delay"></div>
									</div>
								</div>
							</Tooltip>
						) : null}
						<Link to={this.getRundownPlaylistLink(this.props.rundownPlaylist._id)}>
							{this.props.rundownPlaylist.name}
						</Link>
					</th>
					<td className="rundown-list-item__studio">
						{getAllowConfigure() ? (
							<Link to={this.getStudioLink(this.props.rundownPlaylist.studioId)}>
								{this.props.rundownPlaylist.studioName}
							</Link>
						) : (
							this.props.rundownPlaylist.studioName
						)}
					</td>
					<td className="rundown-list-item__showStyle">
						{getAllowConfigure() ? (
							this.props.rundownPlaylist.showStyles.length === 1 ? (
								<Link
									to={this.getShowStyleBaseLink(
										this.props.rundownPlaylist.showStyles[0].id
									)}>{`${this.props.rundownPlaylist.showStyles[0].baseName} - ${this.props.rundownPlaylist.showStyles[0].variantName}`}</Link>
							) : (
								t('Multiple ({{count}})', { count: this.props.rundownPlaylist.showStyles.length })
							)
						) : this.props.rundownPlaylist.showStyles.length === 1 ? (
							`${this.props.rundownPlaylist.showStyles[0].baseName} - ${this.props.rundownPlaylist.showStyles[0].variantName}`
						) : (
							t('Multiple ({{count}})', { count: this.props.rundownPlaylist.showStyles.length })
						)}
					</td>
					<td className="rundown-list-item__created">
						<MomentFromNow>{this.props.rundownPlaylist.created}</MomentFromNow>
					</td>
					<td className="rundown-list-item__airTime">
						{this.props.rundownPlaylist.expectedStart && (
							<Moment format="YYYY/MM/DD HH:mm:ss">{this.props.rundownPlaylist.expectedStart}</Moment>
						)}
					</td>
					<td className="rundown-list-item__duration">
						{this.props.rundownPlaylist.expectedDuration &&
							RundownUtils.formatDiffToTimecode(
								this.props.rundownPlaylist.expectedDuration,
								false,
								false,
								true,
								false,
								true
							)}
					</td>
					<td className="rundown-list-item__status">{this.props.rundownPlaylist.rundownStatus}</td>
					<td className="rundown-list-item__air-status">{this.props.rundownPlaylist.rundownAirStatus}</td>
					<td className="rundown-list-item__views">{this.renderViewLinks()}</td>
					<td className="rundown-list-item__actions">
						{this.props.rundownPlaylist.unsyncedRundowns.length > 0 || getAllowConfigure() || getAllowService() ? (
							<Tooltip overlay={t('Delete')} placement="top">
								<button
									className="action-btn"
									onClick={() => this.confirmDeleteRundownPlaylist(this.props.rundownPlaylist)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</Tooltip>
						) : null}
						{this.props.rundownPlaylist.unsyncedRundowns.length > 0 ? (
							<Tooltip overlay={t('Re-sync all rundowns in playlist')} placement="top">
								<button
									className="action-btn"
									onClick={() => this.confirmReSyncRundownPlaylist(this.props.rundownPlaylist)}>
									<FontAwesomeIcon icon={faSync} />
								</button>
							</Tooltip>
						) : null}
					</td>
				</tr>
				{this.props.rundownPlaylist.startedPlayback !== undefined &&
					this.props.rundownPlaylist.expectedDuration !== undefined &&
					this.props.rundownPlaylist.active && (
						<tr className="hl expando-addon">
							<td colSpan={8}>
								<ActiveProgressBar rundownPlaylist={this.props.rundownPlaylist} />
							</td>
						</tr>
					)}
			</React.Fragment>
		)
	}
}

enum ToolTipStep {
	TOOLTIP_START_HERE = 'TOOLTIP_START_HERE',
	TOOLTIP_RUN_MIGRATIONS = 'TOOLTIP_RUN_MIGRATIONS',
	TOOLTIP_EXTRAS = 'TOOLTIP_EXTRAS',
}

interface IRundownsListProps {
	coreSystem: ICoreSystem
	rundownPlaylists: Array<RundownPlaylistUi>
	rundownLayouts: Array<RundownLayoutBase>
}

interface IRundownsListState {
	systemStatus?: StatusResponse
	subsReady: boolean
}

export const RundownList = translateWithTracker(() => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	const studios = Studios.find().fetch()
	const showStyleBases = ShowStyleBases.find().fetch()
	const showStyleVariants = ShowStyleVariants.find().fetch()
	const rundownLayouts = RundownLayouts.find({
		$or: [{ exposeAsStandalone: true }, { exposeAsShelf: true }],
	}).fetch()

	return {
		coreSystem: getCoreSystem(),
		rundownPlaylists: RundownPlaylists.find({}, { sort: { created: -1 } })
			.fetch()
			.map((playlist: RundownPlaylistUi) => {
				const rundownsInPlaylist = playlist.getRundowns()
				playlist.rundownAirStatus = rundownsInPlaylist.map((rundown) => rundown.airStatus).join(', ')
				playlist.rundownStatus = rundownsInPlaylist.map((rundown) => rundown.status).join(', ')
				playlist.unsyncedRundowns = rundownsInPlaylist.filter((rundown) => rundown.unsynced)

				const studio = _.find(studios, (s) => s._id === playlist.studioId)

				playlist.studioName = (studio && studio.name) || ''
				playlist.showStyles = _.compact(
					_.uniq(
						rundownsInPlaylist.map((rundown) => [rundown.showStyleBaseId, rundown.showStyleVariantId]),
						false,
						(ids) => ids[0] + '_' + ids[1]
					).map((combo) => {
						const showStyleBase = _.find(showStyleBases, (style) => style._id === combo[0])
						const showStyleVariant = _.find(showStyleVariants, (variant) => variant._id === combo[1])

						if (showStyleBase) {
							return {
								id: showStyleBase._id,
								baseName: showStyleBase.name || undefined,
								variantName: (showStyleVariant && showStyleVariant.name) || undefined,
							}
						} else {
							return undefined
						}
					})
				)
				return playlist
			}),
		rundownLayouts,
	}
})(
	class RundownList extends MeteorReactComponent<Translated<IRundownsListProps>, IRundownsListState> {
		// private _subscriptions: Array<Meteor.SubscriptionHandle> = []

		constructor(props) {
			super(props)

			this.state = {
				subsReady: false,
			}
		}

		tooltipStep() {
			const syncedRundownPlaylists = this.props.rundownPlaylists.filter(
				(rundownPlaylist) => rundownPlaylist.unsyncedRundowns.length === 0
			)
			const unsyncedRundownPlaylists = this.props.rundownPlaylists.filter(
				(rundownPlaylist) => rundownPlaylist.unsyncedRundowns.length > 0
			)

			if (
				this.props.coreSystem &&
				this.props.coreSystem.version === GENESIS_SYSTEM_VERSION &&
				syncedRundownPlaylists.length === 0 &&
				unsyncedRundownPlaylists.length === 0
			) {
				if (getAllowConfigure()) {
					return ToolTipStep.TOOLTIP_RUN_MIGRATIONS
				} else {
					return ToolTipStep.TOOLTIP_START_HERE
				}
			} else {
				return ToolTipStep.TOOLTIP_EXTRAS
			}
		}

		componentDidMount() {
			const { t } = this.props

			// Subscribe to data:
			this.subscribe(PubSub.rundownPlaylists, {})
			this.subscribe(PubSub.studios, {})
			this.subscribe(PubSub.rundownLayouts, {})

			this.autorun(() => {
				const showStyleBaseIds = _.uniq(_.map(Rundowns.find().fetch(), (rundown) => rundown.showStyleBaseId))
				const showStyleVariantIds = _.uniq(_.map(Rundowns.find().fetch(), (rundown) => rundown.showStyleVariantId))
				const playlistIds = _.uniq(
					RundownPlaylists.find()
						.fetch()
						.map((i) => i._id)
				)

				this.subscribe(PubSub.showStyleBases, {
					_id: { $in: showStyleBaseIds },
				})
				this.subscribe(PubSub.showStyleVariants, {
					_id: { $in: showStyleVariantIds },
				})
				this.subscribe(PubSub.rundowns, {
					playlistId: { $in: playlistIds },
				})
			})

			this.autorun(() => {
				let subsReady = this.subscriptionsReady()
				if (subsReady !== this.state.subsReady) {
					this.setState({
						subsReady: subsReady,
					})
				}
			})

			MeteorCall.systemStatus
				.getSystemStatus()
				.then((systemStatus: StatusResponse) => {
					this.setState({ systemStatus })
				})
				.catch(() => {
					NotificationCenter.push(
						new Notification(
							'systemStatus_failed',
							NoticeLevel.CRITICAL,
							t('Could not get system status. Please consult system administrator.'),
							'RundownList'
						)
					)
				})
		}

		registerHelp() {
			const { t } = this.props

			const step = this.tooltipStep()

			return (
				<React.Fragment>
					{step === ToolTipStep.TOOLTIP_START_HERE ? (
						<ReactNotification
							actions={[
								literal<NotificationAction>({
									label: 'Enable',
									action: () => {
										window.location.assign('/?configure=1')
									},
									type: 'button',
								}),
							]}>
							{t('Enable configuration mode by adding ?configure=1 to the address bar.')}
						</ReactNotification>
					) : (
						undefined
					)}
					{step === ToolTipStep.TOOLTIP_START_HERE || step === ToolTipStep.TOOLTIP_RUN_MIGRATIONS ? (
						<ReactNotification
							actions={[
								literal<NotificationAction>({
									label: 'Go to migrations',
									action: () => {
										window.location.assign('/settings/tools/migration')
									},
									type: 'button',
								}),
							]}>
							{t('You need to run migrations to set the system up for operation.')}
						</ReactNotification>
					) : (
						undefined
					)}
					{/* !this.props.rundowns.length ?
				<ReactNotification>{t('Add rundowns by connecting a gateway.')}</ReactNotification>
				: undefined
			*/}
					{/* this.state.systemStatus && this.state.systemStatus.status === 'FAIL' ?
				<ReactNotification>{t('Check system status messages.')}</ReactNotification>
				: undefined
			*/}
				</React.Fragment>
			)
		}

		renderRundowns(list: RundownPlaylistUi[]) {
			const { t, i18n, tReady } = this.props

			return list.length > 0 ? (
				list.map((rundownPlaylist) => (
					<RundownListItem
						key={unprotectString(rundownPlaylist._id)}
						rundownPlaylist={rundownPlaylist}
						rundownLayouts={this.props.rundownLayouts}
						{...{ t, i18n, tReady }}
					/>
				))
			) : (
				<tr>
					<td colSpan={9}>{t('There are no rundowns ingested into Sofie.')}</td>
				</tr>
			)
		}

		render() {
			const { t } = this.props

			const syncedRundownPlaylists = this.props.rundownPlaylists.filter(
				(rundownPlaylist) => rundownPlaylist.unsyncedRundowns.length === 0
			)
			const unsyncedRundownPlaylists = this.props.rundownPlaylists.filter(
				(rundownPlaylist) => rundownPlaylist.unsyncedRundowns.length > 0
			)

			return (
				<React.Fragment>
					{this.props.coreSystem ? this.registerHelp() : null}
					{this.props.coreSystem &&
					this.props.coreSystem.version === GENESIS_SYSTEM_VERSION &&
					syncedRundownPlaylists.length === 0 &&
					unsyncedRundownPlaylists.length === 0 ? (
						<div className="mtl gutter has-statusbar">
							<h1>{t('Getting Started')}</h1>
							<div>
								<ul>
									<li>
										{t('Start with giving this browser configuration permissions by adding this to the URL: ')}&nbsp;
										<Tooltip
											overlay={t('Start Here!')}
											visible={this.tooltipStep() === ToolTipStep.TOOLTIP_START_HERE}
											placement="top">
											<a href="?configure=1">?configure=1</a>
										</Tooltip>
									</li>
									<li>
										{t('Then, run the migrations script:')}&nbsp;
										<Tooltip
											overlay={t('Run Migrations to get set up')}
											visible={this.tooltipStep() === ToolTipStep.TOOLTIP_RUN_MIGRATIONS}
											placement="bottom">
											<a href="/settings/tools/migration">{t('Migrations')}</a>
										</Tooltip>
									</li>
								</ul>
								{t('Documentation is available at')}&nbsp;
								<a href="https://github.com/nrkno/Sofie-TV-automation/">
									https://github.com/nrkno/Sofie-TV-automation/
								</a>
							</div>
						</div>
					) : null}
					<div className="mtl gutter has-statusbar">
						<header className="mvs">
							<h1>{t('Rundowns')}</h1>
						</header>
						{this.state.subsReady ? (
							<div className="mod mvl">
								<table className="table system-status-table expando expando-tight">
									<thead>
										<tr className="hl">
											<th className="c3">
												<Tooltip
													overlay={t('Click on a rundown to control your studio')}
													visible={getHelpMode()}
													placement="top">
													<span>{t('Rundown')}</span>
												</Tooltip>
											</th>
											<th className="c2">{t('Studio')}</th>
											<th className="c2">{t('Show style')}</th>
											<th className="c2">{t('Created')}</th>
											<th className="c2">{t('On Air Start Time')}</th>
											<th className="c1">{t('Duration')}</th>
											<th className="c1">{t('Status')}</th>
											<th className="c1">{t('Air Status')}</th>
											<th className="c1">&nbsp;</th>
											<th className="c1">&nbsp;</th>
										</tr>
									</thead>
									<tbody>{this.renderRundowns(syncedRundownPlaylists)}</tbody>
									{unsyncedRundownPlaylists.length > 0 && (
										<tbody>
											<tr className="hl">
												<th colSpan={9} className="pvn phn">
													<h2 className="mtm mbs mhn">
														{t('Unsynced from {{nrcsName}}', { nrcsName: Settings.nrcsName })}
													</h2>
												</th>
											</tr>
										</tbody>
									)}
									{unsyncedRundownPlaylists.length > 0 && (
										<tbody>{this.renderRundowns(unsyncedRundownPlaylists)}</tbody>
									)}
								</table>
							</div>
						) : (
							<Spinner />
						)}
					</div>
					<div className="mtl gutter version-info">
						<p>
							{t('Sofie Automation')} {t('version')}: {PackageInfo.versionExtended || PackageInfo.version || 'UNSTABLE'}
						</p>
						<div>
							{this.state.systemStatus ? (
								<React.Fragment>
									<div>
										{t('System Status')}:&nbsp;
										<Tooltip
											overlay={t('System has issues which need to be resolved')}
											visible={this.state.systemStatus.status === 'FAIL' && getHelpMode()}
											placement="top">
											<span>{this.state.systemStatus.status}</span>
										</Tooltip>
										&nbsp;/&nbsp;{this.state.systemStatus._internal.statusCodeString}
									</div>
									<div>
										{this.state.systemStatus._internal.messages.length ? (
											<div>
												{t('Status Messages:')}
												<ul>
													{_.map(this.state.systemStatus._internal.messages, (message, i) => {
														// console.log(message)
														return <li key={i}>{message}</li>
													})}
												</ul>
											</div>
										) : null}
									</div>
								</React.Fragment>
							) : null}
						</div>
						{getAllowDeveloper() ? <ManualPlayout></ManualPlayout> : null}
					</div>
				</React.Fragment>
			)
		}
	}
)

interface IActiveProgressBarProps {
	rundownPlaylist: RundownPlaylist
}

const ActiveProgressBar = timer(1000)(
	class ActiveProgressBar extends React.Component<IActiveProgressBarProps> {
		render() {
			return this.props.rundownPlaylist.startedPlayback && this.props.rundownPlaylist.expectedDuration ? (
				<div className="progress-bar">
					<div
						className="pb-indicator"
						style={{
							width:
								Math.min(
									((getCurrentTime() - this.props.rundownPlaylist.startedPlayback) /
										this.props.rundownPlaylist.expectedDuration) *
										100,
									100
								) + '%',
						}}
					/>
				</div>
			) : null
		}
	}
)
