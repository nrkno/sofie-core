import React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { getCurrentTime } from '../../../../lib/lib'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../../lib/rundown'
import { withTiming, WithTiming } from './withTiming'
import ClassNames from 'classnames'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { getPlaylistTimingDiff } from '../../../lib/rundownTiming'

interface IEndTimingProps {
	rundownPlaylist: RundownPlaylist
	loop?: boolean
	expectedStart?: number
	expectedDuration?: number
	expectedEnd?: number
	endLabel?: string
	hidePlannedEndLabel?: boolean
	hideDiffLabel?: boolean
	hidePlannedEnd?: boolean
	hideCountdown?: boolean
	hideDiff?: boolean
	rundownCount: number
}

export const PlaylistEndTiming = withTranslation()(
	withTiming<IEndTimingProps & WithTranslation, {}>()(
		class PlaylistEndTiming extends React.Component<Translated<WithTiming<IEndTimingProps>>> {
			render() {
				const { t } = this.props
				const { rundownPlaylist, expectedStart, expectedEnd, expectedDuration } = this.props

				const overUnderClock = getPlaylistTimingDiff(rundownPlaylist, this.props.timingDurations) ?? 0
				const now = this.props.timingDurations.currentTime ?? getCurrentTime()

				return (
					<React.Fragment>
						{!this.props.hidePlannedEnd ? (
							this.props.expectedEnd ? (
								!rundownPlaylist.startedPlayback ? (
									<span className="timing-clock plan-end right visual-last-child" role="timer">
										{!this.props.hidePlannedEndLabel && (
											<span className="timing-clock-label right">{this.props.endLabel ?? t('Planned End')}</span>
										)}
										<Moment interval={0} format="HH:mm:ss" date={expectedEnd} />
									</span>
								) : (
									<span className="timing-clock plan-end right visual-last-child" role="timer">
										{!this.props.hidePlannedEndLabel && (
											<span className="timing-clock-label right">{this.props.endLabel ?? t('Expected End')}</span>
										)}
										<Moment interval={0} format="HH:mm:ss" date={expectedEnd} />
									</span>
								)
							) : this.props.timingDurations ? (
								this.props.rundownPlaylist.loop ? (
									this.props.timingDurations.partCountdown &&
									rundownPlaylist.activationId &&
									rundownPlaylist.currentPartInstanceId ? (
										<span className="timing-clock plan-end right visual-last-child" role="timer">
											{!this.props.hidePlannedEndLabel && (
												<span className="timing-clock-label right">{t('Next Loop at')}</span>
											)}
											<Moment
												interval={0}
												format="HH:mm:ss"
												date={
													now +
													(this.props.timingDurations.partCountdown[
														Object.keys(this.props.timingDurations.partCountdown)[0]
													] || 0)
												}
											/>
										</span>
									) : null
								) : (
									<span className="timing-clock plan-end right visual-last-child" role="timer">
										{!this.props.hidePlannedEndLabel && (
											<span className="timing-clock-label right">{this.props.endLabel ?? t('Expected End')}</span>
										)}
										<Moment
											interval={0}
											format="HH:mm:ss"
											date={(expectedStart || now) + (this.props.timingDurations.remainingPlaylistDuration || 0)}
										/>
									</span>
								)
							) : null
						) : null}
						{!this.props.loop &&
							!this.props.hideCountdown &&
							(expectedEnd ? (
								<span className="timing-clock countdown plan-end right" role="timer">
									{RundownUtils.formatDiffToTimecode(now - expectedEnd, true, true, true)}
								</span>
							) : expectedStart && expectedDuration ? (
								<span className="timing-clock countdown plan-end right" role="timer">
									{RundownUtils.formatDiffToTimecode(
										getCurrentTime() - (expectedStart + expectedDuration),
										true,
										true,
										true
									)}
								</span>
							) : null)}
						{!this.props.hideDiff ? (
							this.props.timingDurations ? (
								<span
									className={ClassNames('timing-clock heavy-light right', {
										heavy: overUnderClock < 0,
										light: overUnderClock >= 0,
									})}
									role="timer"
								>
									{!this.props.hideDiffLabel && <span className="timing-clock-label right">{t('Diff')}</span>}
									{RundownUtils.formatDiffToTimecode(
										overUnderClock,
										true,
										false,
										true,
										true,
										true,
										undefined,
										true,
										true
									)}
								</span>
							) : null
						) : null}
					</React.Fragment>
				)
			}
		}
	)
)
