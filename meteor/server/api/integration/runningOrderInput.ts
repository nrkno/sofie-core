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
	RunningOrder,
	RunningOrders,
	DBRunningOrder
} from '../../../lib/collections/RunningOrders'
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
	Methods, setMeteorMethods, wrapMethods
} from '../../methods'
import { IngestRunningOrder, IngestSegment, IngestPart, BlueprintResultSegment } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { selectShowStyleVariant, afterRemoveSegment, afterRemoveSegmentLine } from '../runningOrder'
import { loadShowStyleBlueprints, getBlueprintOfRunningOrder } from '../blueprints/cache'
import { ShowStyleContext, RunningOrderContext, SegmentContext } from '../blueprints/context'
import { Blueprints, Blueprint } from '../../../lib/collections/Blueprints'
import { RunningOrderBaselineItem, RunningOrderBaselineItems } from '../../../lib/collections/RunningOrderBaselineItems'
import { Random } from 'meteor/random'
import { postProcessSegmentLineBaselineItems, postProcessSegmentLineAdLibItems, postProcessSegmentLineItems } from '../blueprints/postProcess'
import { RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItems } from '../../../lib/collections/RunningOrderBaselineAdLibItems'
import { DBSegment, Segments } from '../../../lib/collections/Segments'
import { SegmentLineAdLibItem, SegmentLineAdLibItems } from '../../../lib/collections/SegmentLineAdLibItems'
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

function mutateRunningOrder (runningOrder: any): IngestRunningOrder {
	return {
		externalId: runningOrder.id,
		name: runningOrder.name,
		type: 'external',
		payload: _.omit(runningOrder, 'sections'),
		segments: _.values(runningOrder.sections || {}).map(mutateSegment)
	}
}

function roId (studioInstallationId: string, externalId: string) {
	return getHash(`${studioInstallationId}_${externalId}`)
}
function getSegmentId (runningOrderId: string, segmentExternalId: string) {
	return getHash(`${runningOrderId}_segment_${segmentExternalId}`)
}
function getPartId (runningOrderId: string, partExternalId: string) {
	return getHash(`${runningOrderId}_part_${partExternalId}`)
}

function canBeUpdated (runningOrder: RunningOrder | undefined, segmentId?: string, partId?: string) {
	if (!runningOrder) return true
	if (runningOrder.unsynced) return false

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

function handleRunningOrderData (peripheralDevice: PeripheralDevice, ingestRunningOrder: IngestRunningOrder, dataSource: string) {
	const studioInstallation = getStudioInstallation(peripheralDevice)

	const runningOrderId = roId(studioInstallation._id, ingestRunningOrder.externalId)
	const existingDbRo = RunningOrders.findOne(runningOrderId)
	if (!canBeUpdated(existingDbRo)) return

	logger.info((existingDbRo ? 'Updating' : 'Adding') + ' RO ' + runningOrderId)

	const showStyle = selectShowStyleVariant(studioInstallation, ingestRunningOrder)
	if (!showStyle) {
		logger.warn('Studio blueprint rejected RO')
		return
	}

	const showStyleBlueprint = loadShowStyleBlueprints(showStyle.base)
	const blueprintContext = new ShowStyleContext(studioInstallation, showStyle.base._id, showStyle.variant._id)
	const roRes = showStyleBlueprint.getRunningOrder(blueprintContext, ingestRunningOrder)

	const showStyleBlueprintDb = Blueprints.findOne(showStyle.base.blueprintId) as Blueprint || {}

	const dbROData: DBRunningOrder = _.extend(existingDbRo || {},
		_.omit(literal<DBRunningOrder>({
			...roRes.runningOrder,
			_id: runningOrderId,
			externalId: ingestRunningOrder.externalId,
			studioInstallationId: studioInstallation._id,
			peripheralDeviceId: peripheralDevice._id,
			showStyleVariantId: showStyle.variant._id,
			showStyleBaseId: showStyle.base._id,
			dataSource: dataSource,
			unsynced: false,

			importVersions: {
				studioInstallation: studioInstallation._runningOrderVersionHash,
				showStyleBase: showStyle.base._runningOrderVersionHash,
				showStyleVariant: showStyle.variant._runningOrderVersionHash,
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

	// Save RO into database:
	saveIntoDb(RunningOrders, {
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

	const dbRo = RunningOrders.findOne(dbROData._id)
	if (!dbRo) throw new Meteor.Error(500, 'Running order not found (it should have been)')
	// cache the Data
	const cacheEntries: IngestDataCacheObj[] = []
	cacheEntries.push({
		_id: dbRo._id,
		type: IngestCacheType.RUNNINGORDER,
		runningOrderId: dbRo._id,
		modified: getCurrentTime(),
		data: {
			...ingestRunningOrder,
			segments: []
		}
	})
	_.each(ingestRunningOrder.segments, s => cacheEntries.push(...generateCacheForSegment(dbRo._id, s)))
	saveIntoDb<IngestDataCacheObj, IngestDataCacheObj>(IngestDataCache, {
		runningOrderId: dbRo._id,
	}, cacheEntries)

	// Save the baseline
	const blueprintRoContext = new RunningOrderContext(dbRo, studioInstallation)
	logger.info(`Building baseline items for ${dbRo._id}...`)
	logger.info(`... got ${roRes.baseline.length} items from baseline.`)

	const baselineItem: RunningOrderBaselineItem = {
		_id: Random.id(7),
		runningOrderId: dbRo._id,
		objects: postProcessSegmentLineBaselineItems(blueprintRoContext, roRes.baseline)
	}

	saveIntoDb<RunningOrderBaselineItem, RunningOrderBaselineItem>(RunningOrderBaselineItems, {
		runningOrderId: dbRo._id,
	}, [baselineItem])

	// Save the global adlibs
	logger.info(`... got ${roRes.globalAdLibPieces.length} adLib items from baseline.`)
	const adlibItems = postProcessSegmentLineAdLibItems(blueprintRoContext, roRes.globalAdLibPieces, 'baseline')
	saveIntoDb<RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItem>(RunningOrderBaselineAdLibItems, {
		runningOrderId: dbRo._id
	}, adlibItems)

	const existingRoParts = SegmentLines.find({
		runningOrderId: runningOrderId,
		dynamicallyInserted: false
	}).fetch()

	const existingSegments = Segments.find({ runningOrder: dbRo._id }).fetch()
	const segments: DBSegment[] = []
	const segmentLines: DBSegmentLine[] = []
	const segmentPieces: SegmentLineItem[] = []
	const adlibPieces: SegmentLineAdLibItem[] = []

	const blueprint = getBlueprintOfRunningOrder(dbRo)

	_.each(ingestRunningOrder.segments, (ingestSegment: IngestSegment) => {
		const segmentId = getSegmentId(runningOrderId, ingestSegment.externalId)
		const existingSegment = _.find(existingSegments, s => s._id === segmentId)
		const existingParts = existingRoParts.filter(p => p.segmentId === segmentId)

		const context = new SegmentContext(dbRo, studioInstallation, existingParts)
		const res = blueprint.getSegment(context, ingestSegment)

		const res2 = generateSegmentContents(context, ingestSegment, existingSegment, existingParts, res)
		segments.push(res2.newSegment)
		segmentLines.push(...res2.segmentLines)
		segmentPieces.push(...res2.segmentPieces)
		adlibPieces.push(...res2.adlibPieces)
	})

	// Update Segments:
	saveIntoDb(Segments, {
		runningOrderId: runningOrderId
	}, segments, {
		afterInsert (segment) {
			logger.info('inserted segment ' + segment._id)
		},
		afterUpdate (segment) {
			logger.info('updated segment ' + segment._id)
		},
		afterRemove (segment) {
			logger.info('removed segment ' + segment._id)
			afterRemoveSegment(segment._id, segment.runningOrderId)
		}
	})
	saveIntoDb<SegmentLine, DBSegmentLine>(SegmentLines, {
		runningOrderId: runningOrderId,
	}, segmentLines, {
		afterRemove (segmentLine) {
			afterRemoveSegmentLine(segmentLine)
		}
	})

	saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
		runningOrderId: runningOrderId,
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

	saveIntoDb<SegmentLineAdLibItem, SegmentLineAdLibItem>(SegmentLineAdLibItems, {
		runningOrderId: runningOrderId,
	}, adlibPieces, {
		afterInsert (segmentLineAdLibItem) {
			logger.debug('inserted segmentLineAdLibItem ' + segmentLineAdLibItem._id)
			logger.debug(segmentLineAdLibItem)
		},
		afterUpdate (segmentLineAdLibItem) {
			logger.debug('updated segmentLineItem ' + segmentLineAdLibItem._id)
		},
		afterRemove (segmentLineAdLibItem) {
			logger.debug('deleted segmentLineItem ' + segmentLineAdLibItem._id)
		}
	})
}

function generateCacheForSegment (runningOrderId: string, ingestSegment: IngestSegment): IngestDataCacheObj[] {
	const segmentId = getSegmentId(runningOrderId, ingestSegment.externalId)
	const cacheEntries: IngestDataCacheObj[] = []
	cacheEntries.push({
		_id: `${runningOrderId}_${segmentId}`,
		type: IngestCacheType.SEGMENT,
		runningOrderId: runningOrderId,
		segmentId: segmentId,
		modified: getCurrentTime(),
		data: {
			...ingestSegment,
			parts: []
		}
	})

	_.each(ingestSegment.parts, p => {
		const partId = getPartId(runningOrderId, p.externalId)
		cacheEntries.push({
			_id: `${runningOrderId}_${partId}`,
			type: IngestCacheType.PART,
			runningOrderId: runningOrderId,
			segmentId: segmentId,
			partId: partId,
			modified: getCurrentTime(),
			data: p
		})
	})

	return cacheEntries
}

function generateSegmentContents (
	context: RunningOrderContext,
	ingestSegment: IngestSegment,
	existingSegment: DBSegment | undefined,
	existingParts: DBSegmentLine[],
	blueprintRes: BlueprintResultSegment) {

	const runningOrderId = context.runningOrderId
	const segmentId = getSegmentId(runningOrderId, ingestSegment.externalId)

	const newSegment = literal<DBSegment>({
		...(existingSegment || {}),
		...blueprintRes.segment,
		_id: segmentId,
		runningOrderId: runningOrderId,
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
	const adlibPieces: SegmentLineAdLibItem[] = []

	// SegmentLines
	for (let blueprintPart of knownParts) {
		const partId = getPartId(runningOrderId, blueprintPart.part.externalId)
		const sourcePart = ingestSegment.parts.find(p => p.externalId === blueprintPart.part.externalId) as IngestPart
		// TODO - this loop needs to handle virtual parts properly

		const existingPart = _.find(existingParts, p => p._id === partId)
		const part = literal<DBSegmentLine>({
			// TODO - priorities of these are wrong?
			...(existingPart || {}),
			...blueprintPart.part,
			_id: partId,
			runningOrderId: runningOrderId,
			segmentId: newSegment._id,
			_rank: sourcePart.rank
		})
		segmentLines.push(part)

		// Update pieces
		const pieces = postProcessSegmentLineItems(context, blueprintPart.pieces, '', part._id) // TODO - blueprint id?
		segmentPieces.push(...pieces)

		const adlibs = postProcessSegmentLineAdLibItems(context, blueprintPart.adLibPieces, '', part._id) // TODO - blueprint id?
		adlibPieces.push(...adlibs)
	}

	return {
		newSegment,
		segmentLines,
		segmentPieces,
		adlibPieces
	}
}

function updateOrCreateSegmentFromPayload (studioInstallation: StudioInstallation, runningOrder: RunningOrder, ingestSegment: IngestSegment) {
	const segmentId = getSegmentId(runningOrder._id, ingestSegment.externalId)

	// cache the Data
	const cacheEntries: IngestDataCacheObj[] = generateCacheForSegment(runningOrder._id, ingestSegment)
	saveIntoDb<IngestDataCacheObj, IngestDataCacheObj>(IngestDataCache, {
		runningOrderId: runningOrder._id,
		segmentId: segmentId,
	}, cacheEntries)

	const blueprint = getBlueprintOfRunningOrder(runningOrder)

	const existingSegment = Segments.findOne({
		_id: segmentId,
		runningOrderId: runningOrder._id,
	})
	const existingParts = SegmentLines.find({
		runningOrderId: runningOrder._id,
		segmentId: segmentId
	}).fetch()

	const context = new SegmentContext(runningOrder, studioInstallation, existingParts)
	const res = blueprint.getSegment(context, ingestSegment)

	const { segmentLines, segmentPieces, adlibPieces, newSegment } = generateSegmentContents(context, ingestSegment, existingSegment, existingParts, res)

	Segments.upsert({
		_id: segmentId,
		runningOrderId: runningOrder._id
	}, newSegment)

	saveIntoDb<SegmentLine, DBSegmentLine>(SegmentLines, {
		runningOrderId: runningOrder._id,
		segmentId: segmentId,
	}, segmentLines, {
		afterRemove (segmentLine) {
			afterRemoveSegmentLine(segmentLine)
		}
	})

	const changedSli = saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
		runningOrderId: runningOrder._id,
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

	saveIntoDb<SegmentLineAdLibItem, SegmentLineAdLibItem>(SegmentLineAdLibItems, {
		runningOrderId: runningOrder._id,
		segmentLineId: { $in: segmentLines.map(p => p._id) },
	}, adlibPieces, {
		afterInsert (segmentLineAdLibItem) {
			logger.debug('inserted segmentLineAdLibItem ' + segmentLineAdLibItem._id)
			logger.debug(segmentLineAdLibItem)
		},
		afterUpdate (segmentLineAdLibItem) {
			logger.debug('updated segmentLineItem ' + segmentLineAdLibItem._id)
		},
		afterRemove (segmentLineAdLibItem) {
			logger.debug('deleted segmentLineItem ' + segmentLineAdLibItem._id)
		}
	})

}

function loadCachedRunningOrderData (runningOrderId: string): IngestRunningOrder {
	const cacheEntries = IngestDataCache.find({ runningOrderId: runningOrderId }).fetch()

	const baseEntry = cacheEntries.find(e => e.type === IngestCacheType.RUNNINGORDER)
	if (!baseEntry) throw new Meteor.Error(500, 'Failed to find cached runningOrder')

	const ingestRunningOrder = baseEntry.data as IngestRunningOrder

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
			ingestRunningOrder.segments.push(ingestSegment)
		}
	})

	return ingestRunningOrder
}

function loadCachedSegmentData (runningOrderId: string, segmentId: string): IngestSegment {
	const cacheEntries = IngestDataCache.find({
		runningOrderId: runningOrderId,
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
	const runningOrder = RunningOrders.findOne(roId(studioInstallation._id, externalId))
	if (!runningOrder) throw new Meteor.Error(404, 'Running order not found')

	return {
		runningOrder,
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

export namespace RunningOrderInput {
	// TODO - this all needs guards to avoid race conditions with stuff running in playout.ts (which should be removed from there)

	export function dataRunningOrderDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataRunningOrderDelete', runningOrderId)

		check(runningOrderId, String)

		updateDeviceLastDataReceived(deviceId)

		const { runningOrder } = getStudioInstallationAndRO(peripheralDevice, runningOrderId)
		if (canBeUpdated(runningOrder) && runningOrder) {
			runningOrder.remove()
		}
	}
	export function dataRunningOrderCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, runningOrderData: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataRunningOrderCreate', runningOrderId, runningOrderData)

		check(runningOrderId, String)
		check(runningOrderData, Object)

		updateDeviceLastDataReceived(deviceId)

		handleRunningOrderData(peripheralDevice, mutateRunningOrder(runningOrderData), 'dataRunningOrderCreate')
	}
	export function dataRunningOrderUpdate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, runningOrderData: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataRunningOrderUpdate', runningOrderId, runningOrderData)

		check(runningOrderId, String)
		check(runningOrderData, Object)

		updateDeviceLastDataReceived(deviceId)

		handleRunningOrderData(peripheralDevice, mutateRunningOrder(runningOrderData), 'dataRunningOrderUpdate')
	}

	export function dataSegmentDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentDelete', runningOrderId, segmentId)

		check(runningOrderId, String)
		check(segmentId, String)

		updateDeviceLastDataReceived(deviceId)

		const { runningOrder } = getStudioInstallationAndRO(peripheralDevice, runningOrderId)
		const segmentInternalId = getSegmentId(runningOrder._id, segmentId)

		if (canBeUpdated(runningOrder, segmentInternalId)) {
			Promise.all([
				asyncCollectionRemove(SegmentLines, { segmentId: segmentInternalId }),
				// TODO - cleanup other SL contents
				asyncCollectionRemove(Segments, segmentInternalId)
			])
		}
	}
	export function dataSegmentCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentCreate', runningOrderId, segmentId, newSection)

		check(runningOrderId, String)
		check(segmentId, String)
		check(newSection, Object)

		updateDeviceLastDataReceived(deviceId)

		const { studioInstallation, runningOrder } = getStudioInstallationAndRO(peripheralDevice, runningOrderId)
		const segmentInternalId = getSegmentId(runningOrder._id, segmentId)

		if (canBeUpdated(runningOrder, segmentInternalId)) {
			updateOrCreateSegmentFromPayload(studioInstallation, runningOrder, mutateSegment(newSection))
		}
	}
	export function dataSegmentUpdate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentUpdate', runningOrderId, segmentId, newSection)

		check(runningOrderId, String)
		check(segmentId, String)
		check(newSection, Object)

		updateDeviceLastDataReceived(deviceId)

		const { studioInstallation, runningOrder } = getStudioInstallationAndRO(peripheralDevice, runningOrderId)
		const segmentInternalId = getSegmentId(runningOrder._id, segmentId)

		if (canBeUpdated(runningOrder, segmentInternalId)) {
			updateOrCreateSegmentFromPayload(studioInstallation, runningOrder, mutateSegment(newSection))
		}
	}

	export function dataSegmentLineDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentLineDelete', runningOrderId, segmentId, segmentLineId)

		check(runningOrderId, String)
		check(segmentId, String)
		check(segmentLineId, String)

		updateDeviceLastDataReceived(deviceId)

		const { studioInstallation, runningOrder } = getStudioInstallationAndRO(peripheralDevice, runningOrderId)
		const segmentInternalId = getSegmentId(runningOrder._id, segmentId)
		const partInternalId = getPartId(runningOrder._id, segmentLineId)

		if (canBeUpdated(runningOrder, segmentInternalId, partInternalId)) {
			const segmentLine = SegmentLines.findOne({
				_id: partInternalId,
				segmentId: segmentInternalId,
				runningOrderId: runningOrder._id
			})
			if (!segmentLine) throw new Meteor.Error(404, 'Part not found')

			// Blueprints will handle the deletion of the SL
			const ingestSegment = loadCachedSegmentData(runningOrder._id, segmentInternalId)
			ingestSegment.parts = ingestSegment.parts.filter(p => p.externalId !== segmentLineId)

			updateOrCreateSegmentFromPayload(studioInstallation, runningOrder, ingestSegment)
		}
	}

	function dataSegmentLineCreateOrUpdate (peripheralDevice: PeripheralDevice, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) {
		const { studioInstallation, runningOrder } = getStudioInstallationAndRO(peripheralDevice, runningOrderId)

		const segmentInternalId = getSegmentId(runningOrder._id, segmentId)
		const partInternalId = getPartId(runningOrder._id, segmentLineId)

		if (canBeUpdated(runningOrder, segmentInternalId, partInternalId)) {
			// Blueprints will handle the creation of the SL
			const ingestSegment = loadCachedSegmentData(runningOrder._id, segmentInternalId)
			ingestSegment.parts = ingestSegment.parts.filter(p => p.externalId !== segmentLineId)
			ingestSegment.parts.push(mutatePart(newStory))

			updateOrCreateSegmentFromPayload(studioInstallation, runningOrder, ingestSegment)
		}
	}
	export function dataSegmentLineCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentLineCreate', runningOrderId, segmentId, segmentLineId, newStory)

		check(runningOrderId, String)
		check(segmentId, String)
		check(segmentLineId, String)
		check(newStory, Object)

		updateDeviceLastDataReceived(deviceId)

		dataSegmentLineCreateOrUpdate(peripheralDevice, runningOrderId, segmentId, segmentLineId, newStory)
	}
	export function dataSegmentLineUpdate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		logger.info('dataSegmentLineUpdate', runningOrderId, segmentId, segmentLineId, newStory)

		check(runningOrderId, String)
		check(segmentId, String)
		check(segmentLineId, String)
		check(newStory, Object)

		updateDeviceLastDataReceived(deviceId)

		dataSegmentLineCreateOrUpdate(peripheralDevice, runningOrderId, segmentId, segmentLineId, newStory)
	}
}

let methods: Methods = {
	'debug_roRunBlueprints' (roId: string, deleteFirst?: boolean) {
		check(roId, String)

		const ro = RunningOrders.findOne(roId)
		if (!ro) throw new Meteor.Error(404, 'Running order not found')

		const ingestRunningOrder = loadCachedRunningOrderData(roId)

		if (deleteFirst) ro.remove()

		const peripheralDevice = PeripheralDevices.findOne(ro.peripheralDeviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, 'MOS Device not found to be used for mock running order!')

		handleRunningOrderData(peripheralDevice, ingestRunningOrder, ro.dataSource)

		logger.info('debug_roRunBlueprints: infinites')
		updateSourceLayerInfinitesAfterLine(ro)

		logger.info('debug_roRunBlueprints: done')
	}
}

methods[PeripheralDeviceAPI.methods.dataRunningOrderDelete] = (deviceId: string, deviceToken: string, runningOrderId: string) => {
	return RunningOrderInput.dataRunningOrderDelete(this, deviceId, deviceToken, runningOrderId)
}
methods[PeripheralDeviceAPI.methods.dataRunningOrderCreate] = (deviceId: string, deviceToken: string, runningOrderId: string, runningOrderData: any) => {
	return RunningOrderInput.dataRunningOrderCreate(this, deviceId, deviceToken, runningOrderId, runningOrderData)
}
methods[PeripheralDeviceAPI.methods.dataRunningOrderUpdate] = (deviceId: string, deviceToken: string, runningOrderId: string, runningOrderData: any) => {
	return RunningOrderInput.dataRunningOrderUpdate(this, deviceId, deviceToken, runningOrderId, runningOrderData)
}
methods[PeripheralDeviceAPI.methods.dataSegmentDelete] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string) => {
	return RunningOrderInput.dataSegmentDelete(this, deviceId, deviceToken, runningOrderId, segmentId)
}
methods[PeripheralDeviceAPI.methods.dataSegmentCreate] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) => {
	return RunningOrderInput.dataSegmentCreate(this, deviceId, deviceToken, runningOrderId, segmentId, newSection)
}
methods[PeripheralDeviceAPI.methods.dataSegmentUpdate] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) => {
	return RunningOrderInput.dataSegmentUpdate(this, deviceId, deviceToken, runningOrderId, segmentId, newSection)
}
// TODO - these need renaming
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemDelete] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string) => {
	return RunningOrderInput.dataSegmentLineDelete(this, deviceId, deviceToken, runningOrderId, segmentId, segmentLineId)
}
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemCreate] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) => {
	return RunningOrderInput.dataSegmentLineCreate(this, deviceId, deviceToken, runningOrderId, segmentId, segmentLineId, newStory)
}
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemUpdate] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) => {
	return RunningOrderInput.dataSegmentLineUpdate(this, deviceId, deviceToken, runningOrderId, segmentId, segmentLineId, newStory)
}

setMeteorMethods(wrapMethods(methods))
