import { Meteor } from 'meteor/meteor'
import * as Path from 'path'
import { fsReadFile } from '../lib'
import { check, Match } from '../../lib/check'
import * as _ from 'underscore'
import { literal, getRandomId, makePromise, getCurrentTime, protectString } from '../../lib/lib'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { NewOrganizationAPI, OrganizationAPIMethods } from '../../lib/api/organization'
import { registerClassToMeteorMethods } from '../methods'
import { Organizations, OrganizationId, DBOrganization, DBOrganizationBase } from '../../lib/collections/Organization'
import { OrganizationContentWriteAccess } from '../security/organization'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { insertStudio, insertStudioInner } from './studios'
import { insertShowStyleBase, insertShowStyleBaseInner } from './showStyles'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { ShowStyleBases, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { Blueprints, BlueprintId } from '../../lib/collections/Blueprints'
import { CoreSystem } from '../../lib/collections/CoreSystem'
import { runMigration, prepareMigration } from '../migration/databaseMigration'
import { UserId, Users } from '../../lib/collections/Users'
import { restoreFromRundownPlaylistSnapshot } from './snapshot'
import { Snapshots } from '../../lib/collections/Snapshots'
import { resetCredentials } from '../security/lib/credentials'

function restoreSnapshotTEMP(orgId: OrganizationId, studioId: StudioId, showStyleId: ShowStyleBaseId) {
	const snapshotId = protectString(Meteor.settings.SNAPSHOT_ID)
	let snapshot = Snapshots.findOne(snapshotId)
	if (!snapshot) return

	let filePath = Path.join(Meteor.settings.SNAPSHOT_PATH, snapshot.fileName)

	let dataStr = fsReadFile(filePath).toString()

	let readSnapshot = JSON.parse(dataStr)
	readSnapshot.snapshot.organizationId = orgId
	readSnapshot.playlist.organizationId = orgId
	readSnapshot.rundowns.forEach((rundown) => {
		rundown.organizationId = orgId
	})
	restoreFromRundownPlaylistSnapshot(readSnapshot, studioId, showStyleId)
}

function createDefaultEnvironmentForOrg(orgId: OrganizationId) {
	let systemBlueprintId: BlueprintId | undefined
	let studioBlueprintId: BlueprintId | undefined
	let showStyleBlueprintId: BlueprintId | undefined
	const studioId = insertStudioInner(orgId)
	const showStyleId = insertShowStyleBaseInner(orgId)

	const core = CoreSystem.findOne()
	Blueprints.find()
		.fetch()
		.forEach((blueprint) => {
			if (blueprint.blueprintType === 'system') systemBlueprintId = blueprint._id
			if (blueprint.blueprintType === 'studio') studioBlueprintId = blueprint._id
			if (blueprint.blueprintType === 'showstyle') showStyleBlueprintId = blueprint._id
		})
	if (systemBlueprintId && core) CoreSystem.update({ _id: core._id }, { $set: { blueprintId: systemBlueprintId } })
	if (studioBlueprintId)
		Studios.update(
			{ _id: studioId },
			{
				$set: {
					blueprintId: studioBlueprintId,
				},
				$push: {
					supportedShowStyleBase: showStyleId,
				},
			}
		)
	if (showStyleId && showStyleBlueprintId)
		ShowStyleBases.update({ _id: showStyleId }, { $set: { blueprintId: showStyleBlueprintId } })
	const migration = prepareMigration(true)
	if (migration.migrationNeeded && migration.manualStepCount === 0) {
		runMigration(migration.chunks, migration.hash, [])
	}
	if (Meteor.settings.SNAPSHOT_ID) {
		restoreSnapshotTEMP(orgId, studioId, showStyleId)
	}
}

export function createOrganization(organization: DBOrganizationBase): OrganizationId {
	triggerWriteAccessBecauseNoCheckNecessary()

	const orgId = Organizations.insert(
		literal<DBOrganization>({
			...organization,
			_id: getRandomId(),
			userRoles: {},
			created: getCurrentTime(),
			modified: getCurrentTime(),
		})
	)
	// Setup default environment for the organization:
	createDefaultEnvironmentForOrg(orgId)
	return orgId
}

export function removeOrganization(context: MethodContext, organizationId: OrganizationId) {
	OrganizationContentWriteAccess.organization(context, organizationId)
	const users = Users.find({ organizationId }).fetch()
	users.forEach((user) => {
		resetCredentials({ userId: user._id })
	})
	Organizations.remove({ organizationId })
}

class ServerOrganizationAPI extends MethodContextAPI implements NewOrganizationAPI {
	removeOrganization(organizationId: OrganizationId) {
		return makePromise(() => removeOrganization(this, organizationId))
	}
}

registerClassToMeteorMethods(OrganizationAPIMethods, ServerOrganizationAPI, false)
