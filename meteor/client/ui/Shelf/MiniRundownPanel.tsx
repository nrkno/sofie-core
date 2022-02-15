import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	DashboardLayoutMiniRundown,
	RundownLayoutMiniRundown,
	DashboardLayoutNextInfo,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PartInstance, PartInstanceId, PartInstances } from '../../../lib/collections/PartInstances'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { dashboardElementPosition } from './DashboardPanel'
import { Part } from '../../../lib/collections/Parts'
import { unprotectString } from '../../../lib/lib'
interface IMiniRundownPanelProps {
	key: string
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutMiniRundown
	playlist: RundownPlaylist
}

interface IMiniRundownPanelTrackedProps {
	currentSegment?: Segment
	currentPartInstance?: PartInstance
	nextPartInstance?: PartInstance
	nextSegment?: Segment
}

interface IState {}

interface MiniRundownPart {
	identifier: any
	segmentName: string
	partName: string
}

interface NextSegmentAndPart {
	segment: Segment | undefined
	part: Part | undefined
}

export class MiniRundownPanelInner extends MeteorReactComponent<
	IMiniRundownPanelProps & IMiniRundownPanelTrackedProps,
	IState
> {
	constructor(props) {
		super(props)
		this.state = {}
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const style = getElementStyle(this.props, isDashboardLayout)
		const showAny = isShowAnyValues(this.props)

		const current = getMiniRundownPart(
			this.props,
			showAny,
			this.props.currentSegment,
			this.props.currentPartInstance?.part
		)
		const next = getMiniRundownPart(this.props, showAny, this.props.nextSegment, this.props.nextPartInstance?.part)

		const allParts: Part[] = this.props.playlist.getAllOrderedParts()
		const allSegments: Segment[] = this.props.playlist.getSegments()

		const secondSegmentAndPart = getNextSegmentAndPart(
			allParts,
			allSegments,
			showAny,
			this.props.nextPartInstance?.part
		)
		const second = getMiniRundownPart(this.props, showAny, secondSegmentAndPart.segment, secondSegmentAndPart.part)

		const thirdSegmentAndPart = getNextSegmentAndPart(allParts, allSegments, showAny, secondSegmentAndPart.part)
		const third = getMiniRundownPart(this.props, showAny, thirdSegmentAndPart.segment, thirdSegmentAndPart.part)

		return (
			<div
				className={ClassNames('dashboard-panel mini-rundown-panel', getContainerClass(this.props, isDashboardLayout))}
				style={getContainerStyle(this.props, isDashboardLayout)}
			>
				<span className="mini-rundown-panel__name" style={style}>
					{showAny && this.props.panel.name}{' '}
				</span>
				<div className="current-part">
					<span className="mini-rundown-panel__rank">{current.identifier}</span>
					<span className="mini-rundown-panel__segment" style={style}>
						{current.segmentName}
					</span>
					<span className="mini-rundown-panel__part" style={style}>
						{current.partName}
					</span>
				</div>

				<div className="next-part">
					<span className="mini-rundown-panel__rank">{next.identifier}</span>
					<span className="mini-rundown-panel__segment" style={style}>
						{next.segmentName}
					</span>
					<span className="mini-rundown-panel__part" style={style}>
						{next.partName}
					</span>
				</div>

				<div className="second-part">
					<span className="mini-rundown-panel__rank">{second.identifier}</span>
					<span className="mini-rundown-panel__segment" style={style}>
						{second.segmentName}
					</span>
					<span className="mini-rundown-panel__part" style={style}>
						{second.partName}
					</span>
				</div>

				<div className="third-part">
					<span className="mini-rundown-panel__rank">{third.identifier}</span>
					<span className="mini-rundown-panel__segment" style={style}>
						{third.segmentName}
					</span>
					<span className="mini-rundown-panel__part" style={style}>
						{third.partName}
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

function getContainerClass(props, isDashboardLayout: boolean): string[] | undefined {
	return isDashboardLayout ? (props.panel as DashboardLayoutMiniRundown).customClasses : undefined
}

function getContainerStyle(props, isDashboardLayout: boolean): any {
	return _.extend(isDashboardLayout ? dashboardElementPosition({ ...(props.panel as DashboardLayoutNextInfo) }) : {}, {
		visibility: props.visible ? 'visible' : 'hidden',
	})
}

function getElementStyle(props, isDashboardLayout: boolean) {
	return {
		fontSize: isDashboardLayout ? ((props.panel as DashboardLayoutMiniRundown).scale || 1) + 'em' : undefined,
	}
}

function isShowAnyValues(props): boolean {
	return !props.panel.hideForDynamicallyInsertedParts || props.nextPartInstance?.orphaned !== 'adlib-part'
}

function getNextSegmentAndPart(
	allParts: Part[],
	allSegments: Segment[],
	showAny: boolean,
	previousPart?: Part
): NextSegmentAndPart {
	let getNext: boolean = false
	let nextPart: Part | undefined = undefined
	allParts.every((part: Part) => {
		if (getNext) {
			nextPart = part
			return false
		}

		if (part._id === previousPart?._id) {
			getNext = true
		}

		return true
	})

	let nextSegment: Segment | undefined = undefined
	allSegments.every((segment: Segment) => {
		if (unprotectString(segment._id) === unprotectString(nextPart?.segmentId)) {
			nextSegment = segment
			return false
		}
		return true
	})

	return { segment: nextSegment, part: nextPart }
}

function getMiniRundownPart(
	props,
	showAny: boolean,
	segment: Segment | undefined,
	part: Part | undefined
): MiniRundownPart {
	return {
		identifier: getSegmentIdentifier(showAny, segment),
		segmentName: getSegmentName(props, showAny, segment),
		partName: getPartTitle(props, showAny, part),
	}
}

function getSegmentName(props, showAny: boolean, segment: Segment | undefined): string {
	return showAny && segment?.name
}

function getPartTitle(props, showAny: boolean, part: Part | undefined): string {
	return showAny && part?.title !== undefined ? part?.title : ''
}

function getSegmentIdentifier(showAny: boolean, segment: Segment | undefined): any {
	return showAny && segment?.identifier
}
