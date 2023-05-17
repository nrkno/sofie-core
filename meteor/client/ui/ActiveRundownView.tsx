import React, { useEffect } from 'react'
import { NavLink, Route, Switch, useRouteMatch } from 'react-router-dom'
import { useSubscription, useTracker } from '../lib/ReactMeteorData/ReactMeteorData'

import { Spinner } from '../lib/Spinner'
import { RundownView } from './RundownView'
import { PubSub } from '../../lib/api/pubsub'
import { UIStudios } from './Collections'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylists } from '../collections'
import { useTranslation } from 'react-i18next'

export function ActiveRundownView({ studioId }: { studioId: StudioId }): JSX.Element | null {
	const { t } = useTranslation()

	const { path } = useRouteMatch()

	const studioReady = useSubscription(PubSub.uiStudio, studioId)
	const playlistReady = useSubscription(PubSub.rundownPlaylists, {
		activationId: { $exists: true },
		studioId,
	})

	const subsReady = studioReady && playlistReady

	const studio = useTracker(() => UIStudios.findOne(studioId), [studioId])
	const playlist = useTracker(
		() =>
			RundownPlaylists.findOne({
				activationId: { $exists: true },
				studioId,
			}),
		[studioId]
	)

	useEffect(() => {
		document.body.classList.add('dark', 'vertical-overflow-only')

		return () => {
			document.body.classList.remove('dark', 'vertical-overflow-only')
		}
	}, [playlist])

	if (!subsReady) {
		return (
			<div className="rundown-view rundown-view--loading">
				<Spinner />
			</div>
		)
	} else {
		if (playlist) {
			return (
				<Switch>
					<Route path={`${path}`} exact>
						<RundownView playlistId={playlist._id} inActiveRundownView={true} />
					</Route>
					<Route path={`${path}/shelf`} exact>
						<RundownView playlistId={playlist._id} inActiveRundownView={true} onlyShelf={true} />
					</Route>
				</Switch>
			)
		} else if (studio) {
			return <NotFoundMessage message={t('There is no rundown active in this studio.')} />
		} else if (studioId) {
			return <NotFoundMessage message={t("This studio doesn't exist.")} />
		} else {
			return <NotFoundMessage message={t('There are no active rundowns.')} />
		}
	}
}

function NotFoundMessage({ message }: { message: string }) {
	const { t } = useTranslation()

	return (
		<div className="rundown-view rundown-view--unpublished">
			<div className="rundown-view__label">
				<p>{message}</p>
				<p>
					<NavLink to="/rundowns" className="btn btn-primary">
						{t('Return to list')}
					</NavLink>
				</p>
			</div>
		</div>
	)
}
