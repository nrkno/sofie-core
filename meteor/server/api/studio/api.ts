import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import { registerClassToMeteorMethods } from '../../methods'
import { NewStudiosAPI, StudiosAPIMethods } from '../../../lib/api/studios'
import { Studios, DBStudio, StudioId } from '../../../lib/collections/Studios'
import { literal, getRandomId, lazyIgnore } from '../../../lib/lib'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { MethodContextAPI, MethodContext } from '../../../lib/api/methods'
import { OrganizationContentWriteAccess } from '../../security/organization'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { Timeline } from '../../../lib/collections/Timeline'
import { ExternalMessageQueue } from '../../../lib/collections/ExternalMessageQueue'
import { MediaObjects } from '../../../lib/collections/MediaObjects'
import { Credentials } from '../../security/lib/credentials'
import { OrganizationId } from '../../../lib/collections/Organization'
import { ExpectedPackages } from '../../../lib/collections/ExpectedPackages'
import { ExpectedPackageWorkStatuses } from '../../../lib/collections/ExpectedPackageWorkStatuses'
import { PackageInfos } from '../../../lib/collections/PackageInfos'
import { PackageContainerPackageStatuses } from '../../../lib/collections/PackageContainerPackageStatus'

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
			mappings: {},
			supportedShowStyleBase: [],
			blueprintConfig: {},
			// testToolsConfig?: ITestToolsConfig
			settings: {
				frameRate: 25,
				mediaPreviewsUrl: '',
				sofieUrl: '',
			},
			_rundownVersionHash: '',
			routeSets: {},
			routeSetExclusivityGroups: {},
			packageContainers: {},
			thumbnailContainerIds: [],
			previewContainerIds: [],
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

	await Promise.all([
		Studios.removeAsync(studio._id),
		// Studios.remove({ studioId: studio._id }) // TODO - what was this supposed to be?
		ExternalMessageQueue.removeAsync({ studioId: studio._id }),
		MediaObjects.removeAsync({ studioId: studio._id }),
		Timeline.removeAsync({ studioId: studio._id }),
		ExpectedPackages.removeAsync({ studioId: studio._id }),
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
			Studios.update(studioId, {
				$set: {
					mappingsHash: getRandomId(),
				},
			})
		},
		10
	)
}
Studios.find(
	{},
	{
		fields: {
			mappings: 1,
			routeSets: 1,
		},
	}
).observeChanges({
	added: triggerUpdateStudioMappingsHash,
	changed: triggerUpdateStudioMappingsHash,
	removed: triggerUpdateStudioMappingsHash,
})
