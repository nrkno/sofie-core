import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import * as _ from 'underscore'
import { PeripheralDevice, PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'
import { Rundowns, DBRundown } from '../../../lib/collections/Rundowns'
import { DBPart } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { saveIntoDb, getCurrentTime, unprotectString, PreparedChanges, waitForPromise } from '../../../lib/lib'
import {
	IngestRundown,
	IngestSegment,
	IngestPart,
	BlueprintResultOrderedRundowns,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../../../lib/logging'
import { Studio } from '../../../lib/collections/Studios'
import { getAllRundownsInPlaylist, sortDefaultRundownInPlaylistOrder } from '../rundown'
import { DBSegment, Segments, SegmentId } from '../../../lib/collections/Segments'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import {
	loadCachedIngestSegment,
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
} from './lib'
import { DBRundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { MethodContext } from '../../../lib/api/methods'
import { CommitIngestData, ingestLockFunction } from './syncFunction'
import { CacheForIngest } from './cache'
import { updateRundownFromIngestData, updateSegmentFromIngestData } from './generation'
import { loadCachedRundownData } from './ingestCache2'

/** Priority for handling of synchronous events. Lower means higher priority */
export enum RundownSyncFunctionPriority {
	/** Events initiated from external (ingest) devices */
	INGEST = 0,
	/** Events initiated from user, for triggering ingest actions */
	USER_INGEST = 9,
	/** Events initiated from user, for playout */
	USER_PLAYOUT = 10,
	/** Events initiated from playout-gateway callbacks */
	CALLBACK_PLAYOUT = 20,
}

interface SegmentChanges {
	segmentId: SegmentId
	segment: PreparedChanges<DBSegment>
	parts: PreparedChanges<DBPart>
	pieces: PreparedChanges<Piece>
	adlibPieces: PreparedChanges<AdLibPiece>
}

export namespace RundownInput {
	// Get info on the current rundowns from this device:
	export function dataRundownList(context: MethodContext, deviceId: PeripheralDeviceId, deviceToken: string) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownList')
		return listIngestRundowns(peripheralDevice)
	}
	export function dataRundownGet(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownGet', rundownExternalId)
		check(rundownExternalId, String)
		return getIngestRundown(peripheralDevice, rundownExternalId)
	}
	// Delete, Create & Update Rundown (and it's contents):
	export function dataRundownDelete(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownDelete', rundownExternalId)
		check(rundownExternalId, String)
		handleRemovedRundown(peripheralDevice, rundownExternalId)
	}
	export function dataRundownCreate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		ingestRundown: IngestRundown
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownCreate', ingestRundown)
		check(ingestRundown, Object)
		handleUpdatedRundown(undefined, peripheralDevice, ingestRundown, true)
	}
	export function dataRundownUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		ingestRundown: IngestRundown
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownUpdate', ingestRundown)
		check(ingestRundown, Object)
		handleUpdatedRundown(undefined, peripheralDevice, ingestRundown, false)
	}
	export function dataSegmentGet(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentGet', rundownExternalId, segmentExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		return getIngestSegment(peripheralDevice, rundownExternalId, segmentExternalId)
	}
	// Delete, Create & Update Segment (and it's contents):
	export function dataSegmentDelete(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentDelete', rundownExternalId, segmentExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		handleRemovedSegment(peripheralDevice, rundownExternalId, segmentExternalId)
	}
	export function dataSegmentCreate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentCreate', rundownExternalId, ingestSegment)
		check(rundownExternalId, String)
		check(ingestSegment, Object)
		handleUpdatedSegment(peripheralDevice, rundownExternalId, ingestSegment, true)
	}
	export function dataSegmentUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentUpdate', rundownExternalId, ingestSegment)
		check(rundownExternalId, String)
		check(ingestSegment, Object)
		handleUpdatedSegment(peripheralDevice, rundownExternalId, ingestSegment, false)
	}
	// Delete, Create & Update Part:
	export function dataPartDelete(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		partExternalId: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataPartDelete', rundownExternalId, segmentExternalId, partExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(partExternalId, String)
		handleRemovedPart(peripheralDevice, rundownExternalId, segmentExternalId, partExternalId)
	}
	export function dataPartCreate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataPartCreate', rundownExternalId, segmentExternalId, ingestPart)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(ingestPart, Object)
		handleUpdatedPart(peripheralDevice, rundownExternalId, segmentExternalId, ingestPart)
	}
	export function dataPartUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataPartUpdate', rundownExternalId, segmentExternalId, ingestPart)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(ingestPart, Object)
		handleUpdatedPart(peripheralDevice, rundownExternalId, segmentExternalId, ingestPart)
	}
}

function getIngestRundown(peripheralDevice: PeripheralDevice, rundownExternalId: string): IngestRundown {
	const rundown = Rundowns.findOne({
		peripheralDeviceId: peripheralDevice._id,
		externalId: rundownExternalId,
	})
	if (!rundown) {
		throw new Meteor.Error(404, `Rundown ${rundownExternalId} does not exist`)
	}

	const ingestData = waitForPromise(loadCachedRundownData(null, rundown._id))
	if (!ingestData)
		throw new Meteor.Error(404, `Rundown "${rundown._id}", (${rundownExternalId}) has no cached ingest data`)
	return ingestData
}
function getIngestSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string
): IngestSegment {
	const rundown = Rundowns.findOne({
		peripheralDeviceId: peripheralDevice._id,
		externalId: rundownExternalId,
	})
	if (!rundown) {
		throw new Meteor.Error(404, `Rundown ${rundownExternalId} does not exist`)
	}

	const segment = Segments.findOne({
		externalId: segmentExternalId,
		rundownId: rundown._id,
	})

	if (!segment) {
		throw new Meteor.Error(404, `Segment ${segmentExternalId} does not exist in rundown ${rundownExternalId}`)
	}

	return loadCachedIngestSegment(rundown._id, rundown.externalId, segment._id, segment.externalId)
}
function listIngestRundowns(peripheralDevice: PeripheralDevice): string[] {
	const rundowns = Rundowns.find({
		peripheralDeviceId: peripheralDevice._id,
	}).fetch()

	return rundowns.map((r) => r.externalId)
}

export function handleRemovedRundown(peripheralDevice: PeripheralDevice, rundownExternalId: string) {
	const studio = getStudioFromDevice(peripheralDevice)

	return ingestLockFunction(
		'handleRemovedRundown',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				// Remove it
				return undefined
			} else {
				return null
			}
		},
		async (cache) => {
			const rundown = getRundown(cache)

			return {
				changedSegmentIds: [],
				removedSegmentIds: [],
				renamedSegments: new Map(),
				removeRundown: canRundownBeUpdated(rundown, false),

				showStyle: undefined,
				blueprint: undefined,
			}
		}
	)
}
/** Handle an updated (or inserted) Rundown */
export function handleUpdatedRundown(
	studio0: Studio | undefined,
	peripheralDevice: PeripheralDevice | undefined,
	newIngestRundown: IngestRundown,
	isCreateAction: boolean
) {
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
	return ingestLockFunction(
		'handleUpdatedRundown',
		studioId,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown || isCreateAction) {
				// We want to regenerate unmodified
				return makeNewIngestRundown(newIngestRundown)
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			if (!ingestRundown) throw new Meteor.Error(`regenerateRundown lost the IngestRundown...`)

			return handleUpdatedRundownInner(cache, ingestRundown, isCreateAction, peripheralDevice)
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
export function regenerateRundown(studio: Studio, rundownExternalId: string) {
	return ingestLockFunction(
		'regenerateRundown',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				// We want to regenerate unmodified
				return ingestRundown
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			// If the rundown is orphaned, then we can't regenerate as there wont be any data to use!
			if (!ingestRundown || !canRundownBeUpdated(cache.Rundown.doc, false)) return null

			return updateRundownFromIngestData(cache, ingestRundown, undefined)
		}
	)
}

/** Set _rank and playlistId of rundowns in a playlist */
export function updateRundownsInPlaylist(
	playlist: DBRundownPlaylist,
	rundownRanks: BlueprintResultOrderedRundowns,
	currentRundown?: DBRundown
) {
	const { rundowns, selector } = getAllRundownsInPlaylist(playlist._id, playlist.externalId)

	let maxRank: number = Number.NEGATIVE_INFINITY
	let currentRundownUpdated: DBRundown | undefined
	rundowns.forEach((rundown) => {
		rundown.playlistId = playlist._id

		if (!playlist.rundownRanksAreSetInSofie) {
			const rundownRank = rundownRanks[unprotectString(rundown._id)]
			if (rundownRank !== undefined) {
				rundown._rank = rundownRank
			}
		}
		if (!_.isNaN(Number(rundown._rank))) {
			maxRank = Math.max(maxRank, rundown._rank)
		}
		if (currentRundown && rundown._id === currentRundown._id) currentRundownUpdated = rundown
		return rundown
	})
	if (playlist.rundownRanksAreSetInSofie) {
		// Place new rundowns at the end:

		const unrankedRundowns = sortDefaultRundownInPlaylistOrder(rundowns.filter((r) => r._rank === undefined))

		unrankedRundowns.forEach((rundown) => {
			if (rundown._rank === undefined) {
				rundown._rank = ++maxRank
			}
		})
	}
	if (currentRundown && !currentRundownUpdated) {
		throw new Meteor.Error(
			500,
			`updateRundownsInPlaylist: Rundown "${currentRundown._id}" is not a part of rundowns`
		)
	}
	if (currentRundown && currentRundownUpdated) {
		// Apply to in-memory copy:
		currentRundown.playlistId = currentRundownUpdated.playlistId
		currentRundown._rank = currentRundownUpdated._rank
	}

	saveIntoDb(Rundowns, selector, rundowns)
}

export function handleRemovedSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string
) {
	const studio = getStudioFromDevice(peripheralDevice)

	return ingestLockFunction(
		'handleRemovedSegment',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const oldSegmentsLength = ingestRundown.segments.length
				ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== segmentExternalId)
				ingestRundown.modified = getCurrentTime()

				if (ingestRundown.segments.length === oldSegmentsLength) {
					// Nothing was removed
					return null
				}

				// We modify in-place
				return ingestRundown
			} else {
				return null
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
export function handleUpdatedSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	newIngestSegment: IngestSegment,
	isCreateAction: boolean
) {
	const studio = getStudioFromDevice(peripheralDevice)

	const segmentExternalId = newIngestSegment.externalId

	return ingestLockFunction(
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
				return null
			}
		},
		async (cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment "${segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(cache, ingestSegment, isCreateAction)
		}
	)
}

export function handleRemovedPart(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string,
	partExternalId: string
) {
	const studio = getStudioFromDevice(peripheralDevice)

	return ingestLockFunction(
		'handleRemovedPart',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === segmentExternalId)
				if (!ingestSegment) {
					logger.warn(
						`handleUpdatedPart: Missing Segment with externalId "${segmentExternalId}" in Rundown ingest data for "${rundownExternalId}"`
					)
					return null
				}
				const oldPartsLength = ingestSegment.parts.length
				ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== partExternalId)
				ingestSegment.modified = getCurrentTime()

				if (ingestSegment.parts.length === oldPartsLength) {
					// Nothing was removed
					return null
				}

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment "${segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(cache, ingestSegment, false)
		}
	)
}
export function handleUpdatedPart(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string,
	ingestPart: IngestPart
) {
	const studio = getStudioFromDevice(peripheralDevice)

	return ingestLockFunction(
		'handleUpdatedPart',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === segmentExternalId)
				if (!ingestSegment) {
					logger.warn(
						`handleUpdatedPart: Missing Segment with externalId "${segmentExternalId}" in Rundown ingest data for "${rundownExternalId}"`
					)
					return null
				}
				ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== ingestPart.externalId)
				ingestSegment.parts.push(makeNewIngestPart(ingestPart))
				ingestSegment.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment "${segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(cache, ingestSegment, false)
		}
	)
}
