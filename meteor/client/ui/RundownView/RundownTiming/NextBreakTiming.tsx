import React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { getCurrentTime, unprotectString } from '../../../../lib/lib'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../../lib/rundown'
import { WithTiming, withTiming } from './withTiming'
import ClassNames from 'classnames'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

interface INextBreakTimingProps {
	loop?: boolean
	rundownsBeforeBreak: Rundown[]
	breakText?: string
	lastChild?: boolean
}

export const NextBreakTiming = withTranslation()(
	withTiming<INextBreakTimingProps & WithTranslation, {}>()(
		class NextBreakEndTiming extends React.Component<Translated<WithTiming<INextBreakTimingProps>>> {
			render() {
				const { t, rundownsBeforeBreak } = this.props
				const breakRundown = rundownsBeforeBreak.length
					? rundownsBeforeBreak[rundownsBeforeBreak.length - 1]
					: undefined

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

				const expectedEnd = PlaylistTiming.getExpectedEnd(breakRundown.timing)

				return (
					<React.Fragment>
						<span
							className={ClassNames('timing-clock plan-end right', { 'visual-last-child': this.props.lastChild })}
							role="timer"
						>
							<span className="timing-clock-label right">{t(this.props.breakText || 'Next Break')}</span>
							<Moment interval={0} format="HH:mm:ss" date={expectedEnd} />
						</span>
						{!this.props.loop && expectedEnd ? (
							<span className="timing-clock countdown plan-end right">
								{RundownUtils.formatDiffToTimecode(getCurrentTime() - expectedEnd, true, true, true)}
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
