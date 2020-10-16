import * as React from 'react'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import Moment from 'react-moment'
import { withTiming, WithTiming } from './RundownTiming'
import { RundownUtils } from '../../lib/rundown'
import { withTranslation } from 'react-i18next'

interface IProps {
	rundown: Rundown
}

interface ITrackedProps {
	notificationsFromRundown: {
		critical: number
		warning: number
	}
}

const QUATER_DAY = 6 * 60 * 60 * 1000

/**
 * This is a countdown to the rundown's _Expected Start_ time. It shows nothing if the expectedStart is undefined
 * or the time to _Expected Start_ from now is larger than 6 hours.
 */
const RundownCountdown = withTranslation()(
	withTiming<
		Translated<{
			expectedStart: number | undefined
			className?: string | undefined
		}>,
		{}
	>({
		filter: 'currentTime',
	})(
		class RundownCountdown extends React.Component<
			Translated<
				WithTiming<{
					expectedStart: number | undefined
					className?: string | undefined
				}>
			>
		> {
			render() {
				const { t } = this.props
				if (this.props.expectedStart === undefined) return null

				const time = this.props.expectedStart - (this.props.timingDurations.currentTime || 0)

				if (time < QUATER_DAY) {
					return (
						<span className={this.props.className}>
							{time > 0
								? t('(in: {{time}})', {
										time: RundownUtils.formatDiffToTimecode(time, false, true, true, true, true),
								  })
								: t('({{time}} ago)', {
										time: RundownUtils.formatDiffToTimecode(time, false, true, true, true, true),
								  })}
						</span>
					)
				}
				return null
			}
		}
	)
)

/**
 * This is a component for showing the title of the rundown, it's expectedStart and expectedDuration and
 * icons for the notifications it's segments have produced. The counters for the notifications are
 * produced by filtering the notifications in the Notification Center based on the source being the
 * rundownId or one of the segmentIds.
 *
 * The component should be minimally reactive.
 */
export const RundownDividerHeader = withTranslation()(
	class RundownDividerHeader extends React.Component<Translated<IProps>> {
		render() {
			const { t } = this.props
			return (
				<div className="rundown-divider-timeline">
					<h2 className="rundown-divider-timeline__title">{this.props.rundown.name}</h2>
					{this.props.rundown.expectedStart && (
						<div className="rundown-divider-timeline__expected-start">
							<span>{t('Planned Start')}</span>&nbsp;
							<Moment
								interval={1000}
								calendar={{
									sameElse: 'lll',
								}}>
								{this.props.rundown.expectedStart}
							</Moment>
							&nbsp;
							<RundownCountdown
								className="rundown-divider-timeline__expected-start__countdown"
								expectedStart={this.props.rundown.expectedStart}
							/>
						</div>
					)}
					{this.props.rundown.expectedDuration && (
						<div className="rundown-divider-timeline__expected-duration">
							<span>{t('Planned Duration')}</span>&nbsp;
							<Moment interval={0} format="HH:mm:ss" date={this.props.rundown.expectedDuration} />
						</div>
					)}
				</div>
			)
		}
	}
)
