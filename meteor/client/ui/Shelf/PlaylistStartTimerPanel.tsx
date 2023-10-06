import * as React from 'react'
import ClassNames from 'classnames'
import {
	DashboardLayoutPlaylistStartTimer,
	RundownLayoutBase,
	RundownLayoutPlaylistStartTimer,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementStyle } from './DashboardPanel'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { withTranslation } from 'react-i18next'
import { PlaylistStartTiming } from '../RundownView/RundownTiming/PlaylistStartTiming'

interface IPlaylistStartTimerPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutPlaylistStartTimer
	playlist: RundownPlaylist
}

interface IState {}

class PlaylistStartTimerPanelInner extends MeteorReactComponent<Translated<IPlaylistStartTimerPanelProps>, IState> {
	constructor(props) {
		super(props)
	}

	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)

		return (
			<div
				className={ClassNames(
					'playlist-start-time-panel timing',
					isDashboardLayout ? (this.props.panel as DashboardLayoutPlaylistStartTimer).customClasses : undefined
				)}
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutPlaylistStartTimer) : {}}
			>
				<PlaylistStartTiming
					rundownPlaylist={this.props.playlist}
					hideDiff={this.props.panel.hideDiff}
					hidePlannedStart={this.props.panel.hidePlannedStart}
					plannedStartText={this.props.panel.plannedStartText}
				/>
			</div>
		)
	}
}

export const PlaylistStartTimerPanel = withTranslation()(PlaylistStartTimerPanelInner)
