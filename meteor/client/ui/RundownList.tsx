import Tooltip from 'rc-tooltip'
import * as React from 'react'
import { PubSub } from '../../lib/api/pubsub'
import { GENESIS_SYSTEM_VERSION } from '../../lib/collections/CoreSystem'
import { RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { Rundown } from '../../lib/collections/Rundowns'
import { getAllowConfigure, getHelpMode } from '../lib/localStorage'
import { extendMandadory, unprotectString } from '../../lib/lib'
import { useSubscription, useTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../lib/Spinner'
import { GettingStarted } from './RundownList/GettingStarted'
import { RegisterHelp } from './RundownList/RegisterHelp'
import { RundownDropZone } from './RundownList/RundownDropZone'
import { RundownListFooter } from './RundownList/RundownListFooter'
import RundownPlaylistDragLayer from './RundownList/RundownPlaylistDragLayer'
import { RundownPlaylistUi } from './RundownList/RundownPlaylistUi'
import { RundownLayoutsAPI } from '../../lib/api/rundownLayouts'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { UIStudios } from './Collections'
import {
	getCoreSystem,
	RundownLayouts,
	RundownPlaylists,
	Rundowns,
	ShowStyleBases,
	ShowStyleVariants,
} from '../collections'
import { RundownPlaylistCollectionUtil } from '../../lib/collections/rundownPlaylistUtil'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'

export enum ToolTipStep {
	TOOLTIP_START_HERE = 'TOOLTIP_START_HERE',
	TOOLTIP_RUN_MIGRATIONS = 'TOOLTIP_RUN_MIGRATIONS',
	TOOLTIP_EXTRAS = 'TOOLTIP_EXTRAS',
}

export function RundownList(): JSX.Element {
	const { t } = useTranslation()

	const playlistIds = useTracker(
		() =>
			RundownPlaylists.find(undefined, {
				projection: {
					_id: 1,
				},
			}).map((doc) => doc._id),
		[],
		[]
	)

	const showStyleBaseIds = useTracker(
		() =>
			Rundowns.find({ playlistId: { $in: playlistIds } }, { projection: { _id: 1 } }).map((doc) => doc.showStyleBaseId),
		[playlistIds],
		[]
	)

	const showStyleVariantIds = useTracker(
		() =>
			Rundowns.find({ playlistId: { $in: playlistIds } }, { projection: { _id: 1 } }).map(
				(doc) => doc.showStyleVariantId
			),
		[playlistIds],
		[]
	)

	const baseSubsReady = [
		useSubscription(PubSub.rundownPlaylists, {}),
		useSubscription(PubSub.uiStudio, null),
		useSubscription(PubSub.rundownLayouts, {}),

		useSubscription(PubSub.rundowns, playlistIds, null),

		useSubscription(PubSub.showStyleBases, {
			_id: { $in: showStyleBaseIds },
		}),

		useSubscription(PubSub.showStyleVariants, {
			_id: { $in: showStyleVariantIds },
		}),
	].reduce((prev, current) => prev && current, true)

	const [subsReady, setSubsReady] = useState(false)

	useEffect(() => {
		if (baseSubsReady) setSubsReady(true)
	}, [baseSubsReady])

	const coreSystem = useTracker(() => getCoreSystem(), [])
	const studios = useTracker(() => UIStudios.find().fetch(), [], [])
	const rundownLayouts = useTracker(
		() =>
			RundownLayouts.find({
				$or: [{ exposeAsSelectableLayout: true }, { exposeAsStandalone: true }],
			}).fetch(),
		[],
		[]
	)
	const rundownPlaylists = useTracker(
		() =>
			RundownPlaylists.find({}, { sort: { created: -1 } }).map((playlist: RundownPlaylist) => {
				const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)

				const airStatuses: string[] = []
				const statuses: string[] = []
				const unsyncedRundowns: Rundown[] = []
				const showStyles: RundownPlaylistUi['showStyles'] = []

				for (const rundown of rundowns) {
					airStatuses.push(String(rundown.airStatus))
					statuses.push(String(rundown.status))

					if (rundown.orphaned) {
						unsyncedRundowns.push(rundown)
					}

					const showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId, {
						projection: { _id: 1, name: 1 },
					}) as Pick<ShowStyleBase, '_id' | 'name'>
					if (showStyleBase) {
						const showStyleVariant = ShowStyleVariants.findOne(rundown.showStyleVariantId, {
							projection: { _id: 1, name: 1 },
						}) as Pick<ShowStyleVariant, '_id' | 'name'>

						showStyles.push({
							id: showStyleBase._id,
							baseName: showStyleBase.name || undefined,
							variantName: (showStyleVariant && showStyleVariant.name) ?? undefined,
						})
					}
				}

				return extendMandadory<RundownPlaylist, RundownPlaylistUi>(playlist, {
					rundowns,
					unsyncedRundowns,
					showStyles,
					rundownAirStatus: airStatuses.join(', '),
					rundownStatus: statuses.join(', '),
					studioName: studios.find((s) => s._id === playlist.studioId)?.name || '',
				})
			}),
		[studios],
		[]
	)

	const step = useMemo(() => {
		let gotPlaylists = false

		for (const playlist of rundownPlaylists) {
			if (playlist.unsyncedRundowns.length > -1) {
				gotPlaylists = true
				break
			}
		}

		if (coreSystem?.version === GENESIS_SYSTEM_VERSION && gotPlaylists === true) {
			return getAllowConfigure() ? ToolTipStep.TOOLTIP_RUN_MIGRATIONS : ToolTipStep.TOOLTIP_START_HERE
		} else {
			return ToolTipStep.TOOLTIP_EXTRAS
		}
	}, [coreSystem, rundownPlaylists])

	const showGettingStarted = coreSystem?.version === GENESIS_SYSTEM_VERSION && rundownPlaylists.length === 0

	function renderRundownPlaylists() {
		if (rundownPlaylists.length < 1) {
			return <p>{t('There are no rundowns ingested into Sofie.')}</p>
		}

		return (
			<ul className="rundown-playlists">
				{rundownPlaylists.map((playlist) => (
					<RundownPlaylistUi key={unprotectString(playlist._id)} playlist={playlist} rundownLayouts={rundownLayouts} />
				))}
			</ul>
		)
	}

	return (
		<>
			{coreSystem ? <RegisterHelp step={step} /> : null}

			{showGettingStarted === true ? <GettingStarted step={step} /> : null}

			<section className="mtl gutter has-statusbar">
				<header className="mvs">
					<h1>{t('Rundowns')}</h1>
				</header>
				{subsReady ? (
					<section className="mod mvl rundown-list">
						<header className="rundown-list__header">
							<span className="rundown-list-item__name">
								<Tooltip
									overlay={t('Click on a rundown to control your studio')}
									visible={getHelpMode()}
									placement="top"
								>
									<span>{t('Rundown')}</span>
								</Tooltip>
							</span>
							{/* <span className="rundown-list-item__problems">{t('Problems')}</span> */}
							<span>{t('Show Style')}</span>
							<span>{t('On Air Start Time')}</span>
							<span>{t('Duration')}</span>
							{rundownPlaylists.some(
								(p) =>
									!!PlaylistTiming.getExpectedEnd(p.timing) ||
									p.rundowns.some((r) => PlaylistTiming.getExpectedEnd(r.timing))
							) && <span>{t('Expected End Time')}</span>}
							<span>{t('Last updated')}</span>
							{rundownLayouts.some(
								(l) =>
									(RundownLayoutsAPI.isLayoutForShelf(l) && l.exposeAsStandalone) ||
									(RundownLayoutsAPI.isLayoutForRundownView(l) && l.exposeAsSelectableLayout)
							) && <span>{t('View Layout')}</span>}
							<span>&nbsp;</span>
						</header>
						{renderRundownPlaylists()}
						<footer>
							<RundownDropZone />
						</footer>
						<RundownPlaylistDragLayer />
					</section>
				) : (
					<Spinner />
				)}
			</section>

			<RundownListFooter />
		</>
	)
}
