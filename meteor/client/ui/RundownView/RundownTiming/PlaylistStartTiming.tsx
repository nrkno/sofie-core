import React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { withTiming, WithTiming } from './withTiming'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { RundownUtils } from '../../../lib/rundown'
import { getCurrentTime } from '../../../../lib/lib'
import ClassNames from 'classnames'

interface IEndTimingProps {
	rundownPlaylist: RundownPlaylist
	hideExpectedStart?: boolean
	hideDiff?: boolean
}

export const PlaylistStartTiming = withTranslation()(
	withTiming<IEndTimingProps & WithTranslation, {}>()(
		class PlaylistStartTiming extends React.Component<Translated<WithTiming<IEndTimingProps>>> {
			render() {
				let { t, rundownPlaylist } = this.props
				let expectedStart = rundownPlaylist.expectedStart
					? rundownPlaylist.expectedStart
					: rundownPlaylist.expectedDuration && rundownPlaylist.expectedEnd
					? rundownPlaylist.expectedEnd - rundownPlaylist.expectedDuration
					: undefined

				return (
					<React.Fragment>
						{!this.props.hideExpectedStart &&
							(rundownPlaylist.startedPlayback && rundownPlaylist.activationId && !rundownPlaylist.rehearsal ? (
								<span className="timing-clock plan-start left">
									<span className="timing-clock-label left">{t('Started')}</span>
									<Moment interval={0} format="HH:mm:ss" date={rundownPlaylist.startedPlayback} />
								</span>
							) : rundownPlaylist.expectedStart ? (
								<span className="timing-clock plan-start left">
									<span className="timing-clock-label left">{t('Planned Start')}</span>
									<Moment interval={0} format="HH:mm:ss" date={rundownPlaylist.expectedStart} />
								</span>
							) : rundownPlaylist.expectedEnd && rundownPlaylist.expectedDuration ? (
								<span className="timing-clock plan-start left">
									<span className="timing-clock-label left">{t('Expected Start')}</span>
									<Moment
										interval={0}
										format="HH:mm:ss"
										date={rundownPlaylist.expectedEnd - rundownPlaylist.expectedDuration}
									/>
								</span>
							) : null)}
						{!this.props.hideDiff && expectedStart && (
							<span
								className={ClassNames('timing-clock heavy-light left', {
									heavy: getCurrentTime() > expectedStart,
									light: getCurrentTime() <= expectedStart,
								})}
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
