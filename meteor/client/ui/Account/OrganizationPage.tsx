import * as React from 'react'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Accounts } from 'meteor/accounts-base'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
import { RouteComponentProps } from 'react-router'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { StatusResponse } from '../../../lib/api/systemStatus'
import { getUser, User, Users, getUserRoles } from '../../../lib/collections/Users'
import { Spinner } from '../../lib/Spinner'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { Organizations, DBOrganization, UserRoles } from '../../../lib/collections/Organization'
import { getAllowStudio, getAllowConfigure, getAllowDeveloper } from '../../lib/localStorage'
import { unprotectString } from '../../../lib/lib'
import { throws } from 'assert'
import { MeteorCall } from '../../../lib/api/methods'

interface OrganizationProps extends RouteComponentProps {
	user: User | null
	organization: DBOrganization | null
	usersInOrg: User[]
}

interface OrganizationState {
	newUserEmail: string
	newUserName: string
	editUser: string
}

export const OrganizationPage = translateWithTracker((props: RouteComponentProps) => {
	const user = getUser()
	const organization = user && Organizations.findOne({ _id: user.organizationId })
	organization && meteorSubscribe(PubSub.usersInOrganization, { organizationId: organization._id })
	const usersInOrg =
		user &&
		organization &&
		Users.find({ organizationId: user.organizationId })
			.fetch()
			.filter((u) => u._id !== user._id)
	return {
		user: user ? user : null,
		organization: organization ? organization : null,
		usersInOrg: usersInOrg || null,
	}
})(
	class OrganizationPage extends MeteorReactComponent<Translated<OrganizationProps>, OrganizationState> {
		state: OrganizationState = {
			newUserEmail: '',
			newUserName: '',
			editUser: '',
		}

		private getUserAndRoles(): { user: User | null; roles: UserRoles | null } {
			const user = this.props.usersInOrg.find((user) => user.profile.name === this.state.editUser)
			if (!user) return { user: null, roles: null }
			const roles = this.props.organization?.userRoles[unprotectString(user._id)] || null
			return { user, roles }
		}

		private toggleAccess(updatedRoles: UserRoles) {
			const { user, roles } = this.getUserAndRoles()
			const organization = this.props.organization
			if (!user || !roles || !organization) return
			const userRoles = { ...roles, ...updatedRoles }
			Organizations.update({ _id: organization._id }, { $set: { [`userRoles.${user._id}`]: userRoles } })
		}

		private async createAndEnrollUser() {
			if (!this.state.newUserEmail || !this.state.newUserName) {
				return
			}
			if (!this.props.organization) return

			await MeteorCall.user.enrollUser(this.state.newUserEmail, this.state.newUserName)
			this.setState({ newUserEmail: '', newUserName: '' })
		}

		componentDidMount() {
			if (!getUserRoles().admin) this.props.history.push('/')
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
						{this.props.usersInOrg.length ? (
							<React.Fragment>
								<select
									value={this.state.editUser}
									onChange={(e) => this.setState({ editUser: e.currentTarget.value })}>
									<option value="">{t('Select an User')}</option>
									{this.props.usersInOrg.map((user, index) => (
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
											checked={roles.configurator}
											onChange={(e) => this.toggleAccess({ configurator: e.currentTarget.checked })}
										/>
										<p>{t('Allow to Edit Rundowns ( Studio Access )')}</p>
										<input
											type="checkbox"
											checked={roles.studio}
											onChange={(e) => this.toggleAccess({ studio: e.currentTarget.checked })}
										/>
										<p>{t('Allow access to Developer Tools')}</p>
										<input
											type="checkbox"
											checked={roles.developer}
											onChange={(e) => this.toggleAccess({ developer: e.currentTarget.checked })}
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
