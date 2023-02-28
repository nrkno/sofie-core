import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	DashboardLayoutNextInfo,
	RundownLayoutNextInfo,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { Segment } from '../../../lib/collections/Segments'
import { dashboardElementStyle } from './DashboardPanel'
import { PartInstances, Segments } from '../../collections'

interface INextInfoPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutNextInfo
	playlist: RundownPlaylist
}

interface INextInfoPanelTrackedProps {
	nextPartInstance?: PartInstance
	nextSegment?: Segment
}

export class NextInfoPanelInner extends MeteorReactComponent<INextInfoPanelProps & INextInfoPanelTrackedProps> {
	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const showAny =
			!this.props.panel.hideForDynamicallyInsertedParts || this.props.nextPartInstance?.orphaned !== 'adlib-part'
		const segmentName = showAny && this.props.panel.showSegmentName && this.props.nextSegment?.name
		const partTitle = showAny && this.props.panel.showPartTitle && this.props.nextPartInstance?.part.title
		return (
			<div
				className={ClassNames(
					'next-info-panel',
					isDashboardLayout ? (this.props.panel as DashboardLayoutNextInfo).customClasses : undefined
				)}
				style={_.extend(
					isDashboardLayout
						? dashboardElementStyle({ ...(this.props.panel as DashboardLayoutNextInfo), height: 1 })
						: {},
					{
						visibility: this.props.visible ? 'visible' : 'hidden',
					}
				)}
			>
				<div className="dashboard__panel--font-scaled">
					<span className="next-info-panel__name">{showAny && this.props.panel.name} </span>
					{segmentName && <span className="next-info-panel__segment">{segmentName}</span>}
					{partTitle && <span className="next-info-panel__part">{partTitle}</span>}
				</div>
			</div>
		)
	}
}

export const NextInfoPanel = withTracker<INextInfoPanelProps, {}, INextInfoPanelTrackedProps>(
	(props: INextInfoPanelProps & INextInfoPanelTrackedProps) => {
		let nextPartInstance: PartInstance | undefined = undefined
		let nextSegment: Segment | undefined = undefined

		if (props.playlist.nextPartInstanceId) {
			nextPartInstance = PartInstances.findOne(props.playlist.nextPartInstanceId)
		}
		if (nextPartInstance) {
			nextSegment = Segments.findOne(nextPartInstance.segmentId)
		}
		return { nextPartInstance, nextSegment }
	},
	(_data, props: INextInfoPanelProps, nextProps: INextInfoPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(NextInfoPanelInner)
