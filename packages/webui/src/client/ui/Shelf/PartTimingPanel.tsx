import * as React from 'react'
import * as _ from 'underscore'
import {
	DashboardLayoutPartCountDown,
	RundownLayoutBase,
	RundownLayoutPartTiming,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts'
import { getAllowSpeaking, getAllowVibrating } from '../../lib/localStorage'
import { CurrentPartOrSegmentRemaining } from '../RundownView/RundownTiming/CurrentPartOrSegmentRemaining'
import { CurrentPartElapsed } from '../RundownView/RundownTiming/CurrentPartElapsed'
import { getIsFilterActive } from '../../lib/rundownLayouts'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil'

interface IPartTimingPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPartTiming
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
}

interface IPartTimingPanelTrackedProps {
	livePart?: PartInstance
	active: boolean
}

interface IState {}

class PartTimingPanelInner extends React.Component<
	Translated<IPartTimingPanelProps & IPartTimingPanelTrackedProps>,
	IState
> {
	render(): JSX.Element {
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
							<CurrentPartOrSegmentRemaining
								currentPartInstanceId={this.props.playlist.currentPartInfo?.partInstanceId ?? null}
								speaking={getAllowSpeaking() && panel.speakCountDown}
								vibrating={getAllowVibrating() && panel.speakCountDown}
								heavyClassName="overtime"
								className="part-remaining"
								useSegmentTime={true}
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
		if (props.playlist.currentPartInfo) {
			const livePart = RundownPlaylistClientUtil.getActivePartInstances(props.playlist, {
				_id: props.playlist.currentPartInfo.partInstanceId,
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
