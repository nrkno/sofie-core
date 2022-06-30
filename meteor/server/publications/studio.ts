import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { meteorPublish, AutoFillSelector } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import {
	Studios,
	DBStudio,
	getActiveRoutes,
	getRoutedMappings,
	StudioId,
	RoutedMappings,
} from '../../lib/collections/Studios'
import { PeripheralDeviceId, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../lib/collections/ExternalMessageQueue'
import { MediaObjects, MediaObject } from '../../lib/collections/MediaObjects'
import { StudioReadAccess } from '../security/studio'
import { OrganizationReadAccess } from '../security/organization'
import { FindOptions, MongoQuery } from '../../lib/typings/meteor'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { CustomPublishArray, meteorCustomPublishArray } from '../lib/customPublication'
import { setUpOptimizedObserver, TriggerUpdate } from '../lib/optimizedObserver'
import { ExpectedPackageDBBase, ExpectedPackageId, ExpectedPackages } from '../../lib/collections/ExpectedPackages'
import {
	ExpectedPackageWorkStatus,
	ExpectedPackageWorkStatuses,
} from '../../lib/collections/ExpectedPackageWorkStatuses'
import {
	PackageContainerPackageStatuses,
	PackageContainerPackageStatusDB,
} from '../../lib/collections/PackageContainerPackageStatus'
import { Match } from 'meteor/check'
import { PackageInfos } from '../../lib/collections/PackageInfos'
import { PackageContainerStatuses } from '../../lib/collections/PackageContainerStatus'
import { literal } from '../../lib/lib'
import { ReadonlyDeep } from 'type-fest'

meteorPublish(PubSub.studios, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.organizationId<DBStudio>(this.userId, selector0, token)
	const modifier: FindOptions<DBStudio> = {
		fields: {},
	}
	if (
		!cred ||
		NoSecurityReadAccess.any() ||
		(selector._id && (await StudioReadAccess.studio(selector._id, cred))) ||
		(selector.organizationId && (await OrganizationReadAccess.organizationContent(selector.organizationId, cred)))
	) {
		return Studios.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.studioOfDevice, async function (deviceId: PeripheralDeviceId, token) {
	if (await PeripheralDeviceReadAccess.peripheralDevice(deviceId, { userId: this.userId, token })) {
		const peripheralDevice = PeripheralDevices.findOne(deviceId)

		if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

		const modifier: FindOptions<DBStudio> = {
			fields: {},
		}

		const studioId = peripheralDevice.studioId
		if (studioId && (await StudioReadAccess.studioContent(studioId, { userId: this.userId, token }))) {
			return Studios.find(studioId, modifier)
		}
	}
	return null
})

meteorPublish(PubSub.externalMessageQueue, async function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<ExternalMessageQueueObj> = {
		fields: {},
	}
	if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId, token })) {
		return ExternalMessageQueue.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.mediaObjects, async function (studioId, selector, token) {
	if (!studioId) throw new Meteor.Error(400, 'studioId argument missing')
	selector = selector || {}
	check(studioId, String)
	check(selector, Object)
	const modifier: FindOptions<MediaObject> = {
		fields: {},
	}
	selector.studioId = studioId
	if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId, token })) {
		return MediaObjects.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.expectedPackages, async function (selector, token) {
	// Note: This differs from the expected packages sent to the Package Manager, instead @see PubSub.expectedPackagesForDevice
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<ExpectedPackageDBBase> = {
		fields: {},
	}
	if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId, token })) {
		return ExpectedPackages.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.expectedPackageWorkStatuses, async function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<ExpectedPackageWorkStatus> = {
		fields: {},
	}
	if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId, token })) {
		return ExpectedPackageWorkStatuses.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.packageContainerStatuses, async function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<ExpectedPackageWorkStatus> = {
		fields: {},
	}
	if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId, token })) {
		return PackageContainerStatuses.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.packageInfos, async function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<ExpectedPackageWorkStatus> = {
		fields: {},
	}
	if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId, token })) {
		return PackageInfos.find(selector, modifier)
	}
	return null
})
meteorPublish(
	PubSub.packageContainerPackageStatuses,
	async function (studioId: StudioId, containerId?: string | null, packageId?: ExpectedPackageId | null) {
		if (!studioId) throw new Meteor.Error(400, 'studioId argument missing')

		check(studioId, String)
		check(containerId, Match.Maybe(String))
		check(packageId, Match.Maybe(String))

		const modifier: FindOptions<PackageContainerPackageStatusDB> = {
			fields: {},
		}
		const selector: MongoQuery<PackageContainerPackageStatusDB> = {
			studioId: studioId,
		}
		if (containerId) selector.containerId = containerId
		if (packageId) selector.packageId = packageId

		if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId })) {
			return PackageContainerPackageStatuses.find(selector, modifier)
		}
		return null
	}
)

meteorCustomPublishArray(
	PubSub.mappingsForDevice,
	'studioMappings',
	async function (pub, deviceId: PeripheralDeviceId, token) {
		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = PeripheralDevices.findOne(deviceId)

			if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

			const studioId = peripheralDevice.studioId
			if (!studioId) return

			await createObserverForMappingsPublication(pub, PubSub.mappingsForDevice, studioId)
		}
	}
)

meteorCustomPublishArray(PubSub.mappingsForStudio, 'studioMappings', async function (pub, studioId: StudioId, token) {
	if (await StudioReadAccess.studio(studioId, { userId: this.userId, token })) {
		await createObserverForMappingsPublication(pub, PubSub.mappingsForStudio, studioId)
	}
})

interface RoutedMappingsArgs {
	readonly studioId: StudioId
}

type RoutedMappingsState = Record<string, never>

interface RoutedMappingsUpdateProps {
	invalidateStudio: boolean
}

async function setupMappingsPublicationObservers(
	args: ReadonlyDeep<RoutedMappingsArgs>,
	triggerUpdate: TriggerUpdate<RoutedMappingsUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	// Set up observers:
	return [
		Studios.find(args.studioId, {
			fields: {
				// It should be enough to watch the mappingsHash, since that should change whenever there is a
				// change to the mappings or the routes
				mappingsHash: 1,
			},
		}).observe({
			added: () => triggerUpdate({ invalidateStudio: true }),
			changed: () => triggerUpdate({ invalidateStudio: true }),
			removed: () => triggerUpdate({ invalidateStudio: true }),
		}),
	]
}
async function manipulateMappingsPublicationData(
	args: RoutedMappingsArgs,
	_state: Partial<RoutedMappingsState>,
	_updateProps: Partial<RoutedMappingsUpdateProps> | undefined
): Promise<RoutedMappings[] | null> {
	// Prepare data for publication:

	// Ignore _updateProps, as we arent caching anything so we have to rerun from scratch no matter what

	const studio = await Studios.findOneAsync(args.studioId)
	if (!studio) return []

	const routes = getActiveRoutes(studio)
	const routedMappings = getRoutedMappings(studio.mappings, routes)

	return [
		literal<RoutedMappings>({
			_id: studio._id,
			mappingsHash: studio.mappingsHash,
			mappings: routedMappings,
		}),
	]
}

/** Create an observer for each publication, to simplify the stop conditions */
async function createObserverForMappingsPublication(
	pub: CustomPublishArray<RoutedMappings>,
	observerId: PubSub,
	studioId: StudioId
) {
	const observer = await setUpOptimizedObserver<
		RoutedMappings,
		RoutedMappingsArgs,
		RoutedMappingsState,
		RoutedMappingsUpdateProps
	>(
		`pub_${observerId}_${studioId}`,
		{ studioId },
		setupMappingsPublicationObservers,
		manipulateMappingsPublicationData,
		(_args, newData) => {
			pub.updatedDocs(newData)
		}
	)
	pub.onStop(() => {
		observer.stop()
	})
}
