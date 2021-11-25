import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	DashboardLayoutPlaylistName,
	RundownLayoutBase,
	RundownLayoutPlaylistName,
} from '../../../lib/collections/RundownLayouts'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementPosition } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { Rundown } from '../../../lib/collections/Rundowns'

interface IPlaylistNamePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPlaylistName
	playlist: RundownPlaylist
}

interface IState {}

interface IPlaylistNamePanelTrackedProps {
	currentRundown?: Rundown
}

class PlaylistNamePanelInner extends MeteorReactComponent<
	IPlaylistNamePanelProps & IPlaylistNamePanelTrackedProps,
	IState
> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { panel } = this.props

		return (
			<div
				className={ClassNames(
					'playlist-name-panel',
					isDashboardLayout ? (panel as DashboardLayoutPlaylistName).customClasses : undefined
				)}
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutPlaylistName) }),
								fontSize: ((panel as DashboardLayoutPlaylistName).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
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
		if (props.playlist.currentPartInstanceId) {
			const livePart = props.playlist.getActivePartInstances({ _id: props.playlist.currentPartInstanceId })[0]
			if (livePart) {
				const currentRundown = props.playlist.getRundowns({ _id: livePart.rundownId })[0]

				return {
					currentRundown,
				}
			}
		}

		return {}
	}
)(PlaylistNamePanelInner)
