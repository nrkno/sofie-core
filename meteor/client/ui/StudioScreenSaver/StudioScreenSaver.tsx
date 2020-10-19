import * as React from 'react'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { StudioId, Studio, Studios } from '../../../lib/collections/Studios'
import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { getCurrentTime } from '../../../lib/lib'
import { invalidateAfter } from '../../lib/invalidatingTime'
import timer from 'react-timer-hoc'

interface IProps {
	studioId: StudioId
}

interface ITrackedProps {
	studio: Studio | undefined
	rundownPlaylist: RundownPlaylist | undefined
}

export const StudioScreenSaver = translateWithTracker((props: IProps) => {
	invalidateAfter(5000)
	const now = getCurrentTime()

	return {
		studio: Studios.findOne(props.studioId),
		rundownPlaylist: RundownPlaylists.find(
			{
				studioId: props.studioId,
			},
			{
				sort: {
					expectedStart: 1,
				},
				limit: 1,
				fields: {
					name: 1,
					expectedStart: 1,
					expectedDuration: 1,
					studioId: 1,
				},
			}
		)
			.fetch()
			.find((rundownPlaylist) => {
				if (rundownPlaylist.expectedStart && rundownPlaylist.expectedStart > now) {
					// is expected to start next
					return true
				} else if (
					rundownPlaylist.expectedStart &&
					rundownPlaylist.expectedDuration &&
					rundownPlaylist.expectedStart <= now &&
					rundownPlaylist.expectedStart + rundownPlaylist.expectedDuration > now
				) {
					// should be live right now
					return true
				}
				return false
			}),
	}
})(
	timer(1000)(
		class StudioScreenSaver extends React.Component<Translated<IProps & ITrackedProps>> {
			render() {
				const { rundownPlaylist } = this.props
				const now = new Date(getCurrentTime())
				return (
					<div className="studio-screen-saver">
						<div className="studio-screen-saver__info">
							<div className="studio-screen-saver__clock">{`${now.toLocaleTimeString(undefined, {
								formatMatcher: 'best fit',
								hour: '2-digit',
								minute: '2-digit',
								second: '2-digit',
							})}`}</div>
							{rundownPlaylist && (
								<>
									<div className="studio-screen-saver__info__rundown">{rundownPlaylist.name}</div>
								</>
							)}
						</div>
					</div>
				)
			}
		}
	)
)
