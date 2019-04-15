import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'
import {
	Route
} from 'react-router-dom'
import { translateWithTracker, Translated } from '../lib/ReactMeteorData/ReactMeteorData'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'

import { Spinner } from '../lib/Spinner'
import { RundownView } from './RundownView'
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
	rundown?: Rundown
	studioInstallation?: StudioInstallation
	studioId?: string
	// isReady: boolean
}
interface IState {
	subsReady: boolean
}
export const ActiveROView = translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {

	let studioId = objectPathGet(props, 'match.params.studioId')
	let studioInstallation
	if (studioId) {
		studioInstallation = StudioInstallations.findOne(studioId)
	}
	const rundown = Rundowns.findOne(_.extend({
		active: true
	}, {
		studioInstallationId: studioId
	}))

	return {
		rundown,
		studioInstallation,
		studioId
	}
})(class extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {

	constructor (props) {
		super(props)
		this.state = {
			subsReady: false
		}
	}

	componentWillMount () {
		this.subscribe('rundowns', _.extend({
			active: true
		}, this.props.studioId ? {
			studioInstallationId: this.props.studioId
		} : {}))
		if (this.props.studioId) {
			this.subscribe('studioInstallations', {
				_id: this.props.studioId
			})
		}
		this.autorun(() => {
			let subsReady = this.subscriptionsReady()
			if (subsReady !== this.state.subsReady) {
				this.setState({
					subsReady: subsReady
				})
			}
		})
	}

	componentDidMount () {
		$(document.body).addClass(['dark', 'vertical-overflow-only'])
	}

	componentWillUnmount () {
		super.componentWillUnmount()
		$(document.body).removeClass(['dark', 'vertical-overflow-only'])
	}

	componentDidUpdate () {
		$(document.body).addClass(['dark', 'vertical-overflow-only'])
	}

	renderMessage (message: string) {
		const { t } = this.props

		return (
			<div className='rundown-view rundown-view--unpublished'>
				<div className='rundown-view__label'>
					<p>
						{message}
					</p>
					<p>
						<Route render={({ history }) => (
							<button className='btn btn-primary' onClick={() => { history.push('/rundowns') }}>
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
				<div className='rundown-view rundown-view--loading' >
					<Spinner />
				</div >
			)
		} else {
			if (this.props.rundown) {
				return <RundownView rundownId={this.props.rundown._id} inActiveROView={true} />
			} else if (this.props.studioInstallation) {
				return this.renderMessage(t('There is no rundown active in this studio.'))
			} else if (this.props.studioId) {
				return this.renderMessage(t('This studio doesn\'t exist.'))
			} else {
				return this.renderMessage(t('There are no active rundowns.'))
			}
		}
	}
})
