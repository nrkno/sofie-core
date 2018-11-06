import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import {
	MosString128,
	MosTime,
	MosDuration,
	IMOSRunningOrder,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSROAction,
	IMOSItemAction,
	IMOSItem,
	IMOSROReadyToAir,
	IMOSROFullStory,
	IMOSStory,
	IMOSObjectStatus
} from 'mos-connection'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevices, PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { RunningOrder, RunningOrders, DBRunningOrder } from '../../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines, DBSegmentLine, SegmentLineHoldMode, SegmentLineNoteType } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { DBSegment } from '../../../lib/collections/Segments'
import { saveIntoDb, partialExceptId, getCurrentTime, literal, fetchBefore, getRank, fetchAfter } from '../../../lib/lib'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import { logger } from '../../logging'
import { runTemplate, TemplateContext, RunTemplateResult, TemplateResultAfterPost } from '../templates/templates'
import { getHash } from '../../lib'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { SegmentLineAdLibItem, SegmentLineAdLibItems } from '../../../lib/collections/SegmentLineAdLibItems'
import { ShowStyles, ShowStyle } from '../../../lib/collections/ShowStyles'
import { ServerPlayoutAPI, updateTimelineFromMosData } from '../playout'
import { CachePrefix } from '../../../lib/collections/RunningOrderDataCache'
import { setMeteorMethods, wrapMethods, Methods } from '../../methods'
import { afterRemoveSegmentLine, updateSegments, updateAffectedSegmentLines, removeSegmentLine, runPostProcessTemplate, ServerRunningOrderAPI } from '../runningOrder'

export function roId (roId: MosString128, original?: boolean): string {
	// logger.debug('roId', roId)
	if (!roId) throw new Meteor.Error(401, 'parameter roId missing!')
	let id = 'ro_' + (roId['_str'] || roId.toString())
	return (original ? id : getHash(id))
}
export function segmentLineId (runningOrderId: string, storyId: MosString128): string {
	let id = runningOrderId + '_' + storyId.toString()
	return getHash(id)
}

/**
 * Returns a Running order, throws error if not found
 * @param roId Id of the Running order
 */
export function getRO (roID: MosString128): RunningOrder {
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
// export function getSegment (roID: MosString128, storyID: MosString128, rank: number): Segment {
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
export function getSegmentLine (roID: MosString128, storyID: MosString128): SegmentLine {
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
export function convertToSegmentLine (story: IMOSStory, runningOrderId: string, rank: number): DBSegmentLine {
	return {
		_id: segmentLineId(runningOrderId, story.ID),
		runningOrderId: runningOrderId,
		segmentId: '', // to be coupled later
		_rank: rank,
		mosId: story.ID.toString(),
		slug: (story.Slug || '').toString()
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
export function upsertSegmentLine (story: IMOSStory, runningOrderId: string, rank: number): DBSegmentLine {
	let sl = convertToSegmentLine(story, runningOrderId, rank)
	SegmentLines.upsert(sl._id, {$set: sl}) // insert, or update
	afterInsertUpdateSegmentLine(story, runningOrderId)
	return sl
}
export function afterInsertUpdateSegmentLine (story: IMOSStory, runningOrderId: string) {
	// TODO: create segmentLineItems

	// use the Template-generator to generate the segmentLineItems
	// and put them into the db
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
		// first try and parse it as a MosDuration timecode string
		return duration ? new MosDuration(duration.toString()).valueOf() * 1000 : undefined
	} catch (e) {
		try {
			// second try and parse it as a length in seconds
			return duration ? Number.parseFloat(duration) * 1000 : undefined
		} catch (e2) {
			logger.warn('Bad MosDuration: "' + duration + '"', e)
			return undefined
		}
	}
}
function formatTime (time: any): number | undefined {
	try {
		return time ? new MosTime(time.toString()).getTime() : undefined
	} catch (e) {
		logger.warn('Bad MosTime: "' + time + '"', e)
		return undefined
	}
}
export function updateStory (ro: RunningOrder, segmentLine: SegmentLine, story: IMOSROFullStory): boolean {
	let showStyle = ShowStyles.findOne(ro.showStyleId)
	if (!showStyle) throw new Meteor.Error(404, 'ShowStyle "' + ro.showStyleId + '" not found!')

	let context: TemplateContext = {
		noCache: false,
		runningOrderId: ro._id,
		runningOrder: ro,
		studioId: ro.studioInstallationId,
		// segment: Segment,
		segmentLine: segmentLine,
		templateId: 'N/A'
	}
	let tr: RunTemplateResult | undefined
	try {
		tr = runTemplate(showStyle, context, story, 'story ' + story.ID.toString())
	} catch (e) {
		logger.error(e.stack ? e.stack : e.toString())
		// throw e
		tr = {
			templateId: '',
			result: {
				notes: [{
					type: SegmentLineNoteType.ERROR,
					origin: {
						name: '',
						roId: context.runningOrderId,
						segmentId: context.segmentLine.segmentId,
						segmentLineId: context.segmentLine._id,
					},
					message: 'Internal Server Error'
				}],
				segmentLine: null, 			// DBSegmentLine | null,
				segmentLineItems: [], 		// Array<SegmentLineItem> | null
				segmentLineAdLibItems: [], 	// Array<SegmentLineAdLibItem> | null
				baselineItems: [] 			// Array<RunningOrderBaselineItem> | null
			}
		}
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
	if (tr) {

		if (tr.result.segmentLine) {
			if (!tr.result.segmentLine.typeVariant) tr.result.segmentLine.typeVariant = tr.templateId
			SegmentLines.update(segmentLine._id, {$set: {
				expectedDuration:		tr.result.segmentLine.expectedDuration || 0,
				notes: 					tr.result.notes,
				autoNext: 				tr.result.segmentLine.autoNext || false,
				autoNextOverlap: 		tr.result.segmentLine.autoNextOverlap || 0,
				overlapDuration: 		tr.result.segmentLine.overlapDuration || 0,
				transitionDelay: 		tr.result.segmentLine.transitionDelay || '',
				transitionDuration: 	tr.result.segmentLine.transitionDuration || 0,
				disableOutTransition: 	tr.result.segmentLine.disableOutTransition || false,
				updateStoryStatus:		tr.result.segmentLine.updateStoryStatus || false,
				typeVariant:			tr.result.segmentLine.typeVariant || '',
				subTypeVariant:			tr.result.segmentLine.subTypeVariant || '',
				holdMode: 				tr.result.segmentLine.holdMode || SegmentLineHoldMode.NONE,
			}})
		} else {
			SegmentLines.update(segmentLine._id, {$set: {
				notes: 					tr.result.notes,
			}})
		}
		changedSli = saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
			runningOrderId: ro._id,
			segmentLineId: segmentLine._id,
			dynamicallyInserted: { $ne: true } // do not affect dynamically inserted items (such as adLib items)
		}, tr.result.segmentLineItems || [], {
			afterInsert (segmentLineItem) {
				logger.debug('inserted segmentLineItem ' + segmentLineItem._id)
				logger.debug(segmentLineItem)
				// @todo: have something here?
				// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
					// afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (segmentLineItem) {
				logger.debug('updated segmentLineItem ' + segmentLineItem._id)
				// @todo: have something here?
				// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
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
		saveIntoDb<SegmentLineAdLibItem, SegmentLineAdLibItem>(SegmentLineAdLibItems, {
			runningOrderId: ro._id,
			segmentLineId: segmentLine._id,
			fromPostProcess: { $ne: true }, // do not affect postProcess items
		}, tr.result.segmentLineAdLibItems || [], {
			afterInsert (segmentLineAdLibItem) {
				logger.debug('inserted segmentLineAdLibItem ' + segmentLineAdLibItem._id)
				logger.debug(segmentLineAdLibItem)
				// @todo: have something here?
				// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// afterInsertUpdateSegment (story, roId(ro.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (segmentLineAdLibItem) {
				logger.debug('updated segmentLineItem ' + segmentLineAdLibItem._id)
				// @todo: have something here?
				// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
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

	// if anything was changed
	return (changedSli.added > 0 || changedSli.removed > 0 || changedSli.updated > 0)
	// return this.core.mosManipulate(P.methods.mosRoReadyToAir, story)
}
export function sendStoryStatus (ro: RunningOrder, takeSegmentLine: SegmentLine | null) {

	if (ro.currentPlayingStoryStatus) {
		setStoryStatus(ro.mosDeviceId, ro, ro.currentPlayingStoryStatus, IMOSObjectStatus.STOP)
		.catch(e => logger.error(e))
	}
	if (takeSegmentLine) {
		setStoryStatus(ro.mosDeviceId, ro, takeSegmentLine.mosId, IMOSObjectStatus.PLAY)
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
function setStoryStatus (deviceId: string, ro: RunningOrder, storyId: string, status: IMOSObjectStatus): Promise<any> {
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
	function reloadRunningOrder (runningOrder: RunningOrder, cb: (err) => void) {
		logger.info('reloadRunningOrder ' + runningOrder._id)

		if (!runningOrder.mosDeviceId) throw new Meteor.Error(400,'runningOrder.mosDeviceId missing!')
		check(runningOrder.mosDeviceId, String)

		let peripheralDevice = PeripheralDevices.findOne(runningOrder.mosDeviceId) as PeripheralDevice
		if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + runningOrder.mosDeviceId + '" not found' )

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err: any, ro: IMOSRunningOrder) => {
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
function handleRunningOrderData (ro: IMOSRunningOrder, peripheralDevice: PeripheralDevice, dataSource: string) {
	// Create or update a runningorder (ie from roCreate or roList)

	let existingDbRo = RunningOrders.findOne(roId(ro.ID))
	if (!isAvailableForMOS(existingDbRo)) return
	updateMosLastDataReceived(peripheralDevice._id)
	logger.info((existingDbRo ? 'Updating' : 'Adding') + ' RO ' + roId(ro.ID))

	if (!peripheralDevice.studioInstallationId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no StudioInstallation')

	let studioInstallation = StudioInstallations.findOne(peripheralDevice.studioInstallationId) as StudioInstallation
	if (!studioInstallation) throw new Meteor.Error(404, 'StudioInstallation "' + peripheralDevice.studioInstallationId + '" not found')

	let showStyle = ShowStyles.findOne(studioInstallation.defaultShowStyle) as ShowStyle || {}

	let dbROData: DBRunningOrder = _.extend(existingDbRo || {},
		{
			_id: roId(ro.ID),
			mosId: ro.ID.toString(),
			studioInstallationId: studioInstallation._id,
			mosDeviceId: peripheralDevice._id,
			showStyleId: showStyle._id,
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
	_.each(ro.Stories, (story: IMOSStory) => {
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
			// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
			// if (story) {
				// afterInsertUpdateSegment (story, roId(ro.ID))
			// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
		},
		afterUpdate (segmentLine) {
			// logger.debug('updated segmentLine ' + segmentLine._id)
			// @todo: have something here?
			// let story: IMOSROStory | undefined = _.find(ro.Stories, (s) => { return s.ID.toString() === segment.mosId } )
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
	export function mosRoCreate (id, token, ro: IMOSRunningOrder) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		// logger.debug('mosRoCreate', ro)
		logger.info('mosRoCreate ' + ro.ID)
		logger.debug(ro)

		handleRunningOrderData(ro, peripheralDevice, 'roCreate')
	}
	export function mosRoReplace (id, token, ro: IMOSRunningOrder) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReplace ' + ro.ID)
		// @ts-ignore
		logger.debug(ro)
		handleRunningOrderData(ro, peripheralDevice, 'roReplace')
	}
	export function mosRoDelete (id, token, runningOrderId: MosString128, force?: boolean) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoDelete ' + runningOrderId)

		let ro = getRO(runningOrderId)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)
		logger.info('Removing RO ' + roId(runningOrderId))

		if (ro) {
			if (!ro.active || force === true) {
				ServerRunningOrderAPI.removeRunningOrder(ro._id)
			} else {
				if (!ro.unsynced) {
					RunningOrders.update(ro._id, {$set: {
						unsynced: true,
						unsyncedTime: getCurrentTime()
					}})
				}
			}

		}
	}
	export function mosRoMetadata (id, token, roData: IMOSRunningOrderBase) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoMetadata ' + roData.ID)

		// @ts-ignore
		logger.debug(roData)
		let ro = getRO(roData.ID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)

		let m = {}
		if (roData.MosExternalMetaData) m['metaData'] = roData.MosExternalMetaData
		if (roData.Slug) 				m['name'] = roData.Slug.toString()
		if (roData.EditorialStart) 		m['expectedStart'] = formatTime(roData.EditorialStart)
		if (roData.EditorialDuration) 	m['expectedDuration'] = formatDuration(roData.EditorialDuration)

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
	export function mosRoStatus (id, token, status: IMOSRunningOrderStatus) {
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
	export function mosRoStoryStatus (id, token, status: IMOSStoryStatus) {
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
	export function mosRoItemStatus (id, token, status: IMOSItemStatus) {
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
	export function mosRoStoryInsert (id, token, Action: IMOSStoryAction, Stories: Array<IMOSROStory>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryInsert after ' + Action.StoryID)

		let ro = getRO(Action.RunningOrderID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)

		// @ts-ignore		logger.debug(
		logger.debug(Action, Stories)
		// insert a story (aka SegmentLine) before another story:
		let segmentLineAfter = (Action.StoryID ? getSegmentLine(Action.RunningOrderID, Action.StoryID) : null)

		let segmentBeforeOrLast
		let newRankMax
		let newRankMin
		if (segmentLineAfter) {
			segmentBeforeOrLast = fetchBefore(SegmentLines,
				{ runningOrderId: ro._id },
				segmentLineAfter._rank
			)
		} else {
			segmentBeforeOrLast = fetchBefore(SegmentLines,
				{ runningOrderId: ro._id },
				null
			)
		}
		let affectedSegmentLineIds: Array<string> = []
		let firstInsertedSegmentLine: DBSegmentLine | undefined
		_.each(Stories, (story: IMOSROStory, i: number) => {
			logger.info('insert story ' + story.ID)
			let rank = getRank(segmentBeforeOrLast, segmentLineAfter, i, Stories.length)
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
	export function mosRoItemInsert (id, token, Action: IMOSItemAction, Items: Array<IMOSItem>) {
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
		_.each(Items, (item: IMOSItem, i: number) => {
			let rank = getRank(segmentLineBeforeOrLast, segmentLineAfter, i, Items.length)
			// let rank = newRankMin + ( i / Items.length ) * (newRankMax - newRankMin)
			insertSegmentLine(item, ro._id, segment._id, rank)
		})
		*/
	}
	export function mosRoStoryReplace (id, token, Action: IMOSStoryAction, Stories: Array<IMOSROStory>) {
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
		_.each(Stories, (story: IMOSROStory, i: number) => {
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
	export function mosRoItemReplace (id, token, Action: IMOSItemAction, Items: Array<IMOSItem>) {
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

		_.each(Items, (item: IMOSItem, i: number) => {
			let rank = getRank (segmentLineBefore, segmentLineAfter, i, Items.length)
			insertSegmentLine(item, ro._id, rank)
		})
		*/
	}
	export function mosRoStoryMove (id, token, Action: IMOSStoryAction, Stories: Array<MosString128>) {
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

		let segmentLineAfter = getSegmentLine(Action.RunningOrderID, Action.StoryID)
		let segmentLineBefore = fetchBefore(SegmentLines, { runningOrderId: ro._id }, segmentLineAfter._rank)
		// console.log('Inserting between: ' + (segmentLineBefore ? segmentLineBefore._rank : 'X') + ' - ' + segmentLineAfter._rank)

		let affectedSegmentLineIds: Array<string> = []
		affectedSegmentLineIds.push(segmentLineAfter._id)
		if (segmentLineBefore) affectedSegmentLineIds.push(segmentLineBefore._id)
		_.each(Stories, (storyId: MosString128, i: number) => {
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
	export function mosRoItemMove (id, token, Action: IMOSItemAction, Items: Array<MosString128>) {
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

		_.each(Items, (itemId: MosString128, i: number) => {
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Items.length)
			SegmentLines.update(segmentLineId(segmentId, itemId), {$set: {
				_rank: rank
			}})
		})
		*/
	}
	export function mosRoStoryDelete (id, token, Action: IMOSROAction, Stories: Array<MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryDelete ' + Action.RunningOrderID)

		let ro = getRO(Action.RunningOrderID)
		if (!isAvailableForMOS(ro)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, Stories)
		// Delete Stories (aka SegmentLine)
		let affectedSegmentLineIds: Array<string> = []
		_.each(Stories, (storyId: MosString128, i: number) => {
			logger.debug('remove story ' + storyId)
			let slId = segmentLineId(ro._id, storyId)
			affectedSegmentLineIds.push(slId)
			removeSegmentLine(ro._id, slId)
		})
		updateSegments(ro._id)
		updateAffectedSegmentLines(ro, affectedSegmentLineIds)
	}
	export function mosRoItemDelete (id, token, Action: IMOSStoryAction, Items: Array<MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemDelete NOT IMPLEMENTED YET ' + Action.StoryID)
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// Delete Items (aka SegmentLine ## TODO ##LinesLines)
		let ro = getRO(Action.RunningOrderID)
		_.each(Items, (itemId: MosString128, i: number) => {
			removeSegmentLine( segmentLineId(segmentId(ro._id, Action.StoryID), itemId))
		})
		*/
	}
	export function mosRoStorySwap (id, token, Action: IMOSROAction, StoryID0: MosString128, StoryID1: MosString128) {
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
	export function mosRoItemSwap (id, token, Action: IMOSStoryAction, ItemID0: MosString128, ItemID1: MosString128) {
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
	export function mosRoReadyToAir (id, token, Action: IMOSROReadyToAir) {
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
	export function mosRoFullStory (id, token, story: IMOSROFullStory ) {
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
			runPostProcessTemplate(ro, segment)
		}

		if (changed) {
			updateTimelineFromMosData(segmentLine.runningOrderId, [ segmentLine._id ])
		}
	}
}

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.mosRoCreate] = (deviceId, deviceToken, ro: IMOSRunningOrder) => {
	return MosIntegration.mosRoCreate(deviceId, deviceToken, ro)
}
methods[PeripheralDeviceAPI.methods.mosRoReplace] = (deviceId, deviceToken, ro: IMOSRunningOrder) => {
	return MosIntegration.mosRoReplace(deviceId, deviceToken, ro)
}
methods[PeripheralDeviceAPI.methods.mosRoDelete] = (deviceId, deviceToken, runningOrderId: MosString128, force?: boolean) => {
	return MosIntegration.mosRoDelete(deviceId, deviceToken, runningOrderId, force)
}
methods[PeripheralDeviceAPI.methods.mosRoMetadata] = (deviceId, deviceToken, metadata: IMOSRunningOrderBase) => {
	return MosIntegration.mosRoMetadata(deviceId, deviceToken, metadata)
}
methods[PeripheralDeviceAPI.methods.mosRoStatus] = (deviceId, deviceToken, status: IMOSRunningOrderStatus) => {
	return MosIntegration.mosRoStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryStatus] = (deviceId, deviceToken, status: IMOSStoryStatus) => {
	return MosIntegration.mosRoStoryStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoItemStatus] = (deviceId, deviceToken, status: IMOSItemStatus) => {
	return MosIntegration.mosRoItemStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryInsert] = (deviceId, deviceToken, Action: IMOSStoryAction, Stories: Array<IMOSROStory>) => {
	return MosIntegration.mosRoStoryInsert(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemInsert] = (deviceId, deviceToken, Action: IMOSItemAction, Items: Array<IMOSItem>) => {
	return MosIntegration.mosRoItemInsert(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryReplace] = (deviceId, deviceToken, Action: IMOSStoryAction, Stories: Array<IMOSROStory>) => {
	return MosIntegration.mosRoStoryReplace(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemReplace] = (deviceId, deviceToken, Action: IMOSItemAction, Items: Array<IMOSItem>) => {
	return MosIntegration.mosRoItemReplace(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryMove] = (deviceId, deviceToken, Action: IMOSStoryAction, Stories: Array<MosString128>) => {
	return MosIntegration.mosRoStoryMove(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemMove] = (deviceId, deviceToken, Action: IMOSItemAction, Items: Array<MosString128>) => {
	return MosIntegration.mosRoItemMove(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryDelete] = (deviceId, deviceToken, Action: IMOSROAction, Stories: Array<MosString128>) => {
	return MosIntegration.mosRoStoryDelete(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemDelete] = (deviceId, deviceToken, Action: IMOSStoryAction, Items: Array<MosString128>) => {
	return MosIntegration.mosRoItemDelete(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStorySwap] = (deviceId, deviceToken, Action: IMOSROAction, StoryID0: MosString128, StoryID1: MosString128) => {
	return MosIntegration.mosRoStorySwap(deviceId, deviceToken, Action, StoryID0, StoryID1)
}
methods[PeripheralDeviceAPI.methods.mosRoItemSwap] = (deviceId, deviceToken, Action: IMOSStoryAction, ItemID0: MosString128, ItemID1: MosString128) => {
	return MosIntegration.mosRoItemSwap(deviceId, deviceToken, Action, ItemID0, ItemID1)
}
methods[PeripheralDeviceAPI.methods.mosRoReadyToAir] = (deviceId, deviceToken, Action: IMOSROReadyToAir) => {
	return MosIntegration.mosRoReadyToAir(deviceId, deviceToken, Action)
}
methods[PeripheralDeviceAPI.methods.mosRoFullStory] = (deviceId, deviceToken, story: IMOSROFullStory) => {
	return MosIntegration.mosRoFullStory(deviceId, deviceToken, story)
}
// Apply methods:
setMeteorMethods(wrapMethods(methods))
