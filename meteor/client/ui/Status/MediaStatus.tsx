import React from 'react'
import { MediaStatus as MediaStatusComponent } from '../MediaStatus/MediaStatus'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownPlaylists } from '../../collections'
import { PubSub } from '../../../lib/api/pubsub'

export function MediaStatus(): JSX.Element | null {
	const playlistIds = useTracker(() => RundownPlaylists.find().map((playlist) => playlist._id), [], [])

	useSubscription(PubSub.rundownPlaylists, {})

	return <MediaStatusComponent playlistIds={playlistIds} />
}
