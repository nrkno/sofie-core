import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { getCurrentTime } from '../../lib/lib'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { logger } from '../logging'
<<<<<<< HEAD
=======
import { getRunStoryContext, loadBlueprints, StoryResult, postProcessSegmentLineAdLibItems, postProcessSegmentLineItems, PostProcessResult, getPostProcessContext } from './templates/templates'
import { getHash } from '../lib'
>>>>>>> feat: Refactor blueprint contexts so be different per type to limit exposed api
import { Timeline } from '../../lib/collections/Timeline'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { ServerPlayoutAPI, afterUpdateTimeline } from './playout'
import { syncFunction } from '../codeControl'
import { setMeteorMethods, wrapMethods, Methods } from '../methods'

// import {ServerPeripheralDeviceAPIMOS as MOS} from './peripheralDeviceMos'
export namespace ServerPeripheralDeviceAPI {
	export function initialize (id: string, token: string, options: PeripheralDeviceAPI.InitOptions): string {
		check(id, String)
		check(token, String)
		check(options, Object)
		check(options.name, String)
		check(options.type, Number)
		check(options.parentDeviceId, Match.Optional(String))
		check(options.versions, Match.Optional(Object))

		logger.debug('Initialize device ' + id, options)

		let peripheralDevice
		try {
			peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

			PeripheralDevices.update(id, {
				$set: {
					lastSeen: getCurrentTime(),
					lastConnected: getCurrentTime(),
					connected: true,
					connectionId: options.connectionId,
					type: options.type,
					name: options.name,
					parentDeviceId: options.parentDeviceId,
					versions: options.versions,
				}
			})
		} catch (e) {
			if ((e as Meteor.Error).error === 404) {
				PeripheralDevices.insert({
					_id: id,
					created: getCurrentTime(),
					status: {
						statusCode: PeripheralDeviceAPI.StatusCode.UNKNOWN
					},
					studioInstallationId: '',
					connected: true,
					connectionId: options.connectionId,
					lastSeen: getCurrentTime(),
					lastConnected: getCurrentTime(),
					token: token,
					type: options.type,
					name: options.name,
					parentDeviceId: options.parentDeviceId,
					versions: options.versions,
					// settings: {}
				})
			} else {
				throw e
			}
		}
		return id
	}
	export function unInitialize (id: string, token: string): string {

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// TODO: Add an authorization for this?

		PeripheralDevices.remove(id)
		return id
	}
	export function setStatus (id: string, token: string, status: PeripheralDeviceAPI.StatusObject): PeripheralDeviceAPI.StatusObject {
		check(id, String)
		check(token, String)
		check(status, Object)
		check(status.statusCode, Number)
		logger.debug('setStatus', status.statusCode)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// check if we have to update something:
		if (!_.isEqual(status, peripheralDevice.status)) {
			// perform the update:
			PeripheralDevices.update(id, {$set: {
				status: status
			}})
		}
		return status
	}
	export function ping (id: string, token: string ): void {
		check(id, String)
		check(token, String)

		// logger.debug('device ping', id)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// Update lastSeen
		PeripheralDevices.update(id, {$set: {
			lastSeen: getCurrentTime()
		}})
	}
	export function getPeripheralDevice (id: string, token: string) {
		return PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
	}
	export const timelineTriggerTime = syncFunction(function timelineTriggerTime (id: string, token: string, results: PeripheralDeviceAPI.TimelineTriggerTimeResult) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// check(r.time, Number)
		check(results, Array)
		_.each(results, (o) => {
			check(o.id, String)
			check(o.time, Number)
		})

		let studioIds: {[studioId: string]: true} = {}

		_.each(results, (o) => {
			check(o.id, String)

			// check(o.time, Number)
			logger.info('Timeline: Setting time: "' + o.id + '": ' + o.time)

			let obj = Timeline.findOne(o.id)

			if (obj) {
				studioIds[obj.siId] = true

				Timeline.update({
					_id: o.id
				}, {$set: {
					'trigger.value': o.time,
					'trigger.setFromNow': true
				}},{
					multi: true
				})
			}

			// Meteor.call('playout_timelineTriggerTimeUpdate', o.id, o.time)
			ServerPlayoutAPI.timelineTriggerTimeUpdateCallback(o.id, o.time)
		})

		// After we've updated the timeline, we must call afterUpdateTimeline!
		_.each(studioIds, (_val, studioId) => {
			let studio = StudioInstallations.findOne(studioId)
			if (studio) {
				afterUpdateTimeline(studio)
			}
		})
	}, 'timelineTriggerTime$0,$1')
	export function segmentLinePlaybackStarted (id: string, token: string, r: PeripheralDeviceAPI.SegmentLinePlaybackStartedResult) {
		// This is called from the playout-gateway when an auto-next event occurs
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.roId, String)
		check(r.slId, String)

		// Meteor.call('playout_segmentLinePlaybackStart', r.roId, r.slId, r.time)
		ServerPlayoutAPI.slPlaybackStartedCallback(r.roId, r.slId, r.time)
	}
	export function segmentLineItemPlaybackStarted (id: string, token: string, r: PeripheralDeviceAPI.SegmentLineItemPlaybackStartedResult) {
		// This is called from the playout-gateway when an auto-next event occurs
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.roId, String)
		check(r.sliId, String)

		// Meteor.call('playout_segmentLineItemPlaybackStart', r.roId, r.sliId, r.time)
		ServerPlayoutAPI.sliPlaybackStartedCallback(r.roId, r.sliId, r.time)
	}
	export function pingWithCommand (id: string, token: string, message: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err, res) => {
			if (err) {
				logger.warn(err)
			}
		}, 'pingResponse', message)

		ServerPeripheralDeviceAPI.ping(id, token)
	}
	export function killProcess (id: string, token: string, really: boolean) {
		// This is used in integration tests only
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		// Make sure this never runs if this server isn't empty:
		if (RunningOrders.find().count()) throw new Meteor.Error(400, 'Unable to run killProcess: RunningOrders not empty!')

		if (really) {
			this.logger.info('KillProcess command received from ' + peripheralDevice._id + ', shutting down in 1000ms!')
			setTimeout(() => {
				process.exit(0)
			}, 1000)
			return true
		}
		return false
	}
	export function testMethod (id: string, token: string, returnValue: string, throwError?: boolean): string {
		// used for integration tests with core-connection
		check(id, String)
		check(token, String)
		check(returnValue, String)

		// logger.debug('device ping', id)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		if (throwError) {
			throw new Meteor.Error(418, 'Error thrown, as requested')
		} else {
			return returnValue
		}
	}
	export const executeFunction: (deviceId: string, functionName: string, ...args: any[]) => any = Meteor.wrapAsync((deviceId: string, functionName: string, ...args: any[]) => {
		let args0 = args.slice(0, -1)
		let cb = args.slice(-1)[0] // the last argument in ...args
		PeripheralDeviceAPI.executeFunction(deviceId, cb, functionName, ...args0)
	})
}

/**
 * Insert a Story (aka a Segment) into the database
 * @param story The story to be inserted
 * @param runningOrderId The Running order id to insert into
 * @param rank The rank (position) to insert at
 */
// export function insertSegment (story: IMOSROStory, runningOrderId: string, rank: number) {
// 	let segment = convertToSegment(story, rank)
// 	Segments.upsert(segment._id, {$set: _.omit(segment,['_id']) })
// 	afterInsertUpdateSegment(story, runningOrderId)
// }
/**
 * After a Story (aka a Segment) has been inserted / updated, handle its contents
 * @param story The Story that was inserted / updated
 * @param runningOrderId Id of the Running Order that contains the story
 */
// export function afterInsertUpdateSegment (story: IMOSROStory, runningOrderId: string) {
	// Save Items (#####) into database:

	/*
	let segment = convertToSegment(story, runningOrderId, 0)
	let rank = 0
	saveIntoDb(SegmentLines, {
		runningOrderId: runningOrderId,
		segmentId: segment._id
	}, _.map(story.Items, (item: IMOSItem) => {
		return convertToSegmentLine(item, runningOrderId, segment._id, rank++)
	}), {
		afterInsert (o) {
			let item: IMOSItem | undefined = _.find(story.Items, (s) => { return s.ID.toString() === o.mosId } )
			if (item) {
				afterInsertUpdateSegmentLine(item, runningOrderId, segment._id)
			} else throw new Meteor.Error(500, 'Item not found (it should have been)')
		},
		afterUpdate (o) {
			let item: IMOSItem | undefined = _.find(story.Items, (s) => { return s.ID.toString() === o.mosId } )
			if (item) {
				afterInsertUpdateSegmentLine(item, runningOrderId, segment._id)
			} else throw new Meteor.Error(500, 'Item not found (it should have been)')
		},
		afterRemove (o) {
			afterRemoveSegmentLine(o._id)
		}
	})
	*/
<<<<<<< HEAD
// }
=======
}
/**
 * After a Segment has beed removed, handle its contents
 * @param segmentId Id of the Segment
 * @param runningOrderId Id of the Running order
 */
export function afterRemoveSegment (segmentId: string, runningOrderId: string) {
	// Remove the segment lines:
	saveIntoDb(SegmentLines, {
		runningOrderId: runningOrderId,
		segmentId: segmentId
	},[],{
		remove (segmentLine) {
			removeSegmentLine(segmentLine.runningOrderId, segmentLine)
		}
	})
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
export function removeSegmentLine (roId: string, segmentLineOrId: DBSegmentLine | string, replacedBySegmentLine?: DBSegmentLine) {
	let segmentLineToRemove: DBSegmentLine | undefined = (
		_.isString(segmentLineOrId) ?
			SegmentLines.findOne(segmentLineOrId) :
			segmentLineOrId
	)
	if (segmentLineToRemove) {
		SegmentLines.remove(segmentLineToRemove._id)
		afterRemoveSegmentLine(segmentLineToRemove, replacedBySegmentLine)
		updateTimelineFromMosData(roId)

		if (replacedBySegmentLine) {
			SegmentLines.update({
				runningOrderId: segmentLineToRemove.runningOrderId,
				afterSegmentLine: segmentLineToRemove._id
			}, {
				$set: {
					afterSegmentLine: replacedBySegmentLine._id,
				}
			}, {
				multi: true
			})
		} else {
			SegmentLines.remove({
				runningOrderId: segmentLineToRemove.runningOrderId,
				afterSegmentLine: segmentLineToRemove._id
			})
		}
	}
}
export function afterInsertUpdateSegmentLine (story: IMOSStory, runningOrderId: string) {
	// TODO: create segmentLineItems

	// use the Template-generator to generate the segmentLineItems
	// and put them into the db
}
export function afterRemoveSegmentLine (removedSegmentLine: DBSegmentLine, replacedBySegmentLine?: DBSegmentLine) {
	SegmentLineItems.remove({
		segmentLineId: removedSegmentLine._id
	})

	let ro = RunningOrders.findOne(removedSegmentLine.runningOrderId)
	if (ro) {
		// If the replaced segment is next-to-be-played out,
		// instead make the next-to-be-played-out item the one in it's place
		if (
			ro.active &&
			ro.nextSegmentLineId === removedSegmentLine._id
		) {
			if (!replacedBySegmentLine) {
				let segmentLineBefore = fetchBefore(SegmentLines, {
					runningOrderId: removedSegmentLine.runningOrderId
				}, removedSegmentLine._rank)

				let nextSegmentLineInLine = fetchAfter(SegmentLines, {
					runningOrderId: removedSegmentLine.runningOrderId,
					_id: {$ne: removedSegmentLine._id}
				}, segmentLineBefore ? segmentLineBefore._rank : null)

				if (nextSegmentLineInLine) {
					replacedBySegmentLine = nextSegmentLineInLine
				}
			}
			ServerPlayoutAPI.roSetNext(ro._id, replacedBySegmentLine ? replacedBySegmentLine._id : null)
		}
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

function findDurationInfoMOSExternalMetaData (story: IMOSROFullStory): any | undefined {
	if (story.MosExternalMetaData) {
		let matchingMetaData = story.MosExternalMetaData.find((metaData) => {
			if (metaData.MosSchema.match(/http(s)?:\/\/[\d\w\.\:]+\/schema\/enps.dtd$/)) {
				return true
			}
			return false
		})
		if (matchingMetaData) {
			return matchingMetaData
		}
	}
	return undefined
}

export function updateSegmentLines (runningOrderId: string) {
	let segmentLines0 = SegmentLines.find({runningOrderId: runningOrderId}, {sort: {_rank: 1}}).fetch()

	let segmentLines: Array<SegmentLine> = []
	let segmentLinesToInsert: {[id: string]: Array<SegmentLine>} = {}

	_.each(segmentLines0, (sl) => {
		if (sl.afterSegmentLine) {
			if (!segmentLinesToInsert[sl.afterSegmentLine]) segmentLinesToInsert[sl.afterSegmentLine] = []
			segmentLinesToInsert[sl.afterSegmentLine].push(sl)
		} else {
			segmentLines.push(sl)
		}
	})

	let hasAddedAnything = true
	while (hasAddedAnything) {
		hasAddedAnything = false

		_.each(segmentLinesToInsert, (sls, slId) => {

			let segmentLineBefore: SegmentLine | null = null
			let segmentLineAfter: SegmentLine | null = null
			let insertI = -1
			_.each(segmentLines, (sl, i) => {
				if (sl._id === slId) {
					segmentLineBefore = sl
					insertI = i + 1
				} else if (segmentLineBefore && !segmentLineAfter) {
					segmentLineAfter = sl
				}
			})

			if (segmentLineBefore) {

				if (insertI !== -1) {
					_.each(sls, (sl, i) => {
						let newRank = getRank(segmentLineBefore, segmentLineAfter, i, sls.length)

						if (sl._rank !== newRank) {
							sl._rank = newRank
							SegmentLines.update(sl._id, {$set: {_rank: sl._rank}})
						}
						segmentLines.splice(insertI, 0, sl)
						insertI++
						hasAddedAnything = true
					})
				}
				delete segmentLinesToInsert[slId]
			}
		})
	}

	return segmentLines
}
function updateSegments (runningOrderId: string) {
	// using SegmentLines, determine which segments are to be created
	// let segmentLines = SegmentLines.find({runningOrderId: runningOrderId}, {sort: {_rank: 1}}).fetch()
	let segmentLines = updateSegmentLines(runningOrderId)

	let prevSlugParts: string[] = []
	let segment: DBSegment
	let segments: Array<DBSegment> = []
	let rankSegment = 0
	let segmentLineUpdates = {}
	_.each(segmentLines, (segmentLine: SegmentLine) => {
		let slugParts = segmentLine.slug.split(';')

		if (slugParts[0] !== prevSlugParts[0]) {
			segment = convertToSegment(segmentLine, rankSegment++)
			segments.push(segment)
		}
		if (segmentLine.segmentId !== segment._id) {
			logger.debug(segmentLine)
			logger.debug(segmentLine._id + ' old segmentId: ' + segmentLine.segmentId + ', new: ' + segment._id )
			segmentLineUpdates[segmentLine._id] = { segmentId: segment._id }
		}

		prevSlugParts = slugParts
	})

	// Update SegmentLines:
	_.each(segmentLineUpdates, (modifier, id) => {
		logger.info('added SegmentLine to segment ' + modifier['segmentId'])
		SegmentLines.update(id, {$set: modifier})
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
function updateAffectedSegmentLines (ro: RunningOrder, affectedSegmentLineIds: Array<string>) {

	// Update the affected segments:
	let affectedSegmentIds = _.uniq(
		_.pluck(
			SegmentLines.find({ // fetch assigned segmentIds
				_id: {$in: affectedSegmentLineIds} // _.pluck(affectedSegmentLineIds, '_id')}
			}).fetch(),
		'segmentId')
	)

	let changed = false
	_.each(affectedSegmentIds, (segmentId) => {
		changed = changed || updateWithinSegment(ro, segmentId )
	})

	if (changed) {
		updateTimelineFromMosData(ro._id, affectedSegmentLineIds)
	}
}
function updateWithinSegment (ro: RunningOrder, segmentId: string): boolean {
	let segment = Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, 'Segment "' + segmentId + '" not found!')

	let segmentLines = ro.getSegmentLines({
		segmentId: segment._id
	})

	let changed = false
	_.each(segmentLines, (segmentLine) => {
		let story = ro.fetchCache(CachePrefix.FULLSTORY + segmentLine._id)
		if (story) {
			changed = changed || updateStory(ro, segmentLine, story)
		} else {
			logger.warn('Unable to update segmentLine "' + segmentLine._id + '", story cache not found')
		}
	})

	runPostProcessTemplate(ro, segment)

	return changed
}
function runPostProcessTemplate (ro: RunningOrder, segment: Segment) {
	let showStyle = ShowStyles.findOne(ro.showStyleId)
	if (!showStyle) throw new Meteor.Error(404, 'ShowStyle "' + ro.showStyleId + '" not found!')

	const segmentLines = segment.getSegmentLines()
	if (segmentLines.length === 0) {
		return
	}

	const firstSegmentLine = segmentLines.sort((a, b) => b._rank = a._rank)[0]

	const context = getPostProcessContext(ro, firstSegmentLine)

	let result: PostProcessResult | undefined = undefined
	let notes: SegmentLineNote[] = []
	try {
		const blueprints = loadBlueprints(showStyle)
		result = blueprints.PostProcess(context)
		result.SegmentLineItems = postProcessSegmentLineItems(context, result.SegmentLineItems, 'post-process', firstSegmentLine._id)
		notes = context.getNotes()

	} catch (e) {
		logger.error(e.toString())
		// throw e
		notes = [{
			type: SegmentLineNoteType.ERROR,
			origin: {
				name: '',
				roId: context.runningOrderId,
				segmentId: firstSegmentLine.segmentId,
				segmentLineId: '',
			},
			message: 'Internal Server Error'
		}]
		result = undefined
	}

	const slIds = segmentLines.map(sl => sl._id)

	let changedSli: {
		added: number,
		updated: number,
		removed: number
	} = {
		added: 0,
		updated: 0,
		removed: 0
	}
	if (notes) {
		Segments.update(segment._id, {$set: {
			notes: notes,
		}})
	}

	if (result) {

		if (result.SegmentLineItems) {
			result.SegmentLineItems.forEach(sli => {
				sli.fromPostProcess = true
			})
		}

		changedSli = saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
			runningOrderId: ro._id,
			segmentLineId: { $in: slIds },
			fromPostProcess: true,
		}, (result.SegmentLineItems || []) as SegmentLineItem[], {
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
	}

	// if anything was changed
	return (changedSli.added > 0 || changedSli.removed > 0 || changedSli.updated > 0)
}

const updateStory: (ro: RunningOrder, segmentLine: SegmentLine, story: IMOSROFullStory) => boolean
= syncFunction(function updateStory (ro: RunningOrder, segmentLine: SegmentLine, story: IMOSROFullStory): boolean {
	let showStyle = ShowStyles.findOne(ro.showStyleId)
	if (!showStyle) throw new Meteor.Error(404, 'ShowStyle "' + ro.showStyleId + '" not found!')

	const context = getRunStoryContext(ro, segmentLine, story)

	let result: StoryResult | null = null
	let notes: SegmentLineNote[] = []
	try {
		const blueprints = loadBlueprints(showStyle)
		result = blueprints.RunStory(context, story)

		if (result) {
			result.AdLibItems = postProcessSegmentLineAdLibItems(context, result.AdLibItems, result.SegmentLine.typeVariant, segmentLine._id)
			result.SegmentLineItems = postProcessSegmentLineItems(context, result.SegmentLineItems, result.SegmentLine.typeVariant, segmentLine._id)
		}

		notes = context.getNotes()
	} catch (e) {
		logger.error(e.stack ? e.stack : e.toString())
		// throw e
		notes = [{
			type: SegmentLineNoteType.ERROR,
			origin: {
				name: '',
				roId: context.runningOrderId,
				segmentId: context.segmentLine.segmentId,
				segmentLineId: context.segmentLine._id,
			},
			message: 'Internal Server Error'
		}],
		result = null
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

	if (result) {

		if (result.SegmentLine) {
			// if (!result.SegmentLine.typeVariant) result.SegmentLine.typeVariant = tr.templateId
			SegmentLines.update(segmentLine._id, {$set: {
				expectedDuration:		result.SegmentLine.expectedDuration || 0,
				notes: 					notes,
				autoNext: 				result.SegmentLine.autoNext || false,
				autoNextOverlap: 		result.SegmentLine.autoNextOverlap || 0,
				overlapDuration: 		result.SegmentLine.overlapDuration || 0,
				transitionDelay: 		result.SegmentLine.transitionDelay || '',
				transitionDuration: 	result.SegmentLine.transitionDuration || 0,
				disableOutTransition: 	result.SegmentLine.disableOutTransition || false,
				updateStoryStatus:		result.SegmentLine.updateStoryStatus || false,
				typeVariant:			result.SegmentLine.typeVariant || '',
				subTypeVariant:			result.SegmentLine.subTypeVariant || '',
				holdMode: 				result.SegmentLine.holdMode || SegmentLineHoldMode.NONE,
			}})
		} else {
			SegmentLines.update(segmentLine._id, {$set: {
				notes: notes,
			}})
		}
		changedSli = saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
			runningOrderId: ro._id,
			segmentLineId: segmentLine._id,
			dynamicallyInserted: { $ne: true } // do not affect dynamically inserted items (such as adLib items)
		}, (result.SegmentLineItems || []) as SegmentLineItem[], {
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
			segmentLineId: segmentLine._id
		}, result.AdLibItems || [], {
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
	} else {
		SegmentLines.update(segmentLine._id, {$set: {
			notes: notes,
		}})
	}

	// if anything was changed
	return (changedSli.added > 0 || changedSli.removed > 0 || changedSli.updated > 0)
	// return this.core.mosManipulate(P.methods.mosRoReadyToAir, story)
})
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
>>>>>>> feat: Refactor blueprint contexts so be different per type to limit exposed api

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.initialize] = (deviceId, deviceToken, options) => {
	return ServerPeripheralDeviceAPI.initialize(deviceId, deviceToken, options)
}
methods[PeripheralDeviceAPI.methods.unInitialize] = (deviceId, deviceToken) => {
	return ServerPeripheralDeviceAPI.unInitialize(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.setStatus] = (deviceId, deviceToken, status) => {
	return ServerPeripheralDeviceAPI.setStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.ping] = (deviceId, deviceToken) => {
	return ServerPeripheralDeviceAPI.ping(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.getPeripheralDevice ] = (deviceId, deviceToken) => {
	return ServerPeripheralDeviceAPI.getPeripheralDevice(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.segmentLinePlaybackStarted] = (deviceId, deviceToken, r: PeripheralDeviceAPI.SegmentLinePlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.segmentLinePlaybackStarted(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.segmentLineItemPlaybackStarted] = (deviceId, deviceToken, r: PeripheralDeviceAPI.SegmentLineItemPlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.segmentLineItemPlaybackStarted(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.pingWithCommand] = (deviceId, deviceToken, message: string) => {
	return ServerPeripheralDeviceAPI.pingWithCommand(deviceId, deviceToken, message)
}
methods[PeripheralDeviceAPI.methods.killProcess] = (deviceId, deviceToken, really: boolean) => {
	return ServerPeripheralDeviceAPI.killProcess(deviceId, deviceToken, really)
}
methods[PeripheralDeviceAPI.methods.testMethod] = (deviceId, deviceToken, returnValue, throwError ) => {
	return ServerPeripheralDeviceAPI.testMethod(deviceId, deviceToken, returnValue, throwError)
}
methods[PeripheralDeviceAPI.methods.timelineTriggerTime] = (deviceId, deviceToken, r: PeripheralDeviceAPI.TimelineTriggerTimeResult) => {
	return ServerPeripheralDeviceAPI.timelineTriggerTime(deviceId, deviceToken, r)
}

// --------------------
methods[PeripheralDeviceAPI.methods.functionReply] = (deviceId, deviceToken, commandId, err: any, result: any) => {
	// logger.debug('functionReply', err, result)
	PeripheralDeviceCommands.update(commandId, {
		$set: {
			hasReply: true,
			reply: result,
			replyError: err,
			replyTime: getCurrentTime()
		}
	})
}

// Apply methods:
setMeteorMethods(wrapMethods(methods))

// temporary functions:
setMeteorMethods({
	'temporaryRemovePeripheralDevice' (id: string) {
		// TODO: Replace this function with an authorized one
		PeripheralDevices.remove(id)
		return id
	}
})
