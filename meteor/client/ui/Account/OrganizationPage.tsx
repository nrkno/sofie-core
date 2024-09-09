import React, { useCallback, useState } from 'react'
import { useSubscriptions, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { getUser, DBUser, getUserRolesFromLoadedDocuments } from '../../../lib/collections/Users'
import { Spinner } from '../../lib/Spinner'
import { MeteorPubSub } from '../../../lib/api/pubsub'
import { DBOrganization, UserRoles } from '../../../lib/collections/Organization'
import { unprotectString } from '../../../lib/lib'
import { MeteorCall } from '../../../lib/api/methods'
import { EditAttribute } from '../../lib/EditAttribute'
import { Organizations, Users } from '../../collections'
import { useTranslation } from 'react-i18next'
import { logger } from '../../../lib/logging'

export function OrganizationPage(): JSX.Element {
	const { t } = useTranslation()

	const loggedInUser = useTracker(() => getUser(), [], null)
	const userOrganizationId = loggedInUser?.organizationId

	// Subscribe to data:
	useSubscriptions(MeteorPubSub.usersInOrganization, userOrganizationId ? [[userOrganizationId]] : [])

	const organization =
		useTracker(() => userOrganizationId && Organizations.findOne({ _id: userOrganizationId }), [userOrganizationId]) ??
		null

	const userIsAdmin = !!getUserRolesFromLoadedDocuments(loggedInUser, organization).admin

	const usersInOrg = useTracker(
		() => (userOrganizationId ? Users.find({ organizationId: userOrganizationId }).fetch() : []),
		[userOrganizationId],
		[]
	)

	const [newUserEmail, setNewUserEmail] = useState('')
	const [newUserName, setNewUserName] = useState('')
	const createAndEnrollUser = useCallback(() => {
		if (!newUserEmail || !newUserName) {
			return
		}

		MeteorCall.user
			.enrollUser(newUserEmail, newUserName)
			.then(() => {
				// Clear fields
				setNewUserEmail('')
				setNewUserName('')
			})
			.catch((e) => {
				logger.error('enrollUser failed: ', e)
			})
	}, [newUserEmail, newUserName])

	const changeNewUserEmail = useCallback((e: React.FormEvent<HTMLInputElement>) => {
		setNewUserEmail(e.currentTarget.value)
	}, [])
	const changeNewUserName = useCallback((e: React.FormEvent<HTMLInputElement>) => {
		setNewUserName(e.currentTarget.value)
	}, [])

	if (!userIsAdmin) {
		return <div>Not Allowed</div>
	}

	return (
		<div className="center-page organization-page">
			<div className="mtl page">
				<h1>{t(`Organization Page${organization ? ' - ' + organization.name : ''}`)}</h1>
				{loggedInUser ? (
					<div className="flex-col">
						<h2>{t('Invite User')}</h2>
						<p>{t("New User's Email")}</p>
						<input type="email" value={newUserEmail} onChange={changeNewUserEmail} />
						<p>{t("New User's Name")}</p>
						<input type="text" value={newUserName} onChange={changeNewUserName} />
						<button className="btn btn-primary" onClick={createAndEnrollUser}>
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
						{usersInOrg.map((user) => {
							return (
								<OrganizationPageUserRow
									key={unprotectString(user._id)}
									userIsAdmin={userIsAdmin}
									displayUser={user}
									organization={organization}
								/>
							)
						})}
					</tbody>
				</table>
			</div>
		</div>
	)
}
interface OrganizationPageUserRowProps {
	userIsAdmin: boolean
	displayUser: DBUser
	organization: DBOrganization | null
}
function OrganizationPageUserRow({ userIsAdmin, displayUser, organization }: Readonly<OrganizationPageUserRowProps>) {
	const renderUserRole = (user: DBUser, userRole: keyof UserRoles) => {
		if (user && organization) {
			const roles: UserRoles = organization.userRoles[unprotectString(user._id)] || {}
			return userIsAdmin ? (
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

	return (
		<tr>
			<td>{displayUser.profile.name}</td>
			<td>{displayUser.emails.map((e) => e.address).join(', ')}</td>

			<td>{renderUserRole(displayUser, 'studio')}</td>
			<td>{renderUserRole(displayUser, 'configurator')}</td>
			<td>{renderUserRole(displayUser, 'developer')}</td>
			<td>{renderUserRole(displayUser, 'admin')}</td>
		</tr>
	)
}
