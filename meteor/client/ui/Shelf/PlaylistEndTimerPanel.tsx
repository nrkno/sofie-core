import * as React from 'react'
import * as _ from 'underscore'
import {
	DashboardLayoutPlaylistEndTimer,
	DashboardLayoutPlaylistStartTimer,
	RundownLayoutBase,
	RundownLayoutPlaylistEndTimer,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { withTranslation } from 'react-i18next'
import { PlaylistStartTiming } from '../RundownView/RundownTiming/PlaylistStartTiming'
import { PlaylistEndTiming } from '../RundownView/RundownTiming/PlaylistEndTiming'

interface IPlaylistStartTimerPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPlaylistEndTimer
	playlist: RundownPlaylist
}

interface IState {}

export class PlaylistEndTimerPanelInner extends MeteorReactComponent<
	Translated<IPlaylistStartTimerPanelProps>,
	IState
> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)

		let { playlist, panel } = this.props

		if (!playlist.expectedDuration) {
			return null
		}

		return (
			<div
				className="playlist-end-time-panel timing"
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(panel as DashboardLayoutPlaylistEndTimer), height: 1 }),
								fontSize: ((panel as DashboardLayoutPlaylistEndTimer).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<PlaylistEndTiming
					loop={playlist.loop}
					expectedStart={playlist.expectedStart}
					expectedEnd={playlist.expectedEnd}
					expectedDuration={playlist.expectedDuration}
					endLabel={panel.expectedEndText}
					hideCountdown={panel.hideCountdown}
					hideDiff={panel.hideDiff}
					hidePlannedEnd={panel.hidePlannedEnd}
					rundownCount={0}
				/>
			</div>
		)
	}
}

export const PlaylistEndTimerPanel = withTranslation()(PlaylistEndTimerPanelInner)
