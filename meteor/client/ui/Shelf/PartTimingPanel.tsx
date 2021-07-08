import * as React from 'react'
import * as _ from 'underscore'
import {
	DashboardLayoutPartCountDown,
	RundownLayoutBase,
	RundownLayoutPartTiming,
} from '../../../lib/collections/RundownLayouts'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { dashboardElementPosition } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { getAllowSpeaking } from '../../lib/localStorage'
import { CurrentPartRemaining } from '../RundownView/RundownTiming/CurrentPartRemaining'
import { CurrentPartElapsed } from '../RundownView/RundownTiming/CurrentPartElapsed'
import { getIsFilterActive } from '../../lib/rundownLayouts'

interface IPartTimingPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPartTiming
	playlist: RundownPlaylist
}

interface IPartTimingPanelTrackedProps {
	livePart?: PartInstance
	active: boolean
}

interface IState {}

class PartTimingPanelInner extends MeteorReactComponent<
	Translated<IPartTimingPanelProps & IPartTimingPanelTrackedProps>,
	IState
> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		let { t, panel } = this.props

		return (
			<div
				className="part-timing-panel timing"
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutPartCountDown), height: 1 }),
								fontSize: ((panel as DashboardLayoutPartCountDown).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<span className="timing-clock left">
					<span className="timing-clock-label">
						{panel.timingType === 'count_down' ? t('Part Count Down') : t('Part Count Up')}
					</span>
					{this.props.active &&
						(panel.timingType === 'count_down' ? (
							<CurrentPartRemaining
								currentPartInstanceId={this.props.playlist.currentPartInstanceId}
								speaking={getAllowSpeaking() && panel.speakCountDown}
								heavyClassName="overtime"
							/>
						) : (
							<CurrentPartElapsed currentPartId={this.props.livePart?.part._id} />
						))}
				</span>
			</div>
		)
	}
}

export const PartTimingPanel = translateWithTracker<IPartTimingPanelProps, IState, IPartTimingPanelTrackedProps>(
	(props: IPartTimingPanelProps) => {
		if (props.playlist.currentPartInstanceId) {
			let livePart = props.playlist.getActivePartInstances({ _id: props.playlist.currentPartInstanceId })[0]
			let { active } = getIsFilterActive(props.playlist, props.panel)

			return { active, livePart }
		}
		return { active: false }
	},
	(_data, props: IPartTimingPanelProps, nextProps: IPartTimingPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(PartTimingPanelInner)
