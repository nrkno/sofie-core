/*
Please note that the contents of this file is quite unstructured and for test purposes only
*/

import * as React from 'react'
import * as _ from 'underscore'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'

import { Rundowns, Rundown } from '../../lib/collections/Rundowns'
import { Segments, Segment } from '../../lib/collections/Segments'
import { Timeline, TimelineObjGeneric } from '../../lib/collections/Timeline'
import { TimelineState } from 'superfly-timeline'
import { SegmentLines, SegmentLine } from '../../lib/collections/SegmentLines'
import { MediaObjects, MediaObject } from '../../lib/collections/MediaObjects'
import { Resolver, Enums } from 'superfly-timeline'
import { transformTimeline } from '../../lib/timeline'
import { Time } from '../../lib/lib'
import { getCurrentTimeReactive } from '../lib/currentTimeReactive'
import { makeTableOfObject } from '../lib/utilComponents'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'

// ----------------------------------------------------------------------------
interface INPProps {

}
export class NymansPlayground extends MeteorReactComponent<INPProps> {
	componentWillMount () {
		// Subscribe to data:
		this.autorun(() => {
			this.subscribe('timeline', {})

			this.subscribe('rundowns', {
				active: true
			})
			this.subscribe('studioInstallations', {})
			this.subscribe('showStyleBases', {})
			this.subscribe('showStyleVariants', {})
			let activeRO = Rundowns.findOne({active: true})
			if (activeRO) {
				this.subscribe('segments', {
					rundownId: activeRO._id
				})
				this.subscribe('segmentLines', {
					rundownId: activeRO._id
				})
				this.subscribe('pieces', {
					rundownId: activeRO._id
				})
				this.subscribe('adLibPieces', {
					rundownId: activeRO._id
				})
			}
		})
	}
	render () {
		return (
			<div>
				<h1>Nyman's playground</h1>
				<div>
					<ComponentTimelineSimulate />
				</div>
				<div>
					<ComponentMediaObjects />
				</div>
				<div>
					<ComponentRundowns />
				</div>
				<div>
					<ComponentTimeline />
				</div>
			</div>
		)
	}
}
interface IRundowns {
	rundowns: Array<Rundown>,
	mediaObjects: Array<MediaObject>,
}
export const ComponentMediaObjects = withTracker(() => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		mediaObjects: MediaObjects.find({}, { sort: { _id: 1 } }).fetch()

	}
})(
class extends MeteorReactComponent<IRundowns> {
	renderMOs () {

		return this.props.mediaObjects.map((mo) => (
			<div key={mo._id}>

				<div>_id: <i>{mo._id}</i></div>
				<div>_rev: <i>{mo._rev}</i></div>
				<div>mediaPath: <i>{mo.mediaPath}</i></div>
				<div>mediaSize: <i>{mo.mediaSize}</i></div>
				<div>mediaTime: <i>{mo.mediaTime}</i></div>
				{/* <div>mediainfo: <i>{mo.mediainfo}</i></div> */}

				<div>thumbSize: <i>{mo.thumbSize}</i></div>
				<div>thumbTime: <i>{mo.thumbTime}</i></div>
				<div>previewSize: <i>{mo.previewSize}</i></div>
				<div>previewTime: <i>{mo.previewTime}</i></div>
				<div>cinf: <i>{mo.cinf}</i></div>
				<div>tinf: <i>{mo.tinf}</i></div>
				<div>studioId: <i>{mo.studioId}</i></div>
				<div>collectionId: <i>{mo.collectionId}</i></div>
				<div>objId: <i>{mo.objId}</i></div>
			</div>
		))
	}
	render () {
		return (
			<div>
				<h2>Media Objects</h2>
				<div>
					{this.renderMOs()}
				</div>
			</div>
		)
	}
})
interface IRundowns {
	rundowns: Array<Rundown>
}
export const ComponentRundowns = withTracker(() => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		rundowns: Rundowns.find({}, { sort: { createdAt: -1 } }).fetch()

	}
})(
class extends MeteorReactComponent<IRundowns> {
	renderROs () {

		return this.props.rundowns.map((rundown) => (
			<div key={rundown._id}>
				<div>ID: <i>{rundown._id}</i></div>
				<div>Created: {rundown.created}</div>

				<div>externalId: {rundown.externalId}</div>
				<div>studioInstallationId: {rundown.studioInstallationId}</div>
				<div>showStyleBaseId: {rundown.showStyleBaseId}</div>
				<div>showStyleVariantId: {rundown.showStyleVariantId}</div>
				<div>name: {rundown.name}</div>
				<div>created: {rundown.created}</div>

				<div>metaData: {makeTableOfObject(rundown.metaData)}</div>
				<div>status: {makeTableOfObject(rundown.status)}</div>
				<div>airStatus: {makeTableOfObject(rundown.airStatus)}</div>

				<div>currentSegmentLineId: {rundown.currentSegmentLineId}</div>
				<div>nextSegmentLineId: {rundown.nextSegmentLineId}</div>

				<div>
					<ComponentSegments rundownId={rundown._id} />
				</div>
			</div>
		))
	}
	render () {
		return (
			<div>
				<h2>Rundowns</h2>
				<div>
					{this.renderROs()}
				</div>
			</div>
		)
	}
})
interface ISegmentsProps {
	rundownId?: string
}
interface ISegmentsState {
}
interface ISegmentsTrackedProps {
	segments: Array<Segment>
}
export const ComponentSegments = withTracker<ISegmentsProps, ISegmentsState, ISegmentsTrackedProps>((props: ISegmentsProps) => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		segments: (
			props.rundownId ?
			Segments.find({
				rundownId: props.rundownId
			}, { sort: { _rank: 1 } }).fetch()
			: []
		)
	}
})(
class extends MeteorReactComponent<ISegmentsProps & ISegmentsTrackedProps, ISegmentsState> {
	renderROs () {

		return this.props.segments.map((segment) => (
			<div key={segment._id}>
				<b>Segment</b>
				<div>ID: <i>{segment._id}</i></div>
				<div>Name: <i>{segment.name}</i></div>
				<div>
				<ComponentSegmentLines segmentId={segment._id} />
				</div>
			</div>
		))
	}
	render () {
		return (
			<div>
				<h2>Segments</h2>
				<div>
					{this.renderROs()}
				</div>
			</div>
		)
	}
})
interface ISegmentLineProps {
	segmentId?: string
}
interface ISegmentLineState {
}
interface ISegmentLineTrackedState {
	segmentLines: Array<SegmentLine>
}
export const ComponentSegmentLines = withTracker<ISegmentLineProps, ISegmentLineState, ISegmentLineTrackedState>((props: ISegmentLineProps) => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		segmentLines: (
			props.segmentId ?
			SegmentLines.find({
				segmentId: props.segmentId
			}, { sort: { _rank: 1 } }).fetch()
			: []
		)
	}
})(
class extends MeteorReactComponent<ISegmentLineProps & ISegmentLineTrackedState, ISegmentLineState> {
	renderROs () {

		return this.props.segmentLines.map((segmentLine) => (
			<div key={segmentLine._id}>
				<b>SegmentLine</b>
				<div>ID: <i>{segmentLine._id}</i></div>
				<div>externalId: <i>{segmentLine.externalId}</i></div>
			</div>
		))
	}
	render () {
		return (
			<div>
				<div>
					{this.renderROs()}
				</div>
			</div>
		)
	}
})
interface ITimeline {
	timeline: Array<TimelineObjGeneric>
}
export const ComponentTimeline = withTracker(() => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		timeline: Timeline.find({}, { sort: { _id: 1 } }).fetch()
	}
})(
class extends MeteorReactComponent<ITimeline> {
	renderTimeline () {
		return this.props.timeline.map((timelineObj) => (
			<div key={timelineObj._id}>
				<table><tbody>
				<tr><td>ID:</td><td> <i>{timelineObj._id}</i></td></tr>
				{/* <tr><td>DeviceId:</td><td> <EditAttribute type='text' collection={Timeline}	obj={timelineObj} attribute='deviceId'/> </td></tr>
				<tr><td>trigger.type:</td><td> <EditAttribute type='dropdown' collection={Timeline}	obj={timelineObj} attribute='trigger.type' options={TriggerType} /></td></tr>
				<tr><td>trigger.value:</td><td> <EditAttribute type='text' collection={Timeline}	obj={timelineObj} attribute='trigger.value'/></td></tr>
				<tr><td>duration:</td><td> <EditAttribute type='text' collection={Timeline}	obj={timelineObj} attribute='duration'/></td></tr>
				<tr><td>LLayer:</td><td> <EditAttribute type='text' collection={Timeline}	obj={timelineObj} attribute='LLayer'/></td></tr>
				<tr><td>disabled:</td><td> <EditAttribute type='checkbox' collection={Timeline}	obj={timelineObj} attribute='disabled'/></td></tr> */}

				<tr><td>trigger.type:</td><td>{timelineObj.trigger.type}</td></tr>
				<tr><td>trigger.value:</td><td>{timelineObj.trigger.value}</td></tr>
				<tr><td>duration:</td><td>{timelineObj.duration} </td></tr>
				<tr><td>LLayer:</td><td>{timelineObj.LLayer} </td></tr>
				<tr><td>disabled:</td><td>{timelineObj.disabled} </td></tr>
				<tr><td>
					<strong>Content</strong>
				</td></tr>
					{/* <tr><td>type:</td><td> <EditAttribute tye='dropdown' collection={Timeline}	obj={timelineObj} attribute='content.type' options={TimelineContentType} /></td></tr> */}

				</tbody></table>
			</div>
		))
	}
	render () {
		return (
			<div>
				<h2>Timeline objects</h2>
				<div>
					{this.renderTimeline()}
				</div>
			</div>
		)
	}
})

interface ITimelineSimulate {
	state: TimelineState
	now: Time
}
export const ComponentTimelineSimulate = withTracker(() => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	let timeline = transformTimeline(
		Timeline.find({}, { sort: { _id: 1 } }).fetch()
	)

	// pre-process the timeline
	let now = getCurrentTimeReactive()

	let tl = Resolver.getTimelineInWindow(timeline)

	let state = Resolver.getState(tl, now)

	return {
		now: now,
		state: state
	}
})(
class extends MeteorReactComponent<ITimelineSimulate> {
	renderTimelineState () {
		return _.map(this.props.state.GLayers, (o, GLayerId) => (
			<tr key={GLayerId}>
				<td>{GLayerId}</td>
				<td>{o.id}</td>
				<td>{Enums.TriggerType[o.trigger.type]}</td>
				<td>{o.trigger.value}</td>
				<td>{o.duration}</td>
				<td>{o.content.type}</td>
				<td>{makeTableOfObject(o.content)}</td>
			</tr>
		))
	}
	render () {
		return (
			<div>
				<h2>Timeline state</h2>
				<div>
					Time: {this.props.now}
					<div>
						<table><tbody>
							<tr>
								<th>GLayer</th>
								<th>id</th>
								<th>Trigger.type</th>
								<th>Trigger.value</th>
								<th>Duration</th>
								<th>content</th>
							</tr>
							{this.renderTimelineState()}
						</tbody></table>
					</div>
				</div>
			</div>
		)
	}
})
