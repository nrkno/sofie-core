import * as React from 'react'
import { Rundown } from '../../../lib/collections/Rundowns'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { NotificationCenter, NoticeLevel } from '../../lib/notifications/notifications'
import { ProtectedString, unprotectStringArray, unprotectString } from '../../../lib/lib'
import { WarningIconSmall, CriticalIconSmall } from '../../lib/notificationIcons'
import { MomentFromNow } from '../../lib/Moment'
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

				if (this.props.expectedStart - (this.props.timingDurations.currentTime || 0) < QUATER_DAY) {
					return (
						<span className={this.props.className}>
							{t('(in: {{time}})', {
								time: RundownUtils.formatDiffToTimecode(
									this.props.expectedStart - (this.props.timingDurations.currentTime || 0),
									false,
									true,
									true,
									true,
									true
								),
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
export const RundownDividerHeader = translateWithTracker<IProps, {}, ITrackedProps>(
	(props: IProps) => {
		const activeIds = unprotectStringArray(
			props.rundown
				.getSegments(
					{},
					{
						fields: {
							_id: 1,
						},
					}
				)
				.map((segment) => segment._id)
		)
		activeIds.push(unprotectString(props.rundown._id))

		let critical = 0
		let warning = 0

		// filter all of the notifications in the Notification Center using the notification.source
		NotificationCenter.getNotifications().forEach((notification) => {
			if (notification.source && activeIds.includes(notification.source as string)) {
				if (notification.status === NoticeLevel.CRITICAL) {
					critical++
				} else if (notification.status === NoticeLevel.WARNING) {
					warning++
				}
			}
		})

		return {
			notificationsFromRundown: {
				critical,
				warning,
			},
		}
	},
	(data, props: IProps, nextProps: IProps) => {
		if (
			props.rundown._id !== nextProps.rundown._id ||
			props.rundown.name !== nextProps.rundown.name ||
			props.rundown.expectedStart !== nextProps.rundown.expectedStart ||
			props.rundown.expectedDuration !== nextProps.rundown.expectedDuration
		) {
			return true
		}
		return false
	}
)(
	class RundownDividerHeader extends React.Component<Translated<IProps & ITrackedProps>> {
		render() {
			const { t } = this.props
			return (
				<div className="rundown-divider-timeline">
					<h2 className="rundown-divider-timeline__title">{this.props.rundown.name}</h2>
					<div className="rundown-divider-timeline__notifications-group">
						<div className="rundown-divider-timeline__notifications rundown-divider-timeline__notifications--critical">
							<CriticalIconSmall />
							<span className="rundown-divider-timeline__notifications__count">
								{this.props.notificationsFromRundown.critical}
							</span>
						</div>
						<div className="rundown-divider-timeline__notifications rundown-divider-timeline__notifications--warning">
							<WarningIconSmall />
							<span className="rundown-divider-timeline__notifications__count">
								{this.props.notificationsFromRundown.warning}
							</span>
						</div>
					</div>
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
