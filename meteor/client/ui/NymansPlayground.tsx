/*
Please note that the contents of this file is quite unstructured and for test purposes only
*/

import * as React from 'react'
import * as _ from 'underscore'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'

import { Task, Tasks } from '../../lib/collections/Tasks'
import { Mongo } from 'meteor/mongo'
import { RunningOrders, RunningOrder } from '../../lib/collections/RunningOrders'
import { Segments, Segment } from '../../lib/collections/Segments'
import { Timeline, TimelineObj } from '../../lib/collections/Timeline'
import { TriggerType, TimelineState } from 'superfly-timeline'
import { SegmentLines, SegmentLine } from '../../lib/collections/SegmentLines'
import { MediaObjects, MediaObject } from '../../lib/collections/MediaObjects'
import { Resolver, Enums } from 'superfly-timeline'
import { transformTimeline } from '../../lib/timeline'
import { getCurrentTime, Time } from '../../lib/lib'
import { getCurrentTimeReactive } from '../lib/currentTimeReactive'

// ----------------------------------------------------------------------------

interface IEditAttribute extends IPropsEditAttributeBase {
	type: string
}
class EditAttribute extends React.Component<IEditAttribute> {
	render () {

		if (this.props.type === 'text') {
			return (
				<EditAttributeText {...this.props} />
			)
		} else if (this.props.type === 'int') {
			return (
				<EditAttributeInt {...this.props} />
			)
		} else if (this.props.type === 'checkbox') {
			return (
				<EditAttributeCheckbox {...this.props} />
			)
		} else if (this.props.type === 'dropdown') {
			return (
				<EditAttributeDropdown {...this.props} />
			)
		}
	}
}
interface IPropsEditAttributeBase {
	updateOnKey?: boolean,
	attribute: string,
	collection: Mongo.Collection<any>,
	myObject?: any,
	obj?: any
	options?: any
}
interface IStateEditAttributeBase {
	value: any,
	editing: boolean
}
class EditAttributeBase extends React.Component<IPropsEditAttributeBase, IStateEditAttributeBase> {
	constructor (props) {
		super(props)

		this.state = {
			value: this.getAttribute(),
			editing: false
		}

		this.handleEdit 	= this.handleEdit.bind(this)
		this.handleUpdate 	= this.handleUpdate.bind(this)
	}
	handleEdit (newValue) {
		this.setState({
			value: newValue,
			editing: true
		})
		if (this.props.updateOnKey) {
			this.updateValue(newValue)
		}
	}
	handleUpdate (newValue) {
		this.setState({
			value: newValue,
			editing: false
		})

		this.updateValue(newValue)
	}
	deepAttribute (obj,attr): any {
		// Returns a value deep inside an object
		// Example: deepAttribute(company,"ceo.address.street");

		const f = (obj, attr) => {
			if (obj) {
				let attributes = attr.split('.')

				if (attributes.length > 1) {
					let outerAttr = attributes.shift()
					let innerAttrs = attributes.join('.')

					return f(obj[outerAttr],innerAttrs)

				} else {
					return obj[attributes[0]]
				}
			} else {
				return obj
			}
		}
		return f(obj,attr)
	}
	getAttribute () {
		return this.deepAttribute(this.props.myObject, this.props.attribute)
	}
	getAttributeText () {
		return this.getAttribute()
	}
	getEditAttribute () {
		return ( this.state.editing ? this.state.value : this.getAttribute())
	}
	updateValue (newValue) {
		let m = {}
		m[this.props.attribute] = newValue
		this.props.collection.update(this.props.obj._id, {$set: m})
	}
}
let wrapEditAttribute = (newClass) => {
	return withTracker((props) => {
		// These properties will be exposed under this.props
		// Note that these properties are reactively recalculated
		return {
			myObject: props.collection.findOne(props.obj._id)
		}
	})(newClass)
}

const EditAttributeText = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)

		this.handleChange 	= this.handleChange.bind(this)
		this.handleBlur 	= this.handleBlur.bind(this)
	}
	handleChange (event) {
		this.handleEdit(event.target.value)
	}
	handleBlur (event) {
		this.handleUpdate(event.target.value)
	}
	render () {
		return (
			<div>
				<input type='text'
					className='form-control'

					value={this.getEditAttribute() || ''}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
				/>

			</div>
		)
	}
})
const EditAttributeInt = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)

		this.handleChange 	= this.handleChange.bind(this)
		this.handleBlur 	= this.handleBlur.bind(this)
	}
	handleChange (event) {
		this.handleEdit(event.target.value)
	}
	handleBlur (event) {
		this.handleUpdate(parseInt(event.target.value, 10))
	}
	render () {
		return (
			<div>
				<input type='number'
					step='1'
					className='form-control'

					value={this.getEditAttribute()}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
				/>

			</div>
		)
	}
})
const EditAttributeCheckbox = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)

		this.handleChange 	= this.handleChange.bind(this)
	}
	isChecked () {
		return !!this.getEditAttribute()
	}
	handleChange (event) {

		this.handleUpdate(!this.state.value)
	}
	render () {
		return (
			<div>
				<input type='checkbox'
					className='form-control'

					checked={this.isChecked()}
					onChange={this.handleChange}
				/>
			</div>
		)
	}
})
const EditAttributeDropdown = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)

		this.handleChange 	= this.handleChange.bind(this)
	}
	isChecked () {
		return !!this.getEditAttribute()
	}
	handleChange (event) {
		this.handleUpdate(event.target.value)
	}
	getOptions () {
		let options: Array<{value: any, name: string, i?: number}> = []

		if (Array.isArray(this.props.options)) {
			for (let key in this.props.options) {
				let val = this.props.options[key]
				if (typeof val === 'object') {
					options.push({
						name: val.name,
						value: val.value
					})
				} else {
					options.push({
						name: val,
						value: val
					})
				}
			}
		} else if (typeof this.props.options === 'object') {
			for (let key in this.props.options) {
				let val = this.props.options[key]
				options.push({
					name: key + ': ' + val,
					value: val
				})
			}
		}

		for (let i = 0; i < options.length; i++) {
			options[i].i = i
		}
		
		return options
	}
	render () {
		return (
			<div>
				<select
					value={this.getAttribute()}
					onChange={this.handleChange}
				>
					{this.getOptions().map((o) => (
						<option key={o.i} value={o.value}>{o.name}</option>
					))}
				</select>
			</div>
		)
	}
})
// ----------------------------------------------------------------------------
interface IEditTasks {
	tasks: Array<Task>
}
export const EditTasks = withTracker(() => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		tasks: Tasks.find({}, { sort: { createdAt: -1 } }).fetch()
	}
})(
class extends React.Component<IEditTasks> {
	renderTasks () {

		return this.props.tasks.map((task) => (
			<div key={task._id}>
				Edit Task:
				<div>
					Text:
					<EditAttribute
						collection={Tasks}
						obj={task}
						type='text'
						attribute='text'
					/>
				</div>
				<div>
					Text (updated on key):
					<EditAttribute
						collection={Tasks}
						obj={task}
						type='text'
						attribute='text'
						updateOnKey={true}
					/>
				</div>
				<div>
					Checkbox:
					<EditAttribute
						collection={Tasks}
						obj={task}
						type='checkbox'
						attribute='checked'
					/>
					<EditAttribute
						collection={Tasks}
						obj={task}
						type='checkbox'
						attribute='checked'
					/>
				</div>

			</div>
		))
	}
	render () {
		return (
			<div>
				EditTasks
				<div>
					{this.renderTasks()}
				</div>
			</div>
		)
	}
})
// ----------------------------------------------------------------------------
export class NymansPlayground extends React.Component {
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
					<ComponentRunningOrders />
				</div>
				<div>
					<ComponentTimeline />
				</div>
			</div>
		)
	}
}
interface IRunningOrders {
	runningOrders: Array<RunningOrder>,
	mediaObjects: Array<MediaObject>,
}
export const ComponentMediaObjects = withTracker(() => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		mediaObjects: MediaObjects.find({}, { sort: { _id: 1 } }).fetch()

	}
})(
class extends React.Component<IRunningOrders> {
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
interface IRunningOrders {
	runningOrders: Array<RunningOrder>
}
export const ComponentRunningOrders = withTracker(() => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		runningOrders: RunningOrders.find({}, { sort: { createdAt: -1 } }).fetch()

	}
})(
class extends React.Component<IRunningOrders> {
	renderROs () {

		return this.props.runningOrders.map((ro) => (
			<div key={ro._id}>
				<div>ID: <i>{ro._id}</i></div>
				<div>Created: {ro.created}</div>

				<div>mosId: {ro.mosId}</div>
				<div>studioInstallationId: {ro.studioInstallationId}</div>
				<div>showStyleId: {ro.showStyleId}</div>
				<div>name: {ro.name}</div>
				<div>created: {ro.created}</div>

				<div>metaData: {ro.metaData}</div>
				<div>status: {ro.status}</div>
				<div>airStatus: {ro.airStatus}</div>

				<div>currentSegmentLineId: {ro.currentSegmentLineId}</div>
				<div>nextSegmentLineId: {ro.nextSegmentLineId}</div>

				<div>
					<ComponentSegments runningOrderId={ro._id} />
				</div>
			</div>
		))
	}
	render () {
		return (
			<div>
				<h2>Running orders</h2>
				<div>
					{this.renderROs()}
				</div>
			</div>
		)
	}
})
interface ISegments {
	segments: Array<Segment>
	runningOrderId?: String
}
export const ComponentSegments = withTracker((props) => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		segments: Segments.find({
			runningOrderId: props.runningOrderId
		}, { sort: { _rank: 1 } }).fetch()
	}
})(
class extends React.Component<ISegments> {
	renderROs () {

		return this.props.segments.map((segment) => (
			<div key={segment._id}>
				<b>Segment</b>
				<div>ID: <i>{segment._id}</i></div>
				<div>Name: <i>{segment.name}</i></div>
				<div>Number: <i>{segment.number}</i></div>
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
interface ISegmentLine {
	segmentLines: Array<SegmentLine>
	segmentId?: String
}
export const ComponentSegmentLines = withTracker((props) => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		segmentLines: SegmentLines.find({
			segmentId: props.segmentId
		}, { sort: { _rank: 1 } }).fetch()
	}
})(
class extends React.Component<ISegmentLine> {
	renderROs () {

		return this.props.segmentLines.map((segmentLine) => (
			<div key={segmentLine._id}>
				<b>SegmentLine</b>
				<div>ID: <i>{segmentLine._id}</i></div>
				<div>MosId: <i>{segmentLine.mosId}</i></div>
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
	timeline: Array<TimelineObj>
}
export const ComponentTimeline = withTracker(() => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		timeline: Timeline.find({}, { sort: { _id: 1 } }).fetch()
	}
})(
class extends React.Component<ITimeline> {
	renderTimeline () {
		return this.props.timeline.map((timelineObj) => (
			<div key={timelineObj._id}>
				<table><tbody>
				<tr><td>ID:</td><td> <i>{timelineObj._id}</i></td></tr>
				<tr><td>DeviceId:</td><td> <EditAttribute type='text' collection={Timeline}	obj={timelineObj} attribute='deviceId'/> </td></tr>
				<tr><td>trigger.type:</td><td> <EditAttribute type='dropdown' collection={Timeline}	obj={timelineObj} attribute='trigger.type' options={TriggerType} /></td></tr>
				<tr><td>trigger.value:</td><td> <EditAttribute type='text' collection={Timeline}	obj={timelineObj} attribute='trigger.value'/></td></tr>
				<tr><td>duration:</td><td> <EditAttribute type='text' collection={Timeline}	obj={timelineObj} attribute='duration'/></td></tr>
				<tr><td>LLayer:</td><td> <EditAttribute type='text' collection={Timeline}	obj={timelineObj} attribute='LLayer'/></td></tr>
				<tr><td>disabled:</td><td> <EditAttribute type='checkbox' collection={Timeline}	obj={timelineObj} attribute='disabled'/></td></tr>
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
class extends React.Component<ITimelineSimulate> {
	renderTimelineState () {

		let tableize = (o: any) => {
			return (
				<table><tbody>
					{_.map(o, (val, key) => {
						return (
							<tr key={key}>
								<td>{key}</td>
								<td>{(
									_.isObject(val) ? tableize(val) : val
								)}</td>
							</tr>
						)
					})}
				</tbody></table>
			)
		}

		return _.map(this.props.state.GLayers, (o, GLayerId) => (
			<tr key={GLayerId}>
				<td>{GLayerId}</td>
				<td>{o.id}</td>
				<td>{Enums.TriggerType[o.trigger.type]}</td>
				<td>{o.trigger.value}</td>
				<td>{o.duration}</td>
				<td>{o.content.type}</td>
				<td>{tableize(o.content)}</td>
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
