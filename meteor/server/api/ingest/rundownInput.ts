import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import { PeripheralDevice, PeripheralDeviceId, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { DBRundown, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { getCurrentTime, lazyIgnore, literal } from '../../../lib/lib'
import { IngestRundown, IngestSegment, IngestPart, IngestPlaylist } from '@sofie-automation/blueprints-integration'
import { logger } from '../../../lib/logging'
import { Studio, StudioId } from '../../../lib/collections/Studios'
import { DBSegment, SegmentId, Segments } from '../../../lib/collections/Segments'
import {
	RundownIngestDataCache,
	LocalIngestRundown,
	makeNewIngestSegment,
	makeNewIngestPart,
	makeNewIngestRundown,
} from './ingestCache'
import {
	getSegmentId,
	getStudioFromDevice,
	canRundownBeUpdated,
	canSegmentBeUpdated,
	checkAccessAndGetPeripheralDevice,
	getRundown,
	extendIngestRundownCore,
} from './lib'
import { MethodContext } from '../../../lib/api/methods'
import { CommitIngestData, runIngestOperationWithCache, UpdateIngestRundownAction } from './lockFunction'
import { CacheForIngest } from './cache'
import {
	getRundownFromIngestData,
	resolveSegmentChangesForUpdatedRundown,
	saveChangesForRundown,
	saveSegmentChangesToCache,
	updateRundownFromIngestData,
	updateSegmentFromIngestData,
	UpdateSegmentsResult,
} from './generation'
import { removeRundownsFromDb } from '../rundownPlaylist'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { rundownToSegmentRundown, StudioUserContext } from '../blueprints/context'
import { selectShowStyleVariant } from '../rundown'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import _ from 'underscore'
import { profiler } from '../profiler'
import { updateBaselineExpectedPackagesOnRundown } from './expectedPackages'
import { MediaObject, MediaObjects } from '../../../lib/collections/MediaObjects'
import { Parts } from '../../../lib/collections/Parts'

export namespace RundownInput {
	export async function dataPlaylistGet(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		playlistExternalId: string
	): Promise<IngestPlaylist> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataPlaylistGet', playlistExternalId)
		check(playlistExternalId, String)
		return getIngestPlaylist(peripheralDevice, playlistExternalId)
	}
	// Get info on the current rundowns from this device:
	export async function dataRundownList(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string
	): Promise<string[]> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownList')
		return listIngestRundowns(peripheralDevice)
	}
	export async function dataRundownGet(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string
	): Promise<IngestRundown> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownGet', rundownExternalId)
		check(rundownExternalId, String)
		return getIngestRundown(peripheralDevice, rundownExternalId)
	}
	// Delete, Create & Update Rundown (and it's contents):
	export async function dataRundownDelete(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownDelete', rundownExternalId)
		check(rundownExternalId, String)
		await handleRemovedRundown(peripheralDevice, rundownExternalId)
	}
	export async function dataRundownCreate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		ingestRundown: IngestRundown
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownCreate', ingestRundown)
		check(ingestRundown, Object)
		await handleUpdatedRundown(undefined, peripheralDevice, ingestRundown, true)
	}
	export async function dataRundownUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		ingestRundown: IngestRundown
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownUpdate', ingestRundown)
		check(ingestRundown, Object)
		await handleUpdatedRundown(undefined, peripheralDevice, ingestRundown, false)
	}
	export async function dataRundownMetaDataUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		ingestRundown: Omit<IngestRundown, 'segments'>
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownMetaDataUpdate', ingestRundown)
		check(ingestRundown, Object)
		await handleUpdatedRundownMetaData(undefined, peripheralDevice, ingestRundown)
	}
	export async function dataSegmentGet(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	): Promise<IngestSegment> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentGet', rundownExternalId, segmentExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		return getIngestSegment(peripheralDevice, rundownExternalId, segmentExternalId)
	}
	// Delete, Create & Update Segment (and it's contents):
	export async function dataSegmentDelete(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentDelete', rundownExternalId, segmentExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		await handleRemovedSegment(peripheralDevice, rundownExternalId, segmentExternalId)
	}
	export async function dataSegmentCreate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentCreate', rundownExternalId, ingestSegment)
		check(rundownExternalId, String)
		check(ingestSegment, Object)
		await handleUpdatedSegment(peripheralDevice, rundownExternalId, ingestSegment, true)
	}
	export async function dataSegmentUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentUpdate', rundownExternalId, ingestSegment)
		check(rundownExternalId, String)
		check(ingestSegment, Object)
		await handleUpdatedSegment(peripheralDevice, rundownExternalId, ingestSegment, false)
	}
	export async function dataSegmentRanksUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		newRanks: { [segmentExternalId: string]: number }
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentRanksUpdate', rundownExternalId, Object.keys(newRanks))
		check(rundownExternalId, String)
		check(newRanks, Object)
		await handleUpdatedSegmentRanks(peripheralDevice, rundownExternalId, newRanks)
	}
	// Delete, Create & Update Part:
	export async function dataPartDelete(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		partExternalId: string
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataPartDelete', rundownExternalId, segmentExternalId, partExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(partExternalId, String)
		await handleRemovedPart(peripheralDevice, rundownExternalId, segmentExternalId, partExternalId)
	}
	export async function dataPartCreate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataPartCreate', rundownExternalId, segmentExternalId, ingestPart)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(ingestPart, Object)
		await handleUpdatedPart(peripheralDevice, rundownExternalId, segmentExternalId, ingestPart)
	}
	export async function dataPartUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	): Promise<void> {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataPartUpdate', rundownExternalId, segmentExternalId, ingestPart)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(ingestPart, Object)
		await handleUpdatedPart(peripheralDevice, rundownExternalId, segmentExternalId, ingestPart)
	}
}

async function getIngestPlaylist(
	peripheralDevice: PeripheralDevice,
	playlistExternalId: string
): Promise<IngestPlaylist> {
	const rundowns = await Rundowns.findFetchAsync({
		peripheralDeviceId: peripheralDevice._id,
		playlistExternalId,
	})

	const ingestPlaylist: IngestPlaylist = literal<IngestPlaylist>({
		externalId: playlistExternalId,
		rundowns: [],
	})

	await Promise.all(
		rundowns.map(async (rundown) => {
			const ingestCache = await RundownIngestDataCache.create(rundown._id)
			const ingestData = ingestCache.fetchRundown()
			if (ingestData) {
				ingestPlaylist.rundowns.push(ingestData)
			}
		})
	)

	return ingestPlaylist
}
async function getIngestRundown(peripheralDevice: PeripheralDevice, rundownExternalId: string): Promise<IngestRundown> {
	const rundown = await Rundowns.findOneAsync({
		peripheralDeviceId: peripheralDevice._id,
		externalId: rundownExternalId,
	})
	if (!rundown) {
		throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
	}

	const ingestCache = await RundownIngestDataCache.create(rundown._id)
	const ingestData = ingestCache.fetchRundown()
	if (!ingestData)
		throw new Meteor.Error(404, `Rundown "${rundown._id}", (${rundownExternalId}) has no cached ingest data`)
	return ingestData
}
async function getIngestSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string
): Promise<IngestSegment> {
	const rundown = await Rundowns.findOneAsync({
		peripheralDeviceId: peripheralDevice._id,
		externalId: rundownExternalId,
	})
	if (!rundown) {
		throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
	}

	const segment = await Segments.findOneAsync({
		externalId: segmentExternalId,
		rundownId: rundown._id,
	})

	if (!segment) {
		throw new Meteor.Error(404, `Segment ${segmentExternalId} not found in rundown ${rundownExternalId}`)
	}

	const ingestCache = await RundownIngestDataCache.create(rundown._id)
	const ingestData = ingestCache.fetchSegment(segment._id)
	if (!ingestData)
		throw new Meteor.Error(
			404,
			`Rundown "${rundown._id}", (${rundownExternalId}) has no cached segment "${segment._id}" ingest data`
		)
	return ingestData
}
async function listIngestRundowns(peripheralDevice: PeripheralDevice): Promise<string[]> {
	const rundowns = await Rundowns.findFetchAsync({
		peripheralDeviceId: peripheralDevice._id,
	})

	return rundowns.map((r) => r.externalId)
}

export async function handleRemovedRundown(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string
): Promise<void> {
	const studio = getStudioFromDevice(peripheralDevice)

	return handleRemovedRundownFromStudio(studio._id, rundownExternalId)
}
async function handleRemovedRundownFromStudio(studioId: StudioId, rundownExternalId: string, forceDelete?: boolean) {
	return runIngestOperationWithCache(
		'handleRemovedRundown',
		studioId,
		rundownExternalId,
		() => {
			// Remove it
			return UpdateIngestRundownAction.DELETE
		},
		async (cache) => {
			const rundown = getRundown(cache)

			return {
				changedSegmentIds: [],
				removedSegmentIds: [],
				renamedSegments: new Map(),
				removeRundown: forceDelete || canRundownBeUpdated(rundown, false),

				showStyle: undefined,
				blueprint: undefined,
			}
		}
	)
}
export async function handleRemovedRundownByRundown(rundown: DBRundown, forceDelete?: boolean): Promise<void> {
	if (rundown.restoredFromSnapshotId) {
		// It's from a snapshot, so should be removed directly, as that means it cannot run ingest operations
		// Note: this bypasses activation checks, but that probably doesnt matter
		await removeRundownsFromDb([rundown._id])

		// check if the playlist is now empty
		const rundownCount = Rundowns.find({ playlistId: rundown.playlistId }).count()
		if (rundownCount === 0) {
			// A lazy approach, but good enough for snapshots
			RundownPlaylists.remove(rundown.playlistId)
		}
	} else {
		await handleRemovedRundownFromStudio(rundown.studioId, rundown.externalId, forceDelete)
	}
}

/** Handle an updated (or inserted) Rundown */
export async function handleUpdatedRundown(
	studio0: Studio | undefined,
	peripheralDevice: PeripheralDevice | undefined,
	newIngestRundown: IngestRundown,
	isCreateAction: boolean
): Promise<void> {
	const studioId = peripheralDevice?.studioId ?? studio0?._id
	if ((!peripheralDevice && !studio0) || !studioId) {
		throw new Meteor.Error(500, `A PeripheralDevice or Studio is required to update a rundown`)
	}

	if (peripheralDevice && studio0 && peripheralDevice.studioId !== studio0._id) {
		throw new Meteor.Error(
			500,
			`PeripheralDevice "${peripheralDevice._id}" does not belong to studio "${studio0._id}"`
		)
	}

	const rundownExternalId = newIngestRundown.externalId
	return runIngestOperationWithCache(
		'handleUpdatedRundown',
		studioId,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown || isCreateAction) {
				// We want to regenerate unmodified
				return makeNewIngestRundown(newIngestRundown)
			} else {
				throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
			}
		},
		async (cache, ingestRundown) => {
			if (!ingestRundown) throw new Meteor.Error(`regenerateRundown lost the IngestRundown...`)

			return handleUpdatedRundownInner(cache, ingestRundown, isCreateAction, peripheralDevice)
		}
	)
}
/** Handle updates to existing rundown properties */
export async function handleUpdatedRundownMetaData(
	studio0: Studio | undefined,
	peripheralDevice: PeripheralDevice | undefined,
	newIngestRundown: Omit<IngestRundown, 'segments'>
): Promise<void> {
	const studioId = peripheralDevice?.studioId ?? studio0?._id
	if ((!peripheralDevice && !studio0) || !studioId) {
		throw new Meteor.Error(500, `A PeripheralDevice or Studio is required to update a rundown`)
	}

	if (peripheralDevice && studio0 && peripheralDevice.studioId !== studio0._id) {
		throw new Meteor.Error(
			500,
			`PeripheralDevice "${peripheralDevice._id}" does not belong to studio "${studio0._id}"`
		)
	}

	const rundownExternalId = newIngestRundown.externalId
	return runIngestOperationWithCache(
		'handleUpdatedRundownMetaData',
		studioId,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				return makeNewIngestRundown({
					...newIngestRundown,
					segments: ingestRundown.segments,
				})
			} else {
				throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
			}
		},
		async (cache, ingestRundown) => {
			if (!ingestRundown) throw new Meteor.Error(`Rundown "${rundownExternalId}" not found`)

			return handleUpdatedRundownMetaDataInner(cache, ingestRundown, peripheralDevice)
		}
	)
}
export async function handleUpdatedRundownInner(
	cache: CacheForIngest,
	ingestRundown: LocalIngestRundown,
	isCreateAction: boolean,
	peripheralDevice?: PeripheralDevice // TODO - to cache?
): Promise<CommitIngestData | null> {
	if (!canRundownBeUpdated(cache.Rundown.doc, isCreateAction)) return null

	logger.info(`${cache.Rundown.doc ? 'Updating' : 'Adding'} rundown ${cache.RundownId}`)

	return updateRundownFromIngestData(cache, ingestRundown, peripheralDevice)
}
export async function regenerateRundown(
	studio: Studio,
	rundownExternalId: string,
	peripheralDevice0: PeripheralDevice | undefined
): Promise<void> {
	return runIngestOperationWithCache(
		'regenerateRundown',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				// We want to regenerate unmodified
				return ingestRundown
			} else {
				throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
			}
		},
		async (cache, ingestRundown) => {
			// If the rundown is orphaned, then we can't regenerate as there wont be any data to use!
			if (!ingestRundown || !canRundownBeUpdated(cache.Rundown.doc, false)) return null

			// Try and find the stored peripheralDevice
			const peripheralDevice =
				peripheralDevice0 ??
				(cache.Rundown.doc?.peripheralDeviceId
					? PeripheralDevices.findOne({
							_id: cache.Rundown.doc.peripheralDeviceId,
							studioId: cache.Studio.doc._id,
					  })
					: undefined)

			return updateRundownFromIngestData(cache, ingestRundown, peripheralDevice)
		}
	)
}

export async function handleUpdatedRundownMetaDataInner(
	cache: CacheForIngest,
	ingestRundown: LocalIngestRundown,
	peripheralDevice?: PeripheralDevice // TODO - to cache?
): Promise<CommitIngestData | null> {
	if (!canRundownBeUpdated(cache.Rundown.doc, false)) return null
	const existingRundown = cache.Rundown.doc
	if (!existingRundown) {
		throw new Meteor.Error(404, `Rundown "${ingestRundown.externalId}" does not exist`)
	}

	const span = profiler.startSpan('ingest.rundownInput.handleUpdatedRundownMetaDataInner')

	logger.info(`Updating rundown ${cache.RundownId}`)

	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, cache.Rundown.doc)

	const selectShowStyleContext = new StudioUserContext(
		{
			name: 'selectShowStyleVariant',
			identifier: `studioId=${cache.Studio.doc._id},rundownId=${cache.RundownId},ingestRundownId=${cache.RundownExternalId}`,
			tempSendUserNotesIntoBlackHole: true,
		},
		cache.Studio.doc
	)
	// TODO-CONTEXT save any user notes from selectShowStyleContext
	const showStyle = await selectShowStyleVariant(selectShowStyleContext, extendedIngestRundown)
	if (!showStyle) {
		logger.debug('Blueprint rejected the rundown')
		throw new Meteor.Error(501, 'Blueprint rejected the rundown')
	}

	const pAllRundownWatchedPackages = WatchedPackagesHelper.createForIngest(cache, undefined)

	const showStyleBlueprint = await loadShowStyleBlueprint(showStyle.base)
	const allRundownWatchedPackages = await pAllRundownWatchedPackages

	// Call blueprints, get rundown
	const { dbRundownData, rundownRes } = await getRundownFromIngestData(
		cache,
		ingestRundown,
		peripheralDevice,
		showStyle,
		showStyleBlueprint,
		allRundownWatchedPackages
	)

	// Save rundown and baseline
	const dbRundown = await saveChangesForRundown(cache, dbRundownData, rundownRes, showStyle)

	let segmentChanges: UpdateSegmentsResult | undefined
	let removedSegments: DBSegment[] | undefined
	if (!_.isEqual(rundownToSegmentRundown(existingRundown), rundownToSegmentRundown(dbRundown))) {
		logger.info(`MetaData of rundown ${dbRundown.externalId} has been modified, regenerating segments`)
		const changes = await resolveSegmentChangesForUpdatedRundown(cache, ingestRundown, allRundownWatchedPackages)
		segmentChanges = changes.segmentChanges
		removedSegments = changes.removedSegments
	}

	updateBaselineExpectedPackagesOnRundown(cache, rundownRes.baseline)

	if (segmentChanges) {
		saveSegmentChangesToCache(cache, segmentChanges, true)
	}

	logger.info(`Rundown ${dbRundown._id} update complete`)

	span?.end()
	return literal<CommitIngestData>({
		changedSegmentIds: segmentChanges?.segments.map((s) => s._id) ?? [],
		removedSegmentIds: removedSegments?.map((s) => s._id) ?? [],
		renamedSegments: new Map(),

		removeRundown: false,

		showStyle: showStyle.compound,
		blueprint: showStyleBlueprint,
	})
}

export async function handleRemovedSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string
): Promise<void> {
	const studio = getStudioFromDevice(peripheralDevice)

	return runIngestOperationWithCache(
		'handleRemovedSegment',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const oldSegmentsLength = ingestRundown.segments.length
				ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== segmentExternalId)
				ingestRundown.modified = getCurrentTime()

				if (ingestRundown.segments.length === oldSegmentsLength) {
					throw new Meteor.Error(
						404,
						`Rundown "${rundownExternalId}" does not have a Segment "${segmentExternalId}" to remove`
					)
				}

				// We modify in-place
				return ingestRundown
			} else {
				throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
			}
		},
		async (cache) => {
			const rundown = getRundown(cache)
			const segmentId = getSegmentId(rundown._id, segmentExternalId)
			const segment = cache.Segments.findOne(segmentId)

			if (!canSegmentBeUpdated(rundown, segment, false)) {
				// segment has already been deleted
				return null
			} else {
				return {
					changedSegmentIds: [],
					removedSegmentIds: [segmentId],
					renamedSegments: new Map(),

					removeRundown: false,

					showStyle: undefined,
					blueprint: undefined,
				}
			}
		}
	)
}
export async function handleUpdatedSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	newIngestSegment: IngestSegment,
	isCreateAction: boolean
): Promise<void> {
	const studio = getStudioFromDevice(peripheralDevice)

	const segmentExternalId = newIngestSegment.externalId

	return runIngestOperationWithCache(
		'handleUpdatedSegment',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== segmentExternalId)
				ingestRundown.segments.push(makeNewIngestSegment(newIngestSegment))
				ingestRundown.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
			}
		},
		async (cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment "${segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(cache, ingestSegment, isCreateAction)
		}
	)
}

export async function handleUpdatedSegmentRanks(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	newRanks: { [segmentExternalId: string]: number }
): Promise<void> {
	const studio = getStudioFromDevice(peripheralDevice)

	return runIngestOperationWithCache(
		'handleUpdatedSegmentRanks',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				// Update ranks on ingest data
				for (const segment of ingestRundown.segments) {
					segment.rank = newRanks[segment.externalId] ?? segment.rank
				}
				// We modify in-place
				return ingestRundown
			} else {
				throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
			}
		},
		async (cache) => {
			const changedSegmentIds: SegmentId[] = []
			for (const [externalId, rank] of Object.entries(newRanks)) {
				const segmentId = getSegmentId(cache.RundownId, externalId)
				const changed = cache.Segments.update(segmentId, {
					$set: {
						_rank: rank,
					},
				})

				if (changed.length === 0) {
					logger.warn(`Failed to update rank of segment "${externalId}" (${rundownExternalId})`)
				} else {
					changedSegmentIds.push(segmentId)
				}
			}

			return {
				changedSegmentIds,
				removedSegmentIds: [],
				renamedSegments: new Map(),
				removeRundown: false,

				showStyle: undefined,
				blueprint: undefined,
			}
		}
	)
}

export async function handleRemovedPart(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string,
	partExternalId: string
): Promise<void> {
	const studio = getStudioFromDevice(peripheralDevice)

	return runIngestOperationWithCache(
		'handleRemovedPart',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === segmentExternalId)
				if (!ingestSegment) {
					throw new Meteor.Error(
						404,
						`Rundown "${rundownExternalId}" does not have a Segment "${segmentExternalId}" to update`
					)
				}
				ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== partExternalId)
				ingestSegment.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
			}
		},
		async (cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment "${segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(cache, ingestSegment, false)
		}
	)
}
export async function handleUpdatedPart(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string,
	ingestPart: IngestPart
): Promise<void> {
	const studio = getStudioFromDevice(peripheralDevice)

	return runIngestOperationWithCache(
		'handleUpdatedPart',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === segmentExternalId)
				if (!ingestSegment) {
					throw new Meteor.Error(
						404,
						`Rundown "${rundownExternalId}" does not have a Segment "${segmentExternalId}" to update`
					)
				}
				ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== ingestPart.externalId)
				ingestSegment.parts.push(makeNewIngestPart(ingestPart))
				ingestSegment.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Meteor.Error(404, `Rundown "${rundownExternalId}" not found`)
			}
		},
		async (cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment "${segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(cache, ingestSegment, false)
		}
	)
}

// hackGetMediaObjectDuration stuff
Meteor.startup(() => {
	if (Meteor.isServer) {
		MediaObjects.find({}, { fields: { _id: 1, mediaId: 1, mediainfo: 1 } }).observe({
			added: onMediaObjectChanged,
			changed: onMediaObjectChanged,
		})
	}
})

function onMediaObjectChanged(newDocument: MediaObject, oldDocument?: MediaObject) {
	if (
		!oldDocument ||
		(newDocument.mediainfo?.format?.duration &&
			oldDocument.mediainfo?.format?.duration !== newDocument.mediainfo.format.duration)
	) {
		const segmentsToUpdate = new Map<SegmentId, RundownId>()
		const rundownIdsInStudio = Rundowns.find({ studio: newDocument.studioId }, { fields: { _id: 1 } })
			.fetch()
			.map((rundown) => rundown._id)
		Parts.find({
			rundownId: { $in: rundownIdsInStudio },
			'hackListenToMediaObjectUpdates.mediaId': newDocument.mediaId,
		}).forEach((part) => {
			segmentsToUpdate.set(part.segmentId, part.rundownId)
		})
		segmentsToUpdate.forEach((rundownId, segmentId) => {
			lazyIgnore(
				`updateSegmentFromMediaObject_${segmentId}`,
				async () => updateSegmentFromCache(rundownId, segmentId),
				200
			)
		})
	}
}
async function updateSegmentFromCache(rundownId: RundownId, segmentId: SegmentId) {
	const rundown = Rundowns.findOne({ _id: rundownId })
	if (!rundown) throw new Meteor.Error(`Could not find rundown ${rundownId} in updateSegmentFromCache`)

	return runIngestOperationWithCache(
		'updateSegmentFromCache',
		rundown.studioId,
		rundown.externalId,
		(ingestRundown) => {
			if (!ingestRundown) {
				throw new Meteor.Error(
					404,
					`Rundown "${rundown.externalId}" does not have a Segment "${segmentId}" to update`
				)
			}
			return ingestRundown
		},
		async (cache, ingestRundown) => {
			const segment = cache.Segments.findOne({ _id: segmentId })
			if (!segment) {
				throw new Meteor.Error(
					404,
					`Rundown "${rundown.externalId}" does not have a Segment "${segmentId}" to update`
				)
			}

			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === segment.externalId)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment "${segment.externalId}" is missing!`)
			return updateSegmentFromIngestData(cache, ingestSegment, false)
		}
	)
}
