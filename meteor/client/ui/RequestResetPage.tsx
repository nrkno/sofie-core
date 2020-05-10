import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { RouteComponentProps } from 'react-router'
import { NotificationCenter, Notification, NoticeLevel } from '../lib/notifications/notifications'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { getUser } from '../../lib/collections/Users'


interface IRequestResetPageProps extends RouteComponentProps {

}

interface IRequestResetPageState {
	email: string
}

export const RequestResetPage = translateWithTracker((props: IRequestResetPageProps) => {

	const user = getUser()
	if (user) {
		// If user is logged in, forward to lobby:
		// https://reacttraining.com/react-router/web/api/Redirect
		props.history.push('/lobby')
	}

	return {
		
	}
})(
class extends MeteorReactComponent<Translated<IRequestResetPageProps>, IRequestResetPageState> {
	constructor (props) {
		super(props)

		this.state = {
			email: ''
		}
		this.resetPassword = this.resetPassword.bind(this)
	}

	private validateEmail (e: React.FocusEvent<HTMLInputElement>) {
		// if(!this.state.email) 
	}

	private resetPassword (e: React.MouseEvent<HTMLButtonElement>): void {
		if(!this.state.email) {
			NotificationCenter.push(new Notification(
				undefined,
				NoticeLevel.NOTIFICATION,
				'Please enter a valid email',
				'Reset Password Page'
			))
		} else {
			/**
			 * Attmept to get userid for email entered
			 * Accounts.sendResetPasswordEmail(userid, *optional email*)
			 */
		}
		
	}
 

	render() {
		const { t } = this.props
		return (
			<div className="reset-password container">
				<p>Lost password?</p>
				<input 
					type="text" 
					value={this.state.email} 
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
						this.setState({...this.state, email: e.target.value})} 
					onBlur={this.validateEmail}
					placeholder={t('Email Address')}
					name="email"
				/>
				<button onClick={this.resetPassword}>{t('Send reset email')}</button>
			</div>
		)
	}
})