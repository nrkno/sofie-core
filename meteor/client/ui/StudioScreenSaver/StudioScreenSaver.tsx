import * as React from 'react'
import { translateWithTracker, Translated, withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { StudioId, Studio, Studios } from '../../../lib/collections/Studios'
import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { getCurrentTime } from '../../../lib/lib'
import { invalidateAfter } from '../../lib/invalidatingTime'
import { getCurrentTimeReactive } from '../../lib/currentTimeReactive'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'

interface IProps {
	studioId: StudioId
}

interface ITrackedProps {
	studio: Studio | undefined
	rundownPlaylist: RundownPlaylist | undefined
}

const Clock = withTracker<{ className?: string | undefined }, {}, { now: number }>(() => {
	return {
		now: getCurrentTimeReactive(),
	}
})(
	class Clock extends React.Component<{ now: number; className?: string | undefined }> {
		render() {
			const now = new Date(this.props.now)
			return (
				<div className={this.props.className}>{`${now.toLocaleTimeString(undefined, {
					formatMatcher: 'best fit',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
				})}`}</div>
			)
		}
	}
)

function floorCeil(val) {
	return val < 0 ? Math.ceil(val) : Math.floor(val)
}

const Countdown = translateWithTracker<{ expectedStart: number; className?: string | undefined }, {}, { now: number }>(
	() => {
		return {
			now: getCurrentTimeReactive(),
		}
	}
)(
	class Countdown extends React.Component<
		Translated<{ expectedStart: number; now: number; className?: string | undefined }>
	> {
		render() {
			const { t, expectedStart, now, className } = this.props
			const diff = expectedStart - now

			const days = floorCeil(diff / 86400000)
			const hours = floorCeil((diff % 86400000) / 3600000)
			const minutes = floorCeil((diff % 3600000) / 60000)
			const seconds = floorCeil((diff % 60000) / 1000)

			return (
				<div className={className}>
					{days > 0
						? t('in {{days}} days, {{hours}} h {{minutes}} min {{seconds}} s', { days, hours, minutes, seconds })
						: hours > 0
						? t('in {{hours}} h {{minutes}} min {{seconds}} s', { days, hours, minutes, seconds })
						: minutes > 0
						? t('in {{minutes}} min {{seconds}} s', { days, hours, minutes, seconds })
						: seconds > 0
						? t('in {{seconds}} s', { days, hours, minutes, seconds })
						: days < 0
						? t('{{days}} days, {{hours}} h {{minutes}} min {{seconds}} s ago', { days, hours, minutes, seconds })
						: hours < 0
						? t('{{hours}} h {{minutes}} min {{seconds}} s ago', { days, hours, minutes, seconds })
						: minutes < 0
						? t('{{minutes}} min {{seconds}} s ago', { days, hours, minutes, seconds })
						: seconds <= 0
						? t('{{seconds}} s ago', { days, hours, minutes, seconds })
						: null}
				</div>
			)
		}
	}
)

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
	class StudioScreenSaver extends MeteorReactComponent<Translated<IProps & ITrackedProps>> {
		componentDidMount() {
			this.subscribe(PubSub.rundownPlaylists, {
				studioId: this.props.studioId,
			})
		}

		render() {
			const { t, rundownPlaylist } = this.props
			return (
				<div className="studio-screen-saver">
					<object
						className="studio-screen-saver__bkg"
						data="/images/screen-saver-bkg.svg"
						type="image/svg+xml"></object>
					<div className="studio-screen-saver__info">
						<Clock className="studio-screen-saver__clock" />
						{rundownPlaylist && rundownPlaylist.expectedStart && (
							<>
								<div className="studio-screen-saver__info__label">{t('Next scheduled show')}</div>
								<div className="studio-screen-saver__info__rundown">{rundownPlaylist.name}</div>
								<Countdown
									className="studio-screen-saver__info__countdown"
									expectedStart={rundownPlaylist.expectedStart}
								/>
							</>
						)}
					</div>
				</div>
			)
		}
	}
)
