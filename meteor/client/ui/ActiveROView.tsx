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
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { objectPathGet } from '../../lib/lib'

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
	// isReady: boolean
}
interface IState {
	subsReady: boolean
}
export const ActiveROView = translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {

	let studioId = objectPathGet(props, 'match.params.studioId')
	let studioInstallationSubscription
	let studioInstallation
	if (studioId) {
		studioInstallation = StudioInstallations.findOne(studioId)
	}
	const runningOrder = RunningOrders.findOne(_.extend({
		active: true
	}, {
		studioInstallationId: studioId
	}))

	return {
		runningOrder,
		studioInstallation,
		studioId,
		// isReady: runningOrderSubscription.ready() && (studioInstallationSubscription ? studioInstallationSubscription.ready() : true)
	}
})(class extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {

	constructor (props) {
		super(props)
		this.state = {
			subsReady: false
		}
	}
	componentDidMount () {
		$(document.body).addClass(['dark', 'vertical-overflow-only'])

		let studioId = objectPathGet(this.props, 'match.params.studioId')
		if (studioId) {
			this.subscribe('studioInstallations', {
				_id: studioId
			})
			this.subscribe('runningOrders', {
				studioInstallationId: studioId
			})
			this.autorun(() => {
				let subsReady = this.subscriptionsReady()
				if (subsReady !== this.state.subsReady) {
					this.setState({
						subsReady: subsReady
					})
				}
			})
		}
	}

	componentWillUnmount () {
		this._cleanUp()
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
		if (!this.state.subsReady) {
			return (
				<div className='running-order-view running-order-view--loading' >
					<Spinner />
				</div >
			)
		} else {
			if (this.props.runningOrder) {
				return <RunningOrderView runningOrderId={this.props.runningOrder._id} />
			} else if (this.props.studioInstallation) {
				return this.renderMessage(t('There is no running order active in this studio.'))
			} else if (this.props.studioId) {
				return this.renderMessage(t('This studio doesn\'t exist.'))
			} else {
				return this.renderMessage(t('There are no active running orders.'))
			}
		}
	}
})
