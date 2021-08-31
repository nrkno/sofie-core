import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
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
import { Segment } from '../../../lib/collections/Segments'
import { PartInstance } from '../../../lib/collections/PartInstances'

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
				className={ClassNames(
					'segment-name-panel',
					isDashboardLayout ? (panel as DashboardLayoutSegmentName).customClasses : undefined
				)}
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

function getSegmentName(selectedSegment: 'current' | 'next', playlist: RundownPlaylist): string | undefined {
	const currentPartInstance = playlist.currentPartInstanceId
		? (playlist.getActivePartInstances({ _id: playlist.currentPartInstanceId })[0] as PartInstance | undefined)
		: undefined

	if (!currentPartInstance) return

	if (selectedSegment === 'current') {
		if (currentPartInstance) {
			const segment = playlist.getSegments({ _id: currentPartInstance.segmentId })[0] as Segment | undefined
			return segment?.name
		}
	} else {
		if (playlist.nextPartInstanceId) {
			const nextPartInstance = playlist.getActivePartInstances({
				_id: playlist.nextPartInstanceId,
			})[0] as PartInstance | undefined
			if (nextPartInstance && nextPartInstance.segmentId !== currentPartInstance.segmentId) {
				const segment = playlist.getSegments({ _id: nextPartInstance.segmentId })[0] as Segment | undefined
				return segment?.name
			}
		}

		// Current and next part are same segment, or next is not set
		// Find next segment in order
		const orderedSegmentsAndParts = playlist.getSegmentsAndPartsSync()
		const segmentIndex = orderedSegmentsAndParts.segments.findIndex((s) => s._id === currentPartInstance.segmentId)
		if (segmentIndex === -1) return

		const nextSegment = orderedSegmentsAndParts.segments.slice(segmentIndex + 1)[0] as Segment | undefined
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
