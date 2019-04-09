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
	getHash
} from '../../../lib/lib'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import {
	Methods, setMeteorMethods, wrapMethods
} from '../../methods'
import { IngestRunningOrder, IngestSegment, IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { selectShowStyleVariant, afterRemoveSegment, afterRemoveSegmentLine } from '../runningOrder'
import { loadShowStyleBlueprints, getBlueprintOfRunningOrder } from '../blueprints/cache'
import { ShowStyleContext, RunningOrderContext, SegmentContext } from '../blueprints/context'
import { Blueprints, Blueprint } from '../../../lib/collections/Blueprints'
import { CachePrefix } from '../../../lib/collections/RunningOrderDataCache'
import { RunningOrderBaselineItem, RunningOrderBaselineItems } from '../../../lib/collections/RunningOrderBaselineItems'
import { Random } from 'meteor/random'
import { postProcessSegmentLineBaselineItems, postProcessSegmentLineAdLibItems } from '../blueprints/postProcess'
import { RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItems } from '../../../lib/collections/RunningOrderBaselineAdLibItems'
import { DBSegment, Segments, Segment } from '../../../lib/collections/Segments'
const PackageInfo = require('../../../package.json')

function mutatePart (part: any): IngestPart {
	return {
		externalId: part.id,
		name: part.name,
		payload: part
	}
}

function mutateSegment (segment: any): IngestSegment {
	return {
		externalId: segment.id,
		name: segment.name,
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

	const existingSegments = Segments.find({ runningOrder: dbRo._id }).fetch()
	const segments: DBSegment[] = []
	let rankSegment = 0
	_.each(ingestRunningOrder.segments, (ingestSegment: IngestSegment) => {
		const existingSegment = _.find(existingSegments, s => s._id === segment._id)
		const segment = convertToSegment(dbRo._id, ingestSegment, rankSegment++, existingSegment)
		segments.push(segment)
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

}

function getSegmentId (runningOrderId: string, segmentExternalId: string) {
	return getHash(`${runningOrderId}_segment_${segmentExternalId}`)
}
function getPartId (runningOrderId: string, partExternalId: string) {
	return getHash(`${runningOrderId}_part_${partExternalId}`)
}

function convertToSegment (runningOrderId: string, ingestSegment: IngestSegment, rankSegment: number, existingSegment?: Segment): DBSegment {
	const newSegment = literal<DBSegment>({
		_id: getSegmentId(runningOrderId, ingestSegment.externalId),
		runningOrderId: runningOrderId,
		_rank: rankSegment,
		externalId: ingestSegment.externalId,
		name: ingestSegment.name,
	})

	if (existingSegment) {
		return _.extend({}, existingSegment, _.omit(newSegment, ['name']))
	} else {
		return newSegment
	}
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

	// TODO - this should be removed once this is reviewed for doing create
	if (!existingSegment) throw new Meteor.Error(404, 'Segment not found')

	const existingRuntimeArguments = {} // TODO
	const blueprint = getBlueprintOfRunningOrder(runningOrder)
	const context = new SegmentContext(runningOrder, studioInstallation, existingRuntimeArguments)
	const res = blueprint.getSegment(context, ingestSegment)

	if (res === null) throw new Meteor.Error(404, 'Not expected') // TODO - to be removed from blueprints

	const newSegment = literal<DBSegment>({
		// TODO - priorities of these are wrong
		..._.omit((existingSegment || {}), ['name']),
		...res.segment,
		_id: segmentId,
		runningOrderId: runningOrder._id,
		externalId: ingestSegment.externalId,
	})
	Segments.update({
		_id: segmentId,
		runningOrderId: runningOrder._id
	}, newSegment)

	const existingParts = SegmentLines.find({
		runningOrderId: runningOrder._id,
		segmentId: newSegment._id
	}).fetch()

	// SegmentLines
	const segmentLines: DBSegmentLine[] = []
	for (const blueprintPart of res.parts) {
		const partId = getPartId(runningOrder._id, blueprintPart.part.externalId) // TODO - what about virtual parts?
		const existingPart = _.find(existingParts, p => p._id === partId)
		const part = literal<DBSegmentLine>({
			// TODO - priorities of these are wrong
			...(existingPart || {}),
			...blueprintPart.part,
			_id: partId,
			runningOrderId: runningOrder._id,
			segmentId: segmentId,
			_rank: 0 // TODO
		})
		segmentLines.push(part)

		// TODO - adlibs & sli/pieces
	}

	saveIntoDb<SegmentLine, DBSegmentLine>(SegmentLines, {
		runningOrderId: runningOrder._id
	}, segmentLines, {
		beforeDiff (obj, oldObj) {
			let o = _.extend({}, obj, {
				segmentId: oldObj.segmentId
			})
			return o
		},
		afterRemove (segmentLine) {
			afterRemoveSegmentLine(segmentLine)
		}
	})
}

export namespace RunningOrderInput {

	export function dataRunningOrderDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataRunningOrderDelete', runningOrderId)
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
	}
	export function dataSegmentCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, newSection: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentCreate', runningOrderId, segmentId, newSection)
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

	// TODO - the below should be 'segmentLine'/'part'
	export function dataSegmentLineItemDelete (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentLineItemDelete', runningOrderId, segmentId, segmentLineId)
	}
	export function dataSegmentLineItemCreate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentLineItemCreate', runningOrderId, segmentId, segmentLineId, newStory)
	}
	export function dataSegmentLineItemUpdate (self: any, deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(deviceId, deviceToken, self)
		console.log('dataSegmentLineItemUpdate', runningOrderId, segmentId, segmentLineId, newStory)
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
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemDelete] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string) => {
	return RunningOrderInput.dataSegmentLineItemDelete(this, deviceId, deviceToken, runningOrderId, segmentId, segmentLineId)
}
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemCreate] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) => {
	return RunningOrderInput.dataSegmentLineItemCreate(this, deviceId, deviceToken, runningOrderId, segmentId, segmentLineId, newStory)
}
methods[PeripheralDeviceAPI.methods.dataSegmentLineItemUpdate] = (deviceId: string, deviceToken: string, runningOrderId: string, segmentId: string, segmentLineId: string, newStory: any) => {
	return RunningOrderInput.dataSegmentLineItemUpdate(this, deviceId, deviceToken, runningOrderId, segmentId, segmentLineId, newStory)
}

setMeteorMethods(wrapMethods(methods))
