import React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { withTiming, WithTiming } from './withTiming'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownUtils } from '../../../lib/rundown'
import { getCurrentTime } from '../../../../lib/lib'
import ClassNames from 'classnames'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

interface IEndTimingProps {
	rundownPlaylist: DBRundownPlaylist
	hidePlannedStart?: boolean
	hideDiff?: boolean
	plannedStartText?: string
}

export const PlaylistStartTiming = withTranslation()(
	withTiming<IEndTimingProps & WithTranslation, {}>()(
		class PlaylistStartTiming extends React.Component<Translated<WithTiming<IEndTimingProps>>> {
			render(): JSX.Element {
				const { t, rundownPlaylist } = this.props
				const playlistExpectedStart = PlaylistTiming.getExpectedStart(rundownPlaylist.timing)
				const playlistExpectedEnd = PlaylistTiming.getExpectedEnd(rundownPlaylist.timing)
				const playlistExpectedDuration = PlaylistTiming.getExpectedDuration(rundownPlaylist.timing)
				const expectedStart = playlistExpectedStart
					? playlistExpectedStart
					: playlistExpectedDuration && playlistExpectedEnd
					? playlistExpectedEnd - playlistExpectedDuration
					: undefined

				return (
					<React.Fragment>
						{!this.props.hidePlannedStart &&
							(rundownPlaylist.startedPlayback && rundownPlaylist.activationId && !rundownPlaylist.rehearsal ? (
								<span className="timing-clock plan-start left" role="timer">
									<span className="timing-clock-label left">{t('Started')}</span>
									<Moment interval={0} format="HH:mm:ss" date={rundownPlaylist.startedPlayback} />
								</span>
							) : playlistExpectedStart ? (
								<span className="timing-clock plan-start left" role="timer">
									<span className="timing-clock-label left">{this.props.plannedStartText || t('Planned Start')}</span>
									<Moment interval={0} format="HH:mm:ss" date={playlistExpectedStart} />
								</span>
							) : playlistExpectedEnd && playlistExpectedDuration ? (
								<span className="timing-clock plan-start left" role="timer">
									<span className="timing-clock-label left">{this.props.plannedStartText || t('Expected Start')}</span>
									<Moment interval={0} format="HH:mm:ss" date={playlistExpectedEnd - playlistExpectedDuration} />
								</span>
							) : null)}
						{!this.props.hideDiff && expectedStart && (
							<span
								className={ClassNames('timing-clock heavy-light left', {
									heavy: getCurrentTime() > expectedStart,
									light: getCurrentTime() <= expectedStart,
								})}
								role="timer"
							>
								<span className="timing-clock-label">{t('Diff')}</span>
								{rundownPlaylist.startedPlayback
									? RundownUtils.formatDiffToTimecode(
											rundownPlaylist.startedPlayback - expectedStart,
											true,
											false,
											true,
											true,
											true
									  )
									: RundownUtils.formatDiffToTimecode(getCurrentTime() - expectedStart, true, false, true, true, true)}
							</span>
						)}
					</React.Fragment>
				)
			}
		}
	)
)
