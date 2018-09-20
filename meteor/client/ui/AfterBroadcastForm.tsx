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
import { translate } from 'react-i18next'
import { EditAttribute } from '../lib/EditAttribute'
import { ClientAPI } from '../../lib/api/client'
import { PlayoutAPI } from '../../lib/api/playout'
import { EvaluationBase } from '../../lib/collections/Evaluations'
import { eventContextForLog } from '../lib/eventTargetLogHelper'

interface IProps {
	runningOrder: RunningOrder
}
interface IState {
	q0: string
	q1: string
	q2: string
}
// export default translate()(class Dashboard extends React.Component<Translated<IProps>, IState> {
export const AfterBroadcastForm = translate()(class AfterBroadcastForm extends React.Component<Translated<IProps>, IState> {

	constructor (props: Translated<IProps>) {
		super(props)
		this.state = {
			q0: '',
			q1: '',
			q2: '',
		}
	}
	saveForm = (e: React.MouseEvent<HTMLElement>) => {

		let answers = this.state

		let evaluation: EvaluationBase = {
			studioId: this.props.runningOrder.studioInstallationId,
			runningOrderId: this.props.runningOrder._id,
			answers: answers
		}

		Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), PlayoutAPI.methods.saveEvaluation, evaluation)

		Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), PlayoutAPI.methods.roDeactivate, this.props.runningOrder._id)

		this.setState({
			q0: '',
			q1: '',
			q2: '',
		})
	}
	onUpdateValue = (edit: any, newValue: any ) => {
		console.log('edit', edit, newValue)
		let attr = edit.props.attribute

		if (attr) {
			let m = {}
			m[attr] = newValue
			this.setState(m)
		}
	}
	render () {
		const { t } = this.props

		let obj = this.state
		// console.log('obj', obj)
		return (
			<div className='afterbroadcastform-container'>
				<div className='afterbroadcastform'>

					<h2>{t('Evaluation')}</h2>

					<p><em>{t('Please take a minute to fill in this form.')}</em></p>

					<div className='form'>
						<div className='question'>
							<p>{t('Did you have any problems with the broadcast?')}</p>
							<div className='input q0'>
								<EditAttribute
									obj={obj}
									updateFunction={this.onUpdateValue}
									attribute='q0'
									type='dropdown'
									options={getQuestionOptions(t)}
								/>
							</div>
						</div>
						<div className='question q1'>
							<p>{t('Please explain the problems you experienced (what happened and when, what should have happened, what could have triggered the problems, etcetera...)')}</p>
							<div className='input'>
								<EditAttribute
									obj={obj}
									updateFunction={this.onUpdateValue}
									attribute='q1'
									type='multiline'
								/>
							</div>
						</div>
						<div className='question q2'>
							<p>{t('Your name')}</p>
							<div className='input'>
								<EditAttribute
									obj={obj}
									updateFunction={this.onUpdateValue}
									attribute='q2'
									type='text'
								/>
							</div>
						</div>

						<button className='btn btn-primary' onClick={this.saveForm}>
							{t('Save message and Deactivate Rundown')}
						</button>
					</div>
				</div>
			</div>
		)
	}
})
export function getQuestionOptions (t) {
	return [
		{value: 'nothing', name: t('No problems')},
		{value: 'minor', name: t('Something went wrong, but it didn\'t affect the output')},
		{value: 'major', name: t('Something went wrong, and it affected the output')},
	]
}
