import * as React from 'react'
import * as _ from 'underscore'
import {
	DashboardLayoutPartCountDown,
	RundownLayoutBase,
	RundownLayoutPartTiming,
} from '../../../lib/collections/RundownLayouts'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist, RundownPlaylistCollectionUtil } from '../../../lib/collections/RundownPlaylists'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { getAllowSpeaking } from '../../lib/localStorage'
import { CurrentPartRemaining } from '../RundownView/RundownTiming/CurrentPartRemaining'
import { CurrentPartElapsed } from '../RundownView/RundownTiming/CurrentPartElapsed'
import { getIsFilterActive } from '../../lib/rundownLayouts'
import { UIShowStyleBase } from '../../../lib/api/showStyles'

interface IPartTimingPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPartTiming
	playlist: RundownPlaylist
	showStyleBase: UIShowStyleBase
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
		const { t, panel } = this.props

		return (
			<div
				className="part-timing-panel timing"
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutPartCountDown) : {}}
			>
				<span className="timing-clock left">
					{!panel.hideLabel && (
						<span className="timing-clock-label">
							{panel.timingType === 'count_down' ? t('Part Count Down') : t('Part Count Up')}
						</span>
					)}
					{this.props.active &&
						(panel.timingType === 'count_down' ? (
							<CurrentPartRemaining
								currentPartInstanceId={this.props.playlist.currentPartInstanceId}
								speaking={getAllowSpeaking() && panel.speakCountDown}
								heavyClassName="overtime"
								className="part-remaining"
							/>
						) : (
							<CurrentPartElapsed currentPartId={this.props.livePart?.part._id} className="part-elapsed" />
						))}
				</span>
			</div>
		)
	}
}

export const PartTimingPanel = translateWithTracker<IPartTimingPanelProps, IState, IPartTimingPanelTrackedProps>(
	(props: IPartTimingPanelProps) => {
		if (props.playlist.currentPartInstanceId) {
			const livePart = RundownPlaylistCollectionUtil.getActivePartInstances(props.playlist, {
				_id: props.playlist.currentPartInstanceId,
			})[0]
			const { active } = getIsFilterActive(props.playlist, props.showStyleBase, props.panel)

			return { active, livePart }
		}
		return { active: false }
	},
	(_data, props: IPartTimingPanelProps, nextProps: IPartTimingPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(PartTimingPanelInner)
