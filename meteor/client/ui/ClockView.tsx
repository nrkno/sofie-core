import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as $ from 'jquery'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../lib/collections/Segments'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'

import { RunningOrderTimingProvider, withTiming, RunningOrderTiming, SegmentDuration, SegmentLineCountdown } from './RunningOrderTiming'
import { SegmentLineItems } from '../../lib/collections/SegmentLineItems';

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
	bottomMargin: string
}

export const ClockView = translate()(withTracker((props, state) => {
	let subRunningOrders = Meteor.subscribe('runningOrders', {})
	let subSegments = Meteor.subscribe('segments', {})
	let subSegmentLines = Meteor.subscribe('segmentLines', {})
	let subSegmentLineItems = Meteor.subscribe('segmentLineItems', {})
	let subStudioInstallations = Meteor.subscribe('studioInstallations', {})
	let subShowStyles = Meteor.subscribe('showStyles', {})
	let subSegmentLineAdLibItems = Meteor.subscribe('segmentLineAdLibItems', {})

	let runningOrder = RunningOrders.findOne({ active: true })
	// let roDurations = calculateDurations(runningOrder, segmentLines)
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
			timeScale: 0.05,
			studioMode: localStorage.getItem('studioMode') === '1' ? true : false,
			contextMenuContext: null,
			bottomMargin: ''
		}
	}

	componentDidMount () {
		$(document.body).addClass('dark xdark')
	}

	componentWillUnmount () {
		$(document.body).removeClass('dark xdark')
	}

	render () {
		const { t, runningOrder } = this.props

		return (
			<div className='clocks-full-screen'>
				<div className='clocks-half'>
					<div className='clocks-segment-title clocks-current-segment-title'>
						Takstemann Direkte
					</div>
					<div className='clocks-segment-countdown clocks-current-segment-countdown'>
						<span>–</span>
						<span>00</span>:
						<span>00</span>:
						<span className='fontweight-normal'>12</span>:
						<span className='fontweight-normal'>24</span>
					</div>
				</div>
				<div className='clocks-half clocks-top-bar'>
					<div>
						<div className='clocks-segment-title'>
							STK Snøskader i øst
						</div>
						<div className='clocks-segment-countdown'>
							<span>–</span>
							<span>00</span>:
							<span className='fontweight-normal'>01</span>:
							<span className='fontweight-normal'>48</span>:
							<span className='fontweight-normal'>19</span>
						</div>
					</div>
					<div className='clocks-rundown-title clocks-top-bar'>
						<span className='fontweight-light'>{t('Rundown')}</span>: {runningOrder ? runningOrder.name : 'UNKNOWN'}
					</div>
				</div>
			</div>
		)
	}
}
))
