import * as React from 'react'
import ClassNames from 'classnames'
import {
	DashboardLayoutPlaylistName,
	RundownLayoutBase,
	RundownLayoutPlaylistName,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { Rundowns } from '../../collections'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { logger } from '../../lib/logging'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil'

interface IPlaylistNamePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPlaylistName
	playlist: DBRundownPlaylist
}

interface IState {}

interface IPlaylistNamePanelTrackedProps {
	currentRundown?: Rundown
}

class PlaylistNamePanelInner extends React.Component<IPlaylistNamePanelProps & IPlaylistNamePanelTrackedProps, IState> {
	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { panel } = this.props

		return (
			<div
				className={ClassNames(
					'playlist-name-panel',
					isDashboardLayout ? (panel as DashboardLayoutPlaylistName).customClasses : undefined
				)}
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutPlaylistName) : {}}
			>
				<div className="wrapper">
					<span className="playlist-name">{this.props.playlist.name}</span>
					{this.props.panel.showCurrentRundownName && this.props.currentRundown && (
						<span className="rundown-name">{this.props.currentRundown.name}</span>
					)}
				</div>
			</div>
		)
	}
}

export const PlaylistNamePanel = withTracker<IPlaylistNamePanelProps, IState, IPlaylistNamePanelTrackedProps>(
	(props: IPlaylistNamePanelProps) => {
		if (props.playlist.currentPartInfo) {
			const livePart: PartInstance = RundownPlaylistClientUtil.getActivePartInstances(props.playlist, {
				_id: props.playlist.currentPartInfo.partInstanceId,
			})[0]
			if (!livePart) {
				logger.warn(
					`No PartInstance found for PartInstanceId: ${props.playlist.currentPartInfo.partInstanceId} in Playlist: ${props.playlist._id}`
				)
				return {}
			}
			const currentRundown = Rundowns.findOne({ _id: livePart.rundownId, playlistId: props.playlist._id })

			return {
				currentRundown,
			}
		}

		return {}
	}
)(PlaylistNamePanelInner)
