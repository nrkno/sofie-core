import { literal, getRandomId, getCurrentTime } from '../../lib/lib'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { NewOrganizationAPI, OrganizationAPIMethods } from '../../lib/api/organization'
import { registerClassToMeteorMethods } from '../methods'
import { DBOrganization, DBOrganizationBase } from '../../lib/collections/Organization'
import { OrganizationContentWriteAccess } from '../security/organization'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { insertStudioInner } from './studio/api'
import { insertShowStyleBaseInner } from './showStyles'
import { resetCredentials } from '../security/lib/credentials'
import { BlueprintId, OrganizationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints, CoreSystem, Organizations, ShowStyleBases, Studios, Users } from '../collections'
import { getCoreSystemAsync } from '../coreSystem/collection'

async function createDefaultEnvironmentForOrg(orgId: OrganizationId) {
	let systemBlueprintId: BlueprintId | undefined
	let studioBlueprintId: BlueprintId | undefined
	let showStyleBlueprintId: BlueprintId | undefined

	const studioId = await insertStudioInner(orgId)
	const showStyleId = await insertShowStyleBaseInner(orgId)

	const core = await getCoreSystemAsync()
	const blueprints = await Blueprints.findFetchAsync({})
	for (const blueprint of blueprints) {
		if (blueprint.blueprintType === 'system') systemBlueprintId = blueprint._id
		if (blueprint.blueprintType === 'studio') studioBlueprintId = blueprint._id
		if (blueprint.blueprintType === 'showstyle') showStyleBlueprintId = blueprint._id
	}

	if (systemBlueprintId && core) await CoreSystem.updateAsync(core._id, { $set: { blueprintId: systemBlueprintId } })
	if (studioBlueprintId)
		await Studios.updateAsync(studioId, {
			$set: {
				blueprintId: studioBlueprintId,
			},
			$push: {
				supportedShowStyleBase: showStyleId,
			},
		})
	if (showStyleId && showStyleBlueprintId)
		await ShowStyleBases.updateAsync(showStyleId, { $set: { blueprintId: showStyleBlueprintId } })
}

export async function createOrganization(organization: DBOrganizationBase): Promise<OrganizationId> {
	triggerWriteAccessBecauseNoCheckNecessary()

	const orgId = await Organizations.insertAsync(
		literal<DBOrganization>({
			...organization,
			_id: getRandomId(),
			userRoles: {},
			created: getCurrentTime(),
			modified: getCurrentTime(),
		})
	)
	// Setup default environment for the organization:
	await createDefaultEnvironmentForOrg(orgId)
	return orgId
}

async function removeOrganization(context: MethodContext, organizationId: OrganizationId) {
	await OrganizationContentWriteAccess.organization(context, organizationId)

	const users = await Users.findFetchAsync({ organizationId })
	users.forEach((user) => {
		resetCredentials({ userId: user._id })
	})
	await Organizations.removeAsync(organizationId)
}

class ServerOrganizationAPI extends MethodContextAPI implements NewOrganizationAPI {
	async removeOrganization(organizationId: OrganizationId) {
		return removeOrganization(this, organizationId)
	}
}

registerClassToMeteorMethods(OrganizationAPIMethods, ServerOrganizationAPI, false)
