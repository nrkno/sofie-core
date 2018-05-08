import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as CoreIcon from '@nrk/core-icons/jsx'
import { Spinner } from '../lib/Spinner'

import * as ClassNames from 'classnames'
import * as $ from 'jquery'
import { Time } from '../../lib/lib'
import { parse as queryStringParse } from 'query-string'

import { NavLink } from 'react-router-dom'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'
import { SegmentTimelineContainer } from './SegmentTimeline/SegmentTimelineContainer'
import { SegmentContextMenu } from './SegmentTimeline/SegmentContextMenu'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { SegmentLine } from '../../lib/collections/SegmentLines'

interface IHeaderProps {
	timeNow: number
	debugOnAirLine: () => void
	runningOrder: RunningOrder
}

const TimingDisplay = translate()(class extends React.Component<IHeaderProps & InjectedTranslateProps> {
	render () {
		const { t } = this.props

		return (
			<div className='timing mod'>
				<span className='timing-clock-header-label'>{t('Now')}: </span>
				<span className='timing-clock time-now'>18:53:10</span>
				<span className='timing-clock heavy-light heavy'>-00:15</span>
				<span className='timing-clock-header-label'>{t('Finish')}: </span>
				<span className='timing-clock time-end'>18:59:00</span>
			</div>
		)
	}
})

const RunningOrderHeader: React.SFC<IHeaderProps> = (props) => (
	<div className='header row'>
		<div className='col c4 super-dark'>
			{/* !!! TODO: This is just a temporary solution !!! */}
			<div className='right' style={{
				'marginTop': '0.9em'
			}}>
				<button className='btn btn-secondary btn-compact' onClick={(e) => Meteor.call('debug_demoRundown')}>
					Last inn kjøreplan
				</button>

				<button className='btn btn-secondary btn-compact' onClick={(e) => Meteor.call('debug_takeNext', props.runningOrder._id)}>
					Take
				</button>
			</div>
			<div className='badge mod'>
				<div className='media-elem mrs sofie-logo' />
				<div className='bd mls'><span className='logo-text'>Sofie</span></div>
			</div>
		</div>
		<div className='col c4 super-dark'>
			<TimingDisplay {...props} />
		</div>
		<div className='flex-col c4 super-dark horizontal-align-right'>
			<div className='links mod close'>
				<NavLink to='/runningOrders'>
					<CoreIcon id='nrk-close' />
				</NavLink>
			</div>
		</div>
	</div>
)

interface IPropsHeader extends InjectedTranslateProps {
	key: string
	runningOrder: RunningOrder
	segments: Array<Segment>
	studioInstallation: StudioInstallation
	match: {
		runningOrderId: String
	}
}

interface IStateHeader {
	timeScale: number
	studioMode: boolean
	contextMenuContext: any
}

export const RunningOrderView = translate()(withTracker((props, state) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	let subRunningOrders = Meteor.subscribe('runningOrders', {})
	let subSegments = Meteor.subscribe('segments', {})
	let subSegmentLines = Meteor.subscribe('segmentLines', {})
	let subSegmentLineItems = Meteor.subscribe('segmentLineItems', {})
	let subStudioInstallations = Meteor.subscribe('studioInstallations', {})
	let subShowStyles = Meteor.subscribe('showStyles', {})

	let runningOrder = RunningOrders.findOne({ _id: props.match.params.runningOrderId })

	return {
		runningOrder: runningOrder,
		segments: runningOrder ? Segments.find({ runningOrderId: runningOrder._id }, {
			sort: {
				'_rank': 1
			}
		}).fetch() : undefined,
		studioInstallation: runningOrder ? StudioInstallations.findOne({ _id: runningOrder.studioInstallationId }) : undefined,
	}
})(
class extends React.Component<IPropsHeader, IStateHeader> {
	constructor (props) {
		super(props)

		this.state = {
			timeScale: 50,
			studioMode: localStorage.getItem('studioMode') === '1' ? true : false,
			contextMenuContext: null
		}
	}

	componentDidMount () {
		$(document.body).addClass('dark')
	}

	componentWillUnmount () {
		$(document.body).removeClass('dark')
	}

	onTimeScaleChange = (timeScaleVal) => {
		if (Number.isFinite(timeScaleVal) && timeScaleVal > 0) {
			this.setState({
				timeScale: timeScaleVal
			})
		}
	}

	onContextMenu = (contextMenuContext: any) => {
		this.setState({
			contextMenuContext
		})
	}

	onSetNext = (segmentLine: SegmentLine) => {
		if (segmentLine && segmentLine._id) {
			Meteor.call('debug_setNextLine', segmentLine._id)
		}
	}

	renderSegments () {
		if (this.props.segments !== undefined && this.props.studioInstallation !== undefined) {
			return this.props.segments.map((segment) => (
				<SegmentTimelineContainer key={segment._id}
										  studioInstallation={this.props.studioInstallation}
										  segment={segment}
										  runningOrder={this.props.runningOrder}
										  liveLineHistorySize='100'
										  timeScale={this.state.timeScale}
										  onTimeScaleChange={this.onTimeScaleChange}
										  onContextMenu={this.onContextMenu}
										  />
			))
		} else {
			return (
				<div></div>
			)
		}
	}

	renderSegmentsList () {
		const { t } = this.props

		if (this.props.runningOrder !== undefined) {
			return (
				<div>
					{this.renderSegments()}
				</div>
			)
		} else {
			return (
				<div className='mod'>
					<Spinner />
				</div>
			)
		}
	}

	render () {
		const { t } = this.props

		return (
			<div>
				<RunningOrderHeader timeNow={0} debugOnAirLine={this.debugOnAirLine} runningOrder={this.props.runningOrder} />
				<SegmentContextMenu contextMenuContext={this.state.contextMenuContext}
					onSetNext={this.onSetNext} />
				{this.renderSegmentsList()}
			</div>
		)
	}
}
))
