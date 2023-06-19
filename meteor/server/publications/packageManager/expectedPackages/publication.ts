import { Meteor } from 'meteor/meteor'
import { CustomCollectionName, PubSub } from '../../../../lib/api/pubsub'
import { PeripheralDeviceReadAccess } from '../../../security/peripheralDevice'
import { Studio } from '../../../../lib/collections/Studios'
import {
	TriggerUpdate,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	CustomPublishCollection,
} from '../../../lib/customPublication'
import { literal, omit, protectString } from '../../../../lib/lib'
import { logger } from '../../../logging'
import { ReadonlyDeep } from 'type-fest'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import {
	ExpectedPackageId,
	PeripheralDeviceId,
	PieceInstanceId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices, Studios } from '../../../collections'
import { check, Match } from 'meteor/check'
import { PackageManagerExpectedPackage } from '@sofie-automation/shared-lib/dist/package-manager/publications'
import { ExpectedPackagesContentObserver } from './contentObserver'
import { ExpectedPackagesContentCache } from './contentCache'
import { buildMappingsToDeviceIdMap } from './util'
import { regenerateForExpectedPackages, regenerateForPieceInstances } from './generate'

interface ExpectedPackagesPublicationArgs {
	readonly studioId: StudioId
	readonly deviceId: PeripheralDeviceId
	readonly filterPlayoutDeviceIds: PeripheralDeviceId[] | undefined
}

interface ExpectedPackagesPublicationUpdateProps {
	invalidateStudio?: boolean

	newCache: ExpectedPackagesContentCache

	// invalidatePeripheralDevices?: boolean
	invalidateExpectedPackageIds?: ExpectedPackageId[]
	invalidatePieceInstanceIds?: PieceInstanceId[]
}

interface ExpectedPackagesPublicationState {
	studio: Pick<Studio, StudioFields> | undefined
	layerNameToDeviceIds: Map<string, PeripheralDeviceId[]>

	contentCache: ReadonlyDeep<ExpectedPackagesContentCache>
}

export type StudioFields =
	| '_id'
	| 'routeSets'
	| 'mappingsWithOverrides'
	| 'packageContainers'
	| 'previewContainerIds'
	| 'thumbnailContainerIds'
const studioFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<Studio, StudioFields>>>({
	_id: 1,
	routeSets: 1,
	mappingsWithOverrides: 1,
	packageContainers: 1,
	previewContainerIds: 1,
	thumbnailContainerIds: 1,
})

async function setupExpectedPackagesPublicationObservers(
	args: ReadonlyDeep<ExpectedPackagesPublicationArgs>,
	triggerUpdate: TriggerUpdate<ExpectedPackagesPublicationUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	const packagesCache = new ExpectedPackagesContentObserver(args.studioId, (cache) => {
		// Push update
		triggerUpdate({ newCache: cache })

		const innerQueries = [
			cache.ExpectedPackages.find({}).observeChanges({
				added: (id) => triggerUpdate({ invalidateExpectedPackageIds: [protectString<ExpectedPackageId>(id)] }),
				changed: (id) =>
					triggerUpdate({ invalidateExpectedPackageIds: [protectString<ExpectedPackageId>(id)] }),
				removed: (id) =>
					triggerUpdate({ invalidateExpectedPackageIds: [protectString<ExpectedPackageId>(id)] }),
			}),
			cache.PieceInstances.find({}).observeChanges({
				added: (id) => triggerUpdate({ invalidatePieceInstanceIds: [protectString<PieceInstanceId>(id)] }),
				changed: (id) => triggerUpdate({ invalidatePieceInstanceIds: [protectString<PieceInstanceId>(id)] }),
				removed: (id) => triggerUpdate({ invalidatePieceInstanceIds: [protectString<PieceInstanceId>(id)] }),
			}),
		]

		return () => {
			for (const query of innerQueries) {
				query.stop()
			}
		}
	})
	// Set up observers:
	return [
		packagesCache,

		Studios.observeChanges(
			args.studioId,
			{
				added: () => triggerUpdate({ invalidateStudio: true }),
				changed: () => triggerUpdate({ invalidateStudio: true }),
				removed: () => triggerUpdate({ invalidateStudio: true }),
			},
			{
				fields: {
					// mappingsHash gets updated when either of these omitted fields changes
					...omit(studioFieldSpecifier, 'mappingsWithOverrides', 'routeSets'),
					mappingsHash: 1,
				},
			}
		),
	]
}

async function manipulateExpectedPackagesPublicationData(
	args: ReadonlyDeep<ExpectedPackagesPublicationArgs>,
	state: Partial<ExpectedPackagesPublicationState>,
	collection: CustomPublishCollection<PackageManagerExpectedPackage>,
	updateProps: ReadonlyDeep<Partial<ExpectedPackagesPublicationUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// Ensure the cached studio/showstyle id are updated
	const invalidateAllItems = !updateProps || updateProps.newCache || updateProps.invalidateStudio

	if (!state.layerNameToDeviceIds) state.layerNameToDeviceIds = new Map()

	if (invalidateAllItems) {
		// Everything is invalid, reset everything
		collection.remove(null)
	}

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache
	}

	if (!updateProps || updateProps.invalidateStudio) {
		state.studio = (await Studios.findOneAsync(args.studioId, { fields: studioFieldSpecifier })) as
			| Pick<Studio, StudioFields>
			| undefined
		if (!state.studio) {
			logger.warn(`Pub.expectedPackagesForDevice: studio "${args.studioId}" not found!`)
			state.layerNameToDeviceIds = new Map()
		} else {
			const studioMappings = applyAndValidateOverrides(state.studio.mappingsWithOverrides).obj
			state.layerNameToDeviceIds = buildMappingsToDeviceIdMap(state.studio.routeSets, studioMappings)
		}
	}

	if (!state.studio || !state.contentCache) {
		collection.remove(null)
		return
	}

	let regenerateExpectedPackageIds: Set<ExpectedPackageId>
	let regeneratePieceInstanceIds: Set<PieceInstanceId>
	if (invalidateAllItems) {
		// force every piece to be regenerated
		collection.remove(null)
		regenerateExpectedPackageIds = new Set(state.contentCache.ExpectedPackages.find({}).map((p) => p._id))
		regeneratePieceInstanceIds = new Set(state.contentCache.PieceInstances.find({}).map((p) => p._id))
	} else {
		regenerateExpectedPackageIds = new Set(updateProps.invalidateExpectedPackageIds)
		regeneratePieceInstanceIds = new Set(updateProps.invalidatePieceInstanceIds)
	}

	await regenerateForExpectedPackages(
		state.contentCache,
		state.studio,
		state.layerNameToDeviceIds,
		collection,
		args.filterPlayoutDeviceIds,
		regenerateExpectedPackageIds
	)
	await regenerateForPieceInstances(
		state.contentCache,
		state.studio,
		state.layerNameToDeviceIds,
		collection,
		args.filterPlayoutDeviceIds,
		regeneratePieceInstanceIds
	)
}

meteorCustomPublish(
	PubSub.packageManagerExpectedPackages,
	CustomCollectionName.PackageManagerExpectedPackages,
	async function (
		pub,
		deviceId: PeripheralDeviceId,
		filterPlayoutDeviceIds: PeripheralDeviceId[] | undefined,
		token: string | undefined
	) {
		check(deviceId, String)
		check(filterPlayoutDeviceIds, Match.Maybe([String]))

		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)

			if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

			const studioId = peripheralDevice.studioId
			if (!studioId) {
				logger.warn(`Pub.packageManagerExpectedPackages: device "${peripheralDevice._id}" has no studioId`)
				return this.ready()
			}

			await setUpCollectionOptimizedObserver<
				PackageManagerExpectedPackage,
				ExpectedPackagesPublicationArgs,
				ExpectedPackagesPublicationState,
				ExpectedPackagesPublicationUpdateProps
			>(
				`${PubSub.packageManagerExpectedPackages}_${studioId}_${deviceId}_${JSON.stringify(
					(filterPlayoutDeviceIds || []).sort()
				)}`,
				{ studioId, deviceId, filterPlayoutDeviceIds },
				setupExpectedPackagesPublicationObservers,
				manipulateExpectedPackagesPublicationData,
				pub,
				500 // ms, wait this time before sending an update
			)
		} else {
			logger.warn(`Pub.packageManagerExpectedPackages: Not allowed: "${deviceId}"`)
		}
	}
)
