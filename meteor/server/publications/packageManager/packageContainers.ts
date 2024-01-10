import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBStudio, StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { PackageContainer } from '@sofie-automation/shared-lib/dist/package-manager/package'
import { PackageManagerPackageContainers } from '@sofie-automation/shared-lib/dist/package-manager/publications'
import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { PeripheralDevices, Studios } from '../../collections'
import { meteorCustomPublish, setUpOptimizedObserverArray, TriggerUpdate } from '../../lib/customPublication'
import { logger } from '../../logging'
import { PeripheralDeviceReadAccess } from '../../security/peripheralDevice'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'

type StudioFields = '_id' | 'packageContainers'
const studioFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBStudio, StudioFields>>>({
	_id: 1,
	packageContainers: 1,
})

interface PackageManagerPackageContainersArgs {
	readonly studioId: StudioId
	readonly deviceId: PeripheralDeviceId
}

type PackageManagerPackageContainersUpdateProps = Record<string, never>

type PackageManagerPackageContainersState = Record<string, never>

async function setupExpectedPackagesPublicationObservers(
	args: ReadonlyDeep<PackageManagerPackageContainersArgs>,
	triggerUpdate: TriggerUpdate<PackageManagerPackageContainersUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	// Set up observers:
	return [
		Studios.observeChanges(
			{
				studioId: args.studioId,
			},
			{
				added: () => triggerUpdate({}),
				changed: () => triggerUpdate({}),
				removed: () => triggerUpdate({}),
			},
			{
				fields: studioFieldSpecifier,
			}
		),
	]
}

async function manipulateExpectedPackagesPublicationData(
	args: ReadonlyDeep<PackageManagerPackageContainersArgs>,
	_state: Partial<PackageManagerPackageContainersState>,
	_updateProps: Partial<PackageManagerPackageContainersUpdateProps> | undefined
): Promise<PackageManagerPackageContainers[] | null> {
	// Prepare data for publication:

	// Future: this may want to cache on the state, but with only a single observer there feels little point

	const studio = (await Studios.findOneAsync(args.studioId, { fields: studioFieldSpecifier })) as
		| Pick<DBStudio, StudioFields>
		| undefined

	const packageContainers: { [containerId: string]: PackageContainer } = {}
	if (studio) {
		for (const [containerId, studioPackageContainer] of Object.entries<StudioPackageContainer>(
			studio.packageContainers
		)) {
			packageContainers[containerId] = studioPackageContainer.container
		}
	}

	return literal<PackageManagerPackageContainers[]>([
		{
			_id: args.deviceId,
			packageContainers,
		},
	])
}

meteorCustomPublish(
	PeripheralDevicePubSub.packageManagerPackageContainers,
	PeripheralDevicePubSubCollectionsNames.packageManagerPackageContainers,
	async function (pub, deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)

		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)

			if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

			const studioId = peripheralDevice.studioId
			if (!studioId) {
				logger.warn(`Pub.packageManagerPackageContainers: device "${peripheralDevice._id}" has no studioId`)
				return this.ready()
			}

			await setUpOptimizedObserverArray<
				PackageManagerPackageContainers,
				PackageManagerPackageContainersArgs,
				PackageManagerPackageContainersState,
				PackageManagerPackageContainersUpdateProps
			>(
				`${PeripheralDevicePubSub.packageManagerPackageContainers}_${studioId}_${deviceId}`,
				{ studioId, deviceId },
				setupExpectedPackagesPublicationObservers,
				manipulateExpectedPackagesPublicationData,
				pub,
				500 // ms, wait this time before sending an update
			)
		} else {
			logger.warn(`Pub.packageManagerPackageContainers: Not allowed: "${deviceId}"`)
		}
	}
)
