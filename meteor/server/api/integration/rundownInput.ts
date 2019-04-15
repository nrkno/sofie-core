// Note: The interface defined in this file is intended to replace the mos-specific implementation in the end

import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import {
	PeripheralDevices,
	PeripheralDevice
} from '../../../lib/collections/PeripheralDevices'
import {
	Rundown,
	Rundowns,
	DBRundown
} from '../../../lib/collections/Rundowns'
import {
	SegmentLine,
	SegmentLines,
	DBSegmentLine
} from '../../../lib/collections/SegmentLines'
import {
	SegmentLineItem,
	SegmentLineItems
} from '../../../lib/collections/SegmentLineItems'
import {
	saveIntoDb,
	getCurrentTime,
	literal,
	getHash,
	asyncCollectionRemove
} from '../../../lib/lib'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import {
	Methods,
	setMeteorMethods
} from '../../methods'
import { IngestRundown, IngestSegment, IngestPart, BlueprintResultSegment } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { selectShowStyleVariant, afterRemoveSegment, afterRemoveSegmentLine } from '../rundown'
import { loadShowStyleBlueprints, getBlueprintOfRundown } from '../blueprints/cache'
import { ShowStyleContext, RundownContext, SegmentContext } from '../blueprints/context'
import { Blueprints, Blueprint } from '../../../lib/collections/Blueprints'
import { RundownBaselineItem, RundownBaselineItems } from '../../../lib/collections/RundownBaselineItems'
import { Random } from 'meteor/random'
import { postProcessSegmentLineBaselineItems, postProcessAdLibPieces, postProcessSegmentLineItems } from '../blueprints/postProcess'
import { RundownBaselineAdLibItem, RundownBaselineAdLibItems } from '../../../lib/collections/RundownBaselineAdLibItems'
import { DBSegment, Segments } from '../../../lib/collections/Segments'
import { AdLibPiece, AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { IngestDataCacheObj, IngestCacheType, IngestDataCache } from '../../../lib/collections/IngestDataCache'
import { updateSourceLayerInfinitesAfterLine } from '../playout'
const PackageInfo = require('../../../package.json')

/** These are temorary mutation functions as spreadsheet gateway does not use the ingest types yet */
function mutatePart (part: any): IngestPart {
	return {
		externalId: part.id,
		name: part.name,
		rank: part.rank,
		payload: part
	}
}

function mutateSegment (segment: any): IngestSegment {
	return {
		externalId: segment.id,
		name: segment.name,
		rank: segment.rank,
		payload: _.omit(segment, 'stories'),
		parts: _.values(segment.stories || {}).map(mutatePart)
	}
}

function mutateRundown (rundown: any): IngestRundown {
	return {
		externalId: rundown.id,
		name: rundown.name,
		type: 'external',
		payload: _.omit(rundown, 'sections'),
		segments: _.values(rundown.sections || {}).map(mutateSegment)
	}
}

function rundownId (studioInstallationId: string, externalId: string) {
	return getHash(`${studioInstallationId}_${externalId}`)
}
function getSegmentId (rundownId: string, segmentExternalId: string) {
	return getHash(`${rundownId}_segment_${segmentExternalId}`)
}
function getPartId (rundownId: string, partExternalId: string) {
	return getHash(`${rundownId}_part_${partExternalId}`)
}

function canBeUpdated (rundown: Rundown | undefined, segmentId?: string, partId?: string) {
	if (!rundown) return true
	if (rundown.unsynced) return false

	// TODO
	return true
}

function getStudioInstallationId (peripheralDevice: PeripheralDevice): string | undefined {
	if (peripheralDevice.studioInstallationId) {
		return peripheralDevice.studioInstallationId
	}
	if (peripheralDevice.parentDeviceId) {
		// Also check the parent device:
		const parentDevice = PeripheralDevices.findOne(peripheralDevice.parentDeviceId)
		if (parentDevice) {
			return parentDevice.studioInstallationId
		}
	}
	return undefined
}
function getStudioInstallation (peripheralDevice: PeripheralDevice): StudioInstallation {
	const studioInstallationId = getStudioInstallationId(peripheralDevice)
	if (!studioInstallationId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no StudioInstallation')

	const studioInstallation = StudioInstallations.findOne(studioInstallationId)
	if (!studioInstallation) throw new Meteor.Error(404, 'StudioInstallation "' + studioInstallationId + '" not found')
	return studioInstallation
}

function handleRundownData (peripheralDevice: PeripheralDevice, ingestRundown: IngestRundown, dataSource: string) {
	const studioInstallation = getStudioInstallation(peripheralDevice)

	const rundownId = rundownId(studioInstallation._id, ingestRundown.externalId)
	const existingDbRundown = Rundowns.findOne(rundownId)
	if (!canBeUpdated(existingDbRundown)) return

	logger.info((existingDbRundown ? 'Updating' : 'Adding') + ' rundown ' + rundownId)

	const showStyle = selectShowStyleVariant(studioInstallation, ingestRundown)
	if (!showStyle) {
		logger.warn('Studio blueprint rejected rundown')
		return
	}

	const showStyleBlueprint = loadShowStyleBlueprints(showStyle.base)
	const blueprintContext = new ShowStyleContext(studioInstallation, showStyle.base._id, showStyle.variant._id)
	const rundownRes = showStyleBlueprint.getRundown(blueprintContext, ingestRundown)

	const showStyleBlueprintDb = Blueprints.findOne(showStyle.base.blueprintId) as Blueprint || {}

	const dbROData: DBRundown = _.extend(existingDbRundown || {},
		_.omit(literal<DBRundown>({
			...rundownRes.rundown,
			_id: rundownId,
			externalId: ingestRundown.externalId,
			studioInstallationId: studioInstallation._id,
			peripheralDeviceId: peripheralDevice._id,
			showStyleVariantId: showStyle.variant._id,
			showStyleBaseId: showStyle.base._id,
			dataSource: dataSource,
			unsynced: false,

			importVersions: {
				studioInstallation: studioInstallation._rundownVersionHash,
				showStyleBase: showStyle.base._rundownVersionHash,
				showStyleVariant: showStyle.variant._rundownVersionHash,
				blueprint: showStyleBlueprintDb.blueprintVersion,
				core: PackageInfo.version,
			},

			// omit the below fields
			previousSegmentLineId: null,
			currentSegmentLineId: null,
			nextSegmentLineId: null,
			created: 0,
			modified: 0,
		}), ['previousSegmentLineId', 'currentSegmentLineId', 'nextSegmentLineId', 'created', 'modified'])
	)

	// Save rundown into database:
	saveIntoDb(Rundowns, {
		_id: dbROData._id
	}, [dbROData], {
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

	const dbRundown = Rundowns.findOne(dbROData._id)
	if (!dbRundown) throw new Meteor.Error(500, 'Rundown not found (it should have been)')
	// cache the Data
	const cacheEntries: IngestDataCacheObj[] = []
	cacheEntries.push({
		_id: dbRundown._id,
		type: IngestCacheType.RUNDOWN,
		rundownId: dbRundown._id,
		modified: getCurrentTime(),
		data: {
			...ingestRundown,
			segments: []
		}
	})
	_.each(ingestRundown.segments, s => cacheEntries.push(...generateCacheForSegment(dbRundown._id, s)))
	saveIntoDb<IngestDataCacheObj, IngestDataCacheObj>(IngestDataCache, {
		rundownId: dbRundown._id,
	}, cacheEntries)

	// Save the baseline
	const blueprintRundownContext = new RundownContext(dbRundown, studioInstallation)
	logger.info(`Building baseline items for ${dbRundown._id}...`)
	logger.info(`... got ${rundownRes.baseline.length} items from baseline.`)

	const baselineItem: RundownBaselineItem = {
		_id: Random.id(7),
		rundownId: dbRundown._id,
		objects: postProcessSegmentLineBaselineItems(blueprintRundownContext, rundownRes.baseline)
	}

	saveIntoDb<RundownBaselineItem, RundownBaselineItem>(RundownBaselineItems, {
		rundownId: dbRundown._id,
	}, [baselineItem])

	// Save the global adlibs
	logger.info(`... got ${rundownRes.globalAdLibPieces.length} adLib items from baseline.`)
	const adlibItems = postProcessAdLibPieces(blueprintRundownContext, rundownRes.globalAdLibPieces, 'baseline')
	saveIntoDb<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(RundownBaselineAdLibItems, {
		rundownId: dbRundown._id
	}, adlibItems)

	const existingRundownParts = SegmentLines.find({
		rundownId: rundownId,
		dynamicallyInserted: false
	}).fetch()

	const existingSegments = Segments.find({ rundown: dbRundown._id }).fetch()
	const segments: DBSegment[] = []
	const segmentLines: DBSegmentLine[] = []
	const segmentPieces: SegmentLineItem[] = []
	const adlibPieces: AdLibPiece[] = []

	const blueprint = getBlueprintOfRundown(dbRundown)

	_.each(ingestRundown.segments, (ingestSegment: IngestSegment) => {
		const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
		const existingSegment = _.find(existingSegments, s => s._id === segmentId)
		const existingParts = existingRundownParts.filter(p => p.segmentId === segmentId)

		const context = new SegmentContext(dbRundown, studioInstallation, existingParts)
		const res = blueprint.getSegment(context, ingestSegment)

		const res2 = generateSegmentContents(context, ingestSegment, existingSegment, existingParts, res)
		segments.push(res2.newSegment)
		segmentLines.push(...res2.segmentLines)
		segmentPieces.push(...res2.segmentPieces)
		adlibPieces.push(...res2.adlibPieces)
	})

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
	})
	saveIntoDb<SegmentLine, DBSegmentLine>(SegmentLines, {
		rundownId: rundownId,
	}, segmentLines, {
		afterRemove (segmentLine) {
			afterRemoveSegmentLine(segmentLine)
		}
	})

	saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
		rundownId: rundownId,
		dynamicallyInserted: { $ne: true } // do not affect dynamically inserted items (such as adLib items)
	}, segmentPieces, {
		afterInsert (segmentLineItem) {
			logger.debug('inserted segmentLineItem ' + segmentLineItem._id)
			logger.debug(segmentLineItem)
		},
		afterUpdate (segmentLineItem) {
			logger.debug('updated segmentLineItem ' + segmentLineItem._id)
		},
		afterRemove (segmentLineItem) {
			logger.debug('deleted segmentLineItem ' + segmentLineItem._id)
		}
	})

	saveIntoDb<AdLibPiece, AdLibPiece>(AdLibPieces, {
		rundownId: rundownId,
	}, adlibPieces, {
		afterInsert (adLibPiece) {
			logger.debug('inserted adLibPiece ' + adLibPiece._id)
			logger.debug(adLibPiece)
		},
		afterUpdate (adLibPiece) {
			logger.debug('updated segmentLineItem ' + adLibPiece._id)
		},
		afterRemove (adLibPiece) {
			logger.debug('deleted segmentLineItem ' + adLibPiece._id)
		}
	})
}

function generateCacheForSegment (rundownId: string, ingestSegment: IngestSegment): IngestDataCacheObj[] {
	const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
	const cacheEntries: IngestDataCacheObj[] = []
	cacheEntries.push({
		_id: `${rundownId}_${segmentId}`,
		type: IngestCacheType.SEGMENT,
		rundownId: rundownId,
		segmentId: segmentId,
		modified: getCurrentTime(),
		data: {
			...ingestSegment,
			parts: []
		}
	})

	_.each(ingestSegment.parts, p => {
		const partId = getPartId(rundownId, p.externalId)
		cacheEntries.push({
			_id: `${rundownId}_${partId}`,
			type: IngestCacheType.PART,
			rundownId: rundownId,
			segmentId: segmentId,
			partId: partId,
			modified: getCurrentTime(),
			data: p
		})
	})

	return cacheEntries
}

function generateSegmentContents (
	context: RundownContext,
	ingestSegment: IngestSegment,
	existingSegment: DBSegment | undefined,
	existingParts: DBSegmentLine[],
	blueprintRes: BlueprintResultSegment) {

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

	const segmentLines: DBSegmentLine[] = []
	const segmentPieces: SegmentLineItem[] = []
	const adlibPieces: AdLibPiece[] = []

	// SegmentLines
	for (let blueprintPart of knownParts) {
		const partId = getPartId(rundownId, blueprintPart.part.externalId)
		const sourcePart = ingestSegment.parts.find(p => p.externalId === blueprintPart.part.externalId) as IngestPart
		// TODO - this loop needs to handle virtual parts properly

		const existingPart = _.find(existingParts, p => p._id === partId)
		const part = literal<DBSegmentLine>({
			// TODO - priorities of these are wrong?
			...(existingPart || {}),
			...blueprintPart.part,
			_id: partId,
			rundownId: rundownId,
			segmentId: newSegment._id,
			_rank: sourcePart.rank
		})
		segmentLines.push(part)

		// Update pieces
		const pieces = postProcessSegmentLineItems(context, blueprintPart.pieces, '', part._id) // TODO - blueprint id?
		segmentPieces.push(...pieces)

		const adlibs = postProcessAdLibPieces(context, blueprintPart.adLibPieces, '', part._id) // TODO - blueprint id?
		adlibPieces.push(...adlibs)
	}

	return {
		newSegment,
		segmentLines,
		segmentPieces,
		adlibPieces
	}
}

function updateOrCreateSegmentFromPayload (studioInstallation: StudioInstallation, rundown: Rundown, ingestSegment: IngestSegment) {
	const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)

	// cache the Data
	const cacheEntries: IngestDataCacheObj[] = generateCacheForSegment(rundown._id, ingestSegment)
	saveIntoDb<IngestDataCacheObj, IngestDataCacheObj>(IngestDataCache, {
		rundownId: rundown._id,
		segmentId: segmentId,
	}, cacheEntries)

	const blueprint = getBlueprintOfRundown(rundown)

	const existingSegment = Segments.findOne({
		_id: segmentId,
		rundownId: rundown._id,
	})
	const existingParts = SegmentLines.find({
		rundownId: rundown._id,
		segmentId: segmentId
	}).fetch()

	const context = new SegmentContext(rundown, studioInstallation, existingParts)
	const res = blueprint.getSegment(context, ingestSegment)

	const { segmentLines, segmentPieces, adlibPieces, newSegment } = generateSegmentContents(context, ingestSegment, existingSegment, existingParts, res)

	Segments.upsert({
		_id: segmentId,
		rundownId: rundown._id
	}, newSegment)

	saveIntoDb<SegmentLine, DBSegmentLine>(SegmentLines, {
		rundownId: rundown._id,
		segmentId: segmentId,
	}, segmentLines, {
		afterRemove (segmentLine) {
			afterRemoveSegmentLine(segmentLine)
		}
	})

	const changedSli = saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
		rundownId: rundown._id,
		segmentLineId: { $in: segmentLines.map(p => p._id) },
		dynamicallyInserted: { $ne: true } // do not affect dynamically inserted items (such as adLib items)
	}, segmentPieces, {
		afterInsert (segmentLineItem) {
			logger.debug('inserted segmentLineItem ' + segmentLineItem._id)
			logger.debug(segmentLineItem)
		},
		afterUpdate (segmentLineItem) {
			logger.debug('updated segmentLineItem ' + segmentLineItem._id)
		},
		afterRemove (segmentLineItem) {
			logger.debug('deleted segmentLineItem ' + segmentLineItem._id)
		}
	})

	saveIntoDb<AdLibPiece, AdLibPiece>(AdLibPieces, {
		rundownId: rundown._id,
		segmentLineId: { $in: segmentLines.map(p => p._id) },
	}, adlibPieces, {
		afterInsert (adLibPiece) {
			logger.debug('inserted adLibPiece ' + adLibPiece._id)
			logger.debug(adLibPiece)
		},
		afterUpdate (adLibPiece) {
			logger.debug('updated segmentLineItem ' + adLibPiece._id)
		},
		afterRemove (adLibPiece) {
			logger.debug('deleted segmentLineItem ' + adLibPiece._id)
		}
	})

}

function loadCachedRundownData (rundownId: string): IngestRundown {
	const cacheEntries = IngestDataCache.find({ rundownId: rundownId }).fetch()

	const baseEntry = cacheEntries.find(e => e.type === IngestCacheType.RUNDOWN)
	if (!baseEntry) throw new Meteor.Error(500, 'Failed to find cached rundown')

	const ingestRundown = baseEntry.data as IngestRundown

	const segmentMap = _.groupBy(cacheEntries, e => e.segmentId)
	_.each(segmentMap, objs => {
		const segmentEntry = objs.find(e => e.type === IngestCacheType.SEGMENT)
		if (segmentEntry) {
			const ingestSegment = segmentEntry.data as IngestSegment
			_.each(objs, e => {
				if (e.type === IngestCacheType.PART) {
					ingestSegment.parts.push(e.data)
				}
			})
			ingestRundown.segments.push(ingestSegment)
		}
	})

	return ingestRundown
}

function loadCachedSegmentData (rundownId: string, segmentId: string): IngestSegment {
	const cacheEntries = IngestDataCache.find({
		rundownId: rundownId,
		segmentId: segmentId,
	}).fetch()

	const segmentEntry = cacheEntries.find(e => e.type === IngestCacheType.SEGMENT)
	if (!segmentEntry) throw new Meteor.Error(500, 'Failed to find cached segment')

	const ingestSegment = segmentEntry.data as IngestSegment

	_.each(cacheEntries, e => {
		if (e.type === IngestCacheType.PART) {
			ingestSegment.parts.push(e.data)
		}
	})

	return ingestSegment
}

function getStudioInstallationAndRO (peripheralDevice: PeripheralDevice, externalId: string) {
	const studioInstallation = getStudioInstallation(peripheralDevice)
	const rundown = Rundowns.findOne(rundownId(studioInstallation._id, externalId))
	if (!rundown) throw new Meteor.Error(404, 'Rundown not found')

	return {
		rundown,
		studioInstallation
	}
}

function updateDeviceLastDataReceived (deviceId: string) {
	PeripheralDevices.update(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime()
		}
	})
}

export namespace RundownInput {
	// TODO - this all needs guards to avoid race conditions with stuff running in playout.ts (which should be removed from there)

	export function dataRundownDelete (self: any, deviceId: string, deviceToken: string, rundownId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataRundownDelete', rundownId)

		check(rundownId, String)

		updateDeviceLastDataReceived(deviceId)

		const { rundown } = getStudioInstallationAndRO(peripheralDevice, rundownId)
		if (canBeUpdated(rundown) && rundown) {
			rundown.remove()
		}
	}
	export function dataRundownCreate (self: any, deviceId: string, deviceToken: string, rundownId: string, rundownData: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataRundownCreate', rundownId, rundownData)

		check(rundownId, String)
		check(rundownData, Object)

		updateDeviceLastDataReceived(deviceId)

		handleRundownData(peripheralDevice, mutateRundown(rundownData), 'dataRundownCreate')
	}
	export function dataRundownUpdate (self: any, deviceId: string, deviceToken: string, rundownId: string, rundownData: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataRundownUpdate', rundownId, rundownData)

		check(rundownId, String)
		check(rundownData, Object)

		updateDeviceLastDataReceived(deviceId)

		handleRundownData(peripheralDevice, mutateRundown(rundownData), 'dataRundownUpdate')
	}

	export function dataSegmentDelete (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentDelete', rundownId, segmentId)

		check(rundownId, String)
		check(segmentId, String)

		updateDeviceLastDataReceived(deviceId)

		const { rundown } = getStudioInstallationAndRO(peripheralDevice, rundownId)
		const segmentInternalId = getSegmentId(rundown._id, segmentId)

		if (canBeUpdated(rundown, segmentInternalId)) {
			Promise.all([
				asyncCollectionRemove(SegmentLines, { segmentId: segmentInternalId }),
				// TODO - cleanup other SL contents
				asyncCollectionRemove(Segments, segmentInternalId)
			])
		}
	}
	export function dataSegmentCreate (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string, newSection: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentCreate', rundownId, segmentId, newSection)

		check(rundownId, String)
		check(segmentId, String)
		check(newSection, Object)

		updateDeviceLastDataReceived(deviceId)

		const { studioInstallation, rundown } = getStudioInstallationAndRO(peripheralDevice, rundownId)
		const segmentInternalId = getSegmentId(rundown._id, segmentId)

		if (canBeUpdated(rundown, segmentInternalId)) {
			updateOrCreateSegmentFromPayload(studioInstallation, rundown, mutateSegment(newSection))
		}
	}
	export function dataSegmentUpdate (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string, newSection: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentUpdate', rundownId, segmentId, newSection)

		check(rundownId, String)
		check(segmentId, String)
		check(newSection, Object)

		updateDeviceLastDataReceived(deviceId)

		const { studioInstallation, rundown } = getStudioInstallationAndRO(peripheralDevice, rundownId)
		const segmentInternalId = getSegmentId(rundown._id, segmentId)

		if (canBeUpdated(rundown, segmentInternalId)) {
			updateOrCreateSegmentFromPayload(studioInstallation, rundown, mutateSegment(newSection))
		}
	}

	export function dataSegmentLineDelete (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string, segmentLineId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentLineDelete', rundownId, segmentId, segmentLineId)

		check(rundownId, String)
		check(segmentId, String)
		check(segmentLineId, String)

		updateDeviceLastDataReceived(deviceId)

		const { studioInstallation, rundown } = getStudioInstallationAndRO(peripheralDevice, rundownId)
		const segmentInternalId = getSegmentId(rundown._id, segmentId)
		const partInternalId = getPartId(rundown._id, segmentLineId)

		if (canBeUpdated(rundown, segmentInternalId, partInternalId)) {
			const segmentLine = SegmentLines.findOne({
				_id: partInternalId,
				segmentId: segmentInternalId,
				rundownId: rundown._id
			})
			if (!segmentLine) throw new Meteor.Error(404, 'Part not found')

			// Blueprints will handle the deletion of the SL
			const ingestSegment = loadCachedSegmentData(rundown._id, segmentInternalId)
			ingestSegment.parts = ingestSegment.parts.filter(p => p.externalId !== segmentLineId)

			updateOrCreateSegmentFromPayload(studioInstallation, rundown, ingestSegment)
		}
	}

	function dataSegmentLineCreateOrUpdate (peripheralDevice: PeripheralDevice, rundownId: string, segmentId: string, segmentLineId: string, newStory: any) {
		const { studioInstallation, rundown } = getStudioInstallationAndRO(peripheralDevice, rundownId)

		const segmentInternalId = getSegmentId(rundown._id, segmentId)
		const partInternalId = getPartId(rundown._id, segmentLineId)

		if (canBeUpdated(rundown, segmentInternalId, partInternalId)) {
			// Blueprints will handle the creation of the SL
			const ingestSegment = loadCachedSegmentData(rundown._id, segmentInternalId)
			ingestSegment.parts = ingestSegment.parts.filter(p => p.externalId !== segmentLineId)
			ingestSegment.parts.push(mutatePart(newStory))

			updateOrCreateSegmentFromPayload(studioInstallation, rundown, ingestSegment)
		}
	}
	export function dataSegmentLineCreate (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string, segmentLineId: string, newStory: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentLineCreate', rundownId, segmentId, segmentLineId, newStory)

		check(rundownId, String)
		check(segmentId, String)
		check(segmentLineId, String)
		check(newStory, Object)

		updateDeviceLastDataReceived(deviceId)

		dataSegmentLineCreateOrUpdate(peripheralDevice, rundownId, segmentId, segmentLineId, newStory)
	}
	export function dataSegmentLineUpdate (self: any, deviceId: string, deviceToken: string, rundownId: string, segmentId: string, segmentLineId: string, newStory: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentLineUpdate', rundownId, segmentId, segmentLineId, newStory)

		check(rundownId, String)
		check(segmentId, String)
		check(segmentLineId, String)
		check(newStory, Object)

		updateDeviceLastDataReceived(deviceId)

		dataSegmentLineCreateOrUpdate(peripheralDevice, rundownId, segmentId, segmentLineId, newStory)
	}
}

let methods: Methods = {
	'debug_rundownRunBlueprints' (rundownId: string, deleteFirst?: boolean) {
		check(rundownId, String)

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, 'Rundown not found')

		const ingestRundown = loadCachedRundownData(rundownId)

		if (deleteFirst) rundown.remove()

		const peripheralDevice = PeripheralDevices.findOne(rundown.peripheralDeviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, 'MOS Device not found to be used for mock rundown!')

		handleRundownData(peripheralDevice, ingestRundown, rundown.dataSource)

		logger.info('debug_rundownRunBlueprints: infinites')
		updateSourceLayerInfinitesAfterLine(rundown)

		logger.info('debug_rundownRunBlueprints: done')
	}
}

methods[PeripheralDeviceAPI.methods.dataRundownDelete] = (deviceId: string, deviceToken: string, rundownId: string) => {
	return RundownInput.dataRundownDelete(this, deviceId, deviceToken, rundownId)
}
methods[PeripheralDeviceAPI.methods.dataRundownCreate] = (deviceId: string, deviceToken: string, rundownId: string, rundownData: any) => {
	return RundownInput.dataRundownCreate(this, deviceId, deviceToken, rundownId, rundownData)
}
methods[PeripheralDeviceAPI.methods.dataRundownUpdate] = (deviceId: string, deviceToken: string, rundownId: string, rundownData: any) => {
	return RundownInput.dataRundownUpdate(this, deviceId, deviceToken, rundownId, rundownData)
}
methods[PeripheralDeviceAPI.methods.dataSegmentDelete] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string) => {
	return RundownInput.dataSegmentDelete(this, deviceId, deviceToken, rundownId, segmentId)
}
methods[PeripheralDeviceAPI.methods.dataSegmentCreate] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, newSection: any) => {
	return RundownInput.dataSegmentCreate(this, deviceId, deviceToken, rundownId, segmentId, newSection)
}
methods[PeripheralDeviceAPI.methods.dataSegmentUpdate] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, newSection: any) => {
	return RundownInput.dataSegmentUpdate(this, deviceId, deviceToken, rundownId, segmentId, newSection)
}
// TODO - these need renaming
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemDelete] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, segmentLineId: string) => {
	return RundownInput.dataSegmentLineDelete(this, deviceId, deviceToken, rundownId, segmentId, segmentLineId)
}
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemCreate] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, segmentLineId: string, newStory: any) => {
	return RundownInput.dataSegmentLineCreate(this, deviceId, deviceToken, rundownId, segmentId, segmentLineId, newStory)
}
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemUpdate] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, segmentLineId: string, newStory: any) => {
	return RundownInput.dataSegmentLineUpdate(this, deviceId, deviceToken, rundownId, segmentId, segmentLineId, newStory)
}

setMeteorMethods(methods)
