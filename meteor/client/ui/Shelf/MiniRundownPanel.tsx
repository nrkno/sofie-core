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
	allSegments?: Segment[]
}

interface IState {}

interface MiniRundownPart {
	identifier: any
	segmentName: string
	cssClass: string
}

export class MiniRundownPanelInner extends MeteorReactComponent<
	IMiniRundownPanelProps & IMiniRundownPanelTrackedProps,
	IState
> {
	static currentSegmentCssClass: string = 'current-segment'
	static nextSegmentCssClass: string = 'next-segment'
	static panelContainerId: string = 'mini-rundown-panel__container'
	static currentSegmentId: string = 'mini-rundown__current-segment'

	constructor(props) {
		super(props)
		this.state = {}
	}

	componentDidUpdate() {
		Meteor.setTimeout(() => {
			const container = document.getElementById(MiniRundownPanelInner.panelContainerId)
			const element = document.getElementById(MiniRundownPanelInner.currentSegmentId)
			if (container && element) {
				const magicLineHeight: number = 30
				container.scrollTop = element.offsetTop - magicLineHeight
			}
		}, 500)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const style = getElementStyle(this.props, isDashboardLayout)

		const miniRundowns: MiniRundownPart[] = getMiniRundownList(
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

				<div className={MiniRundownPanelInner.panelContainerId} id={MiniRundownPanelInner.panelContainerId}>
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
						</div>
					))}
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

		const allSegments: Segment[] = props.playlist.getSegments()

		return { currentSegment, currentPartInstance, nextPartInstance, nextSegment, allSegments }
	},
	(_data, props: IMiniRundownPanelProps, nextProps: IMiniRundownPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(MiniRundownPanelInner)

function getMiniRundownList(
	allSegments?: Segment[],
	currentPart?: PartInstance,
	nextPart?: PartInstance
): MiniRundownPart[] {
	const miniRundownParts: MiniRundownPart[] = []

	allSegments?.forEach((segment: Segment) => {
		miniRundownParts.push({
			identifier: getSegmentIdentifier(segment),
			segmentName: getSegmentName(segment),
			cssClass: getSegmentCssClass(segment, currentPart, nextPart),
		})
	})


	return miniRundownParts
}

function getSegmentCssClass(segment: Segment, currentPart?: PartInstance, nextPart?: PartInstance): string {
	if (segment._id === currentPart?.segmentId) {
		return MiniRundownPanelInner.currentSegmentCssClass
	}

	if (segment._id === nextPart?.segmentId) {
		return MiniRundownPanelInner.nextSegmentCssClass
	}

	return ''
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

function getSegmentIdentifier(segment: Segment | undefined): any {
	return segment?.identifier !== undefined ? segment?.identifier : ''
}

function getElementKey(prefix: string, identifier: string, index: number): string {
	return prefix + identifier + 'index' + index
}

function getCurrentPartId(cssClass: string) {
	return cssClass === MiniRundownPanelInner.currentSegmentCssClass ? { id: MiniRundownPanelInner.currentSegmentId } : {}
}
