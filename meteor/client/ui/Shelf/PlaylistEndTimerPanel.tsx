import * as React from 'react'
import ClassNames from 'classnames'
import {
	DashboardLayoutPlaylistEndTimer,
	RundownLayoutBase,
	RundownLayoutPlaylistEndTimer,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementStyle } from './DashboardPanel'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistEndTiming } from '../RundownView/RundownTiming/PlaylistEndTiming'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

interface IPlaylistEndTimerPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPlaylistEndTimer
	playlist: DBRundownPlaylist
}

export function PlaylistEndTimerPanel({ playlist, panel, layout }: Readonly<IPlaylistEndTimerPanelProps>): JSX.Element {
	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	return (
		<div
			className={ClassNames(
				'playlist-end-time-panel timing',
				isDashboardLayout ? (panel as DashboardLayoutPlaylistEndTimer).customClasses : undefined
			)}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutPlaylistEndTimer) : {}}
		>
			<PlaylistEndTiming
				rundownPlaylist={playlist}
				loop={playlist.loop}
				expectedStart={PlaylistTiming.getExpectedStart(playlist.timing)}
				expectedEnd={PlaylistTiming.getExpectedEnd(playlist.timing)}
				expectedDuration={PlaylistTiming.getExpectedDuration(playlist.timing)}
				endLabel={panel.plannedEndText}
				hidePlannedEndLabel={panel.hidePlannedEndLabel}
				hideDiffLabel={panel.hideDiffLabel}
				hideCountdown={panel.hideCountdown}
				hideDiff={panel.hideDiff}
				hidePlannedEnd={panel.hidePlannedEnd}
				rundownCount={0}
			/>
		</div>
	)
}
