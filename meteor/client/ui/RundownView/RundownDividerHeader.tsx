import * as React from 'react'
import { Rundown } from '../../../lib/collections/Rundowns'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { NotificationCenter, NoticeLevel } from '../../lib/notifications/notifications'
import { ProtectedString, unprotectStringArray, unprotectString } from '../../../lib/lib'
import { WarningIconSmall, CriticalIconSmall } from '../../lib/notificationIcons'

interface IProps {
	rundown: Rundown
}

interface ITrackedProps {
	notificationsFromRundown: {
		critical: number
		warning: number
	}
}

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
		const notificationsFromRundown = NotificationCenter.getNotifications().filter(
			(notification) => notification.source && activeIds.includes(notification.source as string)
		)
		return {
			notificationsFromRundown: {
				critical: notificationsFromRundown.reduce(
					(mem, notification) => (notification.status === NoticeLevel.CRITICAL ? mem + 1 : mem),
					0
				),
				warning: notificationsFromRundown.reduce(
					(mem, notification) => (notification.status === NoticeLevel.WARNING ? mem + 1 : mem),
					0
				),
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
					{this.props.rundown.expectedStart && (
						<div className="rundown-divider-timeline__expected-start">
							<span>{t('Planned Start')}</span>
							{this.props.rundown.expectedStart}
						</div>
					)}
					{this.props.rundown.expectedDuration && (
						<div className="rundown-divider-timeline__expected-duration">
							<span>{t('Planned Duration')}</span>
							{this.props.rundown.expectedDuration}
						</div>
					)}
				</div>
			)
		}
	}
)
