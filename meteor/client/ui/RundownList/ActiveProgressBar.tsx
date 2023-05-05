import React from 'react'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { useCurrentTime } from '../../lib/lib'

export function ActiveProgressBar({ rundownPlaylist }: { rundownPlaylist: RundownPlaylist }): JSX.Element | null {
	const currentTime = useCurrentTime()

	const { startedPlayback, timing } = rundownPlaylist
	const expectedDuration = PlaylistTiming.getExpectedDuration(timing)
	if (startedPlayback && expectedDuration) {
		const progress = Math.min(((currentTime - startedPlayback) / expectedDuration) * 100, 100)

		return (
			<div className="progress-bar">
				<div className="pb-indicator" style={{ width: `${progress}%` }} />
			</div>
		)
	}

	return null
}
