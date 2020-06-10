import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { RouteComponentProps } from 'react-router'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { StatusResponse } from '../../lib/api/systemStatus'
import { NotificationCenter, Notification, NoticeLevel } from '../lib/notifications/notifications'
import { getUser } from '../../lib/collections/Users'
interface IResetPageProps extends RouteComponentProps<{ token: string }> {}

interface IResetPageState {
	password: string
	error: string | React.ReactElement<HTMLElement>
}

export const ResetPage = translateWithTracker((props: IResetPageProps) => {
	const user = getUser()
	if (user) {
		props.history.push('/rundowns')
	}

	return {}
})(
	class extends MeteorReactComponent<Translated<IResetPageProps>, IResetPageState> {
		constructor(props) {
			super(props)

			this.state = {
				password: '',
				error: '',
			}
			this.handleChange = this.handleChange.bind(this)
			this.validateChange = this.validateChange.bind(this)
			this.handleReset = this.handleReset.bind(this)
		}

		private handleChange(e: React.ChangeEvent<HTMLInputElement>) {
			this.setState({ ...this.state, [e.currentTarget.name]: e.currentTarget.value })
		}

		private validateChange(): boolean {
			const errors: string[] = []
			const { t } = this.props

			if (this.state.password.length < 5) {
				errors.push(t('Password must be atleast 5 characters long'))
			}
			/** Add more password rules */
			if (errors.length) {
				this.HandleError(
					<React.Fragment>
						{errors.map((e) => (
							<span>{e}</span>
						))}
					</React.Fragment>
				)
				return false
			}
			return true
		}

		private handleReset(e: React.MouseEvent<HTMLElement>) {
			e.preventDefault()
			if (!this.validateChange()) return
			const token = this.props.match.params.token
		}

		private HandleError(msg: string | React.ReactElement<HTMLElement>) {
			this.setState({ error: msg })
		}

		render() {
			const { t } = this.props
			return (
				<div className="center-page">
					<div className="mtl gutter flex-col page">
						<header className="mvs alc header">
							<div className="badge">
								<div className="sofie-logo"></div>
							</div>
							<h1>{t('Sofie - TV Automation System')}</h1>
						</header>
						<div className="container">
							<form onSubmit={(e: React.MouseEvent<HTMLFormElement>) => this.handleReset(e)}>
								<label htmlFor="password-reset">{t('Enter your new password')}</label>
								<input
									id="password-reset"
									className="mdinput mas"
									type="password"
									name="password"
									value={this.state.password}
									onChange={this.handleChange}
									onBlur={this.validateChange}
									placeholder={t('Password')}
								/>
								<button type="submit" className="btn btn-primary" onClick={this.handleReset}>
									{t('Set new password')}
								</button>
								<button className="btn" onClick={() => this.props.history.push('/')}>
									{t('Sign In')}
								</button>
							</form>
						</div>
						<div className={'error-msg ' + (this.state.error && 'error-msg-active')}>
							<p>{this.state.error ? this.state.error : ''}&nbsp;</p>
						</div>
					</div>
				</div>
			)
		}
	}
)
