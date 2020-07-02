import * as React from 'react'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Accounts } from 'meteor/accounts-base'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
import { RouteComponentProps } from 'react-router'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { StatusResponse } from '../../../lib/api/systemStatus'
import { getUser, UserId, User, Users, UserRoleType, UserRole } from '../../../lib/collections/Users'
import { Spinner } from '../../lib/Spinner'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { Organizations, DBOrganization } from '../../../lib/collections/Organization'
import { getAllowStudio, getAllowConfigure, getAllowDeveloper } from '../../lib/localStorage'
import { unprotectString } from '../../../lib/lib'
import { throws } from 'assert'
import { MeteorCall } from '../../../lib/api/methods'

interface OrganizationProps extends RouteComponentProps {
	user: User | null
	organization: DBOrganization | null
}

interface OrganizationState {
	newUserEmail: string
	newUserName: string
	editUser: string
	usersInOrg: User[]
}

export const OrganizationPage = translateWithTracker((props: RouteComponentProps) => {
	const user = getUser()
	const organization = user && Organizations.findOne({ _id: user.organizationId })
	organization && meteorSubscribe(PubSub.usersInOrganization, { organizationId: organization._id })
	return {
		user: user ? user : null,
		organization: organization ? organization : null,
	}
})(
	class OrganizationPage extends MeteorReactComponent<Translated<OrganizationProps>, OrganizationState> {
		state: OrganizationState = {
			newUserEmail: '',
			newUserName: '',
			editUser: '',
			usersInOrg: [] as User[],
		}

		private getUserAndRoles(): { user: User | null; roles: UserRoleType[] | null } {
			const user = this.state.usersInOrg.find((user) => user.profile.name === this.state.editUser)
			if (!user) return { user: null, roles: null }
			const roles = user.roles.map((role) => role.type)
			return { user, roles }
		}

		private toggleAccess(role: UserRoleType, value: boolean) {
			const { user, roles } = this.getUserAndRoles()
			console.log(roles)
			if (!user || !roles) return
			if (value && roles.indexOf(role) === -1) {
				roles.push(role)
			} else {
				roles.splice(roles.indexOf(role), 1)
			}
			const userRoles: UserRole[] = roles.map((role) => ({ type: role }))
			console.log(userRoles, user)
			Meteor.users.update({ _id: unprotectString(user._id) }, { $set: { roles: userRoles } })
		}

		private async createAndEnrollUser() {
			if (!this.state.newUserEmail || !this.state.newUserName) {
				return
			}
			if (!this.props.organization) return
			const tempPass = this.props.organization.name + '_' + this.state.newUserName
			await MeteorCall.user.createUser(this.state.newUserEmail, tempPass, { name: this.state.newUserName }, true)
			this.setState({ newUserEmail: '', newUserName: '' })
		}

		componentDidMount() {
			if (this.props.user && this.props.organization) {
				const id = this.props.user._id
				const found = this.props.organization.admins.findIndex((user) => id === user.userId)
				if (found === -1) this.props.history.push('/')
				const users = Users.find({ organizationId: this.props.organization._id })
					.fetch()
					.filter((user) => user._id !== id)
				this.setState({ usersInOrg: users })
			}
		}

		render() {
			const { t } = this.props
			const org = this.props.organization
			const { user, roles } = this.getUserAndRoles()
			return (
				<div className="center-page organization-page">
					<div className="mtl page">
						<h1>{t(`Organization Page${org ? ' - ' + org.name : ''}`)}</h1>
						{this.props.user ? (
							<div className="flex-col">
								<h2>{t('Invite User')}</h2>
								<p>{t("New User's Email")}</p>
								<input
									type="email"
									value={this.state.newUserEmail}
									onChange={(e) => this.setState({ newUserEmail: e.currentTarget.value })}
								/>
								<p>{t("New User's Name")}</p>
								<input
									type="text"
									value={this.state.newUserName}
									onChange={(e) => this.setState({ newUserName: e.currentTarget.value })}
								/>
								<button className="btn btn-primary" onClick={() => this.createAndEnrollUser()}>
									{t('Create New User & Send Enrollment Email')}
								</button>
							</div>
						) : (
							<Spinner />
						)}
					</div>
					<div className="mtl page flex-col">
						<h2>{t('Update User Roles')}</h2>
						{this.state.usersInOrg.length ? (
							<React.Fragment>
								<select
									value={this.state.editUser}
									onChange={(e) => this.setState({ editUser: e.currentTarget.value })}>
									<option value="">{t('Select an User')}</option>
									{this.state.usersInOrg.map((user, index) => (
										<option key={index} value={user.profile.name}>
											{user.profile.name}
										</option>
									))}
								</select>
								{user && roles && (
									<div className="edit-user-roles">
										<p>{t('Allow access Configure Settings')}</p>
										<input
											type="checkbox"
											checked={roles.indexOf(UserRoleType.CONFIGURATOR) !== -1}
											onChange={(e) => this.toggleAccess(UserRoleType.CONFIGURATOR, e.currentTarget.checked)}
										/>
										<p>{t('Allow to Edit Rundowns ( Studio Access )')}</p>
										<input
											type="checkbox"
											checked={roles.indexOf(UserRoleType.STUDIO_PLAYOUT) !== -1}
											onChange={(e) => this.toggleAccess(UserRoleType.STUDIO_PLAYOUT, e.currentTarget.checked)}
										/>
										<p>{t('Allow access to Developer Tools')}</p>
										<input
											type="checkbox"
											checked={roles.indexOf(UserRoleType.DEVELOPER) !== -1}
											onChange={(e) => this.toggleAccess(UserRoleType.DEVELOPER, e.currentTarget.checked)}
										/>
									</div>
								)}
							</React.Fragment>
						) : (
							<Spinner />
						)}
					</div>
				</div>
			)
		}
	}
)
