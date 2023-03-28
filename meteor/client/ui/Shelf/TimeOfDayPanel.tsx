import * as React from 'react'
import {
	DashboardLayoutTimeOfDay,
	RundownLayoutBase,
	RundownLayoutTimeOfDay,
} from '../../../lib/collections/RundownLayouts'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementStyle } from './DashboardPanel'
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

	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { t, panel } = this.props

		return (
			<div
				className="time-of-day-panel timing"
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutTimeOfDay) : {}}
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
