import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'
import {
	BrowserRouter as Router,
	Route,
	Switch,
	Redirect
} from 'react-router-dom'
import { translateWithTracker, Translated } from '../lib/ReactMeteorData/ReactMeteorData'
import { Meteor } from 'meteor/meteor'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'

import { Spinner } from '../lib/Spinner'
import { RunningOrderView } from './RunningOrderView'

interface IProps {
	match?: {
		params?: {
			studioId: string
		}
	}
}
interface ITrackedProps {
	runningOrder?: RunningOrder
	studioInstallation?: StudioInstallation
	studioId?: string
	isReady: boolean
}
export const ActiveROView = translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {

	let studioId
	let studioInstallationSubscription
	let studioInstallation
	if (props.match && props.match.params && props.match.params.studioId) {
		studioId = props.match.params.studioId
		studioInstallationSubscription = Meteor.subscribe('studioInstallations', props.match && props.match.params && props.match.params.studioId ? {
			_id: props.match.params.studioId
		} : {})
		studioInstallation = StudioInstallations.findOne(props.match.params.studioId)
	}

	const runningOrderSubscription = Meteor.subscribe('runningOrders', props.match && props.match.params && props.match.params.studioId ? {
		studioInstallationId: props.match.params.studioId
	} : {})

	const runningOrder = RunningOrders.findOne(_.extend({
		active: true
	}, props.match && props.match.params && props.match.params.studioId ? {
		studioInstallationId: props.match.params.studioId
	} : {}))

	return {
		runningOrder,
		studioInstallation,
		studioId,
		isReady: runningOrderSubscription.ready() && (studioInstallationSubscription ? studioInstallationSubscription.ready() : true)
	}
})(class extends React.Component<Translated<IProps & ITrackedProps>> {

	componentDidMount () {
		$(document.body).addClass(['dark', 'vertical-overflow-only'])
	}

	componentWillUnmount () {
		$(document.body).removeClass(['dark', 'vertical-overflow-only'])
	}

	renderMessage (message: string) {
		const { t } = this.props

		return (
			<div className='running-order-view running-order-view--unpublished'>
				<div className='running-order-view__label'>
					<p>
						{message}
					</p>
					<p>
						<Route render={({ history }) => (
							<button className='btn btn-primary' onClick={() => { history.push('/runningOrders') }}>
								{t('Return to list')}
							</button>
						)} />
					</p>
				</div>
			</div>
		)
	}

	render () {
		const { t } = this.props
		if (this.props.isReady && this.props.runningOrder) {
			return (
				<RunningOrderView runningOrderId={this.props.runningOrder._id} />
			)
		} else if (this.props.isReady && this.props.studioInstallation) {
			return this.renderMessage(t('There is no running order active in this studio.'))
		} else if (this.props.isReady && !this.props.studioInstallation && this.props.studioId) {
			return this.renderMessage(t('This studio doesn\'t exist.'))
		} else if (this.props.isReady && !this.props.studioInstallation && !this.props.studioId) {
			return this.renderMessage(t('There are no active running orders.'))
		} else {
			return (
				<div className='running-order-view running-order-view--loading' >
					<Spinner />
				</div >
			)
		}
	}
})
