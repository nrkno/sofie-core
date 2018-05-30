import { Meteor } from 'meteor/meteor'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { ShowStyle, ShowStyles } from '../../lib/collections/ShowStyles'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems, ITimelineTrigger } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItems, SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { getCurrentTime, saveIntoDb, literal, DBObj, partialExceptId, Time, partial } from '../../lib/lib'
import { RundownAPI } from '../../lib/api/rundown'
import { TimelineTransition, Timeline, TimelineObj, TimelineObjGroupSegmentLine, TimelineContentTypeOther, TimelineObjAbstract, TimelineObjGroup, TimelineContentTypeLawo } from '../../lib/collections/Timeline'
import { TimelineObject, ObjectId, TriggerType, TimelineKeyframe, TimelineGroup } from 'superfly-timeline'
import { Transition, Ease, Direction } from '../../lib/constants/casparcg'
import { Segment, Segments } from '../../lib/collections/Segments'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from './../logging'
import { PeripheralDevice, PeripheralDevices, PlayoutDeviceSettings } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { IMOSRunningOrder } from 'mos-connection'

const SEGMENT_LINE_GROUP_PREFIX = 'sl-group-'
const SEGMENT_LINE_GROUP_FIRST_ITEM_PREFIX = 'sl-group-firstobject-'
const SEGMENT_LINE_ITEM_GROUP_PREFIX = 'sli-group-'

Meteor.methods({
	/**
	 * Activates the RunningOrder:
	 * TODO: Set up the Timeline
	 * Set first item on Next queue
	 */
	'playout_reload_data': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		PeripheralDeviceAPI.executeFunction(runningOrder.mosDeviceId, (err: any, ro: IMOSRunningOrder) => {
			if (err) {
				logger.error(err)
			} else {
				// TODO: what to do with the result?
				console.log('Recieved reply for triggerGetRunningOrder', ro)
			}
		}, 'triggerGetRunningOrder')
	},
	'playout_activate': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		let anyOtherActiveRunningOrders = RunningOrders.find({
			studioInstallationId: runningOrder.studioInstallationId,
			active: true
		}).fetch()

		if (anyOtherActiveRunningOrders.length) {
			throw new Meteor.Error(400, 'Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders,'_id'))
		}
		let segmentLines = runningOrder.getSegmentLines()

		SegmentLines.update({ runningOrderId: runningOrder._id }, { $unset: {
			startedPlayback: 0,
			duration: 0
		}}, {
			multi: true
		})

		// Remove all segment line items that have been created using an adLib item
		SegmentLineItems.remove({
			runningOrderId: runningOrder._id,
			adLibSourceId: {
				$exists: true
			}
		})

		// Remove duration on segmentLineItems, as this is set by the ad-lib playback editing
		SegmentLineItems.update({ runningOrderId: runningOrder._id }, { $unset: {
			duration: 0
		}}, {
			multi: true
		})

		RunningOrders.update(runningOrder._id, {$set: {
			active: true,
			previousSegmentLineId: null,
			currentSegmentLineId: null,
			nextSegmentLineId: segmentLines[0]._id // put the first on queue
		}})
	},
	/**
	 * Inactivates the RunningOrder
	 * TODO: Clear the Timeline (?)
	 */
	'playout_inactivate': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		RunningOrders.update(runningOrder._id, {$set: {
			active: false,
			previousSegmentLineId: null,
			currentSegmentLineId: null,
			nextSegmentLineId: null
		}})
		updateTimeline(runningOrder.studioInstallationId)
	},

	'debug__printTime': () => {
		let now = getCurrentTime()
		console.log(new Date(now))
		return now
	},

	/**
	 * Perform the TAKE action, i.e start playing a segmentLineItem
	 */
	'playout_take': (roId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.nextSegmentLineId) throw new Meteor.Error(500, 'nextSegmentLineId is not set!')

		let takeSegmentLine = SegmentLines.findOne(runningOrder.nextSegmentLineId)
		if (!takeSegmentLine) throw new Meteor.Error(404, 'takeSegmentLine not found!')
		let takeSegment = Segments.findOne(takeSegmentLine.segmentId)

		let segmentLinesAfter = runningOrder.getSegmentLines({
			_rank: {
				$gt: takeSegmentLine._rank,
			},
			_id: {$ne: takeSegmentLine._id}
		})

		let nextSegmentLine: SegmentLine | null = segmentLinesAfter[0] || null

		RunningOrders.update(runningOrder._id, {$set: {
			previousSegmentLineId: runningOrder.currentSegmentLineId,
			currentSegmentLineId: takeSegmentLine._id,
			nextSegmentLineId: nextSegmentLine._id
		}})

		clearNextLineStartedPlaybackAndDuration(roId, nextSegmentLine._id)

		updateTimeline(runningOrder.studioInstallationId)
	},

	'playout_setNext': (roId: string, nextSlId: string) => {

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		RunningOrders.update(runningOrder._id, {$set: {
			nextSegmentLineId: nextSlId
		}})

		clearNextLineStartedPlaybackAndDuration(roId, nextSlId)

		// remove old auto-next from timeline, and add new one
		updateTimeline(runningOrder.studioInstallationId)
	},

	'playout_segmentLinePlaybackStart': (roId: string, slId: string, startedPlayback: Time) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})

		if (segLine) {
			// make sure we don't run multiple times, even if TSR calls us multiple times
			if (!segLine.startedPlayback) {
				logger.info(`Playout reports segment line "${slId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

				if (runningOrder.currentSegmentLineId === slId) {
					// this is the current segment line, it has just started playback
					if (runningOrder.previousSegmentLineId) {
						let prevSegLine = SegmentLines.findOne(runningOrder.previousSegmentLineId)

						if (!prevSegLine) {
							// We couldn't find the previous segment line: this is not a critical issue, but is clearly is a symptom of a larger issue
							logger.error(`Previous segment line "${runningOrder.previousSegmentLineId}" on running order "${roId}" could not be found.`)
						} else {
							setPreviousLinePlaybackDuration(roId, prevSegLine, startedPlayback)
						}
					}

					RunningOrders.update(runningOrder._id, {
						$set: {
							previousSegmentLineId: null
						}
					})
				} else if (runningOrder.nextSegmentLineId === slId) {
					// this is the next segment line, clearly an autoNext has taken place
					if (runningOrder.currentSegmentLineId) {
						let prevSegLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)

						if (!prevSegLine) {
							// We couldn't find the previous segment line: this is not a critical issue, but is clearly is a symptom of a larger issue
							logger.error(`Previous segment line "${runningOrder.currentSegmentLineId}" on running order "${roId}" could not be found.`)
						} else {
							setPreviousLinePlaybackDuration(roId, prevSegLine, startedPlayback)
						}
					}

					let segmentLinesAfter = runningOrder.getSegmentLines({
						_rank: {
							$gt: segLine._rank,
						},
						_id: { $ne: segLine._id }
					})

					let nextSegmentLine: SegmentLine | null = segmentLinesAfter[0] || null

					RunningOrders.update(runningOrder._id, {
						$set: {
							previousSegmentLineId: null,
							currentSegmentLineId: segLine._id,
							nextSegmentLineId: nextSegmentLine._id
						}
					})

					clearNextLineStartedPlaybackAndDuration(roId, nextSegmentLine._id)
				} else {
					// a segment line is being played that has not been selected for playback by Core
					// show must go on, so find next segmentLine and update the RunningOrder, but log an error
					let segmentLinesAfter = runningOrder.getSegmentLines({
						_rank: {
							$gt: segLine._rank,
						},
						_id: { $ne: segLine._id }
					})

					let nextSegmentLine: SegmentLine | null = segmentLinesAfter[0] || null

					RunningOrders.update(runningOrder._id, {
						$set: {
							previousSegmentLineId: null,
							currentSegmentLineId: segLine._id,
							nextSegmentLineId: nextSegmentLine._id
						}
					})

					clearNextLineStartedPlaybackAndDuration(roId, nextSegmentLine._id)

					logger.error(`Segment Line "${segLine._id}" has started playback by the TSR, but has not been selected for playback!`)
				}

				SegmentLines.update(segLine._id, {$set: {
					startedPlayback
				}})
			}
		} else {
			throw new Meteor.Error(404, `Segment line "${slId}" in running order "${roId}" not found!`)
		}
	},
	'playout_segmentAdLibLineItemStart': (roId: string, slId: string, slaiId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		let adLibItem = SegmentLineAdLibItems.findOne({
			_id: slaiId,
			runningOrderId: roId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Segment Line Ad Lib Item "${slaiId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in an active running order!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in a current segment line!`)

		let newSegmentLineItem = convertAdLibToSLineItem(adLibItem, segLine)
		SegmentLineItems.insert(newSegmentLineItem)

		updateTimeline(runningOrder.studioInstallationId)
	},
	'playout_segmentAdLibLineItemStop': (roId: string, slId: string, sliId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		let alCopyItem = SegmentLineItems.findOne({
			_id: sliId,
			runningOrderId: roId
		})
		// To establish playback time, we need to look at the actual Timeline
		let alCopyItemTObj = Timeline.findOne({
			_id: SEGMENT_LINE_ITEM_GROUP_PREFIX + sliId
		})
		let parentOffset = 0
		if (!alCopyItem) throw new Meteor.Error(404, `Segment Line Ad Lib Copy Item "${sliId}" not found!`)
		if (!alCopyItemTObj) throw new Meteor.Error(404, `Segment Line Ad Lib Copy Item "${sliId}" not found in the playout Timeline!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Ad Lib Copy Items can be only manipulated in an active running order!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Copy Items can be only manipulated in a current segment line!`)
		if (!alCopyItem.adLibSourceId) throw new Meteor.Error(501, `"${sliId}" does not appear to be a Segment Line Ad Lib Copy Item!`)

		// The ad-lib item positioning will be relative to the startedPlayback of the segment line
		if (segLine.startedPlayback) {
			parentOffset = segLine.startedPlayback
		}

		let newExpectedDuration = 1 // smallest, non-zero duration
		if (alCopyItemTObj.trigger.type === TriggerType.TIME_ABSOLUTE && _.isNumber(alCopyItemTObj.trigger.value)) {
			const actualStartTime = parentOffset + alCopyItemTObj.trigger.value
			newExpectedDuration = getCurrentTime() - actualStartTime
		} else {
			logger.warn(`"${sliId}" timeline object is not positioned absolutely or is still set to play now, assuming it's about to be played.`)
		}

		SegmentLineItems.update({
			_id: sliId
		}, {$set: {
			duration: newExpectedDuration
		}})

		updateTimeline(runningOrder.studioInstallationId)
	},
	'playout_sourceLayerOnLineStop': (roId: string, slId: string, sourceLayerId: string) => {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		let slItems = SegmentLineItems.find({
			runningOrderId: roId,
			segmentLineId: slId,
			sourceLayerId: sourceLayerId
		}).fetch()
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Items can be only manipulated in an active running order!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Items can be only manipulated in a current segment line!`)

		let parentOffset = 0
		if (segLine.startedPlayback) {
			parentOffset = segLine.startedPlayback
		}

		const now = getCurrentTime()
		slItems.forEach((item) => {
			let newExpectedDuration = 1 // smallest, non-zero duration
			if (item.trigger.type === TriggerType.TIME_ABSOLUTE && _.isNumber(item.trigger.value)) {
				const actualStartTime = parentOffset + item.trigger.value
				newExpectedDuration = now - actualStartTime
			} else {
				logger.warn(`"${item._id}" timeline object is not positioned absolutely or is still set to play now, assuming it's about to be played.`)
			}

			// Only update if the new duration is shorter than the old one, since we are supposed to cut stuff short
			if (newExpectedDuration < item.expectedDuration) {
				SegmentLineItems.update({
					_id: item._id
				}, {$set: {
					duration: newExpectedDuration
				}})
			}
		})

		updateTimeline(runningOrder.studioInstallationId)
	}
})

function convertAdLibToSLineItem (adLibItem: SegmentLineAdLibItem, segmentLine: SegmentLine): SegmentLineItem {
	const oldId = adLibItem._id
	const newId = Random.id()
	const newSLineItem = literal<SegmentLineItem>(_.extend(
		adLibItem,
		{
			_id: newId,
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: 'now'
			},
			segmentLineId: segmentLine._id,
			adLibSourceId: adLibItem._id,
			expectedDuration: adLibItem.expectedDuration || 0 // set duration to infinite if not set by AdLibItem
		}
	))
	if (newSLineItem.content && newSLineItem.content.timelineObjects) {
		let contentObjects = newSLineItem.content.timelineObjects
		// insert the objects into an AdLib group
		let adLibGroup = literal<TimelineObjGroup>({
			_id: newId,
			trigger: newSLineItem.trigger,
			siId: newSLineItem.segmentLineId,
			roId: newSLineItem.runningOrderId,
			deviceId: [],
			LLayer: 'core_adlib',
			duration: newSLineItem.expectedDuration,
			content: {
				type: TimelineContentTypeOther.GROUP,
				objects: _.filter(contentObjects,
					(item) => {
						return item !== null
					}).map(
						(item) => {
							const itemCpy = _.extend(item, {
								id: item!._id,
								inGroup: newId
							})
							return itemCpy as TimelineObject
						})
			},
			isGroup: true
		})
		newSLineItem.content.timelineObjects = [ adLibGroup ]
	}
	return newSLineItem
}

function setPreviousLinePlaybackDuration (roId: string, prevSegLine: SegmentLine, lastChange: Time) {
	if (prevSegLine.startedPlayback && prevSegLine.startedPlayback > 0) {
		SegmentLines.update(prevSegLine._id, {
			$set: {
				duration: lastChange - prevSegLine.startedPlayback
			}
		})
	} else {
		logger.error(`Previous segment line "${prevSegLine._id}" has never started playback on running order "${roId}".`)
	}
}

function clearNextLineStartedPlaybackAndDuration (roId: string, nextSlId: string) {
	SegmentLines.update(nextSlId, {
		$unset: {
			duration: 0,
			startedPlayback: 0
		}
	})
}

function createSegmentLineGroup (segmentLine: SegmentLine, duration: Time): TimelineObj {
	let slGrp = literal<TimelineObjGroupSegmentLine>({
		_id: SEGMENT_LINE_GROUP_PREFIX + segmentLine._id,
		siId: '', // added later
		roId: '', // added later
		deviceId: [],
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 'now'
		},
		duration: duration,
		LLayer: 'core_abstract',
		content: {
			type: TimelineContentTypeOther.GROUP,
			objects: []
		},
		isGroup: true,
		isSegmentLineGroup: true,
		// slId: segmentLine._id
	})

	return slGrp
}
function createSegmentLineGroupFirstObject (segmentLine: SegmentLine, segmentLineGroup: TimelineObj): TimelineObj {
	return literal<TimelineObjAbstract>({
		_id: SEGMENT_LINE_GROUP_FIRST_ITEM_PREFIX + segmentLine._id,
		siId: '', // added later
		roId: '', // added later
		deviceId: [],
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		duration: 0,
		LLayer: 'core_abstract',
		content: {
			type: TimelineContentTypeOther.NOTHING,
		},
		// isGroup: true,
		inGroup: segmentLineGroup._id,
		slId: segmentLine._id
	})
}

function createSegmentLineItemGroup (item: SegmentLineItem, segmentLineGroup?: TimelineObj): TimelineObj {
	return literal<TimelineObjGroup>({
		_id: SEGMENT_LINE_ITEM_GROUP_PREFIX + item._id,
		content: {
			type: TimelineContentTypeOther.GROUP,
			objects: []
		},
		inGroup: segmentLineGroup && segmentLineGroup._id,
		isGroup: true,
		siId: '',
		roId: '',
		deviceId: [],
		trigger: item.trigger,
		duration: item.duration || item.expectedDuration || 0,
		LLayer: item.sourceLayerId
	})
}

function transformSegmentLineIntoTimeline (segmentLine: SegmentLine, segmentLineGroup?: TimelineObj): Array<TimelineObj> {
	let timelineObjs: Array<TimelineObj> = []
	let items = segmentLine.getSegmentLinesItems()

	_.each(items, (item: SegmentLineItem) => {
		if (
			item.content &&
			item.content.timelineObjects
		) {
			let tos = item.content.timelineObjects

			// create a segmentLineItem group for the items and then place all of them there
			const segmentLineItemGroup = createSegmentLineItemGroup(item, segmentLineGroup)
			timelineObjs.push(segmentLineItemGroup)

			_.each(tos, (o: TimelineObj) => {
				if (segmentLineGroup) {
					o.inGroup = segmentLineItemGroup._id
				}

				timelineObjs.push(o)
			})
		}
	})
	return timelineObjs
}

function updateTimeline (studioInstallationId: string) {
	const activeRunningOrder = RunningOrders.findOne({
		studioInstallationId: studioInstallationId,
		active: true
	})

	if (activeRunningOrder) {
		let studioInstallation = activeRunningOrder.getStudioInstallation()

		// remove anything not related to active running order:
		Timeline.remove({
			siId: studioInstallationId,
			roId: {
				$not: {
					$eq: activeRunningOrder._id
				}
			}
		})
		// Todo: Add default objects:
		let timelineObjs: Array<TimelineObj> = []

		// Generate timeline: -------------------------------------------------

		// Default timelineobjects

		// Currently playing

		let currentSegmentLine: SegmentLine | undefined
		let nextSegmentLine: SegmentLine | undefined
		let currentSegmentLineGroup: TimelineObj | undefined

		// we get the nextSegmentLine first, because that affects how the currentSegmentLine will be treated
		if (activeRunningOrder.nextSegmentLineId) {
			// We may be at the beginning of a show, and there can be no currentSegmentLine and we are waiting for the user to Take
			nextSegmentLine = SegmentLines.findOne(activeRunningOrder.nextSegmentLineId)
			if (!nextSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRunningOrder.nextSegmentLineId}" not found!`)
		}

		if (activeRunningOrder.currentSegmentLineId) {
			currentSegmentLine = SegmentLines.findOne(activeRunningOrder.currentSegmentLineId)
			if (!currentSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRunningOrder.currentSegmentLineId}" not found!`)

			// fetch items
			// fetch the timelineobjs in items
			const isFollowed = nextSegmentLine && nextSegmentLine.autoNext
			currentSegmentLineGroup = createSegmentLineGroup(currentSegmentLine, (isFollowed ? (currentSegmentLine.expectedDuration || 0) : 0))
			timelineObjs = timelineObjs.concat(currentSegmentLineGroup, transformSegmentLineIntoTimeline(currentSegmentLine, currentSegmentLineGroup))

			timelineObjs.push(createSegmentLineGroupFirstObject(currentSegmentLine, currentSegmentLineGroup))
		}

		// only add the next objects into the timeline if the next segment is autoNext
		if (nextSegmentLine && nextSegmentLine.autoNext) {
			let nextSegmentLineGroup = createSegmentLineGroup(nextSegmentLine, 0)
			if (currentSegmentLineGroup) {
				nextSegmentLineGroup.trigger = literal<ITimelineTrigger>({
					type: TriggerType.TIME_RELATIVE,
					value: `#${currentSegmentLineGroup._id}.end`
				})
			}
			timelineObjs = timelineObjs.concat(
				nextSegmentLineGroup,
				transformSegmentLineIntoTimeline(nextSegmentLine, nextSegmentLineGroup))
			timelineObjs.push(createSegmentLineGroupFirstObject(nextSegmentLine, nextSegmentLineGroup))
		}

		if (!activeRunningOrder.nextSegmentLineId && !activeRunningOrder.currentSegmentLineId) {
			// maybe at the end of the show
			logger.info(`No next segmentLine and no current segment line set on running order "${activeRunningOrder._id}".`)
		}

		// next (on pvw (or on pgm if first))

		// Pre-process the timelineObjects:

		// create a mapping of which playout parent processes that has which playoutdevices:
		let deviceParentDevice: {[deviceId: string]: PeripheralDevice} = {}
		let peripheralDevicesInStudio = PeripheralDevices.find({
			studioInstallationId: studioInstallation._id,
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT
		}).fetch()
		_.each(peripheralDevicesInStudio, (pd) => {
			if (pd.settings) {
				let settings = pd.settings as PlayoutDeviceSettings
				_.each(settings.devices, (device, deviceId) => {
					deviceParentDevice[deviceId] = pd
				})
			}
		})

		// first, split out any grouped objects, to make the timeline shallow:
		let fixObjectChildren = (o: TimelineObjGroup) => {
			if (o.isGroup && o.content && o.content.objects && o.content.objects.length) {
				// let o2 = o as TimelineObjGroup
				_.each(o.content.objects, (child) => {
					let childFixed: TimelineObj = _.extend(child, {
						inGroup: o._id,
						_id: child.id || child['_id']
					})
					delete childFixed['id']
					timelineObjs.push(childFixed)
					fixObjectChildren(childFixed as TimelineObjGroup)
				})
				delete o.content.objects
			}
		}
		_.each(timelineObjs, (o: TimelineObj) => {
			fixObjectChildren(o as TimelineObjGroup)
		})
		// Add deviceIds to all children objects
		let groupDeviceIds: {[groupId: string]: Array<string>} = {}
		_.each(timelineObjs, (o) => {

			o.roId = activeRunningOrder._id
			o.siId = studioInstallation._id
			if (!o.isGroup) {
				let LLayerMapping = (studioInstallation.mappings || {})[o.LLayer + '']
				if (LLayerMapping) {
					let parentDevice = deviceParentDevice[LLayerMapping.deviceId]
					if (!parentDevice) throw new Meteor.Error(404, 'No parent-device found for device "' + LLayerMapping.deviceId + '"')

					o.deviceId = [parentDevice._id]

					if (o.inGroup) {
						if (!groupDeviceIds[o.inGroup]) groupDeviceIds[o.inGroup] = []
						groupDeviceIds[o.inGroup].push(parentDevice._id)
					}

				} else logger.warn('TimelineObject "' + o._id + '" has an unknown LLayer: "' + o.LLayer + '"')
			}
		})
		let groupObjs = _.compact(_.map(timelineObjs, (o) => {
			if (o.isGroup) {
				return o
			}
			return null
		}))

		// add the children's deviceIds to their parent groups:
		let shouldNotRunAgain = true
		let shouldRunAgain = true
		for (let i = 0; i < 10; i++) {
			shouldNotRunAgain = true
			shouldRunAgain = false
			_.each(groupObjs, (o) => {
				if (o.inGroup) {
					if (!groupDeviceIds[o.inGroup]) groupDeviceIds[o.inGroup] = []
					groupDeviceIds[o.inGroup] = groupDeviceIds[o.inGroup].concat(o.deviceId)
					shouldNotRunAgain = false
				}
				if (o.isGroup) {
					let newDeviceId = _.uniq(groupDeviceIds[o._id] || [], false)

					if (!_.isEqual(o.deviceId, newDeviceId)) {
						shouldRunAgain = true
						o.deviceId = newDeviceId
					}
				}
			})
			if (!shouldRunAgain || shouldNotRunAgain) break
		}

		console.log('timelineObjs', timelineObjs)

		saveIntoDb<TimelineObj, TimelineObj>(Timeline, {
			roId: activeRunningOrder._id
		}, timelineObjs, {
			beforeUpdate: (o: TimelineObj, oldO: TimelineObj): TimelineObj => {
				// do not overwrite trigger on the currentSegmentLine if it is already present
				if (currentSegmentLine && currentSegmentLine._id === oldO._id && o.trigger.value === 'now') {
					o = _.clone(o)
					o.trigger = oldO.trigger
				}
				return o
			}
		})
	} else {
		// remove everything:
		Timeline.remove({
			siId: studioInstallationId
		})
	}
}
