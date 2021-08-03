import * as React from 'react'
import * as _ from 'underscore'
import {
	DashboardLayoutStudioName,
	RundownLayoutBase,
	RundownLayoutStudioName,
} from '../../../lib/collections/RundownLayouts'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementPosition } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { Studio } from '../../../lib/collections/Studios'

interface IStudioNamePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutStudioName
	playlist: RundownPlaylist
	studio: Studio
}

interface IState {}

interface IStudioNamePanelTrackedProps {}

export class StudioNamePanel extends MeteorReactComponent<
	IStudioNamePanelProps & IStudioNamePanelTrackedProps,
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
				className="studio-name-panel"
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutStudioName) }),
								fontSize: ((panel as DashboardLayoutStudioName).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<div className="wrapper">
					<span className="studio-name">{this.props.studio.name}</span>
				</div>
			</div>
		)
	}
}
