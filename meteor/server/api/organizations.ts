import { Meteor } from 'meteor/meteor'
import * as Path from 'path'
import { fsReadFile } from '../lib'
import { check, Match } from '../../lib/check'
import * as _ from 'underscore'
import { literal, getRandomId, makePromise, getCurrentTime, protectString } from '../../lib/lib'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { NewOrganizationAPI, OrganizationAPIMethods } from '../../lib/api/organization'
import { registerClassToMeteorMethods } from '../methods'
import { Organizations, OrganizationId, DBOrganization, NewOrganization } from '../../lib/collections/Organization'
import { OrganizationContentWriteAccess } from '../security/organization'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { insertStudio } from './studios'
import { insertShowStyleBase } from './showStyles'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { ShowStyleBases, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { Blueprints } from '../../lib/collections/Blueprints'
import { CoreSystem } from '../../lib/collections/CoreSystem'
import { runMigration, prepareMigration } from '../migration/databaseMigration'
import { UserId } from '../../lib/collections/Users'
import { restoreFromRundownPlaylistSnapshot } from './snapshot'
import { Snapshots } from '../../lib/collections/Snapshots'

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

function createDefault(userId: UserId, orgId: OrganizationId) {
	let systemBlueprintId, studioBlueprintId, showStyleBlueprintId
	const studioId = insertStudio({ userId })
	const showStyleId = insertShowStyleBase({ userId })
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
	let migration = prepareMigration(true)
	if (migration.migrationNeeded && migration.manualStepCount === 0) {
		runMigration(migration.chunks, migration.hash, [])
	}
	if (Meteor.settings.SNAPSHOT_ID) {
		restoreSnapshotTEMP(orgId, studioId, showStyleId)
	}
}

export function insertOrganization(userId: UserId, organization: NewOrganization) {
	triggerWriteAccessBecauseNoCheckNecessary()
	// const userId = context.userId
	//if (!userId) throw new Meteor.Error(401, 'User is not logged in')
	const admin = { userId }
	const id = Organizations.insert(
		literal<DBOrganization>({
			_id: getRandomId(),
			name: organization.name,
			admins: [admin],
			applications: organization.applications,
			broadcastMediums: organization.broadcastMediums,
			created: getCurrentTime(),
			modified: getCurrentTime(),
		}),
		() => {
			insertStudio({ userId })
			insertShowStyleBase({ userId })
		}
	)
	Meteor.users.update(userId, { $set: { organizationId: id } })
	createDefault(userId, id)
	return id
}

export function removeOrganization(context: MethodContext) {
	const access = OrganizationContentWriteAccess.anyContent(context)
	const organizationId = access.organizationId
	Organizations.remove({ organizationId })
}

class ServerOrganizationAPI extends MethodContextAPI implements NewOrganizationAPI {
	insertOrganization(userId: UserId, organization: NewOrganization) {
		return makePromise(() => insertOrganization(userId, organization))
	}
	removeOrganization() {
		return makePromise(() => removeOrganization(this))
	}
}

registerClassToMeteorMethods(OrganizationAPIMethods, ServerOrganizationAPI, false)
