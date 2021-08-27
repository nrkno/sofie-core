import * as React from 'react'
import * as _ from 'underscore'
import {
	DashboardLayoutTimeOfDay,
	RundownLayoutBase,
	RundownLayoutTimeOfDay,
} from '../../../lib/collections/RundownLayouts'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementPosition } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { withTranslation } from 'react-i18next'
import { TimeOfDay } from '../RundownView/RundownTiming/TimeOfDay'

interface ITimeOfDayPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutTimeOfDay
	playlist: RundownPlaylist
}

interface IState {}

class TimeOfDayPanelInner extends MeteorReactComponent<Translated<ITimeOfDayPanelProps>, IState> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { t, panel } = this.props

		return (
			<div
				className="time-of-day-panel timing"
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutTimeOfDay) }),
								fontSize: ((panel as DashboardLayoutTimeOfDay).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<span className="timing-clock left">
					{!panel.hideLabel && <span className="timing-clock-label">{t('Local Time')}</span>}
					<TimeOfDay />
				</span>
			</div>
		)
	}
}

export const TimeOfDayPanel = withTranslation()(TimeOfDayPanelInner)
