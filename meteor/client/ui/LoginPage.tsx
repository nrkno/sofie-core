import * as React from 'react'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
import { RouteComponentProps } from 'react-router'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { NotificationCenter, Notification, NoticeLevel, NotificationAction } from '../lib/notifications/notifications'
import { StatusResponse } from '../../lib/api/systemStatus'
import { getUser } from '../../lib/collections/Users'


interface ILoginPageProps extends RouteComponentProps {

}

interface ILoginPageState {
	systemStatus?: StatusResponse
	email: string
	password: string
}

export const LoginPage = translateWithTracker((props: ILoginPageProps) => {
	const user = getUser()
	if (user) props.history.push('/lobby')
	return {}
})(
class extends MeteorReactComponent<Translated<ILoginPageProps>, ILoginPageState> {
	// private _subscriptions: Array<Meteor.SubscriptionHandle> = []

	constructor (props) {
		super(props)

		this.state = {
			email: '',
			password: ''
		}

		this.handleChange = this.handleChange.bind(this)
		this.attempLogin = this.attempLogin.bind(this)
		this.handleLoginAttempt = this.handleLoginAttempt.bind(this)
	}

	private handleChange (e: React.ChangeEvent<HTMLInputElement>) {
		if (this.state[e.currentTarget.name] === undefined) return
		return this.setState({ ...this.state, [e.currentTarget.name]: e.currentTarget.value })
	}

	private attempLogin (): void {
		try {
			if (!this.state.email.length) throw new Error('Please enter an email address')
			if (!this.state.password.length) throw new Error('Please enter an password')
		} catch (error) {
			NotificationCenter.push(new Notification(
				undefined,
				NoticeLevel.NOTIFICATION,
				error.message,
				'Login Page'
			))
			console.error(error)
			return
		}
		Meteor.loginWithPassword(this.state.email, this.state.password, this.handleLoginAttempt)
	}

	private handleLoginAttempt (error: Error) {
		if (error) {
			NotificationCenter.push(new Notification(
				undefined,
				NoticeLevel.NOTIFICATION,
				'Incorrect email or password',
				'Login Page'
			))
		}
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
						<input
							className='mdinput mas'
							type='text'
							value={this.state.email}
							onChange={this.handleChange}
							placeholder={t('Email Address')}
							name='email'
						/>
						<input
							className='mdinput mas'
							type='password'
							value={this.state.password}
							onChange={this.handleChange}
							placeholder={t('Password')}
							name='password'
						/>
						<button onClick={() => this.attempLogin()} className='btn btn-primary'>Sign In</button>
						<Link className='selectable right mas' to='/reset' >{t('Lost password?')}</Link>
					</div>
					<div className='mas'>
						<Link className='selectable' to='/signup'>
							<button className='btn'>{t('Create new account')}</button>
						</Link>
					</div>
				</div>
			</div>
		)
	}
}
)
