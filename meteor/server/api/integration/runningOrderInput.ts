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
	DBSegmentLine,
	SegmentLineNoteType,
	SegmentLineNote
} from '../../../lib/collections/SegmentLines'
import {
	SegmentLineItem,
	SegmentLineItems
} from '../../../lib/collections/SegmentLineItems'
import {
	saveIntoDb,
	getCurrentTime,fetchBefore,
	getRank,
	fetchAfter,
	literal,
	getHash,
	asyncCollectionRemove
} from '../../../lib/lib'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import {
	Methods, setMeteorMethods, wrapMethods
} from '../../methods'
import { IngestRunningOrder, IngestSegment, IngestPart, BlueprintResultSegment, BlueprintResultPart } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { selectShowStyleVariant, afterRemoveSegment, afterRemoveSegmentLine } from '../runningOrder'
import { loadShowStyleBlueprints, getBlueprintOfRunningOrder } from '../blueprints/cache'
import { ShowStyleContext, RunningOrderContext, SegmentContext } from '../blueprints/context'
import { Blueprints, Blueprint } from '../../../lib/collections/Blueprints'
import { CachePrefix } from '../../../lib/collections/RunningOrderDataCache'
import { RunningOrderBaselineItem, RunningOrderBaselineItems } from '../../../lib/collections/RunningOrderBaselineItems'
import { Random } from 'meteor/random'
import { postProcessSegmentLineBaselineItems, postProcessSegmentLineAdLibItems, postProcessSegmentLineItems } from '../blueprints/postProcess'
import { RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItems } from '../../../lib/collections/RunningOrderBaselineAdLibItems'
import { DBSegment, Segments, Segment } from '../../../lib/collections/Segments'
import { SegmentLineAdLibItem, SegmentLineAdLibItems } from '../../../lib/collections/SegmentLineAdLibItems'
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
		payload: segment,
		parts: _.values(segment.stories || {}).map(mutatePart)
	}
}

function mutateRunningOrder (runningOrder: any): IngestRunningOrder | undefined {
	return {
		externalId: runningOrder.id,
		name: runningOrder.name,
		type: 'external',
		payload: runningOrder,
		segments: _.values(runningOrder.sections || {}).map(mutateSegment)
	}
}

function roId (studioInstallationId: string, externalId: string) {
	return getHash(`${studioInstallationId}_${externalId}`)
}

function canBeUpdated (runningOrder: RunningOrder | undefined) {
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

	// updateMosLastDataReceived(peripheralDevice._id)
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
			mosDeviceId: peripheralDevice._id,
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
	dbRo.saveCache(CachePrefix.INGEST_RUNNINGORDER + dbRo._id, ingestRunningOrder)

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

		const existingRuntimeArguments = {} // TODO
		const context = new SegmentContext(dbRo, studioInstallation, existingRuntimeArguments)
		const res = blueprint.getSegment(context, ingestSegment)
		if (res === null) throw new Meteor.Error(404, 'Not expected') // TODO - to be removed from blueprints

		const newSegment = literal<DBSegment>({
			// TODO - priorities of these are wrong?
			..._.omit((existingSegment || {}), ['name']),
			...res.segment,
			_id: segmentId,
			runningOrderId: dbRo._id,
			externalId: ingestSegment.externalId,
			_rank: ingestSegment.rank,
		})
		segments.push(newSegment)

		const existingParts = existingRoParts.filter(p => p.segmentId === segmentId)
		const res2 = processSegmentLines(context, ingestSegment, newSegment, existingParts, res.parts)
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

function processSegmentLines (context: RunningOrderContext, ingestSegment: IngestSegment, segment: DBSegment, existingParts: DBSegmentLine[], resParts: BlueprintResultPart[]) {
	const runningOrderId = context.runningOrderId

	// Ensure all parts have a valid externalId set on them
	const expectedPartIds = ingestSegment.parts.map(p => p.externalId)
	const unknownParts = resParts.filter(p => expectedPartIds.indexOf(p.part.externalId) === -1)
	const knownParts = resParts.filter(p => expectedPartIds.indexOf(p.part.externalId) !== -1)

	if (unknownParts.length > 0) {
		const unknownIds = unknownParts.map(p => p.part.externalId).join(', ')
		logger.warn(`Dropping some parts with unknown externalId: ${unknownIds}`)
		// TODO - log for ui?
	}

	// const ranks = res.parts.map(p => {
	// 	const sourcePart = ingestSegment.parts.find(p2 => p2.externalId === p.part.externalId)
	// 	if (sourcePart) {
	// 		return sourcePart.rank as number
	// 	} else {
	// 		return undefined
	// 	}
	// })
	// const calculateRank = (index: number) => {
	// 	// TODO - this should handle things better?
	// 	const rank = ranks[index]
	// 	return rank || 0
	// 	// return 0
	// }

	const segmentLines: DBSegmentLine[] = []
	const segmentPieces: SegmentLineItem[] = []
	const adlibPieces: SegmentLineAdLibItem[] = []

	// SegmentLines
	for (let i = 0; i < knownParts.length; i++) {
		const blueprintPart = knownParts[i]

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
			segmentId: segment._id,
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
		segmentLines,
		segmentPieces,
		adlibPieces
	}
}

function getSegmentId (runningOrderId: string, segmentExternalId: string) {
	return getHash(`${runningOrderId}_segment_${segmentExternalId}`)
}
function getPartId (runningOrderId: string, partExternalId: string) {
	return getHash(`${runningOrderId}_part_${partExternalId}`)
}

function handleSegment (peripheralDevice: PeripheralDevice, externalRunningOrderId: string, ingestSegment: IngestSegment) {
	const studioInstallation = getStudioInstallation(peripheralDevice)

	const runningOrder = RunningOrders.findOne(roId(studioInstallation._id, externalRunningOrderId))
	if (!runningOrder) throw new Meteor.Error(404, 'Running order not found')

	const segmentId = getSegmentId(runningOrder._id, ingestSegment.externalId)
	const existingSegment = Segments.findOne({
		_id: segmentId,
		runningOrderId: runningOrder._id,
	})

	const existingRuntimeArguments = {} // TODO
	const blueprint = getBlueprintOfRunningOrder(runningOrder)
	const context = new SegmentContext(runningOrder, studioInstallation, existingRuntimeArguments)
	const res = blueprint.getSegment(context, ingestSegment)

	if (res === null) throw new Meteor.Error(404, 'Not expected') // TODO - to be removed from blueprints

	const newSegment = literal<DBSegment>({
		// TODO - priorities of these are wrong
		...(existingSegment || {}),
		...res.segment,
		_id: segmentId,
		runningOrderId: runningOrder._id,
		externalId: ingestSegment.externalId,
		_rank: ingestSegment.rank,
	})

	const existingParts = SegmentLines.find({
		runningOrderId: runningOrder._id,
		segmentId: newSegment._id
	}).fetch()
	const { segmentLines, segmentPieces, adlibPieces } = processSegmentLines(context, ingestSegment, newSegment, existingParts, res.parts)

	Segments.update({
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

export namespace RunningOrderInput {
	// TODO - this all needs guards to protect the active SL

	export function dataRunningOrderDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataRunningOrderDelete', runningOrderId)

		try {
			const studioInstallation = getStudioInstallation(peripheralDevice)

			const runningOrderInternalId = roId(studioInstallation._id, runningOrderId)
			const existingDbRo = RunningOrders.findOne(runningOrderInternalId)
			if (canBeUpdated(existingDbRo) && existingDbRo) {
				existingDbRo.remove()
			}

		} catch (e) {
			logger.error('dataRunningOrderDelete failed for ' + runningOrderId + ': ' + e)
		}
	}
	export function dataRunningOrderCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, runningOrderData: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataRunningOrderCreate', runningOrderId, runningOrderData)

		try {
			const ingestRo = mutateRunningOrder(runningOrderData)
			if (ingestRo) {
				handleRunningOrderData(peripheralDevice, ingestRo, 'dataRunningOrderCreate')
			} else {
				// TODO
				logger.error('Failed to mutate runningorder')
			}

		} catch (e) {
			logger.error('dataRunningOrderCreate failed for ' + runningOrderId + ': ' + e)
			logger.debug(runningOrderData)
		}

	}
	export function dataRunningOrderUpdate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, runningOrderData: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataRunningOrderUpdate', runningOrderId, runningOrderData)

		try {
			const ingestRo = mutateRunningOrder(runningOrderData)
			if (ingestRo) {
				handleRunningOrderData(peripheralDevice, ingestRo, 'dataRunningOrderUpdate')
			} else {
				// TODO
				logger.error('Failed to mutate runningorder')
			}

		} catch (e) {
			logger.error('dataRunningOrderUpdate failed for ' + runningOrderId + ': ' + e)
			logger.debug(runningOrderData)
		}
	}

	export function dataSegmentDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentDelete', runningOrderId, segmentId)

		try {
			const studioInstallation = getStudioInstallation(peripheralDevice)

			const runningOrder = RunningOrders.findOne(roId(studioInstallation._id, runningOrderId))
			if (!runningOrder) throw new Meteor.Error(404, 'Running order not found')

			const segmentInternalId = getSegmentId(runningOrder._id, segmentId)

			Promise.all([
				asyncCollectionRemove(SegmentLines, { segmentId: segmentInternalId }),
				// TODO - cleanup other SL contents
				asyncCollectionRemove(Segments, segmentInternalId)
			])

		} catch (e) {
			logger.error('dataSegmentDelete failed for ' + runningOrderId + ': ' + e)
		}
	}
	export function dataSegmentCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentCreate', runningOrderId, segmentId, newSection)

		// TODO - where should this be inserted? It needs more context.
	}
	export function dataSegmentUpdate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentUpdate', runningOrderId, segmentId, newSection)

		try {
			const ingestSegment = mutateSegment(newSection)
			if (ingestSegment) {
				handleSegment(peripheralDevice, runningOrderId, ingestSegment)
			} else {
				// TODO
				logger.error('Failed to mutate segment')
			}

		} catch (e) {
			logger.error('dataSegmentUpdate failed for ' + runningOrderId + ': ' + e)
			logger.debug(newSection)
		}
	}

	export function dataSegmentLineDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentLineDelete', runningOrderId, segmentId, segmentLineId)
	}
	export function dataSegmentLineCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentLineCreate', runningOrderId, segmentId, segmentLineId, newStory)
	}
	export function dataSegmentLineUpdate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentLineUpdate', runningOrderId, segmentId, segmentLineId, newStory)
	}
}

let methods: Methods = {}

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
