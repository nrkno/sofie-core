import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { Link } from 'react-router-dom'
import { TimelineObjGeneric, Timeline } from '../../../lib/collections/Timeline'
import { clone } from 'underscore'
import { Resolver } from 'superfly-timeline'
import { transformTimeline } from '../../../lib/timeline'

interface ITimelineViewProps {
	match?: {
		params?: {
			studioId: string
		}
	}
}
interface ITimelineViewState {
	currentState?: string
	stateData: {[key: string]: TimelineObjGeneric[]}
}
interface ITimelineViewTrackedProps {
	studio?: StudioInstallation,
	timeline: TimelineObjGeneric[]
}

const TimelineView = translateWithTracker<ITimelineViewProps, ITimelineViewState, ITimelineViewTrackedProps>((props: ITimelineViewProps) => {
	return {
		studio: StudioInstallations.findOne(),
		timeline: Timeline.find().fetch()
	}
})(class TimelineView extends MeteorReactComponent<Translated<ITimelineViewProps & ITimelineViewTrackedProps>, ITimelineViewState> {

	constructor (props: Translated<ITimelineViewProps & ITimelineViewTrackedProps>) {
		super(props)

		// this.componentWillReceiveProps(props)

		this.state = {
			currentState: undefined,
			stateData: {}
		}
	}

	onUpdateValue = (edit: any, newValue: any) => {
		console.log('edit', edit, newValue)
		let attr = edit.props.attribute

		if (attr) {
			let m = {}
			m[attr] = newValue
			this.setState(m)
		}
	}

	componentWillReceiveProps (nextProps: Readonly<Translated<ITimelineViewProps & ITimelineViewTrackedProps>>) {
		const statObj = nextProps.timeline.find(t => !!t.statObject)
		if (!statObj) return

		const newVals = {}
		const key = (statObj.content as any).modified + ''
		newVals[key] = clone(nextProps.timeline)
		this.setState({
			stateData: Object.assign({}, this.state.stateData, newVals),
			currentState: key
		})
	}

	componentWillMount () {
		if (this.props.match && this.props.match.params) {
			// Subscribe to data:
			this.subscribe('timeline', {
				siId: this.props.match.params.studioId
			})
			this.subscribe('studioInstallations', {
				_id: this.props.match.params.studioId
			})
		}
	}

	renderTimelineView () {
		const state = this.state.currentState ? this.state.stateData[this.state.currentState] : undefined // TODO - default
		if (!state) return <p>Bad state</p>

		const statObj = state.find(t => !!t.statObject)
		if (!statObj) return <p>No</p>
		const modified = (statObj.content as any).modified

		const resolved = Resolver.getTimelineInWindow(transformTimeline(state))
		const r2 = Resolver.developTimelineAroundTime(resolved, modified)

		const offset = Math.min(...(_.compact(_.map(r2.resolved, v => v.resolved.startTime))))
		const maxEnd = Math.max(...(_.compact(_.map(r2.resolved, v => v.resolved.endTime !== Infinity ? v.resolved.endTime : undefined)))) + 60000

		const grouped = _.groupBy(_.sortBy(r2.resolved, o => o.LLayer), o => o.LLayer)

		const rowHeight = 90
		const objOffset = 10
		const scaleFactor = 1 / 40

		let i = -1
		let yOffset = 0
		const elms = _.map(grouped, (objs, k) => {
			i++

			const sortedObjs = _.chain(objs).sortBy('priority').sortBy('resolved.startTime').value()

			const r = <div className={'.testtools-timeline-llayer-row'}>
				{ _.map(sortedObjs, (v, o) => {
					const isInfinite = v.resolved.endTime === null || v.resolved.endTime === undefined || v.resolved.endTime === Infinity
					const end = isInfinite ? maxEnd : v.resolved.endTime
					const width = ((end || 0) - (v.resolved.startTime || 0)) * scaleFactor
					const divStyle = {
						top: yOffset + (25 + o * objOffset) + 'px',
						left: (v.resolved.startTime ? ((v.resolved.startTime - offset) * scaleFactor) : 0) + 'px',
						width: width + 'px',
					}
					const str = (v.resolved.startTime ? (v.resolved.startTime - offset) : '-') + ' - ' + (!isInfinite ? (end || 0) - offset : '?')
					return <div className={'testtools-timeline-llayer-object'} style={divStyle} title={ str }>{ str }</div>
				})}
			</div>

			yOffset += objs.length * objOffset + 25 + 30

			return r
		})

		const labelElms = _.map(grouped, (objs, k) => {
			const h = objs.length * objOffset + 25 + 30
			return <div className={'testtools-timeline-llayer-label'} style={{height: h + 'px'}}>{ k }</div>
		})

		return <div className={'testtools-timeline'}>
			{ labelElms }
			<div className={'testtools-timeline-scroller'}>
				<div className={'testtools-timeline-marker'} style={{left: (modified - offset) * scaleFactor + 'px'}}></div>
				{ elms }
			</div>
		</div>
	}

	render () {
		const { t } = this.props

		// console.log('obj', obj)
		return (
			<div className='mtl gutter'>
				<header className='mvs'>
					<h1>{t('Timeline')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderTimelineView()}
				</div>
			</div>
		)
	}
})

interface IStudioSelectProps {
}
interface IStudioSelectState {
}
interface IStudioSelectTrackedProps {
	studios: StudioInstallation[]
}
const TimelineStudioSelect = translateWithTracker<IStudioSelectProps, IStudioSelectState, IStudioSelectTrackedProps>((props: IStudioSelectProps) => {
	return {
		studios: StudioInstallations.find({}, {
			sort: {
				_id: 1
			}
		}).fetch()
	}
})(class StudioSelection extends MeteorReactComponent<Translated<IStudioSelectProps & IStudioSelectTrackedProps>, IStudioSelectState> {
	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter recordings-studio-select'>
				<header className='mbs'>
					<h1>{t('Timeline')}</h1>
				</header>
				<div className='mod mvl'>
					<strong>Studio</strong>
					<ul>

						{
							_.map(this.props.studios, (studio) => {
								return (
									<li key={studio._id}>
										<Link to={`timeline/${studio._id}`}>{studio.name}</Link>
									</li>
								)
							})
						}
					</ul>
				</div>
			</div>
		)
	}
})

export { TimelineView, TimelineStudioSelect }
