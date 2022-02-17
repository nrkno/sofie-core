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
import { Meteor } from 'meteor/meteor'

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
	allParts?: Part[]
	allSegments?: Segment[]
}

interface IState {}

interface MiniRundownPart {
	identifier: any
	segmentName: string
	partName: string
	cssClass: string
}

export class MiniRundownPanelInner extends MeteorReactComponent<
	IMiniRundownPanelProps & IMiniRundownPanelTrackedProps,
	IState
> {
	constructor(props) {
		super(props)
		this.state = {}
	}

	componentDidUpdate() {
		Meteor.setTimeout(() => {
			const el = document.getElementById(getCurrentPartIdName())
			if (el) {
				el.scrollIntoView({
					behavior: 'smooth',
				})
			}
		}, 1000)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const style = getElementStyle(this.props, isDashboardLayout)

		const miniRundowns: MiniRundownPart[] = getMiniRundownList(
			this.props.allParts,
			this.props.allSegments,
			this.props.currentPartInstance,
			this.props.nextPartInstance
		)

		return (
			<div
				key={'miniRundownContainer'}
				className={ClassNames('dashboard-panel mini-rundown-panel', getContainerClass(this.props, isDashboardLayout))}
				style={getContainerStyle(this.props, isDashboardLayout)}
			>
				<span className="mini-rundown-panel__name" style={style} key={'miniRundownHeader'}>
					{this.props.panel.name}{' '}
				</span>

				{miniRundowns.map((miniRundown: MiniRundownPart, index: number) => (
					<div
						className={miniRundown.cssClass}
						{...getCurrentPartId(miniRundown.cssClass)}
						key={getElementKey('miniRundownElement', miniRundown.identifier, index)}
					>
						<span
							className="mini-rundown-panel__rank"
							key={getElementKey('miniRundownIdentifier', miniRundown.identifier, index)}
						>
							{miniRundown.identifier}
						</span>
						<span
							className="mini-rundown-panel__segment"
							style={style}
							key={getElementKey('miniRundownSegment', miniRundown.identifier, index)}
						>
							{miniRundown.segmentName}
						</span>
						<span
							className="mini-rundown-panel__part"
							style={style}
							key={getElementKey('miniRundownPart', miniRundown.identifier, index)}
						>
							{miniRundown.partName}
						</span>
					</div>
				))}
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

		const allParts: Part[] = props.playlist.getAllOrderedParts()
		const allSegments: Segment[] = props.playlist.getSegments()

		return { currentSegment, currentPartInstance, nextPartInstance, nextSegment, allParts, allSegments }
	},
	(_data, props: IMiniRundownPanelProps, nextProps: IMiniRundownPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(MiniRundownPanelInner)

function getMiniRundownList(
	allParts?: Part[],
	allSegments?: Segment[],
	currentPart?: PartInstance,
	nextPart?: PartInstance
): MiniRundownPart[] {
	const miniRundownParts: MiniRundownPart[] = []

	allParts?.forEach((part: Part) => {
		const segment = getSegment(allSegments, part)

		miniRundownParts.push({
			identifier: getSegmentIdentifier(segment),
			segmentName: getSegmentName(segment),
			partName: getPartTitle(part),
			cssClass: getRowCssClass(part, currentPart, nextPart),
		})
	})

	return miniRundownParts
}

function getSegment(allSegments?: Segment[], part?: Part): Segment | undefined {
	let foundSegment: Segment | undefined = undefined
	allSegments?.every((segment: Segment) => {
		if (unprotectString(segment._id) === unprotectString(part?.segmentId)) {
			foundSegment = segment
			return false
		}
		return true
	})
	return foundSegment
}

function getRowCssClass(part: Part, currentPart?: PartInstance, nextPart?: PartInstance): string {
	if (part._id === currentPart?.part._id) {
		return 'current-part'
	}
	if (part._id === nextPart?.part._id) {
		return 'next-part'
	}
	return 'part'
}

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

function getSegmentName(segment: Segment | undefined): string {
	return segment?.name !== undefined ? segment?.name : ''
}

function getPartTitle(part: Part | undefined): string {
	return part?.title !== undefined ? part?.title : ''
}

function getSegmentIdentifier(segment: Segment | undefined): any {
	return segment?.identifier !== undefined ? segment?.identifier : ''
}

function getElementKey(prefix: string, identifier: string, index: number): string {
	return prefix + identifier + 'index' + index
}

function getCurrentPartId(cssClass: string) {
	return cssClass === 'current-part' ? { id: getCurrentPartIdName() } : {}
}

function getCurrentPartIdName(): string {
	return 'mini-rundown__current-part'
}
