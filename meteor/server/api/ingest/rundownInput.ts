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
	asyncCollectionRemove,
	sumChanges,
	anythingChanged
} from '../../../lib/lib'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import { IngestRundown, IngestSegment, IngestPart, BlueprintResultSegment } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import { Studio } from '../../../lib/collections/Studios'
import { selectShowStyleVariant, afterRemoveSegment, afterRemovePart, ServerRundownAPI } from '../rundown'
import { loadShowStyleBlueprints, getBlueprintOfRundown } from '../blueprints/cache'
import { ShowStyleContext, RundownContext, SegmentContext } from '../blueprints/context'
import { Blueprints, Blueprint } from '../../../lib/collections/Blueprints'
import { RundownBaselineItem, RundownBaselineItems } from '../../../lib/collections/RundownBaselineItems'
import { Random } from 'meteor/random'
import { postProcessPartBaselineItems, postProcessAdLibPieces, postProcessPieces } from '../blueprints/postProcess'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { DBSegment, Segments } from '../../../lib/collections/Segments'
import { AdLibPiece, AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { saveRundownCache, saveSegmentCache, loadCachedIngestSegment, loadCachedRundownData } from './ingestCache'
import { getRundownId, getSegmentId, getPartId, getStudioFromDevice, getRundown, getStudioFromRundown, canBeUpdated } from './lib'
import { mutateRundown, mutateSegment, mutatePart } from './ingest'
const PackageInfo = require('../../../package.json')

export namespace RundownInput {
	// TODO - this all needs guards to avoid race conditions with stuff running in playout.ts (which should be removed from there)

	// Delete, Create & Update Rundown (and it's contents):
	export function dataRundownDelete (self: any, deviceId: string, deviceToken: string, rundownId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataRundownDelete', rundownId)
		check(rundownId, String)
		handleRemovedRundown(peripheralDevice, rundownId)
	}
	export function dataRundownCreate (self: any, deviceId: string, deviceToken: string, rundownId: string, rundownData: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataRundownCreate', rundownId, rundownData)
		check(rundownId, String)
		check(rundownData, Object)
		handleUpdatedRundown(peripheralDevice, rundownData, 'dataRundownCreate')
	}
	export function dataRundownUpdate (self: any, deviceId: string, deviceToken: string, rundownId: string, rundownData: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataRundownUpdate', rundownId, rundownData)
		check(rundownId, String)
		check(rundownData, Object)
		handleUpdatedRundown(peripheralDevice, rundownData, 'dataRundownUpdate')
	}
	// Delete, Create & Update Segment (and it's contents):
	export function dataSegmentDelete (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentDelete', rundownId, segmentId)
		check(rundownId, String)
		check(segmentId, String)
		handleRemovedSegment(peripheralDevice, rundownId, segmentId)
	}
	export function dataSegmentCreate (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string, newSection: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentCreate', rundownId, segmentId, newSection)
		check(rundownId, String)
		check(segmentId, String)
		check(newSection, Object)
		handleUpdatedSegment(peripheralDevice, rundownId, newSection)
	}
	export function dataSegmentUpdate (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string, newSection: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentUpdate', rundownId, segmentId, newSection)
		check(rundownId, String)
		check(segmentId, String)
		check(newSection, Object)
		handleUpdatedSegment(peripheralDevice, rundownId, newSection)
	}
	// Delete, Create & Update Part:
	export function dataPartDelete (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string, partId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataPartDelete', rundownId, segmentId, partId)
		check(rundownId, String)
		check(segmentId, String)
		check(partId, String)
		handleRemovedPart(peripheralDevice, rundownId, segmentId, partId)
	}
	export function dataPartCreate (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string, partId: string, newStory: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataPartCreate', rundownId, segmentId, partId, newStory)
		check(rundownId, String)
		check(segmentId, String)
		check(partId, String)
		check(newStory, Object)
		handleUpdatedPart(peripheralDevice, rundownId, segmentId, partId, newStory)
	}
	export function dataPartUpdate (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string, partId: string, newStory: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataPartUpdate', rundownId, segmentId, partId, newStory)
		check(rundownId, String)
		check(segmentId, String)
		check(partId, String)
		check(newStory, Object)
		handleUpdatedPart(peripheralDevice, rundownId, segmentId, partId, newStory)
	}
}

export function handleRemovedRundown (peripheralDevice: PeripheralDevice, rundownExternalId: string) {
	const { rundown } = getStudioAndRundown(peripheralDevice, rundownExternalId)
	if (rundown) {
		logger.info('Removing rundown ' + rundown._id)

		if (canBeUpdated(rundown)) {
			rundown.remove()
		} else {
			if (!rundown.unsynced) {
				ServerRundownAPI.unsyncRundown(rundown._id)
			}
		}
	}
}
export function handleUpdatedRundown (peripheralDevice: PeripheralDevice, rundownData: any, dataSource: string) {
	const studio = getStudioFromDevice(peripheralDevice)

	const ingestRundown: IngestRundown = mutateRundown(rundownData)
	const rundownId = getRundownId(studio, ingestRundown.externalId)

	const existingDbRundown = Rundowns.findOne(rundownId)
	if (!canBeUpdated(existingDbRundown)) return

	logger.info((existingDbRundown ? 'Updating' : 'Adding') + ' rundown ' + rundownId)

	saveRundownCache(rundownId, ingestRundown)

	updateRundownFromIngestData( studio, existingDbRundown, ingestRundown, dataSource, peripheralDevice)
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

	const showStyleBlueprint = loadShowStyleBlueprints(showStyle.base)
	const blueprintContext = new ShowStyleContext(studio, showStyle.base._id, showStyle.variant._id)
	const rundownRes = showStyleBlueprint.getRundown(blueprintContext, ingestRundown)

	const showStyleBlueprintDb = Blueprints.findOne(showStyle.base.blueprintId) as Blueprint || {}

	const dbRundownData: DBRundown = _.extend(existingDbRundown || {},
		_.omit(literal<DBRundown>({
			...rundownRes.rundown,
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
	logger.info(`Building baseline items for ${dbRundown._id}...`)
	logger.info(`... got ${rundownRes.baseline.length} items from baseline.`)

	const baselineItem: RundownBaselineItem = {
		_id: Random.id(7),
		rundownId: dbRundown._id,
		objects: postProcessPartBaselineItems(blueprintRundownContext, rundownRes.baseline)
	}
	// Save the global adlibs
	logger.info(`... got ${rundownRes.globalAdLibPieces.length} adLib items from baseline.`)
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

	const blueprint = getBlueprintOfRundown(dbRundown)

	_.each(ingestRundown.segments, (ingestSegment: IngestSegment) => {
		const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
		const existingSegment = _.find(existingSegments, s => s._id === segmentId)
		const existingParts = existingRundownParts.filter(p => p.segmentId === segmentId)

		const context = new SegmentContext(dbRundown, studio, existingParts)
		const res = blueprint.getSegment(context, ingestSegment)

		const segmentContents = generateSegmentContents(context, ingestSegment, existingSegment, existingParts, res)
		segments.push(segmentContents.newSegment)
		parts.push(...segmentContents.parts)
		segmentPieces.push(...segmentContents.segmentPieces)
		adlibPieces.push(...segmentContents.adlibPieces)
	})

	changes = sumChanges(
		changes,
		// Save the baseline
		saveIntoDb<RundownBaselineItem, RundownBaselineItem>(RundownBaselineItems, {
			rundownId: dbRundown._id,
		}, [baselineItem]),
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
				afterRemoveSegment(segment._id, segment.rundownId)
			}
		}),
		saveIntoDb<Part, DBPart>(Parts, {
			rundownId: rundownId,
		}, parts, {
			afterRemove (part) {
				afterRemovePart(part)
			}
		}),
		saveIntoDb<Piece, Piece>(Pieces, {
			rundownId: rundownId,
			dynamicallyInserted: { $ne: true } // do not affect dynamically inserted items (such as adLib items)
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
	return anythingChanged(changes)
}
/**
 * Run ingestData through blueprints and update the Rundown
 * @param rundownId
 * @returns true if data has changed
 */
export function reCreateRundown (rundownId: string): boolean {
	// Recreate rundown from cached data

	const rundown = getRundown(rundownId)
	const studio = getStudioFromRundown(rundown)

	const ingestRundown = loadCachedRundownData(rundownId)
	return updateRundownFromIngestData(studio, rundown, ingestRundown)
}

export function removeSegment (segmentId: string): Promise<any> {
	return Promise.all([
		asyncCollectionRemove(Parts, { segmentId: segmentId }),
		// TODO - cleanup other part contents
		asyncCollectionRemove(Segments, segmentId)
	])
}
function handleRemovedSegment (peripheralDevice: PeripheralDevice, rundownExternalId: string, segmentExternalId: string) {
	const { rundown } = getStudioAndRundown(peripheralDevice, rundownExternalId)
	const segmentId = getSegmentId(rundown._id, segmentExternalId)
	if (canBeUpdated(rundown, segmentId)) {
		removeSegment(segmentId)
	}
}
function handleUpdatedSegment (peripheralDevice: PeripheralDevice, rundownExternalId: string, segmentData: any) {
	const { studio, rundown } = getStudioAndRundown(peripheralDevice, rundownExternalId)

	const ingestSegment: IngestSegment = mutateSegment(segmentData)
	const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)

	if (!canBeUpdated(rundown, segmentId)) return

	saveSegmentCache(rundown._id, segmentId, ingestSegment)
	updateSegmentFromIngestData(studio, rundown, ingestSegment)
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
	const blueprint = getBlueprintOfRundown(rundown)

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

	const { parts, segmentPieces, adlibPieces, newSegment } = generateSegmentContents(context, ingestSegment, existingSegment, existingParts, res)

	Segments.upsert({
		_id: segmentId,
		rundownId: rundown._id
	}, newSegment)

	const changes = sumChanges(
		saveIntoDb<Part, DBPart>(Parts, {
			rundownId: rundown._id,
			segmentId: segmentId,
		}, parts, {
			afterRemove (part) {
				afterRemovePart(part)
			}
		}),
		saveIntoDb<Piece, Piece>(Pieces, {
			rundownId: rundown._id,
			partId: { $in: parts.map(p => p._id) },
			dynamicallyInserted: { $ne: true } // do not affect dynamically inserted items (such as adLib items)
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
	return anythingChanged(changes)

}
// /**
//  * Re-create segment from cached data.
//  * Returns true if data has changed
//  */
// export function reCreateSegment (rundownId: string, segmentId: string): boolean {
// 	// Recreate segment from cached data

// 	const rundown = getRundown(rundownId)
// 	const studio = getStudioFromRundown(rundown)

// 	const ingestSegment = loadCachedIngestSegment(rundownId, segmentId)
// 	return updateSegmentFromIngestData(studio, rundown, ingestSegment)
// }

export function handleRemovedPart (peripheralDevice: PeripheralDevice, rundownExternalId: string, segmentExternalId: string, partExternalId: string) {
	const { studio, rundown } = getStudioAndRundown(peripheralDevice, rundownExternalId)
	const segmentId = getSegmentId(rundown._id, segmentExternalId)
	const partId = getPartId(rundown._id, partExternalId)

	if (!canBeUpdated(rundown, segmentId, partId)) return

	const part = Parts.findOne({
		_id: partId,
		segmentId: segmentId,
		rundownId: rundown._id
	})
	if (!part) throw new Meteor.Error(404, 'Part not found')

	// Blueprints will handle the deletion of the SL
	const ingestSegment = loadCachedIngestSegment(rundown._id, segmentId)
	ingestSegment.parts = ingestSegment.parts.filter(p => p.externalId !== partExternalId)

	saveSegmentCache(rundown._id, segmentId, ingestSegment)
	updateSegmentFromIngestData(studio, rundown, ingestSegment)
}
export function handleUpdatedPart (peripheralDevice: PeripheralDevice, rundownExternalId: string, segmentExternalId: string, partExternalId: string, newStory: any) {
	const { studio, rundown } = getStudioAndRundown(peripheralDevice, rundownExternalId)

	const segmentId = getSegmentId(rundown._id, segmentExternalId)
	const partId = getPartId(rundown._id, partExternalId)

	if (!canBeUpdated(rundown, segmentId, partId)) return

	// Blueprints will handle the creation of the SL
	const ingestSegment: IngestSegment = loadCachedIngestSegment(rundown._id, segmentId)
	ingestSegment.parts = ingestSegment.parts.filter(p => p.externalId !== partExternalId)
	ingestSegment.parts.push(mutatePart(newStory))

	saveSegmentCache(rundown._id, segmentId, ingestSegment)
	updateSegmentFromIngestData(studio, rundown, ingestSegment)
}
export function reCreatePart (): boolean {
	// Recreate part from cached data
	// TODO: implement this, when needed :)
	return false
}

function getStudioAndRundown (peripheralDevice: PeripheralDevice, externalId: string) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundown = getRundown(getRundownId(studio, externalId))

	return {
		rundown,
		studio
	}
}

function generateSegmentContents (
	context: RundownContext,
	ingestSegment: IngestSegment,
	existingSegment: DBSegment | undefined,
	existingParts: DBPart[],
	blueprintRes: BlueprintResultSegment
) {

	const rundownId = context.rundownId
	const segmentId = getSegmentId(rundownId, ingestSegment.externalId)

	const newSegment = literal<DBSegment>({
		...(existingSegment || {}),
		...blueprintRes.segment,
		_id: segmentId,
		rundownId: rundownId,
		externalId: ingestSegment.externalId,
		_rank: ingestSegment.rank,
	})

	// Ensure all parts have a valid externalId set on them
	const expectedPartIds = ingestSegment.parts.map(p => p.externalId)
	const unknownParts = blueprintRes.parts.filter(p => expectedPartIds.indexOf(p.part.externalId) === -1)
	const knownParts = blueprintRes.parts.filter(p => expectedPartIds.indexOf(p.part.externalId) !== -1)

	if (unknownParts.length > 0) {
		const unknownIds = unknownParts.map(p => p.part.externalId).join(', ')
		logger.warn(`Dropping some parts with unknown externalId: ${unknownIds}`)
		// TODO - log for ui?
	}

	const parts: DBPart[] = []
	const segmentPieces: Piece[] = []
	const adlibPieces: AdLibPiece[] = []

	// Parts
	for (let blueprintPart of knownParts) {
		const partId = getPartId(rundownId, blueprintPart.part.externalId)
		const sourcePart = ingestSegment.parts.find(p => p.externalId === blueprintPart.part.externalId) as IngestPart
		// TODO - this loop needs to handle virtual parts properly

		const existingPart = _.find(existingParts, p => p._id === partId)
		const part = literal<DBPart>({
			// TODO - priorities of these are wrong?
			..._.omit(existingPart || {}, 'invalid'),
			...blueprintPart.part,
			_id: partId,
			rundownId: rundownId,
			segmentId: newSegment._id,
			_rank: sourcePart.rank
		})
		parts.push(part)

		// Update pieces
		const pieces = postProcessPieces(context, blueprintPart.pieces, '', part._id) // TODO - blueprint id?
		segmentPieces.push(...pieces)

		const adlibs = postProcessAdLibPieces(context, blueprintPart.adLibPieces, '', part._id) // TODO - blueprint id?
		adlibPieces.push(...adlibs)
	}

	return {
		newSegment,
		parts,
		segmentPieces,
		adlibPieces
	}
}
