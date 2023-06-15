import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { meteorPublish, AutoFillSelector } from './lib'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { DBStudio, getActiveRoutes, getRoutedMappings, RoutedMappings } from '../../lib/collections/Studios'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { ExternalMessageQueueObj } from '../../lib/collections/ExternalMessageQueue'
import { MediaObject } from '../../lib/collections/MediaObjects'
import { StudioReadAccess } from '../security/studio'
import { OrganizationReadAccess } from '../security/organization'
import { MongoQuery } from '../../lib/typings/meteor'
import { NoSecurityReadAccess } from '../security/noSecurity'
import {
	CustomPublish,
	meteorCustomPublish,
	setUpOptimizedObserverArray,
	TriggerUpdate,
} from '../lib/customPublication'
import { ExpectedPackageDBBase } from '../../lib/collections/ExpectedPackages'
import { ExpectedPackageWorkStatus } from '../../lib/collections/ExpectedPackageWorkStatuses'
import { PackageContainerPackageStatusDB } from '../../lib/collections/PackageContainerPackageStatus'
import { Match } from 'meteor/check'
import { literal } from '../../lib/lib'
import { ReadonlyDeep } from 'type-fest'
import { FindOptions, MongoCursor } from '../../lib/collections/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ExpectedPackageId, PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	ExternalMessageQueue,
	MediaObjects,
	PackageContainerPackageStatuses,
	PackageContainerStatuses,
	PeripheralDevices,
	Studios,
} from '../collections'

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
		return Studios.findWithCursor(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.externalMessageQueue, async function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<ExternalMessageQueueObj> = {
		fields: {},
	}
	if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId, token })) {
		return ExternalMessageQueue.findWithCursor(selector, modifier)
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
		return MediaObjects.findWithCursor(selector, modifier)
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
		return ExpectedPackages.findWithCursor(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.expectedPackageWorkStatuses, async function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<ExpectedPackageWorkStatus> = {
		fields: {},
	}
	if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId, token })) {
		return ExpectedPackageWorkStatuses.findWithCursor(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.packageContainerStatuses, async function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<ExpectedPackageWorkStatus> = {
		fields: {},
	}
	if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId, token })) {
		return PackageContainerStatuses.findWithCursor(selector, modifier)
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
			return PackageContainerPackageStatuses.findWithCursor(selector, modifier)
		}
		return null
	}
)
meteorPublish(
	PubSub.packageContainerPackageStatusesSimple,
	async function (studioId: StudioId, containerId?: string | null, packageId?: ExpectedPackageId | null) {
		if (!studioId) throw new Meteor.Error(400, 'studioId argument missing')

		check(studioId, String)
		check(containerId, Match.Maybe(String))
		check(packageId, Match.Maybe(String))

		const modifier: FindOptions<PackageContainerPackageStatusDB> = {
			projection: {
				modified: 0,
			},
		}
		const selector: MongoQuery<PackageContainerPackageStatusDB> = {
			studioId: studioId,
		}
		if (containerId) selector.containerId = containerId
		if (packageId) selector.packageId = packageId

		if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId })) {
			return PackageContainerPackageStatuses.findWithCursor(selector, modifier) as Promise<
				MongoCursor<Omit<PackageContainerPackageStatusDB, 'modified'>>
			>
		}
		return null
	}
)

meteorCustomPublish(
	PubSub.mappingsForDevice,
	CustomCollectionName.StudioMappings,
	async function (pub, deviceId: PeripheralDeviceId, token) {
		check(deviceId, String)

		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)

			if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

			const studioId = peripheralDevice.studioId
			if (!studioId) return

			await createObserverForMappingsPublication(pub, studioId)
		}
	}
)

meteorCustomPublish(
	PubSub.mappingsForStudio,
	CustomCollectionName.StudioMappings,
	async function (pub, studioId: StudioId, token) {
		check(studioId, String)

		if (await StudioReadAccess.studio(studioId, { userId: this.userId, token })) {
			await createObserverForMappingsPublication(pub, studioId)
		}
	}
)

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
		Studios.observeChanges(
			args.studioId,
			{
				added: () => triggerUpdate({ invalidateStudio: true }),
				changed: () => triggerUpdate({ invalidateStudio: true }),
				removed: () => triggerUpdate({ invalidateStudio: true }),
			},
			{
				fields: {
					// It should be enough to watch the mappingsHash, since that should change whenever there is a
					// change to the mappings or the routes
					mappingsHash: 1,
				},
			}
		),
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

	const routes = getActiveRoutes(studio.routeSets)
	const rawMappings = applyAndValidateOverrides(studio.mappingsWithOverrides)
	const routedMappings = getRoutedMappings(rawMappings.obj, routes)

	return [
		literal<RoutedMappings>({
			_id: studio._id,
			mappingsHash: studio.mappingsHash,
			mappings: routedMappings,
		}),
	]
}

/** Create an observer for each publication, to simplify the stop conditions */
async function createObserverForMappingsPublication(pub: CustomPublish<RoutedMappings>, studioId: StudioId) {
	await setUpOptimizedObserverArray<
		RoutedMappings,
		RoutedMappingsArgs,
		RoutedMappingsState,
		RoutedMappingsUpdateProps
	>(
		`${CustomCollectionName.StudioMappings}_${studioId}`,
		{ studioId },
		setupMappingsPublicationObservers,
		manipulateMappingsPublicationData,
		pub
	)
}
