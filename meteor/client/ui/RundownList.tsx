import Tooltip from 'rc-tooltip'
import * as React from 'react'
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
import { unprotectString } from '../../lib/lib'
import { getAllowConfigure, getHelpMode } from '../lib/localStorage'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { NoticeLevel, Notification, NotificationCenter } from '../lib/notifications/notifications'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../lib/Spinner'
import { GettingStarted } from './RundownList/GettingStarted'
import { RegisterHelp } from './RundownList/RegisterHelp'
import { RundownListFooter } from './RundownList/RundownListFooter'
import { RundownPlaylistUi } from './RundownList/RundownPlaylistUi'

export enum ToolTipStep {
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

		renderRundowns(list: RundownPlaylistUi[]) {
			const { t, rundownLayouts } = this.props

			if (list.length < 1) {
				return (
					<tr>
						<td colSpan={10}>{t('There are no rundowns ingested into Sofie.')}</td>
					</tr>
				)
			}

			return list.map((playlist) => (
				<RundownPlaylistUi key={unprotectString(playlist._id)} playlist={playlist} rundownLayouts={rundownLayouts} />
			))
		}

		render() {
			const { t, rundownPlaylists } = this.props

			const step = this.tooltipStep()

			const showGettingStarted =
				this.props.coreSystem?.version === GENESIS_SYSTEM_VERSION && rundownPlaylists.length === 0

			return (
				<React.Fragment>
					{this.props.coreSystem ? <RegisterHelp step={step} /> : null}

					{showGettingStarted === true ? <GettingStarted step={step} /> : null}

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
									<tbody>{this.renderRundowns(rundownPlaylists)}</tbody>
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
