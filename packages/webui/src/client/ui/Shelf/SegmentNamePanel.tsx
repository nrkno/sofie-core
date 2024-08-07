import * as React from 'react'
import ClassNames from 'classnames'
import {
	DashboardLayoutSegmentName,
	RundownLayoutBase,
	RundownLayoutSegmentName,
} from '../../../lib/collections/RundownLayouts'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { RundownPlaylistCollectionUtil } from '../../../lib/collections/rundownPlaylistUtil'

interface ISegmentNamePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutSegmentName
	playlist: DBRundownPlaylist
}

interface IState {}

interface ISegmentNamePanelTrackedProps {
	name?: string
}

class SegmentNamePanelInner extends React.Component<
	Translated<ISegmentNamePanelProps & ISegmentNamePanelTrackedProps>,
	IState
> {
	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { t, panel } = this.props

		return (
			<div
				className={ClassNames(
					'segment-name-panel',
					isDashboardLayout ? (panel as DashboardLayoutSegmentName).customClasses : undefined
				)}
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutSegmentName) : {}}
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

function getSegmentName(selectedSegment: 'current' | 'next', playlist: DBRundownPlaylist): string | undefined {
	const currentPartInstance = playlist.currentPartInfo
		? (RundownPlaylistCollectionUtil.getActivePartInstances(playlist, {
				_id: playlist.currentPartInfo.partInstanceId,
		  })[0] as PartInstance | undefined)
		: undefined

	if (!currentPartInstance) return

	if (selectedSegment === 'current') {
		if (currentPartInstance) {
			const segment = RundownPlaylistCollectionUtil.getSegments(playlist, { _id: currentPartInstance.segmentId })[0] as
				| DBSegment
				| undefined
			return segment?.name
		}
	} else {
		if (playlist.nextPartInfo) {
			const nextPartInstance = RundownPlaylistCollectionUtil.getActivePartInstances(playlist, {
				_id: playlist.nextPartInfo.partInstanceId,
			})[0] as PartInstance | undefined
			if (nextPartInstance && nextPartInstance.segmentId !== currentPartInstance.segmentId) {
				const segment = RundownPlaylistCollectionUtil.getSegments(playlist, { _id: nextPartInstance.segmentId })[0] as
					| DBSegment
					| undefined
				return segment?.name
			}
		}

		// Current and next part are same segment, or next is not set
		// Find next segment in order
		const orderedSegmentsAndParts = RundownPlaylistCollectionUtil.getSegmentsAndPartsSync(playlist)
		const segmentIndex = orderedSegmentsAndParts.segments.findIndex((s) => s._id === currentPartInstance.segmentId)
		if (segmentIndex === -1) return

		const nextSegment = orderedSegmentsAndParts.segments.slice(segmentIndex + 1)[0] as DBSegment | undefined
		return nextSegment?.name
	}
}

export const SegmentNamePanel = translateWithTracker<ISegmentNamePanelProps, IState, ISegmentNamePanelTrackedProps>(
	(props) => {
		const name: string | undefined = getSegmentName(props.panel.segment, props.playlist)

		return {
			...props,
			name,
		}
	}
)(SegmentNamePanelInner)
