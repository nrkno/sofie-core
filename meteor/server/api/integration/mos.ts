import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import * as _ from 'underscore'

import { MOS } from 'tv-automation-sofie-blueprints-integration'

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
import { DBSegment } from '../../../lib/collections/Segments'
import {
	saveIntoDb,
	getCurrentTime,fetchBefore,
	getRank,
	fetchAfter
} from '../../../lib/lib'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import { logger } from '../../logging'
import {
	loadBlueprints,
	postProcessSegmentLineAdLibItems,
	postProcessSegmentLineItems,
	SegmentLineContext
} from '../blueprints'
import { getHash } from '../../lib'
import {
	StudioInstallations,
	StudioInstallation
} from '../../../lib/collections/StudioInstallations'
import {
	SegmentLineAdLibItem,
	SegmentLineAdLibItems
} from '../../../lib/collections/SegmentLineAdLibItems'
import {
	ShowStyleBases
} from '../../../lib/collections/ShowStyleBases'
import {
	ServerPlayoutAPI,
	updateTimelineFromMosData
} from '../playout'
import { CachePrefix } from '../../../lib/collections/RunningOrderDataCache'
import {
	setMeteorMethods,
	wrapMethods,
	Methods
} from '../../methods'
import {
	afterRemoveSegmentLine,
	updateSegments,
	updateAffectedSegmentLines,
	removeSegmentLine,
	runPostProcessBlueprint,
	ServerRunningOrderAPI
} from '../runningOrder'
import { syncFunction } from '../../codeControl'
import { IBlueprintSegmentLine, SegmentLineHoldMode } from 'tv-automation-sofie-blueprints-integration'
import { ShowStyleVariants, ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { updateExpectedMediaItems } from '../expectedMediaItems'

export function roId (roId: MOS.MosString128, original?: boolean): string {
	// logger.debug('roId', roId)
	if (!roId) throw new Meteor.Error(401, 'parameter roId missing!')
	let id = 'ro_' + (roId['_str'] || roId.toString())
	return (original ? id : getHash(id))
}
export function segmentLineId (runningOrderId: string, storyId: MOS.MosString128): string {
	let id = runningOrderId + '_' + storyId.toString()
	return getHash(id)
}

/**
 * Returns a Running order, throws error if not found
 * @param roId Id of the Running order
 */
export function getRO (roID: MOS.MosString128): RunningOrder {
	let id = roId(roID)
	let ro = RunningOrders.findOne(id)
	if (ro) {
		ro.touch()
		return ro
	} else throw new Meteor.Error(404, 'RunningOrder ' + id + ' not found (ro: ' + roID + ')')
}
/**
 * Returns a Segment (aka a Story), throws error if not found
 * @param roId Running order id
 * @param segmentId Segment / Story id
 */
// export function getSegment (roID: MOS.MosString128, storyID: MOS.MosString128, rank: number): Segment {
// 	let id = segmentId(roId(roID), storyID, rank)
// 	let segments = Segments.findOne({
// 		runningOrderId: roId(roID),
// 		_id: id
// 	})
// 	if (segments) {
// 		return segments
// 	} else throw new Meteor.Error(404, 'Segment ' + id + ' not found')
// }
/**
 * Returns a SegmentLine (aka an Item), throws error if not found
 * @param roId
 * @param segmentLineId
 */
export function getSegmentLine (roID: MOS.MosString128, storyID: MOS.MosString128): SegmentLine {
	let id = segmentLineId(roId(roID), storyID)
	let segmentLine = SegmentLines.findOne({
		runningOrderId: roId( roID ),
		_id: id
	})
	if (segmentLine) {
		return segmentLine
	} else throw new Meteor.Error(404, 'SegmentLine ' + id + ' not found (ro: ' + roID + ', story: ' + storyID + ')')
}

/**
 * Converts an Item into a SegmentLine
 * @param item MOS Item
 * @param runningOrderId Running order id of the item
 * @param segmentId Segment / Story id of the item
 * @param rank Rank of the story
 */
export function convertToSegmentLine (story: MOS.IMOSStory, runningOrderId: string, rank: number): DBSegmentLine {
	return {
		_id: segmentLineId(runningOrderId, story.ID),
		runningOrderId: runningOrderId,
		segmentId: '', // to be coupled later
		_rank: rank,
		mosId: story.ID.toString(),
		slug: (story.Slug || '').toString(),
		typeVariant: ''
		// expectedDuration: item.EditorialDuration,
		// autoNext: item.Trigger === ??
	}
}
/**
 * Merge an old segmentLine with a new one (to be used together with (after) convertToSegmentLine )
 * @param newSegmentLine
 * @param existingSegmentLine
 */
export function mergeSegmentLine (newSegmentLine: DBSegmentLine, existingSegmentLine?: DBSegmentLine): DBSegmentLine {
	if (existingSegmentLine) {
		if (existingSegmentLine._id !== newSegmentLine._id) {
			throw new Meteor.Error(500, `mergeSegmentLine: ids differ: ${newSegmentLine._id}, ${existingSegmentLine._id}`)
		}

		newSegmentLine = _.extend({}, existingSegmentLine, _.omit(newSegmentLine, ['segmentId']))

		newSegmentLine.typeVariant = existingSegmentLine.typeVariant || newSegmentLine.typeVariant // typeVariant is set in the blueprints
		newSegmentLine.subTypeVariant = existingSegmentLine.subTypeVariant || newSegmentLine.subTypeVariant // subTypeVariant is set in the blueprints
	}
	return newSegmentLine
}
/**
 * Insert a new SegmentLine (aka an Item)
 * @param item The item to be inserted
 * @param runningOrderId The id of the Running order
 * @param segmentId The id of the Segment / Story
 * @param rank The new rank of the SegmentLine
 */
export function upsertSegmentLine (story: MOS.IMOSStory, runningOrderId: string, rank: number): DBSegmentLine {
	let sl = convertToSegmentLine(story, runningOrderId, rank)
	SegmentLines.upsert(sl._id, {$set: sl}) // insert, or update
	afterInsertUpdateSegmentLine(story, runningOrderId)
	return sl
}
export function afterInsertUpdateSegmentLine (story: MOS.IMOSStory, runningOrderId: string) {
	// nothing
}

function fixIllegalObject (o: any) {
	if (_.isArray(o)) {
		_.each(o, (val, key) => {
			fixIllegalObject(val)
		})
	} else if (_.isObject(o)) {
		_.each(_.keys(o), (key: string) => {
			let val = o[key]
			if ((key + '').match(/^\$/)) {
				let newKey = key.replace(/^\$/,'@')
				o[newKey] = val
				delete o[key]
				key = newKey
			}
			fixIllegalObject(val)
		})
	}
}
function formatDuration (duration: any): number | undefined {
	try {
		// first try and parse it as a MOS.MosDuration timecode string
		return duration ? new MOS.MosDuration(duration.toString()).valueOf() * 1000 : undefined
	} catch (e) {
		try {
			// second try and parse it as a length in seconds
			return duration ? Number.parseFloat(duration) * 1000 : undefined
		} catch (e2) {
			logger.warn('Bad MOS.MosDuration: "' + duration + '"', e)
			return undefined
		}
	}
}
function formatTime (time: any): number | undefined {
	try {
		return time ? new MOS.MosTime(time.toString()).getTime() : undefined
	} catch (e) {
		logger.warn('Bad MOS.MosTime: "' + time + '"', e)
		return undefined
	}
}
export const updateStory: (ro: RunningOrder, segmentLine: SegmentLine, story: MOS.IMOSROFullStory) => boolean
= syncFunction(function updateStory (ro: RunningOrder, segmentLine: SegmentLine, story: MOS.IMOSROFullStory): boolean {
	let showStyleBase = ShowStyleBases.findOne(ro.showStyleBaseId)
	if (!showStyleBase) throw new Meteor.Error(404, 'ShowStyleBase "' + ro.showStyleBaseId + '" not found!')

	const context = new SegmentLineContext(ro, segmentLine, story)
	context.handleNotesExternally = true

	let resultSl: IBlueprintSegmentLine | undefined = undefined
	let resultSli: SegmentLineItem[] | undefined = undefined
	let resultAdlibSli: SegmentLineAdLibItem[] | undefined = undefined
	let notes: SegmentLineNote[] = []
	try {
		const blueprints = loadBlueprints(showStyleBase)
		let result = blueprints.getSegmentLine(context, story)

 		if (result) {
			resultAdlibSli = postProcessSegmentLineAdLibItems(context, result.adLibItems, result.segmentLine.typeVariant, segmentLine._id)
			resultSli = postProcessSegmentLineItems(context, result.segmentLineItems, result.segmentLine.typeVariant, segmentLine._id)
			resultSl = result.segmentLine
		}

 		notes = context.getNotes()
	} catch (e) {
		logger.error(e.stack ? e.stack : e.toString())
		// throw e
		notes = [{
			type: SegmentLineNoteType.ERROR,
			origin: {
				name: '',				roId: context.runningOrder._id,
				segmentId: (context.segmentLine as DBSegmentLine).segmentId,
				segmentLineId: context.segmentLine._id,
			},
			message: 'Internal Server Error'
		}],
		resultSli = undefined
		resultAdlibSli = undefined
	}

	let changedSli: {
		added: number,
		updated: number,
		removed: number
	} = {
		added: 0,
		updated: 0,
		removed: 0
	}
	if (resultSl) {
		SegmentLines.update(segmentLine._id, {$set: {
			expectedDuration:		resultSl.expectedDuration || 0,
			notes: 					notes,
			autoNext: 				resultSl.autoNext || false,
			autoNextOverlap: 		resultSl.autoNextOverlap || 0,
			prerollDuration: 		resultSl.prerollDuration || 0,
			transitionPrerollDuration: 		resultSl.transitionPrerollDuration,
			transitionKeepaliveDuration: 	resultSl.transitionKeepaliveDuration,
			disableOutTransition: 	resultSl.disableOutTransition || false,
			updateStoryStatus:		resultSl.updateStoryStatus || false,
			typeVariant:			resultSl.typeVariant || '',
			subTypeVariant:			resultSl.subTypeVariant || '',
			holdMode: 				resultSl.holdMode || SegmentLineHoldMode.NONE,
			classes: 				resultSl.classes || [],
			classesForNext: 		resultSl.classesForNext || [],
		}})
	} else {
		SegmentLines.update(segmentLine._id, {$set: {
			notes: notes,
		}})
	}

	if (resultSli) {
		changedSli = saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
			runningOrderId: ro._id,
			segmentLineId: segmentLine._id,
			dynamicallyInserted: { $ne: true } // do not affect dynamically inserted items (such as adLib items)
		}, resultSli || [], {
			afterInsert (segmentLineItem) {
				logger.debug('inserted segmentLineItem ' + segmentLineItem._id)
				logger.debug(segmentLineItem)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
					// afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (segmentLineItem) {
				logger.debug('updated segmentLineItem ' + segmentLineItem._id)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// 	afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterRemove (segmentLineItem) {
				logger.debug('deleted segmentLineItem ' + segmentLineItem._id)
				// @todo: handle this:
				// afterRemoveSegmentLineItem(segmentLine._id)
			}
		})
	}
	if (resultAdlibSli) {
		saveIntoDb<SegmentLineAdLibItem, SegmentLineAdLibItem>(SegmentLineAdLibItems, {
			runningOrderId: ro._id,
			segmentLineId: segmentLine._id,
			fromPostProcess: { $ne: true }, // do not affect postProcess items
		}, resultAdlibSli || [], {
			afterInsert (segmentLineAdLibItem) {
				logger.debug('inserted segmentLineAdLibItem ' + segmentLineAdLibItem._id)
				logger.debug(segmentLineAdLibItem)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (segmentLineAdLibItem) {
				logger.debug('updated segmentLineItem ' + segmentLineAdLibItem._id)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// 	afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterRemove (segmentLineAdLibItem) {
				logger.debug('deleted segmentLineItem ' + segmentLineAdLibItem._id)
				// @todo: handle this:
				// afterRemoveSegmentLineItem(segmentLine._id)
			}
		})
	}

	if (resultSli || resultAdlibSli) {
		try {
			updateExpectedMediaItems(ro._id, segmentLine._id)
		} catch (e) {
			logger.error('Error updating expectedMediaItems: ' + e.toString())
		}
	}

	// if anything was changed
	return (changedSli.added > 0 || changedSli.removed > 0 || changedSli.updated > 0)
	// return this.core.mosManipulate(P.methods.mosRoReadyToAir, story)
})

export function sendStoryStatus (ro: RunningOrder, takeSegmentLine: SegmentLine | null) {

	if (ro.currentPlayingStoryStatus) {
		setStoryStatus(ro.mosDeviceId, ro, ro.currentPlayingStoryStatus, MOS.IMOSObjectStatus.STOP)
		.catch(e => logger.error(e))
	}
	if (takeSegmentLine) {
		setStoryStatus(ro.mosDeviceId, ro, takeSegmentLine.mosId, MOS.IMOSObjectStatus.PLAY)
		.catch(e => logger.error(e))

		RunningOrders.update(this._id, {$set: {
			currentPlayingStoryStatus: takeSegmentLine.mosId
		}})
		ro.currentPlayingStoryStatus = takeSegmentLine.mosId
	} else {
		RunningOrders.update(this._id, {$unset: {
			currentPlayingStoryStatus: 1
		}})
		delete ro.currentPlayingStoryStatus
	}
}
function setStoryStatus (deviceId: string, ro: RunningOrder, storyId: string, status: MOS.IMOSObjectStatus): Promise<any> {
	return new Promise((resolve, reject) => {
		if (!ro.rehearsal) {
			logger.debug('setStoryStatus', deviceId, ro.mosId, storyId, status)
			PeripheralDeviceAPI.executeFunction(deviceId, (err, result) => {
				logger.debug('reply', err, result)
				if (err) {
					reject(err)
				} else {
					resolve(result)
				}
			}, 'setStoryStatus', ro.mosId, storyId, status)
		}
	})
}
export const reloadRunningOrder: (runningOrder: RunningOrder) => void = Meteor.wrapAsync(
	function reloadRunningOrder (runningOrder: RunningOrder, cb: (err: Error | null) => void) {
		logger.info('reloadRunningOrder ' + runningOrder._id)

		if (!runningOrder.mosDeviceId) throw new Meteor.Error(400,'runningOrder.mosDeviceId missing!')
		check(runningOrder.mosDeviceId, String)

		let peripheralDevice = PeripheralDevices.findOne(runningOrder.mosDeviceId) as PeripheralDevice
		if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + runningOrder.mosDeviceId + '" not found' )

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err: any, ro: MOS.IMOSRunningOrder) => {
			// console.log('Response!')
			if (err) {
				logger.error(err)
				cb(err)
			} else {
				try {
					logger.info('triggerGetRunningOrder reply ' + ro.ID)
					logger.debug(ro)

					handleRunningOrderData(ro, peripheralDevice, 'roList')
					cb(null)
				} catch (e) {
					cb(e)
				}
			}
		}, 'triggerGetRunningOrder', runningOrder.mosId)
	}
)
function handleRunningOrderData (ro: MOS.IMOSRunningOrder, peripheralDevice: PeripheralDevice, dataSource: string) {
	// Create or update a runningorder (ie from roCreate or roList)

	let existingDbRo = RunningOrders.findOne(roId(ro.ID))
	if (!isAvailableForMOS(existingDbRo)) return
	updateMosLastDataReceived(peripheralDevice._id)
	logger.info((existingDbRo ? 'Updating' : 'Adding') + ' RO ' + roId(ro.ID))

	let studioInstallationId = peripheralDevice.studioInstallationId
	if (!studioInstallationId && peripheralDevice.parentDeviceId) {
		// Also check the parent device:
		let parentDevice = PeripheralDevices.findOne(peripheralDevice.parentDeviceId)
		if (parentDevice) {
			studioInstallationId = parentDevice.studioInstallationId
		}
	}

	if (!studioInstallationId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no StudioInstallation')

	let studioInstallation = StudioInstallations.findOne(studioInstallationId) as StudioInstallation
	if (!studioInstallation) throw new Meteor.Error(404, 'StudioInstallation "' + studioInstallationId + '" not found')

	// the defaultShowStyleVariant is a temporary solution, to be replaced by a blueprint plugin
	let defaultShowStyleVariant = ShowStyleVariants.findOne(studioInstallation.defaultShowStyleVariant) as ShowStyleVariant || {}

	let dbROData: DBRunningOrder = _.extend(existingDbRo || {},
		{
			_id: roId(ro.ID),
			mosId: ro.ID.toString(),
			studioInstallationId: studioInstallation._id,
			mosDeviceId: peripheralDevice._id,
			showStyleVariantId: defaultShowStyleVariant._id,
			showStyleBaseId: defaultShowStyleVariant.showStyleBaseId,
			name: ro.Slug.toString(),
			expectedStart: formatTime(ro.EditorialStart),
			expectedDuration: formatDuration(ro.EditorialDuration),
			dataSource: dataSource,
			unsynced: false
		} as DBRunningOrder
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

	let dbRo = RunningOrders.findOne(dbROData._id)
	if (!dbRo) throw new Meteor.Error(500, 'Running order not found (it should have been)')
	// cache the Data
	dbRo.saveCache(CachePrefix.ROCREATE + dbRo._id, ro)

	// Save Stories into database:

	let existingSegmentLines = dbRo.getSegmentLines()

	// Note: a number of X stories will result in (<=X) Segments and X SegmentLines
	let segments: DBSegment[] = []
	let segmentLines: DBSegmentLine[] = []
	let rankSegment = 0
	let rankSegmentLine = 0
	let prevSlugParts: string[] = []
	let segment: DBSegment
	_.each(ro.Stories, (story: MOS.IMOSStory) => {
		// divide into
		let slugParts = (story.Slug || '').toString().split(';')

		// if (slugParts[0] !== prevSlugParts[0]) {
			// segment = convertToSegment(story, roId(ro.ID), rankSegment++)
			// segments.push(segment)
		// }
		if (dbRo) {
			// join new data with old:
			let segmentLine = convertToSegmentLine(story, dbRo._id, rankSegmentLine++)
			let existingSegmentLine = _.find(existingSegmentLines, (sl) => {
				return sl._id === segmentLine._id
			})
			segmentLine = mergeSegmentLine(segmentLine, existingSegmentLine)

			segmentLines.push(segmentLine)
		} else throw new Meteor.Error(500, 'Running order not found (it should have been)')

		prevSlugParts = slugParts
	})
	// logger.debug('segmentLines', segmentLines)
	// logger.debug('---------------')
	// logger.debug(SegmentLines.find({runningOrderId: dbRo._id}).fetch())
	saveIntoDb<SegmentLine, DBSegmentLine>(SegmentLines, {
		runningOrderId: dbRo._id
	}, segmentLines, {
		beforeDiff (obj, oldObj) {
			let o = _.extend({}, obj, {
				segmentId: oldObj.segmentId
			})
			return o
		},
		afterInsert (segmentLine) {
			// logger.debug('inserted segmentLine ' + segmentLine._id)
			// @todo: have something here?
			// let story: MOS.IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
			// if (story) {
				// afterInsertUpdateSegment (story, roId(ro.ID))
			// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
		},
		afterUpdate (segmentLine) {
			// logger.debug('updated segmentLine ' + segmentLine._id)
			// @todo: have something here?
			// let story: MOS.IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
			// if (story) {
			// 	afterInsertUpdateSegment (story, roId(ro.ID))
			// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
		},
		afterRemove (segmentLine) {
			afterRemoveSegmentLine(segmentLine)
		}
	})
	updateSegments(roId(ro.ID))
}
function isAvailableForMOS (ro: RunningOrder | undefined): boolean {
	if (ro && ro.unsynced) {
		logger.info(`RunningOrder "${ro._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}
	return true
}
function updateMosLastDataReceived (deviceId: string) {
	PeripheralDevices.update(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime()
		}
	})
}
export namespace MosIntegration {
	export function mosRoCreate (id: string, token: string, ro: MOS.IMOSRunningOrder) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		// logger.debug('mosRoCreate', ro)
		logger.info('mosRoCreate ' + ro.ID)
		logger.debug(ro)

		handleRunningOrderData(ro, peripheralDevice, 'roCreate')
	}
	export function mosRoReplace (id: string, token: string, ro: MOS.IMOSRunningOrder) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReplace ' + ro.ID)
		// @ts-ignore
		logger.debug(ro)
		handleRunningOrderData(ro, peripheralDevice, 'roReplace')
	}
	export function mosRoDelete (id: string, token: string, runningOrderId: MOS.MosString128, force?: boolean) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoDelete ' + runningOrderId.toString())

		let ro = getRO(runningOrderId)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)
		logger.info('Removing RO ' + roId(runningOrderId))

		if (ro) {
			if (!ro.active || force === true) {
				ServerRunningOrderAPI.removeRunningOrder(ro._id)
			} else {
				if (!ro.unsynced) {
					ServerRunningOrderAPI.unsyncRunningOrder(ro._id)
				}
			}

		}
	}
	export function mosRoMetadata (id: string, token: string, roData: MOS.IMOSRunningOrderBase) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoMetadata ' + roData.ID)

		// @ts-ignore
		logger.debug(roData)
		let ro = getRO(roData.ID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)

		let m: Partial<DBRunningOrder> = {}
		if (roData.MosExternalMetaData) m.metaData = roData.MosExternalMetaData
		if (roData.Slug) 				m.name = roData.Slug.toString()
		if (roData.EditorialStart) 		m.expectedStart = formatTime(roData.EditorialStart)
		if (roData.EditorialDuration) 	m.expectedDuration = formatDuration(roData.EditorialDuration)

		if (!_.isEmpty(m)) {
			RunningOrders.update(ro._id, {$set: m})
			// update data cache:
			const cache = ro.fetchCache(CachePrefix.ROCREATE + roId(roData.ID),)
			if (cache) {
				if (!cache.MosExternalMetaData) {
					cache.MosExternalMetaData = []
				}
				_.each(roData.MosExternalMetaData || [], (md, key) => {
					if (!cache.MosExternalMetaData[key]) {
						cache.MosExternalMetaData[key] = md
					}
					let md0 = cache.MosExternalMetaData[key]

					md0.MosPayload = _.extend(
						md0.MosPayload || {},
						md.MosPayload
					)
				})
			}

			ro.saveCache(CachePrefix.ROCREATE + roId(roData.ID), cache)
		}
	}
	export function mosRoStatus (id: string, token: string, status: MOS.IMOSRunningOrderStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStatus ' + status.ID)

		let ro = getRO(status.ID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(status)
		RunningOrders.update(ro._id, {$set: {
			status: status.Status
		}})
	}
	export function mosRoStoryStatus (id: string, token: string, status: MOS.IMOSStoryStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryStatus ' + status.ID)

		let ro = getRO(status.RunningOrderId)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)

		// @ts-ignore
		logger.debug(status)
		// Save Stories (aka SegmentLine ) status into database:
		let segmentLine = SegmentLines.findOne({
			_id: 			segmentLineId(roId(status.RunningOrderId), status.ID),
			runningOrderId: ro._id
		})
		if (segmentLine) {
			SegmentLines.update(segmentLine._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'Segment ' + status.ID + ' in RO ' + status.RunningOrderId + ' not found')
	}
	export function mosRoItemStatus (id: string, token: string, status: MOS.IMOSItemStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemStatus NOT IMPLEMENTED YET ' + status.ID)
		// @ts-ignore
		logger.debug(status)
		/*
		// Save status of Item database:
		let segmentID = segmentId(roId(status.RunningOrderId), status.StoryId)
		let segmentLine = SegmentLineIte.findOne({
			_id: 			segmentLineId(segmentID, status.ID),
			segmentId: 		segmentID,
			runningOrderId: roId(status.RunningOrderId)
		})
		if (segmentLine) {
			SegmentLines.update(segmentLine._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'SegmentLine ' + status.ID + ' in segment ' + status.StoryId + ' in RO ' + status.RunningOrderId + ' not found')
		*/
	}
	export function mosRoStoryInsert (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryInsert after ' + Action.StoryID)

		let ro = getRO(Action.RunningOrderID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)

		// @ts-ignore		logger.debug(
		logger.debug(Action, Stories)
		// insert a story (aka SegmentLine) before another story:
		let segmentLineAfter = (Action.StoryID ? getSegmentLine(Action.RunningOrderID, Action.StoryID) : null)

		let newRankMax
		let newRankMin
		let segmentLineBeforeOrLast: DBSegmentLine | undefined = (
			segmentLineAfter ?
				fetchBefore(SegmentLines,
					{ runningOrderId: ro._id },
					segmentLineAfter._rank
				) :
				fetchBefore(SegmentLines,
					{ runningOrderId: ro._id },
					null
				)
		)
		let affectedSegmentLineIds: Array<string> = []
		let firstInsertedSegmentLine: DBSegmentLine | undefined
		_.each(Stories, (story: MOS.IMOSROStory, i: number) => {
			logger.info('insert story ' + story.ID)
			let rank = getRank(segmentLineBeforeOrLast, segmentLineAfter, i, Stories.length)
			// let rank = newRankMin + ( i / Stories.length ) * (newRankMax - newRankMin)
			let segmentLine = upsertSegmentLine(story, ro._id, rank)
			affectedSegmentLineIds.push(segmentLine._id)
			if (!firstInsertedSegmentLine) firstInsertedSegmentLine = segmentLine
		})

		if (segmentLineAfter && ro.nextSegmentLineId === segmentLineAfter._id && firstInsertedSegmentLine && !ro.nextSegmentLineManual) {
			// Move up next-point to the first inserted segmentLine
			ServerPlayoutAPI.roSetNext(ro._id, firstInsertedSegmentLine._id)
		}

		updateSegments(ro._id)
		updateAffectedSegmentLines(ro, affectedSegmentLineIds)
	}
	export function mosRoItemInsert (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemInsert NOT SUPPORTED after ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// insert an item (aka SegmentLine ## TODO ##Line) before another story:
		let ro = getRO(Action.RunningOrderID)
		let segment = getSegment(Action.RunningOrderID, Action.StoryID)
		let segmentLineAfter = (Action.ItemID ? getSegmentLine(Action.RunningOrderID, Action.StoryID, Action.ItemID) : null)

		let segmentLineBeforeOrLast
		let newRankMax
		let newRankMin
		if (segmentLineAfter) {
			segmentLineBeforeOrLast = fetchBefore(SegmentLines,
				{ runningOrderId: ro._id, segmentId: segment._id },
				segmentLineAfter._rank
			)
		} else {
			segmentLineBeforeOrLast = fetchBefore(SegmentLines,
				{ runningOrderId: ro._id, segmentId: segment._id },
				null
			)
		}
		_.each(Items, (item: MOS.IMOSItem, i: number) => {
			let rank = getRank(segmentLineBeforeOrLast, segmentLineAfter, i, Items.length)
			// let rank = newRankMin + ( i / Items.length ) * (newRankMax - newRankMin)
			insertSegmentLine(item, ro._id, segment._id, rank)
		})
		*/
	}
	export function mosRoStoryReplace (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryReplace ' + Action.StoryID)

		let ro = getRO(Action.RunningOrderID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, Stories)
		// Replace a Story (aka a SegmentLine) with one or more Stories
		let segmentLineToReplace = getSegmentLine(Action.RunningOrderID, Action.StoryID)

		let segmentLineBefore = fetchBefore(SegmentLines, { runningOrderId: ro._id }, segmentLineToReplace._rank)
		let segmentLineAfter = fetchAfter(SegmentLines, { runningOrderId: ro._id }, segmentLineToReplace._rank)

		let affectedSegmentLineIds: Array<string> = []

		let insertedSegmentLineIds: {[id: string]: boolean} = {}
		let firstInsertedSegmentLine: DBSegmentLine | undefined
		_.each(Stories, (story: MOS.IMOSROStory, i: number) => {
			logger.info('insert story ' + story.ID)
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Stories.length)
			let sl = upsertSegmentLine(story, ro._id, rank)
			insertedSegmentLineIds[sl._id] = true
			affectedSegmentLineIds.push(sl._id)
			if (!firstInsertedSegmentLine) firstInsertedSegmentLine = sl
		})

		updateSegments(ro._id)

		if (!insertedSegmentLineIds[segmentLineToReplace._id]) {
			// ok, the segmentline to replace wasn't in the inserted segment lines
			// remove it then:
			affectedSegmentLineIds.push(segmentLineToReplace._id)
			removeSegmentLine(ro._id, segmentLineToReplace, firstInsertedSegmentLine)
		}

		updateAffectedSegmentLines(ro, affectedSegmentLineIds)
	}
	export function mosRoItemReplace (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemReplace NOT IMPLEMENTED YET ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// Replace an item (aka SegmentLine ## TODO ##Line) with one or more items
		let ro = getRO(Action.RunningOrderID)
		let segmentLineToReplace = getSegmentLine(Action.RunningOrderID, Action.StoryID, Action.ItemID)

		let segmentLineBefore = fetchBefore(SegmentLines, { runningOrderId: ro._id, segmentId: segmentLineToReplace.segmentId }, segmentLineToReplace._rank)
		let segmentLineAfter = fetchAfter(SegmentLines, { runningOrderId: ro._id, segmentId: segmentLineToReplace.segmentId }, segmentLineToReplace._rank)

		removeSegmentLine(segmentLineToReplace._id)

		_.each(Items, (item: MOS.IMOSItem, i: number) => {
			let rank = getRank (segmentLineBefore, segmentLineAfter, i, Items.length)
			insertSegmentLine(item, ro._id, rank)
		})
		*/
	}
	export function mosRoStoryMove (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn ('mosRoStoryMove ' + Action.StoryID)

		let ro = getRO(Action.RunningOrderID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, Stories)

		// Move Stories (aka SegmentLine ## TODO ##Lines) to before a story

		let currentSegmentLine: SegmentLine | undefined = undefined
		let onAirNextWindowWidth: number | undefined = undefined
		let nextPosition: number | undefined = undefined
		if (ro.currentSegmentLineId) {
			let nextSegmentLine: SegmentLine | undefined = undefined
			currentSegmentLine = SegmentLines.findOne(ro.currentSegmentLineId)
			if (ro.nextSegmentLineId) nextSegmentLine = SegmentLines.findOne(ro.nextSegmentLineId)
			if (currentSegmentLine) {
				const segmentLines = ro.getSegmentLines({
					_rank: _.extend({
						$gte: currentSegmentLine._rank
					}, nextSegmentLine ? {
						$lte: nextSegmentLine._rank
					} : {})
				})
				onAirNextWindowWidth = segmentLines.length
			}
		} else if (ro.nextSegmentLineId) {
			let nextSegmentLine: SegmentLine | undefined = undefined
			nextSegmentLine = SegmentLines.findOne(ro.nextSegmentLineId)
			if (nextSegmentLine) {
				const segmentLines = ro.getSegmentLines({
					_rank: {
						$lte: nextSegmentLine._rank
					}
				})
				nextPosition = segmentLines.length
			}
		}

		let segmentLineAfter = (Action.StoryID ? getSegmentLine(Action.RunningOrderID, Action.StoryID) : null)
		let segmentLineBefore = fetchBefore(SegmentLines, { runningOrderId: ro._id }, (segmentLineAfter ? segmentLineAfter._rank : null))

		// console.log('Inserting between: ' + (segmentLineBefore ? segmentLineBefore._rank : 'X') + ' - ' + segmentLineAfter._rank)

		let affectedSegmentLineIds: Array<string> = []
		if (segmentLineAfter) affectedSegmentLineIds.push(segmentLineAfter._id)
		if (segmentLineBefore) affectedSegmentLineIds.push(segmentLineBefore._id)
		_.each(Stories, (storyId: MOS.MosString128, i: number) => {
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Stories.length)
			SegmentLines.update(segmentLineId(ro._id, storyId), {$set: {
				_rank: rank
			}})
		})

		updateSegments(ro._id)
		updateAffectedSegmentLines(ro, affectedSegmentLineIds)

		// Meteor.call('playout_storiesMoved', ro._id, onAirNextWindowWidth, nextPosition)
		ServerPlayoutAPI.roStoriesMoved(ro._id, onAirNextWindowWidth, nextPosition)
	}
	export function mosRoItemMove (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemMove NOT IMPLEMENTED YET ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// Move Items (#####) to before a story
		let ro = getRO(Action.RunningOrderID)
		let segmentLineAfter = getSegmentLine(Action.RunningOrderID, Action.StoryID, Action.ItemID)
		let segmentLineBefore = fetchBefore(SegmentLines,
			{ runningOrderId: ro._id, segmentId: segmentLineAfter.segmentId},
			segmentLineAfter._rank)

		_.each(Items, (itemId: MOS.MosString128, i: number) => {
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Items.length)
			SegmentLines.update(segmentLineId(segmentId, itemId), {$set: {
				_rank: rank
			}})
		})
		*/
	}
	export function mosRoStoryDelete (id: string, token: string, Action: MOS.IMOSROAction, Stories: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryDelete ' + Action.RunningOrderID)

		let ro = getRO(Action.RunningOrderID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, Stories)
		// Delete Stories (aka SegmentLine)
		let affectedSegmentLineIds: Array<string> = []
		_.each(Stories, (storyId: MOS.MosString128, i: number) => {
			logger.debug('remove story ' + storyId)
			let slId = segmentLineId(ro._id, storyId)
			affectedSegmentLineIds.push(slId)
			removeSegmentLine(ro._id, slId)
		})
		updateSegments(ro._id)
		updateAffectedSegmentLines(ro, affectedSegmentLineIds)
	}
	export function mosRoItemDelete (id: string, token: string, Action: MOS.IMOSStoryAction, Items: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemDelete NOT IMPLEMENTED YET ' + Action.StoryID)
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// Delete Items (aka SegmentLine ## TODO ##LinesLines)
		let ro = getRO(Action.RunningOrderID)
		_.each(Items, (itemId: MOS.MosString128, i: number) => {
			removeSegmentLine( segmentLineId(segmentId(ro._id, Action.StoryID), itemId))
		})
		*/
	}
	export function mosRoStorySwap (id: string, token: string, Action: MOS.IMOSROAction, StoryID0: MOS.MosString128, StoryID1: MOS.MosString128) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStorySwap ' + StoryID0 + ', ' + StoryID1)

		let ro = getRO(Action.RunningOrderID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, StoryID0, StoryID1)
		// Swap Stories (aka SegmentLine)

		let segmentLine0 = getSegmentLine(Action.RunningOrderID, StoryID0)
		let segmentLine1 = getSegmentLine(Action.RunningOrderID, StoryID1)

		SegmentLines.update(segmentLine0._id, {$set: {_rank: segmentLine1._rank}})
		SegmentLines.update(segmentLine1._id, {$set: {_rank: segmentLine0._rank}})

		if (ro.nextSegmentLineId === segmentLine0._id) {
			// Change nexted segmentLine
			ServerPlayoutAPI.roSetNext(ro._id, segmentLine1._id)
		} else if (ro.nextSegmentLineId === segmentLine1._id) {
			// Change nexted segmentLine
			ServerPlayoutAPI.roSetNext(ro._id, segmentLine0._id)
		}

		updateSegments(ro._id)
		updateAffectedSegmentLines(ro, [segmentLine0._id, segmentLine1._id])
	}
	export function mosRoItemSwap (id: string, token: string, Action: MOS.IMOSStoryAction, ItemID0: MOS.MosString128, ItemID1: MOS.MosString128) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemSwap NOT IMPLEMENTED YET ' + ItemID0 + ', ' + ItemID1)
		// @ts-ignore
		logger.debug(Action, ItemID0, ItemID1)
		/*
		// Swap Stories (aka SegmentLine ## TODO ##Lines)
		let ro = getRO(Action.RunningOrderID)

		let segmentLine0 = getSegmentLine(Action.RunningOrderID, Action.StoryID, ItemID0)
		let segmentLine1 = getSegmentLine(Action.RunningOrderID, Action.StoryID, ItemID1)

		Segments.update(segmentLine0._id, {$set: {_rank: segmentLine1._rank}})
		Segments.update(segmentLine1._id, {$set: {_rank: segmentLine0._rank}})
		*/
	}
	export function mosRoReadyToAir (id: string, token: string, Action: MOS.IMOSROReadyToAir) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReadyToAir ' + Action.ID)

		let ro = getRO(Action.ID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action)
		// Set the ready to air status of a Running Order

		RunningOrders.update(ro._id, {$set: {
			airStatus: Action.Status
		}})

	}
	export function mosRoFullStory (id: string, token: string, story: MOS.IMOSROFullStory ) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoFullStory ' + story.ID)

		let ro = getRO(story.RunningOrderId)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)

		fixIllegalObject(story)
		// @ts-ignore
		// logger.debug(story)
		// Update db with the full story:
		// let segment = getSegment(story.RunningOrderId, story.ID)
		let segmentLine = getSegmentLine(story.RunningOrderId, story.ID)

		// cache the Data
		ro.saveCache(CachePrefix.FULLSTORY + segmentLine._id, story)
		const changed = updateStory(ro, segmentLine, story)

		const segment = segmentLine.getSegment()
		if (segment) {
			// this could be run after the segment, if we were capable of limiting that
			runPostProcessBlueprint(ro, segment)
		}

		if (changed) {
			updateTimelineFromMosData(segmentLine.runningOrderId, [ segmentLine._id ])
		}
	}
}

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.mosRoCreate] = (deviceId: string, deviceToken: string, ro: MOS.IMOSRunningOrder) => {
	return MosIntegration.mosRoCreate(deviceId, deviceToken, ro)
}
methods[PeripheralDeviceAPI.methods.mosRoReplace] = (deviceId: string, deviceToken: string, ro: MOS.IMOSRunningOrder) => {
	return MosIntegration.mosRoReplace(deviceId, deviceToken, ro)
}
methods[PeripheralDeviceAPI.methods.mosRoDelete] = (deviceId: string, deviceToken: string, runningOrderId: MOS.MosString128, force?: boolean) => {
	return MosIntegration.mosRoDelete(deviceId, deviceToken, runningOrderId, force)
}
methods[PeripheralDeviceAPI.methods.mosRoMetadata] = (deviceId: string, deviceToken: string, metadata: MOS.IMOSRunningOrderBase) => {
	return MosIntegration.mosRoMetadata(deviceId, deviceToken, metadata)
}
methods[PeripheralDeviceAPI.methods.mosRoStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSRunningOrderStatus) => {
	return MosIntegration.mosRoStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSStoryStatus) => {
	return MosIntegration.mosRoStoryStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoItemStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSItemStatus) => {
	return MosIntegration.mosRoItemStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryInsert] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) => {
	return MosIntegration.mosRoStoryInsert(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemInsert] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) => {
	return MosIntegration.mosRoItemInsert(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryReplace] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) => {
	return MosIntegration.mosRoStoryReplace(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemReplace] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) => {
	return MosIntegration.mosRoItemReplace(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryMove] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoStoryMove(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemMove] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoItemMove(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryDelete] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROAction, Stories: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoStoryDelete(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemDelete] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Items: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoItemDelete(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStorySwap] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROAction, StoryID0: MOS.MosString128, StoryID1: MOS.MosString128) => {
	return MosIntegration.mosRoStorySwap(deviceId, deviceToken, Action, StoryID0, StoryID1)
}
methods[PeripheralDeviceAPI.methods.mosRoItemSwap] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, ItemID0: MOS.MosString128, ItemID1: MOS.MosString128) => {
	return MosIntegration.mosRoItemSwap(deviceId, deviceToken, Action, ItemID0, ItemID1)
}
methods[PeripheralDeviceAPI.methods.mosRoReadyToAir] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROReadyToAir) => {
	return MosIntegration.mosRoReadyToAir(deviceId, deviceToken, Action)
}
methods[PeripheralDeviceAPI.methods.mosRoFullStory] = (deviceId: string, deviceToken: string, story: MOS.IMOSROFullStory) => {
	return MosIntegration.mosRoFullStory(deviceId, deviceToken, story)
}
// Apply methods:
setMeteorMethods(wrapMethods(methods))
