import * as React from 'react'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Accounts } from 'meteor/accounts-base'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { RouteComponentProps } from 'react-router'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { getCoreSystem, ICoreSystem, GENESIS_SYSTEM_VERSION } from '../../lib/collections/CoreSystem'
import { NotificationCenter, Notification, NoticeLevel, NotificationAction } from '../lib/notifications/notifications'
import { MeteorCall } from '../../lib/api/methods'
import { getUser, User, UserRoleType } from '../../lib/collections/Users'
import { Organizations, DBOrganization } from '../../lib/collections/Organization'
import { Spinner } from '../lib/Spinner'

interface IAccountPageProps extends RouteComponentProps {
	user: User
	organization: DBOrganization
}

interface IAccountPageState {
	password: string
	oldPassword: string
	edit: boolean
}

interface UserUI {
	username: string
	emails: {address: string, verified: boolean}[]
	password: string
}

export const AccountPage = translateWithTracker(() => {

	const user = getUser() as User
	const organization = user && Organizations.findOne({ _id: user.organizationId })
	return {
		user: user,
		organization: organization
	}
})(
class extends MeteorReactComponent<Translated<IAccountPageProps>, IAccountPageState> {
	constructor (props) {
		super(props)
	}

	state = {
		password: '',
		oldPassword: '',
		edit: false
	}

	private handleChange (e: React.ChangeEvent<HTMLInputElement>) {
		this.setState({ ...this.state, [e.currentTarget.name]: e.currentTarget.value })
	}

	private handleChangePassword (e: React.MouseEvent<HTMLElement>) {
		e.preventDefault()
		if (!this.state.edit) return this.setState({ edit: true })
		try {
			if (!this.state.oldPassword || !this.state.password) throw { message: 'Missing requried password' }
			if (this.state.password.length < 5) throw { message: 'New password must be atleast 5 characters' }
			Accounts.changePassword(this.state.oldPassword, this.state.password, (error) => {
				if (error) {
					throw { message: error, lvl: NoticeLevel.CRITICAL }
				}
				this.handleNotif('Password Updated Successfully', NoticeLevel.NOTIFICATION)
				this.setState({ edit: false })
			})
		} catch (error) {
			console.log(error)
			this.handleNotif(error.message, error.lvl)
		}
	}

	private handleRemoveUser () {
		MeteorCall.user.removeUser().then((error) => {
			if (error) {
				throw error
			}
			this.props.history.push('/')
		}).catch(error => {
			console.log(error)
			this.handleNotif('Error deleting account', NoticeLevel.CRITICAL)
		})
	}

	private toggleAccess (access: UserRoleType) {
		const roles = this.props.user.roles
		const index = roles.findIndex(r => r.type === access)
		if (index === -1) {
			roles.push({ type: access })
		} else {
			roles.splice(index, 1)
		}
		Meteor.users.update(this.props.user._id, { $set: { roles } })
	}

	private handleNotif (error: string, lvl?: NoticeLevel) {
		if (lvl === undefined) lvl = NoticeLevel.WARNING
		NotificationCenter.push(new Notification(undefined, lvl, error, 'Account Page'))
	}

	render () {
		const { t } = this.props
		return (
			<div className='center-page'>
				<div className='mtl page'>
					<h1>{t('Account Page')}</h1>
					{this.props.user ? <form
						className='flex-col'
						onSubmit={(e: React.MouseEvent<HTMLFormElement>) => this.handleChangePassword(e)}
					>
						<p>{t('Account Name:')}</p>
						<input
							type='text'
							value={this.props.user.profile.name}
							disabled={true}
						/>
						<p>{t('Account Email:')}</p>
						<input
							type='text'
							value={this.props.user.emails.map(e => e.address).join(', ')}
							disabled={true}
						/>
						{this.state.edit && <React.Fragment>
							<p>{t('Old Password')}</p>
							<input
								type='password'
								name='oldPassword'
								value={this.state.oldPassword}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.handleChange(e)}
							/>
							<p>{t('New Password')}</p>
							<input
								type='password'
								name='password'
								value={this.state.password}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => this.handleChange(e)}
							/>
						</React.Fragment>}
						<button
							className='btn btn-primary'
							type='submit'
						>{this.state.edit ? t('Save Changes') : t('Edit Account')}</button>
						{this.state.edit && <button
							className='btn'
							type='button'
							onClick={() => this.setState({ edit: false, password: '', oldPassword: '' })}
						>Cancel</button>}
					</form>
					: <Spinner />}
					<h3>{t('Organzation Info')}</h3>
					{this.props.organization ? <React.Fragment>
						<p>{t('Name:')} {this.props.organization.name}</p>
						<button className='btn' onClick={() => this.toggleAccess(UserRoleType.STUDIO_PLAYOUT)}>{
							this.props.user.roles.find(r => r.type === UserRoleType.STUDIO_PLAYOUT)
							? t('Remove Studio Access')
							: t('Add Studio Access')
						}</button>
						<button className='btn' onClick={() => this.toggleAccess(UserRoleType.CONFIGURATOR)}>{
							this.props.user.roles.find(r => r.type === UserRoleType.CONFIGURATOR)
							? t('Remove Configurator Access')
							: t('Add Configurator Access')
						}</button>
						<button className='btn' onClick={() => this.toggleAccess(UserRoleType.DEVELOPER)}>{
							this.props.user.roles.find(r => r.type === UserRoleType.DEVELOPER)
							? t('Remove Developer Access')
							: t('Add Developer Access')
						}</button>
					</React.Fragment>
					: <Spinner />}
					{this.state.edit && <button className='btn' onClick={() => this.handleRemoveUser()}>{t('Remove Self')}</button>}
				</div>
			</div>
		)
	}
})
