import React, { useEffect } from 'react'
import { Clock } from '../StudioScreenSaver/Clock'
import { StudioId, Studios } from '../../../lib/collections/Studios'
import { useTracker, useSubscription } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PubSub } from '../../../lib/api/pubsub'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { getCurrentTimeReactive } from '../../lib/currentTimeReactive'
import { findNextPlaylist } from '../StudioScreenSaver/StudioScreenSaver'

export function OverlayScreenSaver({ studioId }: { studioId: StudioId }): JSX.Element {
	useEffect(() => {
		document.body.classList.add('transparent')
		return () => {
			document.body.classList.remove('transparent')
		}
	})

	useSubscription(PubSub.studios, { _id: studioId })
	useSubscription(PubSub.rundownPlaylists, { studioId: studioId, active: { $ne: true } })

	const data = useTracker(() => findNextPlaylist({ studioId }), [studioId])

	return (
		<div className="clocks-overlay">
			<div className="clocks-half clocks-bottom">
				<div className="clocks-current-segment-countdown clocks-segment-countdown"></div>
				<div className="clocks-studio-name">{data?.studio?.name ?? null}</div>
				<div className="clocks-next-rundown">{data?.rundownPlaylist?.name ?? null}</div>
				<Clock className="clocks-time-now" />
			</div>
		</div>
	)
}
