import { Meteor } from 'meteor/meteor'
import { check, Match } from '../../lib/check'
import { meteorPublish, AutoFillSelector } from './lib'
import { MeteorPubSub } from '../../lib/api/pubsub'
import { getActiveRoutes, getRoutedMappings } from '../../lib/collections/Studios'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { StudioReadAccess } from '../security/studio'
import { OrganizationReadAccess } from '../security/organization'
import { NoSecurityReadAccess } from '../security/noSecurity'
import {
	CustomPublish,
	meteorCustomPublish,
	setUpOptimizedObserverArray,
	TriggerUpdate,
} from '../lib/customPublication'
import { literal } from '../../lib/lib'
import { ReadonlyDeep } from 'type-fest'
import { FindOptions } from '../../lib/collections/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	ExternalMessageQueue,
	PackageContainerStatuses,
	PackageInfos,
	PeripheralDevices,
	Studios,
} from '../collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { RoutedMappings } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'

meteorPublish(CorelibPubSub.studios, async function (studioIds: StudioId[] | null, token: string | undefined) {
	check(studioIds, Match.Maybe(Array))

	// If values were provided, they must have values
	if (studioIds && studioIds.length === 0) return null

	const { cred, selector } = await AutoFillSelector.organizationId<DBStudio>(this.userId, {}, token)

	// Add the requested filter
	if (studioIds) selector._id = { $in: studioIds }

	if (
		!cred ||
		NoSecurityReadAccess.any() ||
		(selector._id && (await StudioReadAccess.studio(selector._id, cred))) ||
		(selector.organizationId && (await OrganizationReadAccess.organizationContent(selector.organizationId, cred)))
	) {
		return Studios.findWithCursor(selector)
	}
	return null
})

meteorPublish(
	CorelibPubSub.externalMessageQueue,
	async function (selector: MongoQuery<ExternalMessageQueueObj>, token: string | undefined) {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')
		const modifier: FindOptions<ExternalMessageQueueObj> = {
			fields: {},
		}
		if (await StudioReadAccess.studioContent(selector.studioId, { userId: this.userId, token })) {
			return ExternalMessageQueue.findWithCursor(selector, modifier)
		}
		return null
	}
)

meteorPublish(CorelibPubSub.expectedPackages, async function (studioIds: StudioId[], token: string | undefined) {
	// Note: This differs from the expected packages sent to the Package Manager, instead @see PubSub.expectedPackagesForDevice
	check(studioIds, Array)

	if (studioIds.length === 0) return null

	if (await StudioReadAccess.studioContent(studioIds, { userId: this.userId, token })) {
		return ExpectedPackages.findWithCursor({
			studioId: { $in: studioIds },
		})
	}
	return null
})
meteorPublish(
	CorelibPubSub.expectedPackageWorkStatuses,
	async function (studioIds: StudioId[], token: string | undefined) {
		check(studioIds, Array)

		if (studioIds.length === 0) return null

		if (await StudioReadAccess.studioContent(studioIds, { userId: this.userId, token })) {
			return ExpectedPackageWorkStatuses.findWithCursor({
				studioId: { $in: studioIds },
			})
		}
		return null
	}
)
meteorPublish(
	CorelibPubSub.packageContainerStatuses,
	async function (studioIds: StudioId[], token: string | undefined) {
		check(studioIds, Array)

		if (studioIds.length === 0) return null

		if (await StudioReadAccess.studioContent(studioIds, { userId: this.userId, token })) {
			return PackageContainerStatuses.findWithCursor({
				studioId: { $in: studioIds },
			})
		}
		return null
	}
)

meteorPublish(CorelibPubSub.packageInfos, async function (deviceId: PeripheralDeviceId, token: string | undefined) {
	if (!deviceId) throw new Meteor.Error(400, 'deviceId argument missing')

	if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
		return PackageInfos.findWithCursor({ deviceId })
	}
	return null
})

meteorCustomPublish(
	PeripheralDevicePubSub.mappingsForDevice,
	PeripheralDevicePubSubCollectionsNames.studioMappings,
	async function (pub, deviceId: PeripheralDeviceId, token: string | undefined) {
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
	MeteorPubSub.mappingsForStudio,
	PeripheralDevicePubSubCollectionsNames.studioMappings,
	async function (pub, studioId: StudioId, token: string | undefined) {
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
		`${PeripheralDevicePubSubCollectionsNames.studioMappings}_${studioId}`,
		{ studioId },
		setupMappingsPublicationObservers,
		manipulateMappingsPublicationData,
		pub
	)
}
