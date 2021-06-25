import * as React from 'react'
import * as _ from 'underscore'
import {
	DashboardLayoutPlaylistStartTimer,
	RundownLayoutBase,
	RundownLayoutPlaylistStartTimer,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { withTranslation } from 'react-i18next'
import { PlaylistStartTiming } from '../RundownView/RundownTiming/PlaylistStartTiming'

interface IPlaylistStartTimerPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPlaylistStartTimer
	playlist: RundownPlaylist
}

interface IState {}

export class PlaylistStartTimerPanelInner extends MeteorReactComponent<
	Translated<IPlaylistStartTimerPanelProps>,
	IState
> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)

		let { playlist } = this.props

		if (!playlist.expectedDuration) {
			return null
		}

		return (
			<div
				className="playlist-start-time-panel timing"
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutPlaylistStartTimer), height: 1 }),
								fontSize: ((this.props.panel as DashboardLayoutPlaylistStartTimer).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<PlaylistStartTiming rundownPlaylist={this.props.playlist} hideDiff={this.props.panel.hideDiff} />
			</div>
		)
	}
}

export const PlaylistStartTimerPanel = withTranslation()(PlaylistStartTimerPanelInner)
