import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { RouteComponentProps } from 'react-router'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { StatusResponse } from '../../lib/api/systemStatus'
import { NotificationCenter, Notification, NoticeLevel } from '../lib/notifications/notifications'
import { getUser } from '../../lib/collections/Users'
interface IResetPageProps extends RouteComponentProps<{token: string}> {

}

interface IResetPageState {
	systemStatus?: StatusResponse
	subsReady: boolean
	password: string
}

export const ResetPage = translateWithTracker((props: IResetPageProps) => {

	const user = getUser()
	if (user) {
		// If user is logged in, forward to lobby:
		// https://reacttraining.com/react-router/web/api/Redirect
		props.history.push('/lobby')
	}

	return {}
})(
class extends MeteorReactComponent<Translated<IResetPageProps>, IResetPageState> {
	constructor (props) {
		super(props)

		this.state = {
			subsReady: false,
			password: ''
		}
		this.handleChange = this.handleChange.bind(this)
		this.validateChange = this.validateChange.bind(this)
		this.handleReset = this.handleReset.bind(this)
	}

	private handleChange (e: React.ChangeEvent<HTMLInputElement>) {
		this.setState({ ...this.state, [e.currentTarget.name] : e.currentTarget.value })
	}

	private validateChange (): boolean {
		const errors: string[] = []
		const { t } = this.props

		if (this.state.password.length < 5) {
			errors.push(t('Password must be atleast 5 characters long'))
		}
		/** Add more password rules */
		if (errors.length) {
			NotificationCenter.push(new Notification(
				undefined,
				NoticeLevel.WARNING,
				<React.Fragment>
					{errors.map(e => <span>{e}</span>)}
				</React.Fragment>,
				'Reset Password Page'
			))
			return false
		}
		return true
	}

	private handleReset () {
		if (!this.validateChange()) return
		const token = this.props.match.params.token
	}

	render () {
		const { t } = this.props
		return (
			<div className='center-page'>
				<div className='mtl gutter flex-col page'>
					<header className='mvs alc header'>
						<div className='badge'>
							<div className='sofie-logo'></div>
						</div>
						<h1>{t('Sofie - TV Automation System')}</h1>
					</header>
					<div className='container'>
						<p>{t('Enter your new password')}</p>
						<input
							className='mdinput mas'
							type='password'
							name='password'
							value={this.state.password}
							onChange={this.handleChange}
							onBlur={this.validateChange}
							placeholder={t('Password')}
						/>
						<button className='btn btn-primary' onClick={this.handleReset}>{t('Set new password')}</button>
						<button className='btn' onClick={() => this.props.history.push('/')}>{t('Sign In')}</button>
					</div>
				</div>
			</div>
		)
	}
})
