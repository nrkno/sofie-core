import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	DashboardLayoutSegmentCountDown,
	RundownLayoutBase,
	RundownLayoutSegmentTiming,
} from '../../../lib/collections/RundownLayouts'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import { RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Segment } from '../../../lib/collections/Segments'
import { SegmentDuration } from '../RundownView/RundownTiming/SegmentDuration'
import { PartExtended } from '../../../lib/Rundown'
import { memoizedIsolatedAutorun, slowDownReactivity } from '../../lib/reactiveData/reactiveDataHelper'
import { Part, PartId } from '../../../lib/collections/Parts'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { dashboardElementPosition } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { getIsFilterActive } from '../../lib/rundownLayouts'

interface ISegmentTimingPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutSegmentTiming
	playlist: RundownPlaylist
	showStyleBase: ShowStyleBase
}

interface ISegmentTimingPanelTrackedProps {
	liveSegment?: Segment
	parts?: PartExtended[]
	active: boolean
}

interface IState {}

class SegmentTimingPanelInner extends MeteorReactComponent<
	Translated<ISegmentTimingPanelProps & ISegmentTimingPanelTrackedProps>,
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
					'segment-timing-panel timing',
					isDashboardLayout ? (panel as DashboardLayoutSegmentCountDown).customClasses : undefined
				)}
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutSegmentCountDown) }),
								fontSize: ((panel as DashboardLayoutSegmentCountDown).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<span className="timing-clock left">
					{!panel.hideLabel && (
						<span className="timing-clock-label">
							{panel.timingType === 'count_down' ? t('Segment Count Down') : t('Segment Count Up')}
						</span>
					)}
					{this.props.active && this.props.liveSegment && this.props.parts && (
						<SegmentDuration
							segmentId={this.props.liveSegment._id}
							parts={this.props.parts}
							countUp={panel.timingType === 'count_up'}
							className="segment-duration"
						/>
					)}
				</span>
			</div>
		)
	}
}

export const SegmentTimingPanel = translateWithTracker<
	ISegmentTimingPanelProps,
	IState,
	ISegmentTimingPanelTrackedProps
>(
	(props: ISegmentTimingPanelProps) => {
		if (props.playlist.currentPartInstanceId) {
			const livePart = props.playlist.getActivePartInstances({ _id: props.playlist.currentPartInstanceId })[0]
			const liveSegment = livePart ? props.playlist.getSegments({ _id: livePart.segmentId })[0] : undefined

			const { active } = getIsFilterActive(props.playlist, props.showStyleBase, props.panel)

			if (!liveSegment) return { active }

			const [orderedAllPartIds, { currentPartInstance, nextPartInstance }] = slowDownReactivity(
				() =>
					[
						memoizedIsolatedAutorun(
							(_playlistId: RundownPlaylistId) =>
								(
									props.playlist.getAllOrderedParts(undefined, {
										fields: {
											segmentId: 1,
											_rank: 1,
										},
									}) as Pick<Part, '_id' | 'segmentId' | '_rank'>[]
								).map((part) => part._id),
							'playlist.getAllOrderedParts',
							props.playlist._id
						),
						memoizedIsolatedAutorun(
							(_playlistId: RundownPlaylistId, _currentPartInstanceId, _nextPartInstanceId) =>
								props.playlist.getSelectedPartInstances(),
							'playlist.getSelectedPartInstances',
							props.playlist._id,
							props.playlist.currentPartInstanceId,
							props.playlist.nextPartInstanceId
						),
					] as [
						PartId[],
						{ currentPartInstance: PartInstance | undefined; nextPartInstance: PartInstance | undefined }
					],
				// if the rundown isn't active, run the changes ASAP, we don't care if there's going to be jank
				// if this is the current or next segment (will have those two properties defined), run the changes ASAP,
				// otherwise, trigger the updates in a window of 500-2500 ms from change
				props.playlist.activationId === undefined ? 0 : Math.random() * 2000 + 500
			)

			const orderedSegmentsAndParts = props.playlist.getSegmentsAndPartsSync()
			const rundownOrder = props.playlist.getRundownIDs()
			const rundownIndex = rundownOrder.indexOf(liveSegment.rundownId)
			const rundowns = props.playlist.getRundowns()
			const rundown = rundowns.find((r) => r._id === liveSegment!.rundownId)
			const segmentIndex = orderedSegmentsAndParts.segments.findIndex((s) => s._id === liveSegment!._id)

			if (!rundown) return { active }

			const rundownsToShowstyles = new Map()
			for (const rundown of rundowns) {
				rundownsToShowstyles.set(rundown._id, rundown.showStyleBaseId)
			}

			const o = RundownUtils.getResolvedSegment(
				props.showStyleBase,
				props.playlist,
				rundown,
				liveSegment,
				new Set(orderedSegmentsAndParts.segments.map((s) => s._id).slice(0, segmentIndex)),
				rundownOrder.slice(0, rundownIndex),
				rundownsToShowstyles,
				orderedAllPartIds,
				currentPartInstance,
				nextPartInstance,
				true,
				true
			)

			return { active, liveSegment, parts: o.parts }
		}
		return { active: false }
	},
	(_data, props: ISegmentTimingPanelProps, nextProps: ISegmentTimingPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(SegmentTimingPanelInner)
