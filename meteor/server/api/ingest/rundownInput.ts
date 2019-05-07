import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import {
	Rundown,
	Rundowns,
	DBRundown
} from '../../../lib/collections/Rundowns'
import {
	Part,
	Parts,
	DBPart
} from '../../../lib/collections/Parts'
import {
	Piece,
	Pieces
} from '../../../lib/collections/Pieces'
import {
	saveIntoDb,
	getCurrentTime,
	literal,
	sumChanges,
	anythingChanged,
	ReturnType
} from '../../../lib/lib'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import { IngestRundown, IngestSegment, IngestPart, BlueprintResultSegment } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import { Studio } from '../../../lib/collections/Studios'
import { selectShowStyleVariant, afterRemoveSegments, afterRemoveParts, ServerRundownAPI, removeSegments, updateDynamicPartRanks } from '../rundown'
import { loadShowStyleBlueprints, getBlueprintOfRundown } from '../blueprints/cache'
import { ShowStyleContext, RundownContext, SegmentContext } from '../blueprints/context'
import { Blueprints, Blueprint } from '../../../lib/collections/Blueprints'
import { RundownBaselineObj, RundownBaselineObjs } from '../../../lib/collections/RundownBaselineObjs'
import { Random } from 'meteor/random'
import { postProcessPartBaselineItems, postProcessAdLibPieces, postProcessPieces } from '../blueprints/postProcess'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { DBSegment, Segments } from '../../../lib/collections/Segments'
import { AdLibPiece, AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { saveRundownCache, saveSegmentCache, loadCachedIngestSegment } from './ingestCache'
import { getRundownId, getSegmentId, getPartId, getStudioFromDevice, getRundown, canBeUpdated } from './lib'
import { PackageInfo } from '../../coreSystem'
import { updateExpectedMediaItemsOnRundown } from '../expectedMediaItems'
import { triggerUpdateTimelineAfterIngestData } from '../playout/playout'
import { PartNote, NoteType } from '../../../lib/api/notes'
import { syncFunction } from '../../codeControl'

export enum RundownSyncFunctionPriority {
	Ingest = 0,
	Playout = 10,
}
export function rundownSyncFunction<T extends Function> (rundownId: string, priority: RundownSyncFunctionPriority, fcn: T): ReturnType<T> {
	return syncFunction(fcn, `ingest_rundown_${rundownId}`, undefined, priority)()
}

export namespace RundownInput {
	// Delete, Create & Update Rundown (and it's contents):
	export function dataRundownDelete (self: any, deviceId: string, deviceToken: string, rundownExternalId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataRundownDelete', rundownExternalId)
		check(rundownExternalId, String)
		handleRemovedRundown(peripheralDevice, rundownExternalId)
	}
	export function dataRundownCreate (self: any, deviceId: string, deviceToken: string, ingestRundown: IngestRundown) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataRundownCreate', ingestRundown)
		check(ingestRundown, Object)
		handleUpdatedRundown(peripheralDevice, ingestRundown, 'dataRundownCreate')
	}
	export function dataRundownUpdate (self: any, deviceId: string, deviceToken: string, ingestRundown: IngestRundown) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataRundownUpdate', ingestRundown)
		check(ingestRundown, Object)
		handleUpdatedRundown(peripheralDevice, ingestRundown, 'dataRundownUpdate')
	}
	// Delete, Create & Update Segment (and it's contents):
	export function dataSegmentDelete (self: any, deviceId: string, deviceToken: string, rundownExternalId: string, segmentExternalId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentDelete', rundownExternalId, segmentExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		handleRemovedSegment(peripheralDevice, rundownExternalId, segmentExternalId)
	}
	export function dataSegmentCreate (self: any, deviceId: string, deviceToken: string, rundownExternalId: string, ingestSegment: IngestSegment) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentCreate', rundownExternalId, ingestSegment)
		check(rundownExternalId, String)
		check(ingestSegment, Object)
		handleUpdatedSegment(peripheralDevice, rundownExternalId, ingestSegment)
	}
	export function dataSegmentUpdate (self: any, deviceId: string, deviceToken: string, rundownExternalId: string, ingestSegment: IngestSegment) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentUpdate', rundownExternalId, ingestSegment)
		check(rundownExternalId, String)
		check(ingestSegment, Object)
		handleUpdatedSegment(peripheralDevice, rundownExternalId, ingestSegment)
	}
	// Delete, Create & Update Part:
	export function dataPartDelete (self: any, deviceId: string, deviceToken: string, rundownExternalId: string, segmentExternalId: string, partExternalId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataPartDelete', rundownExternalId, segmentExternalId, partExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(partExternalId, String)
		handleRemovedPart(peripheralDevice, rundownExternalId, segmentExternalId, partExternalId)
	}
	export function dataPartCreate (self: any, deviceId: string, deviceToken: string, rundownExternalId: string, segmentExternalId: string, ingestPart: IngestPart) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataPartCreate', rundownExternalId, segmentExternalId, ingestPart)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(ingestPart, Object)
		handleUpdatedPart(peripheralDevice, rundownExternalId, segmentExternalId, ingestPart)
	}
	export function dataPartUpdate (self: any, deviceId: string, deviceToken: string, rundownExternalId: string, segmentExternalId: string, ingestPart: IngestPart) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataPartUpdate', rundownExternalId, segmentExternalId, ingestPart)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(ingestPart, Object)
		handleUpdatedPart(peripheralDevice, rundownExternalId, segmentExternalId, ingestPart)
	}
}

export function handleRemovedRundown (peripheralDevice: PeripheralDevice, rundownExternalId: string) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, rundownExternalId)

	rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, rundownExternalId)
		if (rundown) {
			logger.info('Removing rundown ' + rundown._id)

			if (canBeUpdated(rundown)) {
				rundown.remove()
			} else {
				logger.info(`Rundown "${rundown._id}" cannot be updated`)
				if (!rundown.unsynced) {
					ServerRundownAPI.unsyncRundown(rundown._id)
				}
			}
		}
	})
}
export function handleUpdatedRundown (peripheralDevice: PeripheralDevice, ingestRundown: IngestRundown, dataSource: string) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, ingestRundown.externalId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => handleUpdatedRundownInner(studio, rundownId, ingestRundown, dataSource, peripheralDevice))
}
export function handleUpdatedRundownInner (studio: Studio, rundownId: string, ingestRundown: IngestRundown, dataSource?: string, peripheralDevice?: PeripheralDevice) {
	const existingDbRundown = Rundowns.findOne(rundownId)
	if (!canBeUpdated(existingDbRundown)) return

	updateRundownAndSaveCache(studio, rundownId, existingDbRundown, ingestRundown, dataSource, peripheralDevice)
}
export function updateRundownAndSaveCache (
	studio: Studio,
	rundownId: string,
	existingDbRundown: Rundown | undefined,
	ingestRundown: IngestRundown,
	dataSource?: string,
	peripheralDevice?: PeripheralDevice) {
	logger.info((existingDbRundown ? 'Updating' : 'Adding') + ' rundown ' + rundownId)

	saveRundownCache(rundownId, ingestRundown)

	updateRundownFromIngestData(studio, existingDbRundown, ingestRundown, dataSource, peripheralDevice)
}
function updateRundownFromIngestData (
	studio: Studio,
	existingDbRundown: Rundown | undefined,
	ingestRundown: IngestRundown,
	dataSource?: string,
	peripheralDevice?: PeripheralDevice
): boolean {
	const rundownId = getRundownId(studio, ingestRundown.externalId)

	const showStyle = selectShowStyleVariant(studio, ingestRundown)
	if (!showStyle) {
		logger.debug('Blueprint rejected the rundown')
		// what to do here? remove the rundown? insert default rundowm?
		return false
	}

	const showStyleBlueprint = loadShowStyleBlueprints(showStyle.base).blueprint
	const blueprintContext = new ShowStyleContext(studio, showStyle.base._id, showStyle.variant._id)
	const rundownRes = showStyleBlueprint.getRundown(blueprintContext, ingestRundown)

	// Ensure the ids in the notes are clean
	const rundownNotes = _.map(blueprintContext.getNotes(), note => literal<PartNote>({
		...note,
		origin: {
			name: note.origin.name,
			rundownId: rundownId,
		}
	}))

	const showStyleBlueprintDb = Blueprints.findOne(showStyle.base.blueprintId) as Blueprint || {}

	const dbRundownData: DBRundown = _.extend(existingDbRundown || {},
		_.omit(literal<DBRundown>({
			...rundownRes.rundown,
			notes: rundownNotes,
			_id: rundownId,
			externalId: ingestRundown.externalId,
			studioId: studio._id,
			showStyleVariantId: showStyle.variant._id,
			showStyleBaseId: showStyle.base._id,
			unsynced: false,

			importVersions: {
				studio: studio._rundownVersionHash,
				showStyleBase: showStyle.base._rundownVersionHash,
				showStyleVariant: showStyle.variant._rundownVersionHash,
				blueprint: showStyleBlueprintDb.blueprintVersion,
				core: PackageInfo.version,
			},

			// omit the below fields
			previousPartId: null,
			currentPartId: null,
			nextPartId: null,
			created: 0,
			modified: 0,

			peripheralDeviceId: '', // added later
			dataSource: '' // added later
		}), ['previousPartId', 'currentPartId', 'nextPartId', 'created', 'modified', 'peripheralDeviceId', 'dataSource'])
	)
	if (peripheralDevice) {
		dbRundownData.peripheralDeviceId = peripheralDevice._id
	}
	if (dataSource) {
		dbRundownData.dataSource = dataSource
	}

	// Save rundown into database:
	let changes = saveIntoDb(Rundowns, {
		_id: dbRundownData._id
	}, [dbRundownData], {
		beforeInsert: (o) => {
			o.created = getCurrentTime()
			o.modified = getCurrentTime()
			return o
		},
		beforeUpdate: (o) => {
			o.modified = getCurrentTime()
			return o
		}
	})

	const dbRundown = Rundowns.findOne(dbRundownData._id)
	if (!dbRundown) throw new Meteor.Error(500, 'Rundown not found (it should have been)')

	// Save the baseline
	const blueprintRundownContext = new RundownContext(dbRundown, studio)
	logger.info(`Building baseline objects for ${dbRundown._id}...`)
	logger.info(`... got ${rundownRes.baseline.length} objects from baseline.`)

	const baselineObj: RundownBaselineObj = {
		_id: Random.id(7),
		rundownId: dbRundown._id,
		objects: postProcessPartBaselineItems(blueprintRundownContext, rundownRes.baseline)
	}
	// Save the global adlibs
	logger.info(`... got ${rundownRes.globalAdLibPieces.length} adLib objects from baseline.`)
	const adlibItems = postProcessAdLibPieces(blueprintRundownContext, rundownRes.globalAdLibPieces, 'baseline')

	const existingRundownParts = Parts.find({
		rundownId: rundownId,
		dynamicallyInserted: false
	}).fetch()

	const existingSegments = Segments.find({ rundown: dbRundown._id }).fetch()
	const segments: DBSegment[] = []
	const parts: DBPart[] = []
	const segmentPieces: Piece[] = []
	const adlibPieces: AdLibPiece[] = []

	const { blueprint, blueprintId } = getBlueprintOfRundown(dbRundown)

	_.each(ingestRundown.segments, (ingestSegment: IngestSegment) => {
		const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
		const existingSegment = _.find(existingSegments, s => s._id === segmentId)
		const existingParts = existingRundownParts.filter(p => p.segmentId === segmentId)

		const context = new SegmentContext(dbRundown, studio, existingParts)
		const res = blueprint.getSegment(context, ingestSegment)

		const segmentContents = generateSegmentContents(context, blueprintId, ingestSegment, existingSegment, existingParts, res)
		segments.push(segmentContents.newSegment)
		parts.push(...segmentContents.parts)
		segmentPieces.push(...segmentContents.segmentPieces)
		adlibPieces.push(...segmentContents.adlibPieces)
	})

	changes = sumChanges(
		changes,
		// Save the baseline
		saveIntoDb<RundownBaselineObj, RundownBaselineObj>(RundownBaselineObjs, {
			rundownId: dbRundown._id,
		}, [baselineObj]),
		// Save the global adlibs
		saveIntoDb<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(RundownBaselineAdLibPieces, {
			rundownId: dbRundown._id
		}, adlibItems),

		// Update Segments:
		saveIntoDb(Segments, {
			rundownId: rundownId
		}, segments, {
			afterInsert (segment) {
				logger.info('inserted segment ' + segment._id)
			},
			afterUpdate (segment) {
				logger.info('updated segment ' + segment._id)
			},
			afterRemove (segment) {
				logger.info('removed segment ' + segment._id)
			},
			afterRemoveAll (segments) {
				afterRemoveSegments(rundownId, _.map(segments, s => s._id))
			}
		}),

		saveIntoDb<Part, DBPart>(Parts, {
			rundownId: rundownId,
		}, parts, {
			afterRemoveAll (parts) {
				afterRemoveParts(rundownId, parts)
			}
		}),

		saveIntoDb<Piece, Piece>(Pieces, {
			rundownId: rundownId,
			dynamicallyInserted: { $ne: true } // do not affect dynamically inserted pieces (such as adLib pieces)
		}, segmentPieces, {
			afterInsert (piece) {
				logger.debug('inserted piece ' + piece._id)
				logger.debug(piece)
			},
			afterUpdate (piece) {
				logger.debug('updated piece ' + piece._id)
			},
			afterRemove (piece) {
				logger.debug('deleted piece ' + piece._id)
			}
		}),

		saveIntoDb<AdLibPiece, AdLibPiece>(AdLibPieces, {
			rundownId: rundownId,
		}, adlibPieces, {
			afterInsert (adLibPiece) {
				logger.debug('inserted adLibPiece ' + adLibPiece._id)
				logger.debug(adLibPiece)
			},
			afterUpdate (adLibPiece) {
				logger.debug('updated piece ' + adLibPiece._id)
			},
			afterRemove (adLibPiece) {
				logger.debug('deleted piece ' + adLibPiece._id)
			}
		})
	)
	const didChange = anythingChanged(changes)
	if (didChange) {
		updateExpectedMediaItemsOnRundown(dbRundown._id)
		updateDynamicPartRanks(dbRundown._id)
		triggerUpdateTimelineAfterIngestData(rundownId, _.map(segments, s => s._id))
	}
	return didChange
}

function handleRemovedSegment (peripheralDevice: PeripheralDevice, rundownExternalId: string, segmentExternalId: string) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, rundownExternalId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, rundownExternalId)
		const segmentId = getSegmentId(rundown._id, segmentExternalId)
		if (canBeUpdated(rundown, segmentId)) {
			if (removeSegments(rundownId, [segmentId]) === 0) {
				throw new Meteor.Error(404, `Segment ${segmentExternalId} not found`)
			}
		}
	})
}
function handleUpdatedSegment (peripheralDevice: PeripheralDevice, rundownExternalId: string, ingestSegment: IngestSegment) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, rundownExternalId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, rundownExternalId)
		const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)
		if (!canBeUpdated(rundown, segmentId)) return

		saveSegmentCache(rundown._id, segmentId, ingestSegment)
		updateSegmentFromIngestData(studio, rundown, ingestSegment)
	})
}
/**
 * Run ingestData through blueprints and update the Segment
 * @param studio
 * @param rundown
 * @param ingestSegment
 * @returns true if data has changed
 */
export function updateSegmentFromIngestData (
	studio: Studio,
	rundown: Rundown,
	ingestSegment: IngestSegment
): boolean {
	const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)
	const { blueprint, blueprintId } = getBlueprintOfRundown(rundown)

	const existingSegment = Segments.findOne({
		_id: segmentId,
		rundownId: rundown._id,
	})
	const existingParts = Parts.find({
		rundownId: rundown._id,
		segmentId: segmentId
	}).fetch()

	const context = new SegmentContext(rundown, studio, existingParts)
	const res = blueprint.getSegment(context, ingestSegment)

	const { parts, segmentPieces, adlibPieces, newSegment } = generateSegmentContents(context, blueprintId, ingestSegment, existingSegment, existingParts, res)

	Segments.upsert({
		_id: segmentId,
		rundownId: rundown._id
	}, newSegment)

	const changes = sumChanges(
		saveIntoDb<Part, DBPart>(Parts, {
			rundownId: rundown._id,
			segmentId: segmentId,
			dynamicallyInserted: { $ne: true } // do not affect dynamically inserted parts (such as adLib parts)
		}, parts, {
			afterRemoveAll (parts) {
				afterRemoveParts(rundown._id, parts)
			}
		}),
		saveIntoDb<Piece, Piece>(Pieces, {
			rundownId: rundown._id,
			partId: { $in: parts.map(p => p._id) },
			dynamicallyInserted: { $ne: true } // do not affect dynamically inserted pieces (such as adLib pieces)
		}, segmentPieces, {
			afterInsert (piece) {
				logger.debug('inserted piece ' + piece._id)
				logger.debug(piece)
			},
			afterUpdate (piece) {
				logger.debug('updated piece ' + piece._id)
			},
			afterRemove (piece) {
				logger.debug('deleted piece ' + piece._id)
			}
		}),
		saveIntoDb<AdLibPiece, AdLibPiece>(AdLibPieces, {
			rundownId: rundown._id,
			partId: { $in: parts.map(p => p._id) },
		}, adlibPieces, {
			afterInsert (adLibPiece) {
				logger.debug('inserted adLibPiece ' + adLibPiece._id)
				logger.debug(adLibPiece)
			},
			afterUpdate (adLibPiece) {
				logger.debug('updated piece ' + adLibPiece._id)
			},
			afterRemove (adLibPiece) {
				logger.debug('deleted piece ' + adLibPiece._id)
			}
		})
	)

	const didChange = anythingChanged(changes)
	if (didChange) {
		updateExpectedMediaItemsOnRundown(rundown._id)
		updateDynamicPartRanks(rundown._id)
		triggerUpdateTimelineAfterIngestData(rundown._id, [segmentId])
	}
	return didChange
}

export function handleRemovedPart (peripheralDevice: PeripheralDevice, rundownExternalId: string, segmentExternalId: string, partExternalId: string) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, rundownExternalId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => {
		const rundown = getRundown(rundownId, rundownExternalId)
		const segmentId = getSegmentId(rundown._id, segmentExternalId)
		const partId = getPartId(rundown._id, partExternalId)

		if (!canBeUpdated(rundown, segmentId, partId)) return

		const part = Parts.findOne({
			_id: partId,
			segmentId: segmentId,
			rundownId: rundown._id
		})
		if (!part) throw new Meteor.Error(404, 'Part not found')

		// Blueprints will handle the deletion of the Part
		const ingestSegment = loadCachedIngestSegment(rundown._id, segmentId)
		ingestSegment.parts = ingestSegment.parts.filter(p => p.externalId !== partExternalId)

		saveSegmentCache(rundown._id, segmentId, ingestSegment)
		updateSegmentFromIngestData(studio, rundown, ingestSegment)
	})
}
export function handleUpdatedPart (peripheralDevice: PeripheralDevice, rundownExternalId: string, segmentExternalId: string, ingestPart: IngestPart) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, rundownExternalId)

	return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Ingest, () => handleUpdatedPartInner(studio, rundownId, rundownExternalId, segmentExternalId, ingestPart))
}
export function handleUpdatedPartInner (studio: Studio, rundownId: string, rundownExternalId: string, segmentExternalId: string, ingestPart: IngestPart) {
	const rundown = getRundown(rundownId, rundownExternalId)
	const segmentId = getSegmentId(rundown._id, segmentExternalId)
	const partId = getPartId(rundown._id, ingestPart.externalId)

	if (!canBeUpdated(rundown, segmentId, partId)) return

	// Blueprints will handle the creation of the Part
	const ingestSegment: IngestSegment = loadCachedIngestSegment(rundown._id, segmentId)
	ingestSegment.parts = ingestSegment.parts.filter(p => p.externalId !== ingestPart.externalId)
	ingestSegment.parts.push(ingestPart)

	saveSegmentCache(rundown._id, segmentId, ingestSegment)
	updateSegmentFromIngestData(studio, rundown, ingestSegment)
}

function generateSegmentContents (
	context: RundownContext,
	blueprintId: string,
	ingestSegment: IngestSegment,
	existingSegment: DBSegment | undefined,
	existingParts: DBPart[],
	blueprintRes: BlueprintResultSegment
) {
	const rundownId = context.rundownId
	const segmentId = getSegmentId(rundownId, ingestSegment.externalId)

	const allNotes = _.map(context.getNotes(), note => literal<PartNote>({
		...note,
		origin: {
			name: note.origin.name,
			rundownId: rundownId,
			segmentId: segmentId,
			partId: note.origin.partId,
			pieceId: note.origin.pieceId,
		}
	}))

	// Ensure all parts have a valid externalId set on them
	const expectedPartIds = ingestSegment.parts.map(p => p.externalId)
	const unknownParts = blueprintRes.parts.filter(p => expectedPartIds.indexOf(p.part.externalId) === -1)
	const knownParts = blueprintRes.parts.filter(p => expectedPartIds.indexOf(p.part.externalId) !== -1)

	const segmentNotes = _.filter(allNotes, note => !note.origin.partId || expectedPartIds.indexOf(note.origin.partId) === -1)

	if (unknownParts.length > 0) {
		const unknownIds = unknownParts.map(p => p.part.externalId).join(', ')
		logger.warn(`Dropping some parts with unknown externalId: ${unknownIds}`)
		segmentNotes.push({
			type: NoteType.WARNING,
			message: `Dropping parts with unknown externalId: ${unknownIds}`,
			origin: {
				name: 'ingest',
				rundownId: rundownId,
				segmentId: segmentId,
			}
		})
	}

	const newSegment = literal<DBSegment>({
		...(existingSegment || {}),
		...blueprintRes.segment,
		_id: segmentId,
		rundownId: rundownId,
		externalId: ingestSegment.externalId,
		_rank: ingestSegment.rank,
		notes: segmentNotes,
	})

	const parts: DBPart[] = []
	const segmentPieces: Piece[] = []
	const adlibPieces: AdLibPiece[] = []

	// Parts
	for (let blueprintPart of knownParts) {
		const partId = getPartId(rundownId, blueprintPart.part.externalId)
		const sourcePart = ingestSegment.parts.find(p => p.externalId === blueprintPart.part.externalId) as IngestPart
		// TODO - this loop needs to handle virtual parts properly

		const notes = _.filter(allNotes, note => note.origin.partId === blueprintPart.part.externalId)
		_.each(notes, note => note.origin.partId = partId)

		const existingPart = _.find(existingParts, p => p._id === partId)
		const part = literal<DBPart>({
			..._.omit(existingPart || {}, 'invalid'),
			...blueprintPart.part,
			_id: partId,
			rundownId: rundownId,
			segmentId: newSegment._id,
			_rank: sourcePart.rank, // TODO - is this correct
			notes: notes,
		})
		parts.push(part)

		// Update pieces
		const pieces = postProcessPieces(context, blueprintPart.pieces, blueprintId, part._id)
		segmentPieces.push(...pieces)

		const adlibs = postProcessAdLibPieces(context, blueprintPart.adLibPieces, blueprintId, part._id)
		adlibPieces.push(...adlibs)
	}

	return {
		newSegment,
		parts,
		segmentPieces,
		adlibPieces
	}
}
