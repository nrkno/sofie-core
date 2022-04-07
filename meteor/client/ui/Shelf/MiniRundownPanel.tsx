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
import { RundownPlaylist, RundownPlaylistCollectionUtil } from '../../../lib/collections/RundownPlaylists'
import { PartInstance, PartInstanceId, PartInstances } from '../../../lib/collections/PartInstances'
import { Segment } from '../../../lib/collections/Segments'
import { dashboardElementStyle } from './DashboardPanel'
import { Meteor } from 'meteor/meteor'

interface IMiniRundownPanelProps {
	key: string
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutMiniRundown
	playlist: RundownPlaylist
}

interface IMiniRundownPanelTrackedProps {
	currentPartInstance?: PartInstance
	nextPartInstance?: PartInstance
	allSegments?: Segment[]
}

interface IState {}

interface MiniRundownSegment {
	identifier: string
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
	static nextSegmentId: string = 'mini-rundown__next-segment'

	constructor(props) {
		super(props)
		this.state = {}
	}

	componentDidUpdate() {
		Meteor.setTimeout(() => {
			const container = document.getElementById(MiniRundownPanelInner.panelContainerId)
			const element = document.getElementById(MiniRundownPanelInner.nextSegmentId)
			if (container && element) {
				const magicLineHeight: number = 49
				container.scrollTop = element.offsetTop - magicLineHeight
			}
		}, 500)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const style = getElementStyle(this.props, isDashboardLayout)

		const miniRundowns: MiniRundownSegment[] = getMiniRundownList(
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
					{miniRundowns.map((miniRundown: MiniRundownSegment, index: number) => (
						<div
							className={miniRundown.cssClass}
							{...getIdAttributeForNextSegment(miniRundown.cssClass)}
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
		let nextPartInstance: PartInstance | undefined = undefined

		const currentPartInstanceId: PartInstanceId | null = props.playlist.currentPartInstanceId
		if (currentPartInstanceId) {
			currentPartInstance = PartInstances.findOne(currentPartInstanceId)
		}

		if (props.playlist.nextPartInstanceId) {
			nextPartInstance = PartInstances.findOne(props.playlist.nextPartInstanceId)
		}

		const allSegments: Segment[] = RundownPlaylistCollectionUtil.getSegments(props.playlist)

		return { currentPartInstance, nextPartInstance, allSegments }
	},
	(_data, props: IMiniRundownPanelProps, nextProps: IMiniRundownPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(MiniRundownPanelInner)

function getMiniRundownList(
	allSegments?: Segment[],
	currentPart?: PartInstance,
	nextPart?: PartInstance
): MiniRundownSegment[] {
	const miniRundownSegments: MiniRundownSegment[] = []

	allSegments?.forEach((segment: Segment) => {
		miniRundownSegments.push({
			identifier: getSegmentIdentifier(segment),
			segmentName: getSegmentName(segment),
			cssClass: getSegmentCssClass(segment, currentPart, nextPart),
		})
	})

	return miniRundownSegments
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
	return _.extend(isDashboardLayout ? dashboardElementStyle({ ...(props.panel as DashboardLayoutNextInfo) }) : {}, {
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

function getSegmentIdentifier(segment: Segment | undefined): string {
	return segment?.identifier !== undefined ? segment?.identifier : ''
}

function getElementKey(prefix: string, identifier: string, index: number): string {
	return prefix + identifier + 'index' + index
}

function getIdAttributeForNextSegment(cssClass: string) {
	return cssClass === MiniRundownPanelInner.nextSegmentCssClass ? { id: MiniRundownPanelInner.nextSegmentId } : {}
}
