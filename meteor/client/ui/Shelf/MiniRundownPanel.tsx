import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	DashboardLayoutNextInfo,
	RundownLayoutNextInfo,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import {PartInstance, PartInstanceId, PartInstances} from '../../../lib/collections/PartInstances'
import { Segment, Segments } from '../../../lib/collections/Segments'
interface IMiniRundownPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutNextInfo
	playlist: RundownPlaylist
}

interface IMiniRundownPanelTrackedProps {
	currentSegment?: Segment
	currentPartInstance?: PartInstance
	nextPartInstance?: PartInstance
	nextSegment?: Segment
}

interface IState {}

export class MiniRundownPanelInner extends MeteorReactComponent<IMiniRundownPanelProps & IMiniRundownPanelTrackedProps, IState> {
	constructor(props) {
		super(props)
		this.state = {}
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const showAny = isShowAny()
		const currentSegmentRank: any = getSegmentRank(showAny, this.props.currentSegment)
		const currentSegmentName: string = getNextSegmentName(showAny, this.props.currentSegment)
		const currentPartTitle = getNextPartTitle(showAny, this.props.currentPartInstance)
		const nextSegmentRank: any = getSegmentRank(showAny, this.props.nextSegment)
		const nextSegmentName: string = getNextSegmentName(showAny, this.props.nextSegment)
		const nextPartTitle: string = getNextPartTitle(showAny, this.props.nextPartInstance)
		const style = getElementStyle(isDashboardLayout)

		return (
			<div className={ClassNames('next-info-panel', getContainerClass(isDashboardLayout))}>
				<div className="current-part">
					<span className="mini-rundown-panel__rank">
						{currentSegmentRank}
					</span>
					<span className="mini-rundown-panel__segment" style={style}>
						{currentSegmentName}
					</span>
					<span className="mini-rundown-panel__part" style={style}>
						{currentPartTitle}
					</span>
				</div>

				<div  className="next-part">
					<span className="mini-rundown-panel__rank">
						{nextSegmentRank}
					</span>
					<span className="mini-rundown-panel__segment" style={style}>
						{nextSegmentName}
					</span>
					<span className="mini-rundown-panel__part" style={style}>
						{nextPartTitle}
					</span>
				</div>
			</div>
		)
	}
}

export const MiniRundownPanel = withTracker<IMiniRundownPanelProps, IState, IMiniRundownPanelTrackedProps>(
	(props: IMiniRundownPanelProps & IMiniRundownPanelTrackedProps) => {
		let currentPartInstance: PartInstance | undefined = undefined
		let currentSegment: Segment | undefined = undefined
		let nextPartInstance: PartInstance | undefined = undefined
		let nextSegment: Segment | undefined = undefined

		const currentPartInstanceId: PartInstanceId | null = props.playlist.currentPartInstanceId
		if (currentPartInstanceId) {
			currentPartInstance = PartInstances.findOne(currentPartInstanceId)
		}

		if (currentPartInstance) {
			currentSegment = Segments.findOne(currentPartInstance.segmentId)
		}

		if (props.playlist.nextPartInstanceId) {
			nextPartInstance = PartInstances.findOne(props.playlist.nextPartInstanceId)
		}

		if (nextPartInstance) {
			nextSegment = Segments.findOne(nextPartInstance.segmentId)
		}
		return { currentSegment, currentPartInstance, nextPartInstance, nextSegment }
	},
	(_data, props: IMiniRundownPanelProps, nextProps: IMiniRundownPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(MiniRundownPanelInner)

function getContainerClass(isDashboardLayout: boolean): string[] | undefined {
	return isDashboardLayout ? (this.props.panel as DashboardLayoutNextInfo).customClasses : undefined
}

function getElementStyle(isDashboardLayout: boolean) {
	return {
		fontSize: isDashboardLayout ? ((this.props.panel as DashboardLayoutNextInfo).scale || 1) * 1.5 + 'em' : undefined,
	}
}

function isShowAny(): boolean {
	return !this.props.panel.hideForDynamicallyInsertedParts || this.props.nextPartInstance?.orphaned !== 'adlib-part'
}

function getNextSegmentName(showAny: boolean, segment: Segment | undefined): string {
	return showAny && this.props.panel.showSegmentName && segment?.name
}

function getNextPartTitle(showAny: boolean, partInstance: PartInstance | undefined): string {
	return showAny && this.props.panel.showPartTitle && partInstance?.part.title
}

function getSegmentRank(showAny: boolean, segment: Segment | undefined): any {
	return showAny && segment?._rank
}

