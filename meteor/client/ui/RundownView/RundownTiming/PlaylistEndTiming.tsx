import React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { getCurrentTime } from '../../../../lib/lib'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../../lib/rundown'
import { withTiming, WithTiming } from './withTiming'
import ClassNames from 'classnames'

interface IEndTimingProps {
	loop?: boolean
	expectedStart?: number
	expectedDuration?: number
	expectedEnd?: number
	endLabel?: string
	hidePlannedEnd?: boolean
	hideCountdown?: boolean
	hideDiff?: boolean
	rundownCount: number
}

export const PlaylistEndTiming = withTranslation()(
	withTiming<IEndTimingProps & WithTranslation, {}>()(
		class PlaylistEndTiming extends React.Component<Translated<WithTiming<IEndTimingProps>>> {
			render() {
				let { t } = this.props

				return (
					<React.Fragment>
						{this.props.expectedDuration ? (
							<React.Fragment>
								{!this.props.hidePlannedEnd &&
									(!this.props.loop && this.props.expectedStart ? (
										<span className="timing-clock plan-end right visual-last-child">
											<span className="timing-clock-label right">{t(this.props.endLabel || 'Planned End')}</span>
											<Moment
												interval={0}
												format="HH:mm:ss"
												date={this.props.expectedStart + this.props.expectedDuration}
											/>
										</span>
									) : !this.props.loop && this.props.expectedEnd ? (
										<span className="timing-clock plan-end right visual-last-child">
											<span className="timing-clock-label right">{t(this.props.endLabel || 'Planned End')}</span>
											<Moment interval={0} format="HH:mm:ss" date={this.props.expectedEnd} />
										</span>
									) : null)}
								{!this.props.hideCountdown &&
									(!this.props.loop && this.props.expectedStart && this.props.expectedDuration ? (
										<span className="timing-clock countdown plan-end right">
											{RundownUtils.formatDiffToTimecode(
												getCurrentTime() - (this.props.expectedStart + this.props.expectedDuration),
												true,
												true,
												true
											)}
										</span>
									) : !this.props.loop && this.props.expectedEnd ? (
										<span className="timing-clock countdown plan-end right">
											{RundownUtils.formatDiffToTimecode(getCurrentTime() - this.props.expectedEnd, true, true, true)}
										</span>
									) : null)}
								{this.props.expectedDuration && !this.props.hideDiff ? (
									<span
										className={ClassNames('timing-clock heavy-light right', {
											heavy:
												(this.props.timingDurations.asPlayedPlaylistDuration || 0) < (this.props.expectedDuration || 0),
											light:
												(this.props.timingDurations.asPlayedPlaylistDuration || 0) > (this.props.expectedDuration || 0),
										})}
									>
										<span className="timing-clock-label right">{t('Diff')}</span>
										{RundownUtils.formatDiffToTimecode(
											(this.props.timingDurations.asPlayedPlaylistDuration || 0) - this.props.expectedDuration,
											true,
											false,
											true,
											true,
											true,
											undefined,
											true
										)}
									</span>
								) : null}
							</React.Fragment>
						) : (
							<React.Fragment>
								{!this.props.loop && this.props.timingDurations ? (
									<span className="timing-clock plan-end right visual-last-child">
										<span className="timing-clock-label right">
											{this.props.endLabel ? t(this.props.endLabel) : t('Expected End')}
										</span>
										<Moment
											interval={0}
											format="HH:mm:ss"
											date={getCurrentTime() + (this.props.timingDurations.remainingPlaylistDuration || 0)}
										/>
									</span>
								) : null}
								{this.props.timingDurations && this.props.rundownCount < 2 ? ( // TEMPORARY: disable the diff counter for playlists longer than one rundown -- Jan Starzak, 2021-05-06
									<span
										className={ClassNames('timing-clock heavy-light right', {
											heavy:
												(this.props.timingDurations.asPlayedPlaylistDuration || 0) <
												(this.props.timingDurations.totalPlaylistDuration || 0),
											light:
												(this.props.timingDurations.asPlayedPlaylistDuration || 0) >
												(this.props.timingDurations.totalPlaylistDuration || 0),
										})}
									>
										<span className="timing-clock-label right">{t('Diff')}</span>
										{RundownUtils.formatDiffToTimecode(
											(this.props.timingDurations.asPlayedPlaylistDuration || 0) -
												(this.props.timingDurations.totalPlaylistDuration || 0),
											true,
											false,
											true,
											true,
											true,
											undefined,
											true
										)}
									</span>
								) : null}
							</React.Fragment>
						)}
					</React.Fragment>
				)
			}
		}
	)
)
