import * as React from 'react'
import * as _ from 'underscore'
import {
	DashboardLayoutSegmentName,
	RundownLayoutBase,
	RundownLayoutSegmentName,
} from '../../../lib/collections/RundownLayouts'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementPosition } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'

interface ISegmentNamePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutSegmentName
	playlist: RundownPlaylist
}

interface IState {}

interface ISegmentNamePanelTrackedProps {
	name?: string
}

class SegmentNamePanelInner extends MeteorReactComponent<
	Translated<ISegmentNamePanelProps & ISegmentNamePanelTrackedProps>,
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
				className="segment-name-panel"
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutSegmentName) }),
								fontSize: ((panel as DashboardLayoutSegmentName).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<div className="wrapper">
					<span className="segment-name-title">
						{this.props.panel.segment === 'current' ? t('Current Segment') : t('Next Segment')}
					</span>
					<span className="segment-name">{this.props.name}</span>
				</div>
			</div>
		)
	}
}

export const SegmentNamePanel = translateWithTracker<ISegmentNamePanelProps, IState, ISegmentNamePanelTrackedProps>(
	(props) => {
		const selectedPartInstanceId =
			props.panel.segment === 'current' ? props.playlist.currentPartInstanceId : props.playlist.nextPartInstanceId
		let name: string | undefined

		if (selectedPartInstanceId) {
			const selectedPartInstance = props.playlist.getActivePartInstances({ _id: selectedPartInstanceId })[0]
			const segment = selectedPartInstance._id
				? props.playlist.getSegments({ _id: selectedPartInstance.segmentId })[0]
				: undefined
			name = segment?.name
		}

		return {
			...props,
			name,
		}
	}
)(SegmentNamePanelInner)
