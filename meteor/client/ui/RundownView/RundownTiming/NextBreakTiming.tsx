import React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { getCurrentTime, unprotectString } from '../../../../lib/lib'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../../lib/rundown'
import { WithTiming, withTiming } from './withTiming'
import ClassNames from 'classnames'

interface INextBreakTimingProps {
	loop?: boolean
	rundownsBeforeBreak: Rundown[]
	breakText?: string
}

export const NextBreakTiming = withTranslation()(
	withTiming<INextBreakTimingProps & WithTranslation, {}>()(
		class PlaylistEndTiming extends React.Component<Translated<WithTiming<INextBreakTimingProps>>> {
			render() {
				let { t, rundownsBeforeBreak } = this.props
				let breakRundown = rundownsBeforeBreak.length ? rundownsBeforeBreak[rundownsBeforeBreak.length - 1] : undefined

				const rundownAsPlayedDuration = this.props.timingDurations.rundownAsPlayedDurations
					? rundownsBeforeBreak.reduce(
							(prev, curr) => (prev += this.props.timingDurations.rundownAsPlayedDurations![unprotectString(curr._id)]),
							0
					  )
					: undefined

				const accumulatedExpectedDurations = this.props.timingDurations.rundownExpectedDurations
					? rundownsBeforeBreak.reduce(
							(prev, curr) => (prev += this.props.timingDurations.rundownExpectedDurations![unprotectString(curr._id)]),
							0
					  )
					: undefined

				if (!breakRundown) {
					return null
				}

				return (
					<React.Fragment>
						<span className="timing-clock plan-end right">
							<span className="timing-clock-label right">{t(this.props.breakText || 'Next Break')}</span>
							<Moment interval={0} format="HH:mm:ss" date={breakRundown.expectedEnd} />
						</span>
						{!this.props.loop && breakRundown.expectedEnd ? (
							<span className="timing-clock countdown plan-end right">
								{RundownUtils.formatDiffToTimecode(getCurrentTime() - breakRundown.expectedEnd, true, true, true)}
							</span>
						) : null}
						{accumulatedExpectedDurations ? (
							<span
								className={ClassNames('timing-clock heavy-light right', {
									heavy: (rundownAsPlayedDuration || 0) < (accumulatedExpectedDurations || 0),
									light: (rundownAsPlayedDuration || 0) > (accumulatedExpectedDurations || 0),
								})}
							>
								<span className="timing-clock-label right">{t('Diff')}</span>
								{RundownUtils.formatDiffToTimecode(
									(rundownAsPlayedDuration || 0) - accumulatedExpectedDurations,
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
				)
			}
		}
	)
)
