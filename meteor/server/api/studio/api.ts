import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import { registerClassToMeteorMethods } from '../../methods'
import { NewStudiosAPI, StudiosAPIMethods } from '../../../lib/api/studios'
import { DBStudio } from '../../../lib/collections/Studios'
import { literal, getRandomId, lazyIgnore, stringifyError } from '../../../lib/lib'
import {
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	ExternalMessageQueue,
	MediaObjects,
	PackageContainerPackageStatuses,
	PackageInfos,
	PeripheralDevices,
	RundownPlaylists,
	Rundowns,
	Studios,
	Timeline,
} from '../../collections'
import { MethodContextAPI, MethodContext } from '../../../lib/api/methods'
import { OrganizationContentWriteAccess } from '../../security/organization'
import { Credentials } from '../../security/lib/credentials'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { OrganizationId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'

async function insertStudio(context: MethodContext | Credentials, newId?: StudioId): Promise<StudioId> {
	if (newId) check(newId, String)

	const access = await OrganizationContentWriteAccess.studio(context)
	return insertStudioInner(access.organizationId, newId)
}
export async function insertStudioInner(organizationId: OrganizationId | null, newId?: StudioId): Promise<StudioId> {
	return Studios.insertAsync(
		literal<DBStudio>({
			_id: newId || getRandomId(),
			name: 'New Studio',
			organizationId: organizationId,
			// blueprintId?: BlueprintId
			mappingsWithOverrides: wrapDefaultObject({}),
			supportedShowStyleBase: [],
			blueprintConfigWithOverrides: wrapDefaultObject({}),
			// testToolsConfig?: ITestToolsConfig
			settings: {
				frameRate: 25,
				mediaPreviewsUrl: '',
			},
			_rundownVersionHash: '',
			routeSets: {},
			routeSetExclusivityGroups: {},
			packageContainers: {},
			thumbnailContainerIds: [],
			previewContainerIds: [],
			peripheralDeviceSettings: {
				playoutDevices: wrapDefaultObject({}),
				ingestDevices: wrapDefaultObject({}),
				inputDevices: wrapDefaultObject({}),
			},
			lastBlueprintConfig: undefined,
		})
	)
}
async function removeStudio(context: MethodContext, studioId: StudioId): Promise<void> {
	check(studioId, String)

	const access = await OrganizationContentWriteAccess.studio(context, studioId)
	const studio = access.studio
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found`)

	// allowed to remove?
	const rundown = await Rundowns.findOneAsync({ studioId: studio._id }, { fields: { _id: 1 } })
	if (rundown)
		throw new Meteor.Error(404, `Can't remove studio "${studioId}", because the rundown "${rundown._id}" is in it.`)

	const playlist = await RundownPlaylists.findOneAsync({ studioId: studio._id }, { fields: { _id: 1 } })
	if (playlist)
		throw new Meteor.Error(
			404,
			`Can't remove studio "${studioId}", because the rundownPlaylist "${playlist._id}" is in it.`
		)

	const peripheralDevice = await PeripheralDevices.findOneAsync({ studioId: studio._id }, { fields: { _id: 1 } })
	if (peripheralDevice)
		throw new Meteor.Error(
			404,
			`Can't remoce studio "${studioId}", because the peripheralDevice "${peripheralDevice._id}" is in it.`
		)

	// This is allowed to mutate the job-worker 'owned' collections, as at this point the thread for that studio is about to be destroyed
	await Promise.all([
		Studios.removeAsync(studio._id),
		// Studios.remove({ studioId: studio._id }) // TODO - what was this supposed to be?
		ExternalMessageQueue.removeAsync({ studioId: studio._id }),
		MediaObjects.removeAsync({ studioId: studio._id }),
		Timeline.mutableCollection.removeAsync({ studioId: studio._id }),
		ExpectedPackages.mutableCollection.removeAsync({ studioId: studio._id }),
		ExpectedPackageWorkStatuses.removeAsync({ studioId: studio._id }),
		PackageInfos.removeAsync({ studioId: studio._id }),
		PackageContainerPackageStatuses.removeAsync({ studioId: studio._id }),
	])
}

class ServerStudiosAPI extends MethodContextAPI implements NewStudiosAPI {
	async insertStudio() {
		return insertStudio(this)
	}
	async removeStudio(studioId: StudioId) {
		return removeStudio(this, studioId)
	}
}
registerClassToMeteorMethods(StudiosAPIMethods, ServerStudiosAPI, false)

// Set up a watcher for updating the mappingsHash whenever a mapping or route is changed:
function triggerUpdateStudioMappingsHash(studioId: StudioId) {
	lazyIgnore(
		`triggerUpdateStudio_${studioId}`,
		() => {
			Studios.updateAsync(studioId, {
				$set: {
					mappingsHash: getRandomId(),
				},
			}).catch((e) => {
				logger.error(`triggerUpdateStudioMappingsHash: ${stringifyError(e)}`)
			})
		},
		10
	)
}
Studios.observeChanges(
	{},
	{
		added: triggerUpdateStudioMappingsHash,
		changed: triggerUpdateStudioMappingsHash,
		removed: triggerUpdateStudioMappingsHash,
	},
	{
		fields: {
			mappingsWithOverrides: 1,
			routeSets: 1,
		},
	}
)
