import Tooltip from 'rc-tooltip'
import * as React from 'react'
import * as _ from 'underscore'
import { MeteorCall } from '../../lib/api/methods'
import { PubSub } from '../../lib/api/pubsub'
import { StatusResponse } from '../../lib/api/systemStatus'
import { GENESIS_SYSTEM_VERSION, getCoreSystem, ICoreSystem } from '../../lib/collections/CoreSystem'
import { RundownLayoutBase, RundownLayouts } from '../../lib/collections/RundownLayouts'
import { RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { Rundowns } from '../../lib/collections/Rundowns'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { Studios } from '../../lib/collections/Studios'
import { literal, unprotectString } from '../../lib/lib'
import { languageOr } from '../lib/language'
import { getAllowConfigure, getHelpMode } from '../lib/localStorage'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { NoticeLevel, Notification, NotificationAction, NotificationCenter } from '../lib/notifications/notifications'
import { ReactNotification } from '../lib/notifications/ReactNotification'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../lib/Spinner'
import { RundownListFooter } from './RundownList/RundownListFooter'
import { RundownListItem, RundownPlaylistUi } from './RundownList/RundownListItem'

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
				const airStatuses: string[] = []
				const statuses: string[] = []
				playlist.unsyncedRundowns = []
				playlist.showStyles = []

				for (const rundown of rundownsInPlaylist) {
					airStatuses.push(String(rundown.airStatus))
					statuses.push(String(rundown.status))

					if (rundown.unsynced) {
						playlist.unsyncedRundowns.push(rundown)
					}

					const showStyleBase = showStyleBases.find((style) => style._id === rundown.showStyleBaseId)
					if (showStyleBase) {
						const showStyleVariant = showStyleVariants.find((variant) => variant._id === rundown.showStyleVariantId)

						playlist.showStyles.push({
							id: showStyleBase._id,
							baseName: showStyleBase.name || undefined,
							variantName: (showStyleVariant && showStyleVariant.name) || undefined,
						})
					}
				}

				playlist.rundownAirStatus = airStatuses.join(', ')
				playlist.rundownStatus = statuses.join(', ')

				playlist.studioName = studios.find((s) => s._id === playlist.studioId)?.name || ''

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
			let gotPlaylists = false

			for (const playlist of this.props.rundownPlaylists) {
				if (playlist.unsyncedRundowns.length > -1) {
					gotPlaylists = true
					break
				}
			}

			if (this.props.coreSystem?.version === GENESIS_SYSTEM_VERSION && gotPlaylists === true) {
				return getAllowConfigure() ? ToolTipStep.TOOLTIP_RUN_MIGRATIONS : ToolTipStep.TOOLTIP_START_HERE
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
				const showStyleBaseIds: Set<string> = new Set()
				const showStyleVariantIds: Set<string> = new Set()
				const playlistIds: Set<string> = new Set(
					RundownPlaylists.find()
						.fetch()
						.map((i) => unprotectString(i._id))
				)

				for (const rundown of Rundowns.find().fetch()) {
					showStyleBaseIds.add(unprotectString(rundown.showStyleBaseId))
					showStyleVariantIds.add(unprotectString(rundown.showStyleVariantId))
				}

				this.subscribe(PubSub.showStyleBases, {
					_id: { $in: Array.from(showStyleBaseIds) },
				})
				this.subscribe(PubSub.showStyleVariants, {
					_id: { $in: Array.from(showStyleVariantIds) },
				})
				this.subscribe(PubSub.rundowns, {
					playlistId: { $in: Array.from(playlistIds) },
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
					<td colSpan={10}>{t('There are no rundowns ingested into Sofie.')}</td>
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
					{this.props.coreSystem?.version === GENESIS_SYSTEM_VERSION &&
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
												<th colSpan={10} className="pvn phn">
													<h2 className="mtm mbs mhn">
														{t('Unsynced from {{nrcsNames}}', {
															nrcsNames:
																languageOr(
																	t,
																	Array.from(
																		new Set(
																			_.flatten(
																				unsyncedRundownPlaylists.map((p) =>
																					p.unsyncedRundowns.map((r) => r.externalNRCSName)
																				)
																			)
																		)
																	)
																) || 'NRCS',
														})}
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
					{this.state.systemStatus ? <RundownListFooter systemStatus={this.state.systemStatus} /> : null}
				</React.Fragment>
			)
		}
	}
)
