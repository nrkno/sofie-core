import React from 'react'
import { Switch, Route, Redirect } from 'react-router-dom'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'

import { RundownTimingProvider } from '../RundownView/RundownTiming/RundownTimingProvider'

import { PubSub } from '../../../lib/api/pubsub'
import { StudioScreenSaver } from '../StudioScreenSaver/StudioScreenSaver'
import { PresenterScreen } from './PresenterScreen'
import { OverlayScreen } from './OverlayScreen'
import { OverlayScreenSaver } from './OverlayScreenSaver'
import { RundownPlaylists } from '../../collections'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CameraScreen } from './CameraScreen'

export function ClockView({ studioId }: { studioId: StudioId }): JSX.Element {
	useSubscription(PubSub.rundownPlaylists, {
		activationId: { $exists: true },
		studioId,
	})

	const playlist = useTracker(
		() =>
			RundownPlaylists.findOne({
				activationId: { $exists: true },
				studioId,
			}),
		[studioId]
	)

	return (
		<Switch>
			<Route path="/countdowns/:studioId/presenter">
				{playlist ? (
					<RundownTimingProvider playlist={playlist}>
						<PresenterScreen playlistId={playlist._id} studioId={studioId} />
					</RundownTimingProvider>
				) : (
					<StudioScreenSaver studioId={studioId} ownBackground={true} />
				)}
			</Route>
			<Route path="/countdowns/:studioId/overlay">
				{playlist ? (
					<RundownTimingProvider playlist={playlist}>
						<OverlayScreen playlistId={playlist._id} studioId={studioId} />
					</RundownTimingProvider>
				) : (
					<OverlayScreenSaver studioId={studioId} />
				)}
			</Route>
			<Route path="/countdowns/:studioId/camera">
				<RundownTimingProvider playlist={playlist}>
					<CameraScreen playlist={playlist} studioId={studioId} />
				</RundownTimingProvider>
			</Route>
			<Route>
				<Redirect to="/" />
			</Route>
		</Switch>
	)
}
