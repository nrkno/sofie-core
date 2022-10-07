import { Meteor } from 'meteor/meteor'
import { PubSub } from '../../lib/api/pubsub'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { PeripheralDevices, PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { MappingsExtWithPackage, routeExpectedPackages, Studio, StudioId, Studios } from '../../lib/collections/Studios'
import { setUpOptimizedObserver, TriggerUpdate } from '../lib/optimizedObserver'
import { ExpectedPackageDB, ExpectedPackages, getSideEffect } from '../../lib/collections/ExpectedPackages'
import _ from 'underscore'
import {
	ExpectedPackage,
	PackageContainer,
	Accessor,
	PackageContainerOnPackage,
	AccessorOnPackage,
} from '@sofie-automation/blueprints-integration'
import {
	DBRundownPlaylist,
	RundownPlaylistCollectionUtil,
	RundownPlaylists,
} from '../../lib/collections/RundownPlaylists'
import { DBRundown, Rundowns } from '../../lib/collections/Rundowns'
import { clone, DBObj, literal, omit, protectString, unprotectObject, unprotectString } from '../../lib/lib'
import deepExtend from 'deep-extend'
import { logger } from '../logging'
import { generateExpectedPackagesForPartInstance } from '../api/ingest/expectedPackages'
import { PartInstance } from '../../lib/collections/PartInstances'
import { StudioLight } from '../../lib/collections/optimizations'
import { ReadonlyDeep } from 'type-fest'

interface ExpectedPackagesPublicationArgs {
	readonly studioId: StudioId
	readonly deviceId: PeripheralDeviceId
	readonly filterPlayoutDeviceIds: PeripheralDeviceId[] | undefined
}

interface ExpectedPackagesPublicationUpdateProps {
	invalidateStudio?: boolean
	invalidatePeripheralDevices?: boolean
	invalidateExpectedPackages?: boolean
	invalidateRundownPlaylist?: boolean
}

interface ExpectedPackagesPublicationState {
	studio: Studio | undefined
	expectedPackages: ExpectedPackageDB[]
	routedExpectedPackages: ResultingExpectedPackage[]
	/** ExpectedPackages relevant for playout */
	routedPlayoutExpectedPackages: ResultingExpectedPackage[]
	activePlaylist: DBRundownPlaylist | undefined
	activeRundowns: DBRundown[]
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
}

async function setupExpectedPackagesPublicationObservers(
	args: ReadonlyDeep<ExpectedPackagesPublicationArgs>,
	triggerUpdate: TriggerUpdate<ExpectedPackagesPublicationUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	// Set up observers:
	return [
		Studios.find(args.studioId, {
			fields: {
				mappingsHash: 1, // is changed when routes are changed
				packageContainers: 1,
			},
		}).observe({
			added: () => triggerUpdate({ invalidateStudio: true }),
			changed: () => triggerUpdate({ invalidateStudio: true }),
			removed: () => triggerUpdate({ invalidateStudio: true }),
		}),
		PeripheralDevices.find(
			{ studioId: args.studioId },
			{
				fields: {
					// Only monitor settings
					settings: 1,
				},
			}
		).observe({
			added: () => triggerUpdate({ invalidatePeripheralDevices: true }),
			changed: () => triggerUpdate({ invalidatePeripheralDevices: true }),
			removed: () => triggerUpdate({ invalidatePeripheralDevices: true }),
		}),
		ExpectedPackages.find({
			studioId: args.studioId,
		}).observe({
			added: () => triggerUpdate({ invalidateExpectedPackages: true }),
			changed: () => triggerUpdate({ invalidateExpectedPackages: true }),
			removed: () => triggerUpdate({ invalidateExpectedPackages: true }),
		}),
		RundownPlaylists.find(
			{
				studioId: args.studioId,
			},
			{
				fields: {
					// It should be enough to watch these fields for changes
					_id: 1,
					activationId: 1,
					rehearsal: 1,
					currentPartInstanceId: 1, // So that it invalidates when the current changes
					nextPartInstanceId: 1, // So that it invalidates when the next changes
				},
			}
		).observe({
			added: () => triggerUpdate({ invalidateRundownPlaylist: true }),
			changed: () => triggerUpdate({ invalidateRundownPlaylist: true }),
			removed: () => triggerUpdate({ invalidateRundownPlaylist: true }),
		}),
	]
}

async function manipulateExpectedPackagesPublicationData(
	args: ReadonlyDeep<ExpectedPackagesPublicationArgs>,
	state: Partial<ExpectedPackagesPublicationState>,
	updateProps: ExpectedPackagesPublicationUpdateProps | undefined
): Promise<DBObj[] | null> {
	// Prepare data for publication:

	if (!updateProps) {
		// Invalidate everything on first run
		updateProps = {
			invalidateExpectedPackages: true,
			invalidatePeripheralDevices: true,
			invalidateRundownPlaylist: true,
			invalidateStudio: true,
		}
	}

	let invalidateRoutedExpectedPackages = false
	let invalidateRoutedPlayoutExpectedPackages = false

	if (updateProps.invalidateStudio) {
		invalidateRoutedExpectedPackages = true
		invalidateRoutedPlayoutExpectedPackages = true

		state.studio = await Studios.findOneAsync(args.studioId)
		if (!state.studio) {
			logger.warn(`Pub.expectedPackagesForDevice: studio "${args.studioId}" not found!`)
		}
	}

	if (updateProps.invalidatePeripheralDevices) {
		invalidateRoutedExpectedPackages = true
		invalidateRoutedPlayoutExpectedPackages = true
	}
	if (updateProps.invalidateExpectedPackages || !state.expectedPackages) {
		invalidateRoutedExpectedPackages = true
		invalidateRoutedPlayoutExpectedPackages = true

		state.expectedPackages = await ExpectedPackages.findFetchAsync({
			studioId: args.studioId,
		})
		if (!state.expectedPackages.length) {
			logger.info(`Pub.expectedPackagesForDevice: no ExpectedPackages for studio "${args.studioId}" found`)
		}
	}
	if (updateProps.invalidateRundownPlaylist) {
		const activePlaylist = await RundownPlaylists.findOneAsync({
			studioId: args.studioId,
			activationId: { $exists: true },
		})
		state.activePlaylist = activePlaylist
		delete state.activeRundowns

		const selectPartInstances =
			activePlaylist && RundownPlaylistCollectionUtil.getSelectedPartInstances(activePlaylist)
		state.nextPartInstance = selectPartInstances?.nextPartInstance
		state.currentPartInstance = selectPartInstances?.currentPartInstance

		invalidateRoutedPlayoutExpectedPackages = true
	}

	if (!state.activeRundowns) {
		state.activeRundowns = state.activePlaylist
			? await Rundowns.findFetchAsync({
					playlistId: state.activePlaylist._id,
			  })
			: []
	}

	if (!state.studio) {
		return []
	}
	const studio: Studio = state.studio

	if (invalidateRoutedExpectedPackages) {
		// Map the expectedPackages onto their specified layer:
		const routedMappingsWithPackages = routeExpectedPackages(studio, state.expectedPackages)

		if (state.expectedPackages.length && !Object.keys(routedMappingsWithPackages).length) {
			logger.info(`Pub.expectedPackagesForDevice: routedMappingsWithPackages is empty`)
		}

		state.routedExpectedPackages = generateExpectedPackages(
			state.studio,
			args.filterPlayoutDeviceIds,
			routedMappingsWithPackages,
			Priorities.OTHER // low priority
		)
	}
	if (invalidateRoutedPlayoutExpectedPackages) {
		// Use the expectedPackages of the Current and Next Parts:
		const playoutNextExpectedPackages: ExpectedPackageDB[] = state.nextPartInstance
			? await generateExpectedPackagesForPartInstance(
					args.studioId,
					state.nextPartInstance.rundownId,
					state.nextPartInstance
			  )
			: []

		const playoutCurrentExpectedPackages: ExpectedPackageDB[] = state.currentPartInstance
			? await generateExpectedPackagesForPartInstance(
					args.studioId,
					state.currentPartInstance.rundownId,
					state.currentPartInstance
			  )
			: []

		// Map the expectedPackages onto their specified layer:
		const currentRoutedMappingsWithPackages = routeExpectedPackages(studio, playoutCurrentExpectedPackages)
		const nextRoutedMappingsWithPackages = routeExpectedPackages(studio, playoutNextExpectedPackages)

		if (
			state.currentPartInstance &&
			!Object.keys(currentRoutedMappingsWithPackages).length &&
			!Object.keys(nextRoutedMappingsWithPackages).length
		) {
			logger.debug(
				`Pub.expectedPackagesForDevice: Both currentRoutedMappingsWithPackages and nextRoutedMappingsWithPackages are empty`
			)
		}

		// Filter, keep only the routed mappings for this device:
		state.routedPlayoutExpectedPackages = [
			...generateExpectedPackages(
				state.studio,
				args.filterPlayoutDeviceIds,
				currentRoutedMappingsWithPackages,
				Priorities.PLAYOUT_CURRENT
			),
			...generateExpectedPackages(
				state.studio,
				args.filterPlayoutDeviceIds,
				nextRoutedMappingsWithPackages,
				Priorities.PLAYOUT_NEXT
			),
		]
	}

	const packageContainers: { [containerId: string]: PackageContainer } = {}
	for (const [containerId, studioPackageContainer] of Object.entries(studio.packageContainers)) {
		packageContainers[containerId] = studioPackageContainer.container
	}

	return literal<DBObj[]>([
		{
			_id: protectString(`${args.deviceId}_expectedPackages`),
			type: 'expected_packages',
			studioId: args.studioId,
			expectedPackages: state.routedExpectedPackages,
		},
		{
			_id: protectString(`${args.deviceId}_playoutExpectedPackages`),
			type: 'expected_packages',
			studioId: args.studioId,
			expectedPackages: state.routedPlayoutExpectedPackages,
		},
		{
			_id: protectString(`${args.deviceId}_packageContainers`),
			type: 'package_containers',
			studioId: args.studioId,
			packageContainers: packageContainers,
		},
		{
			_id: protectString(`${args.deviceId}_rundownPlaylist`),
			type: 'active_playlist',
			studioId: args.studioId,
			activeplaylist: state.activePlaylist
				? {
						_id: state.activePlaylist._id,
						active: !!state.activePlaylist.activationId,
						rehearsal: state.activePlaylist.rehearsal,
				  }
				: undefined,
			activeRundowns: state.activeRundowns.map((rundown) => {
				return {
					_id: rundown._id,
					_rank: state.activePlaylist?.rundownIdsInOrder?.indexOf(rundown._id) ?? 0,
				}
			}),
		},
	])
}

meteorCustomPublishArray(
	PubSub.expectedPackagesForDevice,
	'deviceExpectedPackages',
	async function (
		pub,
		deviceId: PeripheralDeviceId,
		filterPlayoutDeviceIds: PeripheralDeviceId[] | undefined,
		token: string | undefined
	) {
		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = PeripheralDevices.findOne(deviceId)

			if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

			const studioId = peripheralDevice.studioId
			if (!studioId) {
				logger.warn(`Pub.expectedPackagesForDevice: device "${peripheralDevice._id}" has no studioId`)
				return this.ready()
			}

			const observer = await setUpOptimizedObserver<
				DBObj,
				ExpectedPackagesPublicationArgs,
				ExpectedPackagesPublicationState,
				ExpectedPackagesPublicationUpdateProps
			>(
				`pub_${PubSub.expectedPackagesForDevice}_${studioId}_${deviceId}_${JSON.stringify(
					(filterPlayoutDeviceIds || []).sort()
				)}`,
				{ studioId, deviceId, filterPlayoutDeviceIds },
				setupExpectedPackagesPublicationObservers,
				manipulateExpectedPackagesPublicationData,
				(_args, newData) => {
					pub.updatedDocs(newData)
				},
				500 // ms, wait this time before sending an update
			)
			pub.onStop(() => {
				observer.stop()
			})
		} else {
			logger.warn(`Pub.expectedPackagesForDevice: Not allowed: "${deviceId}"`)
		}
	}
)

interface ResultingExpectedPackage {
	expectedPackage: ExpectedPackage.Base & { rundownId?: string }
	/** Lower should be done first */
	priority: number
	sources: PackageContainerOnPackage[]
	targets: PackageContainerOnPackage[]
	playoutDeviceId: PeripheralDeviceId
}

enum Priorities {
	// Lower priorities are done first

	/** Highest priority */
	PLAYOUT_CURRENT = 0,
	/** Second-to-highest priority */
	PLAYOUT_NEXT = 1,
	OTHER = 9,
}

function generateExpectedPackages(
	studio: StudioLight,
	filterPlayoutDeviceIds: ReadonlyDeep<PeripheralDeviceId[] | undefined>,
	routedMappingsWithPackages: MappingsExtWithPackage,
	priority: Priorities
) {
	const routedExpectedPackages: ResultingExpectedPackage[] = []

	for (const layerName of Object.keys(routedMappingsWithPackages)) {
		const mapping = routedMappingsWithPackages[layerName]

		// Filter, keep only the routed mappings for this device:
		if (!filterPlayoutDeviceIds || filterPlayoutDeviceIds.includes(mapping.deviceId)) {
			for (const expectedPackage of mapping.expectedPackages) {
				// Lookup Package sources:
				const combinedSources: PackageContainerOnPackage[] = []

				for (const packageSource of expectedPackage.sources) {
					const lookedUpSource = studio.packageContainers[packageSource.containerId]
					if (lookedUpSource) {
						// We're going to combine the accessor attributes set on the Package with the ones defined on the source
						const combinedSource: PackageContainerOnPackage = {
							...omit(clone(lookedUpSource.container), 'accessors'),
							accessors: {},
							containerId: packageSource.containerId,
						}

						/** Array of both the accessors of the expected package and the source */
						const accessorIds = _.uniq(
							Object.keys(lookedUpSource.container.accessors).concat(
								Object.keys(packageSource.accessors || {})
							)
						)

						for (const accessorId of accessorIds) {
							const sourceAccessor: Accessor.Any | undefined =
								lookedUpSource.container.accessors[accessorId]

							const packageAccessor: AccessorOnPackage.Any | undefined =
								packageSource.accessors?.[accessorId]

							if (packageAccessor && sourceAccessor && packageAccessor.type === sourceAccessor.type) {
								combinedSource.accessors[accessorId] = deepExtend({}, sourceAccessor, packageAccessor)
							} else if (packageAccessor) {
								combinedSource.accessors[accessorId] = clone<AccessorOnPackage.Any>(packageAccessor)
							} else if (sourceAccessor) {
								combinedSource.accessors[accessorId] = clone<Accessor.Any>(
									sourceAccessor
								) as AccessorOnPackage.Any
							}
						}
						combinedSources.push(combinedSource)
					} else {
						logger.warn(
							`Pub.expectedPackagesForDevice: Source package container "${packageSource.containerId}" not found`
						)
						// Add a placeholder source, it's used to provide users with a hint of what's wrong
						combinedSources.push({
							containerId: packageSource.containerId,
							accessors: {},
							label: `PackageContainer missing in config: ${packageSource.containerId}`,
						})
					}
				}

				// Lookup Package targets:

				const mappingDeviceId = unprotectString(mapping.deviceId)

				let packageContainerId: string | undefined
				for (const [containerId, packageContainer] of Object.entries(studio.packageContainers)) {
					if (packageContainer.deviceIds.includes(mappingDeviceId)) {
						// TODO: how to handle if a device has multiple containers?
						packageContainerId = containerId
						break // just picking the first one found, for now
					}
				}

				const combinedTargets: PackageContainerOnPackage[] = []
				if (packageContainerId) {
					const lookedUpTarget = studio.packageContainers[packageContainerId]
					if (lookedUpTarget) {
						// Todo: should the be any combination of properties here?
						combinedTargets.push({
							...omit(clone(lookedUpTarget.container), 'accessors'),
							accessors:
								(lookedUpTarget.container.accessors as {
									[accessorId: string]: AccessorOnPackage.Any
								}) || {},
							containerId: packageContainerId,
						})
					}
				} else {
					logger.warn(`Pub.expectedPackagesForDevice: No package container found for "${mappingDeviceId}"`)
					// Add a placeholder target, it's used to provide users with a hint of what's wrong
					combinedTargets.push({
						containerId: '__placeholder-target',
						accessors: {},
						label: `No target found for Device "${mappingDeviceId}", Layer "${layerName}"`,
					})
				}

				if (!combinedSources.length) {
					if (expectedPackage.sources.length !== 0) {
						logger.warn(`Pub.expectedPackagesForDevice: No sources found for "${expectedPackage._id}"`)
					}
				}
				if (!combinedTargets.length) {
					logger.warn(`Pub.expectedPackagesForDevice: No targets found for "${expectedPackage._id}"`)
				}
				expectedPackage.sideEffect = getSideEffect(expectedPackage, studio)

				routedExpectedPackages.push({
					expectedPackage: unprotectObject(expectedPackage),
					sources: combinedSources,
					targets: combinedTargets,
					priority: priority,
					playoutDeviceId: mapping.deviceId,
				})
			}
		}
	}
	return routedExpectedPackages
}
