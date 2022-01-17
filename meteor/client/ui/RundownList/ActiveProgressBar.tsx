import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import React from 'react'
import timer from 'react-timer-hoc'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { getCurrentTime } from '../../../lib/lib'

export interface IActiveProgressBarProps {
	rundownPlaylist: RundownPlaylist
}

export const ActiveProgressBar = timer(1000)(
	class ActiveProgressBar extends React.Component<IActiveProgressBarProps> {
		render() {
			const { startedPlayback, timing } = this.props.rundownPlaylist
			const expectedDuration = PlaylistTiming.getExpectedDuration(timing)
			if (startedPlayback && expectedDuration) {
				const progress = Math.min(((getCurrentTime() - startedPlayback) / expectedDuration) * 100, 100)

				return (
					<div className="progress-bar">
						<div className="pb-indicator" style={{ width: `${progress}%` }} />
					</div>
				)
			}

			return null
		}
	}
)
