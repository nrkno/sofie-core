import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { RouteComponentProps } from 'react-router'
import { NotificationCenter, Notification, NoticeLevel } from '../lib/notifications/notifications'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { getUser } from '../../lib/collections/Users'
import { MeteorCall } from '../../lib/api/methods'

interface IRequestResetPageProps extends RouteComponentProps {}

interface IRequestResetPageState {
	email: string
	error: string
}

export const RequestResetPage = translateWithTracker((props: IRequestResetPageProps) => {
	const user = getUser()
	if (user) {
		props.history.push('/rundowns')
	}

	return {}
})(
	class extends MeteorReactComponent<Translated<IRequestResetPageProps>, IRequestResetPageState> {
		constructor(props) {
			super(props)

			this.state = {
				email: '',
				error: '',
			}
		}

		private validateEmail(e: React.FocusEvent<HTMLInputElement>) {
			/** Find good email regex */
		}

		private async resetPassword(e: React.MouseEvent<HTMLElement>): Promise<void> {
			e.preventDefault()
			if (!this.state.email) {
				this.handleError('Please enter a valid email')
			} else {
				const result = await MeteorCall.user.requestPasswordReset(this.state.email)
				!result
					? this.handleError(`No account found with email ${this.state.email}`)
					: this.handleError(`Password reset email sent`)
				setTimeout(() => this.handleError(''), 5000)
			}
		}

		private handleError(msg: string) {
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
							<form onSubmit={(e: React.MouseEvent<HTMLFormElement>) => this.resetPassword(e)}>
								<label htmlFor="lost-password">Lost password?</label>
								<input
									id="lost-password"
									className="mdinput mas"
									type="text"
									value={this.state.email}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										this.setState({ ...this.state, email: e.target.value })
									}
									onBlur={this.validateEmail}
									placeholder={t('Email Address')}
									name="email"
								/>
								<button
									type="submit"
									className="btn btn-primary"
									onClick={(e: React.MouseEvent<HTMLButtonElement>) => this.resetPassword(e)}>
									{t('Send reset email')}
								</button>
								<button className="btn" onClick={() => this.props.history.push('/')}>
									{t('Sign In')}
								</button>
							</form>
						</div>
						<div className={'error-msg ' + (this.state.error && 'error-msg-active')}>
							<p>{this.state.error.length ? this.state.error : ''}&nbsp;</p>
						</div>
					</div>
				</div>
			)
		}
	}
)
