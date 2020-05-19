import * as React from 'react'
import * as _ from 'underscore'
import { Accounts } from 'meteor/accounts-base'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { NotificationCenter, Notification, NoticeLevel } from '../lib/notifications/notifications'
import { RouteComponentProps } from 'react-router'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { StatusResponse } from '../../lib/api/systemStatus'
import { MeteorCall } from '../../lib/api/methods'
import { getUser } from '../../lib/collections/Users'

interface ISignupPageProps extends RouteComponentProps {

}

interface ISignupPageState {
	systemStatus?: StatusResponse
	subsReady: boolean
	email: string
	password: string
	name: string
	organization: string
	applications: string[]
	broadcastMediums: string[]
}

export const SignupPage = translateWithTracker((props: ISignupPageProps) => {
	const user = getUser()
	if (user) props.history.push('/lobby')
	return {}
})(
class extends MeteorReactComponent<Translated<ISignupPageProps>, ISignupPageState> {
	private applications: string[] = [
		'Doing TV shows from a studio',
		'Doing streaming on the web from a studio',
		'Doing OB productions',
		'Installers / Integrators'
	]
	private broadcastMediums: string[] = ['News', 'Sports', 'E-Sports', 'Entertainment']

	constructor (props) {
		super(props)

		this.state = {
			subsReady: false,
			email: '',
			password: '',
			name: '',
			organization: '',
			applications: [],
			broadcastMediums: []
		}

		this.handleChange = this.handleChange.bind(this)
	}

	private handleChange (e: React.ChangeEvent<HTMLInputElement>) {
		if (Array.isArray(this.state[e.currentTarget.name])) {
			const item = this.state[e.currentTarget.name]
			if (e.currentTarget.type === 'checkbox') {
				if (e.currentTarget.checked) {
					item.push(e.currentTarget.value)
				} else {
					const found = item.findIndex(i => i === e.currentTarget.value)
					item.splice(found, 1)
				}
			} else {
				const found = item.findIndex(i => !this[e.currentTarget.name].includes(i))
				found !== -1
					? item.splice(found, 1, e.currentTarget.value)
					: item.push(e.currentTarget.value)
			}
			this.setState({ ...this.state, [e.currentTarget.name]: item.filter(i => i.length) })
		} else {
			this.setState({ ...this.state, [e.currentTarget.name]: e.currentTarget.value })
		}
	}

	private handleError (msg: string, lvl: NoticeLevel) {
		NotificationCenter.push(new Notification(undefined, lvl, msg, 'Signup Page'))
	}

	private createAccount () {
		try {
			if (!this.state.email.length) throw new Error('Please enter an email address')
			// if(!validEmailRegex.test(this.state.email)) throw new Error('Invalid email address')
			if (!this.state.password.length) throw new Error('Please enter an password')
			if (!this.state.name.length) throw new Error('Please enter your full name')
			if (!this.state.organization.length) throw new Error('Please enter an orgainzation name')
			if (!this.state.applications.length) throw new Error('Please tell us what you mainly do')
			if (!this.state.broadcastMediums.length) throw new Error('Please select a broadcast medium')
		} catch (error) {
			this.handleError(error.message, NoticeLevel.WARNING)
			console.warn(error)
			return
		}

		Accounts.createUser({
			email: this.state.email,
			password: this.state.password,
			profile: { name: this.state.name }
		}, (error) => {
			if (error) this.handleError('Error creating new user', NoticeLevel.NOTIFICATION)
			MeteorCall.organization.insertOrganization({
				name: this.state.organization,
				applications: this.state.applications,
				broadcastMediums: this.state.broadcastMediums
			}).catch(console.error)
		})
	}
	render () {
		const { t } = this.props
		return (
			<div className='center-page'>
				<header className='mvs alc header'>
					<div className='badge'>
						<div className='sofie-logo'></div>
					</div>
					<h1>{t('Sofie - TV Automation System')}</h1>
				</header>
				<div className='frow'>
					<div className='mtl flex-col page'>
							<p>{t('Your Account')}</p>
							<input
								className='mdinput mas'
								type='text'
								name='name'
								value={this.state.name}
								onChange={this.handleChange}
								placeholder='Full Name'
							/>
							<input
								className='mdinput mas'
								type='email'
								name='email'
								value={this.state.email}
								onChange={this.handleChange}
								placeholder='Email Address'
							/>
							<input
								className='mdinput mas'
								type='password'
								name='password'
								value={this.state.password}
								onChange={this.handleChange}
								placeholder='Password'
							/>
					</div>
					<div className='mtl flex-col page'>
						<p>{t('About Your Organization')}</p>
						<input
							className='mdinput mas'
							type='text'
							name='organization'
							value={this.state.organization}
							onChange={this.handleChange}
							placeholder='Company / Organization name'
						/>
						<p>{t('We are mainly')}</p>
						<ul>
							{this.applications.map((a, i) => (
								<div key={i}>
									<input
										id={`applications-${i}`}
										type='checkbox'
										name='applications'
										checked={this.state.applications.indexOf(a) !== -1}
										value={a}
										onChange={this.handleChange}
									/>
									<label htmlFor={`applications-${i}`}>{a}</label>
								</div>
							))}
							<div>
								<input
									type='text'
									name='applications'
									placeholder='Other'
									onChange={this.handleChange}
								/>
							</div>
						</ul>
						<p>{t('Areas')}</p>
						<ul>
							{this.broadcastMediums.map((a, i) => (
								<div key={i}>
									<input
										id={`mediums-${i}`}
										type='checkbox'
										name='broadcastMediums'
										checked={this.state.broadcastMediums.indexOf(a) !== -1}
										value={a}
										onChange={this.handleChange}
									/>
									<label htmlFor={`mediums-${i}`}>{a}</label>
								</div>
							))}
							<div>
								<input
									type='text'
									name='broadcastMediums'
									placeholder='Other'
									onChange={this.handleChange}
								/>
							</div>
						</ul>
					</div>
				</div>
				<div className='flex-row-center container pills'>
					<button className='btn' onClick={() => this.props.history.push('/')}>{t('Sign In')}</button>
					<button className='btn btn-primary' onClick={() => this.createAccount()}>{t('Create new Account')}</button>
				</div>
			</div>
		)
	}
})
