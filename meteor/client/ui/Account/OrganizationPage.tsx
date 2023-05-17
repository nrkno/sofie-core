import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { getUser, User, getUserRoles, DBUser } from '../../../lib/collections/Users'
import { Spinner } from '../../lib/Spinner'
import { PubSub } from '../../../lib/api/pubsub'
import { DBOrganization, UserRoles } from '../../../lib/collections/Organization'
import { unprotectString } from '../../../lib/lib'
import { MeteorCall } from '../../../lib/api/methods'
import { EditAttribute } from '../../lib/EditAttribute'
import { Organizations, Users } from '../../collections'

interface IOrganizationProps {
	user: User | null
	organization: DBOrganization | null
	usersInOrg: User[]
}

interface IOrganizationState {
	newUserEmail: string
	newUserName: string
	editUser: string
}

export const OrganizationPage = translateWithTracker(() => {
	const user = getUser()
	const organization = user && Organizations.findOne({ _id: user.organizationId })

	const usersInOrg = user && organization && Users.find({ organizationId: user.organizationId }).fetch()
	return {
		user: user ? user : null,
		organization: organization ? organization : null,
		usersInOrg: usersInOrg || [],
	}
})(
	class OrganizationPage extends MeteorReactComponent<Translated<IOrganizationProps>, IOrganizationState> {
		state: IOrganizationState = {
			newUserEmail: '',
			newUserName: '',
			editUser: '',
		}

		private async createAndEnrollUser() {
			if (!this.state.newUserEmail || !this.state.newUserName) {
				return
			}
			if (!this.props.organization) return

			await MeteorCall.user.enrollUser(this.state.newUserEmail, this.state.newUserName)
			this.setState({ newUserEmail: '', newUserName: '' })
		}

		componentDidMount(): void {
			this.autorun(() => {
				if (this.props.organization) {
					this.subscribe(PubSub.usersInOrganization, { organizationId: this.props.organization._id })
				}
			})
		}
		private renderUserRole(user: DBUser, userRole: keyof UserRoles) {
			const organization = this.props.organization

			if (user && organization) {
				const roles: UserRoles = organization.userRoles[unprotectString(user._id)] || {}
				return getUserRoles(this.props.user, organization).admin ? (
					<EditAttribute
						attribute={`userRoles.${user._id}.${userRole}`}
						obj={organization}
						type="checkbox"
						collection={Organizations}
						className=""
					/>
				) : (
					<input type="checkbox" disabled={true} checked={roles[userRole]}></input>
				)
			} else return null
		}

		render(): React.ReactNode {
			const { t } = this.props
			const org = this.props.organization
			if (!getUserRoles().admin) {
				return 'Not Allowed'
			}
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
						<h2>{t('Users in organization')}</h2>
						<table>
							<thead>
								<tr>
									<th></th>
									<th></th>
									<th>{t('Studio')}</th>
									<th>{t('Configurator')}</th>
									<th>{t('Developer')}</th>
									<th>{t('Admin')}</th>
								</tr>
							</thead>
							<tbody>
								{this.props.usersInOrg.map((user) => {
									return (
										<tr key={unprotectString(user._id)}>
											<td>{user.profile.name}</td>
											<td>{user.emails.map((e) => e.address).join(', ')}</td>

											<td>{this.renderUserRole(user, 'studio')}</td>
											<td>{this.renderUserRole(user, 'configurator')}</td>
											<td>{this.renderUserRole(user, 'developer')}</td>
											<td>{this.renderUserRole(user, 'admin')}</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				</div>
			)
		}
	}
)
