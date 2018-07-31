import * as React from 'react'
import * as $ from 'jquery'
import {
	BrowserRouter as Router,
	Route,
	Switch,
	Redirect
} from 'react-router-dom'
import { translateWithTracker, Translated } from '../lib/ReactMeteorData/ReactMeteorData'
import { Meteor } from 'meteor/meteor'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'

import { Spinner } from '../lib/Spinner'

interface IProps {
	match: {
		params: {
			studioId: string
		}
	}
}
interface ITrackedProps {
	runningOrder?: RunningOrder
	isReady: boolean
}
export const ActiveROView = translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {

	const runningOrderSubscription = Meteor.subscribe('runningOrders', {
		studioInstallationId: props.match.params.studioId
	})

	const runningOrder = RunningOrders.findOne({
		studioInstallationId: props.match.params.studioId,
		active: true
	})

	return {
		runningOrder,
		isReady: runningOrderSubscription.ready()
	}
})(class extends React.Component<Translated<IProps & ITrackedProps>> {

	componentDidMount () {
		$(document.body).addClass(['dark', 'vertical-overflow-only'])
	}

	componentWillUnmount () {
		$(document.body).removeClass(['dark', 'vertical-overflow-only'])
	}

	render () {
		const { t } = this.props
		if (this.props.isReady && this.props.runningOrder) {
			return <Redirect to={'/ro/' + this.props.runningOrder._id} />
		} else if (this.props.isReady) {
			return (
				<div className='running-order-view running-order-view--unpublished'>
					<div className='running-order-view__label'>
						<p>
							{t('There is no running order active in this studio.')}
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
		} else {
			return (
				<div className='running-order-view running-order-view--loading' >
					<Spinner />
				</div >
			)
		}
	}
})
