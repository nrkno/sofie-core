import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as $ from 'jquery'
import { Time } from '../../lib/lib'
import { parse as queryStringParse } from 'query-string'

import { NavLink } from 'react-router-dom'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'
import { SegmentTimelineContainer } from './SegmentTimeline/SegmentTimelineContainer'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'

interface IHeaderProps {
	timeNow: number
}

const TimingDisplay = translate()(class extends React.Component<IHeaderProps & InjectedTranslateProps> {
	render () {
		const { t } = this.props

		return (
			<div className='timing mod'>
				<span className='timing-clock time-end'>{t('Slutt')}: 18:59:00</span>
				<span className='timing-clock heavy-light heavy'>-00:15</span>
				<span className='timing-clock time-now'>{t('Nå')}: 18:53:10</span>
			</div>
		)
	}
})

const RunningOrderHeader: React.SFC<IHeaderProps> = (props) => (
	<div className='header row'>
		<div className='col c4 super-dark'>
			<div className='badge mod'>
				<div className='media-elem mrs sofie-logo' />
				<div className='bd mls'><span className='logo-text'>Sofie</span></div>
			</div>
		</div>
		<div className='col c4 super-dark'>
			<TimingDisplay {...props} />
		</div>
		<div className='flex-col c4 super-dark horizontal-align-right'>
			<div className='links mod'>
				<NavLink to='/runningOrders'>
					<svg className='icon' aria-hidden='true' role='presentation'>
						<use xlinkHref='#icon-x'/>
					</svg>
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
		segments: runningOrder ? Segments.find({ runningOrderId: runningOrder._id }).fetch() : undefined,
		studioInstallation: runningOrder ? StudioInstallations.findOne({ _id: runningOrder.studioInstallationId }) : undefined,
	}
})(
class extends React.Component<IPropsHeader, IStateHeader> {
	constructor (props) {
		super(props)

		this.state = {
			timeScale: 10,
			studioMode: localStorage.getItem('studioMode') === '1' ? true : false
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
				<div>
					{t('Loading...')}
				</div>
			)
		}
	}

	render () {
		return (
			<div>
				<RunningOrderHeader timeNow={0} />
				{this.renderSegmentsList()}
			</div>
		)
	}
}
))
