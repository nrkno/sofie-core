import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import { RunningOrders, RunningOrder, RunningOrderHoldState, RoData, DBRunningOrder } from '../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines, DBSegmentLine } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { SegmentLineItemLifespan, SegmentLineHoldMode } from 'tv-automation-sofie-blueprints-integration/dist/runningOrder'
import { TimelineTrigger, TimelineObjHoldMode } from 'tv-automation-sofie-blueprints-integration/dist/timeline'
import { SegmentLineAdLibItems, SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { RunningOrderBaselineItems, RunningOrderBaselineItem } from '../../lib/collections/RunningOrderBaselineItems'
import { getCurrentTime,
	saveIntoDb,
	literal,
	Time,
	stringifyObjects,
	fetchAfter,
	normalizeArray,
	getRank,
	asyncCollectionUpdate,
	asyncCollectionRemove,
	waitForPromiseAll,
	asyncCollectionInsert,
	asyncCollectionUpsert,
	asyncCollectionFindFetch,
	waitForPromise,
	asyncCollectionFindOne,
	pushOntoPath
} from '../../lib/lib'
import {
	Timeline,
	TimelineObj,
	TimelineContentTypeOther,
	TimelineObjSegmentLineAbstract,
	TimelineObjSegmentLineItemAbstract,
	TimelineObjGroup,
	TimelineObjGroupSegmentLine,
} from '../../lib/collections/Timeline'
import {
	TimelineContentTypeLawo,
	TimelineObjLawo,
	TimelineContentTypeHttp,
	TimelineObjHTTPRequest
} from 'timeline-state-resolver-types'
import { TriggerType } from 'superfly-timeline'
import { Segments,Segment } from '../../lib/collections/Segments'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../logging'
import { PeripheralDevice,PeripheralDevices,PlayoutDeviceSettings } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { IMOSROFullStory } from 'mos-connection'
import { getSliGroupId, getSlGroupId, getSlFirstObjectId, getSliFirstObjectId } from 'tv-automation-sofie-blueprints-integration/dist/timeline'
import { LookaheadMode } from '../../lib/api/playout'
import { loadBlueprints, getBaselineContext, postProcessSegmentLineAdLibItems, postProcessSegmentLineBaselineItems } from './blueprints'
import { RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItems } from '../../lib/collections/RunningOrderBaselineAdLibItems'
import { StudioInstallations, StudioInstallation, IStudioConfigItem } from '../../lib/collections/StudioInstallations'
import { CachePrefix } from '../../lib/collections/RunningOrderDataCache'
import { PlayoutAPI } from '../../lib/api/playout'
import { triggerExternalMessage } from './externalMessage'
import { getHash } from '../lib'
import { syncFunction, syncFunctionIgnore } from '../codeControl'
import { getResolvedSegment, ISourceLayerExtended } from '../../lib/RunningOrder'
let clone = require('fast-clone')
import { Resolver } from 'superfly-timeline'
import { transformTimeline } from '../../lib/timeline'
import { ClientAPI } from '../../lib/api/client'
import { EvaluationBase, Evaluations } from '../../lib/collections/Evaluations'
import { sendSlackMessageToWebhook } from './slack'
import { setMeteorMethods } from '../methods'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration/dist/content'
import { sendStoryStatus, updateStory } from './integration/mos'
import { updateSegmentLines, reloadRunningOrderData } from './runningOrder'
import { runPostProcessTemplate } from '../../server/api/runningOrder'
import { RecordedFiles } from '../../lib/collections/RecordedFiles'
import { generateRecordingTimelineObjs } from './testTools'
import { reportRunningOrderHasStarted, reportSegmentLineHasStarted, reportSegmentLineItemHasStarted } from './asRunLog'

const MINIMUM_TAKE_SPAN = 1000

export namespace ServerPlayoutAPI {
	/**
	 * Prepare the broadcast for transmission
	 * To be triggered well before the broadcast because it may take time
	 */
	export function roPrepareForBroadcast (roId: string) {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (runningOrder.active) throw new Meteor.Error(404, `roPrepareForBroadcast cannot be run on an active runningOrder!`)
		const anyOtherActiveRunningOrders = areThereActiveROsInStudio(runningOrder.studioInstallationId, runningOrder._id)
		if (anyOtherActiveRunningOrders.length) {
			logger.warn('Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, '_id'))
			const res = literal<ClientAPI.ClientResponse>({
				error: 409,
				message: 'Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, '_id')
			})
			return res
		}

		resetRunningOrder(runningOrder)
		prepareStudioForBroadcast(runningOrder.getStudioInstallation())

		return activateRunningOrder(runningOrder, true) // Activate runningOrder (rehearsal)
	}
	/**
	 * Reset the broadcast, to be used during testing.
	 * The User might have run through the running order and wants to start over and try again
	 */
	export function roResetRunningOrder (roId: string) {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (runningOrder.active && !runningOrder.rehearsal) throw new Meteor.Error(401, `roResetBroadcast can only be run in rehearsal!`)

		resetRunningOrder(runningOrder)

		updateTimeline(runningOrder.studioInstallationId)
	}
	/**
	 * Activate the runningOrder, final preparations before going on air
	 * To be triggered by the User a short while before going on air
	 */
	export function roResetAndActivate (roId: string) {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (runningOrder.active && !runningOrder.rehearsal) throw new Meteor.Error(402, `roResetAndActivate cannot be run when active!`)

		resetRunningOrder(runningOrder)

		return activateRunningOrder(runningOrder, false) // Activate runningOrder
	}
	/**
	 * Only activate the runningOrder, don't reset anything
	 */
	export function roActivate (roId: string, rehearsal: boolean) {
		check(rehearsal, Boolean)
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		return activateRunningOrder(runningOrder, rehearsal)
	}
	/**
	 * Deactivate the runningOrder
	 */
	export function roDeactivate (roId: string, rehearsal: boolean) {
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		return deactivateRunningOrder(runningOrder)
	}
	/**
	 * Trigger a reload of data of the runningOrder
	 */
	export function reloadData (roId: string) {
		// Reload and reset the Running order
		check(roId, String)
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		return reloadRunningOrderData(runningOrder)
	}
	function resetRunningOrder (runningOrder: RunningOrder) {
		logger.info('resetRunningOrder ' + runningOrder._id)
		// Remove all dunamically inserted items (adlibs etc)
		SegmentLineItems.remove({
			runningOrderId: runningOrder._id,
			dynamicallyInserted: true
		})

		SegmentLines.update({
			runningOrderId: runningOrder._id
		}, {
			$unset: {
				duration: 1,
				startedPlayback: 1,
				timings: 1,
				runtimeArguments: 1
			}
		}, {multi: true})

		const dirtySegmentLines = SegmentLines.find({
			runningOrderId: runningOrder._id,
			dirty: true
		}).fetch()
		dirtySegmentLines.forEach(sl => {
			refreshSegmentLine(runningOrder, sl)
			SegmentLines.update(sl._id, {$unset: {
				dirty: 1
			}})
		})

		// Remove all segment line items that were added for holds
		let holdItems = SegmentLineItems.find({
			runningOrderId: runningOrder._id,
			extendOnHold: true,
			infiniteId: { $exists: true },
		})
		holdItems.forEach(i => {
			if (!i.infiniteId || i.infiniteId === i._id) {
				// Was the source, so clear infinite props
				SegmentLineItems.update(i._id, {
					$unset: {
						infiniteId: 0,
						infiniteMode: 0,
					}
				})
			} else {
				SegmentLineItems.remove(i)
			}
		})

		// ensure that any removed infinites (caused by adlib) are restored
		updateSourceLayerInfinitesAfterLine(runningOrder, true)

		SegmentLineItems.update({
			runningOrderId: runningOrder._id
		}, {
			$unset: {
				duration: 1,
				startedPlayback: 1,
				durationOverride: 1,
				disabled: 1,
				hidden: 1
			}
		}, {multi: true})

		resetRunningOrderPlayhead(runningOrder)
	}
	function resetRunningOrderPlayhead (runningOrder: RunningOrder) {
		logger.info('resetRunningOrderPlayhead ' + runningOrder._id)
		let segmentLines = runningOrder.getSegmentLines()

		RunningOrders.update(runningOrder._id, {
			$set: {
				previousSegmentLineId: null,
				currentSegmentLineId: null,
				updateStoryStatus: null,
				holdState: RunningOrderHoldState.NONE,
			}, $unset: {
				startedPlayback: 1
			}
		})

		if (runningOrder.active) {
			// put the first on queue:
			setNextSegmentLine(runningOrder, _.first(segmentLines) || null)
		} else {
			setNextSegmentLine(runningOrder, null)
		}
	}
	function prepareStudioForBroadcast (studio: StudioInstallation) {
		logger.info('prepareStudioForBroadcast ' + studio._id)

		const ssrcBgs: Array<IStudioConfigItem> = _.compact([
			studio.config.find((o) => o._id === 'atemSSrcBackground'),
			studio.config.find((o) => o._id === 'atemSSrcBackground2')
		])
		if (ssrcBgs.length > 1) logger.info(ssrcBgs[0]!.value + ' and ' + ssrcBgs[1]!.value + ' will be loaded to atems')
		if (ssrcBgs.length > 0) logger.info(ssrcBgs[0]!.value + ' will be loaded to atems')

		let playoutDevices = PeripheralDevices.find({
			studioInstallationId: studio._id,
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT
		}).fetch()

		_.each(playoutDevices, (device: PeripheralDevice) => {
			let okToDestoryStuff = true
			PeripheralDeviceAPI.executeFunction(device._id, (err, res) => {
				if (err) {
					logger.error(err)
				} else {
					logger.info('devicesMakeReady OK')
				}
			}, 'devicesMakeReady', okToDestoryStuff)

			if (ssrcBgs.length > 0) {
				PeripheralDeviceAPI.executeFunction(device._id, (err) => {
					if (err) {
						logger.error(err)
					} else {
						logger.info('Added Super Source BG to Atem')
					}
				}, 'uploadFileToAtem', ssrcBgs)
			}
		})
	}
	function areThereActiveROsInStudio (studioInstallationId: string, excludeROId?: string): RunningOrder[] {
		let anyOtherActiveRunningOrders = RunningOrders.find(excludeROId ? {
			studioInstallationId: studioInstallationId,
			active: true,
			_id: {
				$ne: excludeROId
			}
		} : {
			studioInstallationId: studioInstallationId,
			active: true
		}).fetch()

		return anyOtherActiveRunningOrders
	}
	function activateRunningOrder (runningOrder: RunningOrder, rehearsal: boolean) {
		logger.info('Activating RO ' + runningOrder._id + (rehearsal ? ' (Rehearsal)' : ''))

		rehearsal = !!rehearsal
		// if (runningOrder.active && !runningOrder.rehearsal) throw new Meteor.Error(403, `RunningOrder "${runningOrder._id}" is active and not in rehersal, cannot reactivate!`)

		let newRunningOrder = RunningOrders.findOne(runningOrder._id) // fetch new from db, to make sure its up to date

		if (!newRunningOrder) throw new Meteor.Error(404, `RunningOrder "${runningOrder._id}" not found!`)
		runningOrder = newRunningOrder

		let studioInstallation = runningOrder.getStudioInstallation()

		let anyOtherActiveRunningOrders = RunningOrders.find({
			studioInstallationId: runningOrder.studioInstallationId,
			active: true,
			_id: {
				$ne: runningOrder._id
			}
		}).fetch()

		if (anyOtherActiveRunningOrders.length) {
			logger.warn('Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, '_id'))
			const res = literal<ClientAPI.ClientResponse>({
				error: 409,
				message: 'Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, '_id')
			})
			return res
		}

		let wasInactive = !runningOrder.active

		let m = {
			active: true,
			rehearsal: rehearsal,
		}
		RunningOrders.update(runningOrder._id, {
			$set: m
		})
		if (!runningOrder.nextSegmentLineId) {
			let segmentLines = runningOrder.getSegmentLines()
			let firstSegmentLine = _.first(segmentLines)
			if (firstSegmentLine) {
				setNextSegmentLine(runningOrder, firstSegmentLine)
			}
		}

		if (wasInactive) {

			logger.info('Building baseline items...')

			const showStyle = runningOrder.getShowStyle()
			let blueprint = loadBlueprints(showStyle)
			if (!blueprint || !blueprint.Baseline) {
				logger.error('Failed to load baseline blueprint')
			} else {
				const ctx = getBaselineContext(runningOrder)

				const res = blueprint.Baseline(ctx)
				const baselineItems = postProcessSegmentLineBaselineItems(ctx, res.BaselineItems as any as TimelineObj[]) // TODO - types used here
				const adlibItems = postProcessSegmentLineAdLibItems(ctx, res.AdLibItems, 'baseline')

				// TODO - should any notes be logged as a warning, or is that done already?

				if (baselineItems) {
					logger.info(`... got ${baselineItems.length} items from blueprint.`)

					const baselineItem: RunningOrderBaselineItem = {
						_id: Random.id(7),
						runningOrderId: runningOrder._id,
						objects: baselineItems
					}

					saveIntoDb<RunningOrderBaselineItem, RunningOrderBaselineItem>(RunningOrderBaselineItems, {
						runningOrderId: runningOrder._id
					}, [baselineItem])
				}

				if (adlibItems) {
					logger.info(`... got ${adlibItems.length} adLib items from blueprint.`)
					saveIntoDb<RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItem>(RunningOrderBaselineAdLibItems, {
						runningOrderId: runningOrder._id
					}, adlibItems)
				}
			}

			updateTimeline(runningOrder.studioInstallationId)
		}

		return literal<ClientAPI.ClientResponse>({
			success: 200
		})
	}
	function deactivateRunningOrder (runningOrder: RunningOrder) {
		logger.info('Deactivating RO ' + runningOrder._id)

		let previousSegmentLine = (runningOrder.currentSegmentLineId ?
			SegmentLines.findOne(runningOrder.currentSegmentLineId)
			: null
		)

		if (previousSegmentLine) segmentLineStoppedPlaying(runningOrder._id, previousSegmentLine, getCurrentTime())

		RunningOrders.update(runningOrder._id, {
			$set: {
				active: false,
				previousSegmentLineId: null,
				currentSegmentLineId: null,
				holdState: RunningOrderHoldState.NONE,
			}
		})
		setNextSegmentLine(runningOrder, null)
		if (runningOrder.currentSegmentLineId) {
			SegmentLines.update(runningOrder.currentSegmentLineId, {
				$push: {
					'timings.takeOut': getCurrentTime()
				}
			})
		}

		// clean up all runtime baseline items
		RunningOrderBaselineItems.remove({
			runningOrderId: runningOrder._id
		})

		RunningOrderBaselineAdLibItems.remove({
			runningOrderId: runningOrder._id
		})

		updateTimeline(runningOrder.studioInstallationId)

		sendStoryStatus(runningOrder, null)
	}
	function resetSegmentLine (segmentLine: DBSegmentLine): Promise<void> {
		let ps: Array<Promise<any>> = []

		let isDirty = segmentLine.dirty || false

		ps.push(asyncCollectionUpdate(SegmentLines, {
			runningOrderId: segmentLine.runningOrderId,
			_id: segmentLine._id
		}, {
			$unset: {
				duration: 1,
				startedPlayback: 1,
				runtimeArguments: 1,
				dirty: 1
			}
		}))
		ps.push(asyncCollectionUpdate(SegmentLineItems, {
			runningOrderId: segmentLine.runningOrderId,
			segmentLineId: segmentLine._id
		}, {
			$unset: {
				startedPlayback: 1,
				durationOverride: 1,
				disabled: 1,
				hidden: 1
			}
		}, {
			multi: true
		}))
		// Remove all segmentLineItems that have been dynamically created (such as adLib items)
		ps.push(asyncCollectionRemove(SegmentLineItems, {
			runningOrderId: segmentLine.runningOrderId,
			segmentLineId: segmentLine._id,
			dynamicallyInserted: true
		}))
		ps.push(asyncCollectionRemove(SegmentLineItems, {
			runningOrderId: segmentLine.runningOrderId,
			segmentLineId: segmentLine._id,
			extendOnHold: true,
			infiniteId: { $exists: true },
		}))

		if (isDirty) {
			return new Promise((resolve, reject) => {
				Promise.all(ps).then(() => {
					const ro = RunningOrders.findOne(segmentLine.runningOrderId)
					if (!ro) throw new Meteor.Error(404, `Running Order "${segmentLine.runningOrderId}" not found!`)
					refreshSegmentLine(ro, segmentLine)
					resolve()
				}).catch((e) => reject())
			})
		} else {
			return Promise.all(ps)
			.then(() => {
				// do nothing
			})
		}
	}
	function refreshSegmentLine (runningOrder: DBRunningOrder, segmentLine: DBSegmentLine) {
		const ro = new RunningOrder(runningOrder)
		const story = ro.fetchCache(CachePrefix.FULLSTORY + segmentLine._id) as IMOSROFullStory
		const sl = new SegmentLine(segmentLine)
		const changed = updateStory(ro, sl, story)

		const segment = sl.getSegment()
		if (segment) {
			// this could be run after the segment, if we were capable of limiting that
			runPostProcessTemplate(ro, segment)
		}

		updateSourceLayerInfinitesAfterLine(ro, false, sl)
	}
	function setNextSegmentLine (runningOrder: RunningOrder, nextSegmentLine: DBSegmentLine | null, setManually?: boolean) {
		let ps: Array<Promise<any>> = []

		if (nextSegmentLine) {

			if (nextSegmentLine.runningOrderId !== runningOrder._id) throw new Meteor.Error(409, `SegmentLine "${nextSegmentLine._id}" not part of running order "${runningOrder._id}"`)
			if (nextSegmentLine._id === runningOrder.currentSegmentLineId) {
				throw new Meteor.Error(402, 'Not allowed to Next the currently playing SegmentLine')
			}

			ps.push(resetSegmentLine(nextSegmentLine))

			ps.push(asyncCollectionUpdate(RunningOrders, runningOrder._id, {
				$set: {
					nextSegmentLineId: nextSegmentLine._id,
					nextSegmentLineManual: !!setManually
				}
			}))
			ps.push(asyncCollectionUpdate(SegmentLines, nextSegmentLine._id, {
				$push: {
					'timings.next': getCurrentTime()
				}
			}))
		} else {
			ps.push(asyncCollectionUpdate(RunningOrders, runningOrder._id, {
				$set: {
					nextSegmentLineId: null,
					nextSegmentLineManual: !!setManually
				}
			}))
		}
		waitForPromiseAll(ps)
	}
	export function userRoTake (roId: string) {
		// Called by the user. Wont throw as nasty errors

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) {
			logger.warn(`RunningOrder "${roId}" is not active!`)
			return
		}
		if (!runningOrder.nextSegmentLineId) {
			logger.warn('nextSegmentLineId is not set!')
			return
		}
		if (runningOrder.currentSegmentLineId) {
			const currentSegmentLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)
			if (currentSegmentLine && currentSegmentLine.timings) {
				const lastStartedPlayback = currentSegmentLine.timings.startedPlayback ? currentSegmentLine.timings.startedPlayback[currentSegmentLine.timings.startedPlayback.length - 1] : 0
				const lastTake = currentSegmentLine.timings.take ? currentSegmentLine.timings.take[currentSegmentLine.timings.take.length - 1] : 0
				const lastChange = Math.max(lastTake, lastStartedPlayback)
				if (getCurrentTime() - lastChange < MINIMUM_TAKE_SPAN) {
					logger.warn(`Time since last take is shorter than ${MINIMUM_TAKE_SPAN} for ${currentSegmentLine._id}: ${getCurrentTime() - lastStartedPlayback}`)
					return
				}
			} else {
				throw new Meteor.Error(404, `SegmentLine "${runningOrder.currentSegmentLineId}", set as currentSegmentLine in "${roId}", not found!`)
			}
		}
		return roTake(runningOrder)
	}
	export function roTake (roId: string | RunningOrder ) {

		let now = getCurrentTime()
		let runningOrder: RunningOrder | undefined = (
			_.isObject(roId) ? roId as RunningOrder :
			_.isString(roId) ? RunningOrders.findOne(roId) :
			undefined
		)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(501, `RunningOrder "${roId}" is not active!`)
		if (!runningOrder.nextSegmentLineId) throw new Meteor.Error(500, 'nextSegmentLineId is not set!')

		if (runningOrder.holdState === RunningOrderHoldState.COMPLETE) {
			RunningOrders.update(runningOrder._id, {
				$set: {
					holdState: RunningOrderHoldState.NONE
				}
			})
		// If hold is active, then this take is to clear it
		} else if (runningOrder.holdState === RunningOrderHoldState.ACTIVE) {
			RunningOrders.update(runningOrder._id, {
				$set: {
					holdState: RunningOrderHoldState.COMPLETE
				}
			})

			if (runningOrder.currentSegmentLineId) {
				let currentSegmentLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)
				if (!currentSegmentLine) throw new Meteor.Error(404, 'currentSegmentLine not found!')

				// Remove the current extension line
				const items = currentSegmentLine.getAllSegmentLineItems().filter(i => i.extendOnHold && i.infiniteId && i.infiniteId !== i._id)
				SegmentLineItems.remove({
					_id: {$in: _.pluck(items, '_id')}
				})
			}
			if (runningOrder.previousSegmentLineId) {
				let previousSegmentLine = SegmentLines.findOne(runningOrder.previousSegmentLineId)
				if (!previousSegmentLine) throw new Meteor.Error(404, 'previousSegmentLine not found!')

				// Clear the extended mark on the original
				const items = previousSegmentLine.getAllSegmentLineItems().filter(i => i.extendOnHold && i.infiniteId && i.infiniteId === i._id)

				SegmentLineItems.update({
					_id: {$in: _.pluck(items, '_id')}
				}, {
					$unset: {
						infiniteId: 0,
						infiniteMode: 0,
					}
				}, {multi: true})
			}

			updateTimeline(runningOrder.studioInstallationId)
			return
		}
		let roData = runningOrder.fetchAllData()

		let previousSegmentLine = (runningOrder.currentSegmentLineId ?
			roData.segmentLinesMap[runningOrder.currentSegmentLineId]
			: null
		)
		let takeSegmentLine = roData.segmentLinesMap[runningOrder.nextSegmentLineId]
		if (!takeSegmentLine) throw new Meteor.Error(404, 'takeSegmentLine not found!')
		let takeSegment = roData.segmentsMap[takeSegmentLine.segmentId]

		let segmentLineAfter = fetchAfter(roData.segmentLines, {
			runningOrderId: runningOrder._id
		}, takeSegmentLine._rank)

		let nextSegmentLine: DBSegmentLine | null = segmentLineAfter || null

		// beforeTake(runningOrder, previousSegmentLine || null, takeSegmentLine)
		beforeTake(roData, previousSegmentLine || null, takeSegmentLine)

		let ps: Array<Promise<any>> = []
		let m = {
			previousSegmentLineId: runningOrder.currentSegmentLineId,
			currentSegmentLineId: takeSegmentLine._id,
			holdState: !runningOrder.holdState || runningOrder.holdState === RunningOrderHoldState.COMPLETE ? RunningOrderHoldState.NONE : runningOrder.holdState + 1,
		}
		ps.push(asyncCollectionUpdate(RunningOrders, runningOrder._id, {
			$set: m
		}))
		ps.push(asyncCollectionUpdate(SegmentLines, takeSegmentLine._id, {
			$push: {
				'timings.take': now
			}
		}))
		if (m.previousSegmentLineId) {
			ps.push(asyncCollectionUpdate(SegmentLines, m.previousSegmentLineId, {
				$push: {
					'timings.takeOut': now,
				}
			}))
		}
		runningOrder = _.extend(runningOrder, m) as RunningOrder
		setNextSegmentLine(runningOrder, nextSegmentLine)
		waitForPromiseAll(ps)
		ps = []

		// Setup the items for the HOLD we are starting
		if (m.previousSegmentLineId && m.holdState === RunningOrderHoldState.ACTIVE) {
			let previousSegmentLine = roData.segmentLinesMap[m.previousSegmentLineId]
			if (!previousSegmentLine) throw new Meteor.Error(404, 'previousSegmentLine not found!')

			// Make a copy of any item which is flagged as an 'infinite' extension
			const itemsToCopy = previousSegmentLine.getAllSegmentLineItems().filter(i => i.extendOnHold)
			itemsToCopy.forEach(sli => {
				// mark current one as infinite
				SegmentLineItems.update(sli._id, {
					$set: {
						infiniteMode: SegmentLineItemLifespan.OutOnNextSegmentLine,
						infiniteId: sli._id,
					}
				})

				// make the extension
				sli.infiniteId = sli._id
				sli.segmentLineId = m.currentSegmentLineId
				sli.infiniteMode = SegmentLineItemLifespan.OutOnNextSegmentLine
				sli.expectedDuration = 0
				sli._id = sli._id + '_hold'

				// This gets deleted once the nextsegment line is activated, so it doesnt linger for long
				ps.push(asyncCollectionUpsert(SegmentLineItems, sli._id, sli))
				roData.segmentLineItems.push(sli) // update the local collection

			})
		}
		waitForPromiseAll(ps)
		afterTake(runningOrder, takeSegmentLine, previousSegmentLine || null)

		// last:
		SegmentLines.update(takeSegmentLine._id, {
			$push: {
				'timings.takeDone': getCurrentTime()
			}
		})
	}
	export function roSetNext (roId: string, nextSlId: string | null, setManually?: boolean) {
		check(roId, String)
		if (nextSlId) check(nextSlId, String)

		const runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(501, `RunningOrder "${roId}" is not active!`)

		if (runningOrder.holdState && runningOrder.holdState !== RunningOrderHoldState.COMPLETE) throw new Meteor.Error(501, `RunningOrder "${roId}" cannot change next during hold!`)

		let nextSegmentLine: SegmentLine | null = null
		if (nextSlId) {
			nextSegmentLine = SegmentLines.findOne(nextSlId) || null
			if (!nextSegmentLine) throw new Meteor.Error(404, `Segment Line "${nextSlId}" not found!`)
		}

		setNextSegmentLine(runningOrder, nextSegmentLine, setManually)

		// remove old auto-next from timeline, and add new one
		updateTimeline(runningOrder.studioInstallationId)
	}
	export function roMoveNext (roId: string, horisontalDelta: number, verticalDelta: number, setManually: boolean, currentNextSegmentLineItemId?: string) {
		check(roId, String)
		check(horisontalDelta, Number)
		check(verticalDelta, Number)

		if (!horisontalDelta && !verticalDelta) throw new Meteor.Error(402, `roMoveNext: invalid delta: (${horisontalDelta}, ${verticalDelta})`)

		const runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(501, `RunningOrder "${roId}" is not active!`)

		if (runningOrder.holdState && runningOrder.holdState !== RunningOrderHoldState.COMPLETE) throw new Meteor.Error(501, `RunningOrder "${roId}" cannot change next during hold!`)

		let currentNextSegmentLineItem: SegmentLine
		if (currentNextSegmentLineItemId) {
			currentNextSegmentLineItem = SegmentLines.findOne(currentNextSegmentLineItemId) as SegmentLine
		} else {
			if (!runningOrder.nextSegmentLineId) throw new Meteor.Error(501, `RunningOrder "${roId}" has no next segmentLine!`)
			currentNextSegmentLineItem = SegmentLines.findOne(runningOrder.nextSegmentLineId) as SegmentLine
		}

		if (!currentNextSegmentLineItem) throw new Meteor.Error(404, `SegmentLine "${runningOrder.nextSegmentLineId}" not found!`)

		let currentNextSegment = Segments.findOne(currentNextSegmentLineItem.segmentId) as Segment
		if (!currentNextSegment) throw new Meteor.Error(404, `Segment "${currentNextSegmentLineItem.segmentId}" not found!`)

		let segmentLines = runningOrder.getSegmentLines()
		let segments = runningOrder.getSegments()

		let segmentLineIndex: number = -1
		_.find(segmentLines, (sl, i) => {
			if (sl._id === currentNextSegmentLineItem._id) {
				segmentLineIndex = i
				return true
			}
		})
		let segmentIndex: number = -1
		_.find(segments, (s, i) => {
			if (s._id === currentNextSegment._id) {
				segmentIndex = i
				return true
			}
		})
		if (segmentLineIndex === -1) throw new Meteor.Error(404, `SegmentLine not found in list of segmentLines!`)
		if (segmentIndex === -1) throw new Meteor.Error(404, `Segment not found in list of segments!`)

		if (verticalDelta !== 0) {
			segmentIndex += verticalDelta

			let segment = segments[segmentIndex]

			let segmentLinesInSegment = segment.getSegmentLines()
			let segmentLine = _.first(segmentLinesInSegment) as SegmentLine
			if (!segmentLine) throw new Meteor.Error(404, `No SegmentLines in segment "${segment._id}"!`)

			segmentLineIndex = -1
			_.find(segmentLines, (sl, i) => {
				if (sl._id === segmentLine._id) {
					segmentLineIndex = i
					return true
				}
			})
			if (segmentLineIndex === -1) throw new Meteor.Error(404, `SegmentLine (from segment) not found in list of segmentLines!`)
		}

		segmentLineIndex += horisontalDelta

		segmentLineIndex = Math.max(0, Math.min(segmentLines.length - 1, segmentLineIndex))

		let segmentLine = segmentLines[segmentLineIndex]
		if (!segmentLine) throw new Meteor.Error(501, `SegmentLine index ${segmentLineIndex} not found in list of segmentLines!`)

		if (segmentLine._id === runningOrder.currentSegmentLineId && !currentNextSegmentLineItemId) {
			// Whoops, we're not allowed to next to that.
			// Skip it, then (ie run the whole thing again)
			return ServerPlayoutAPI.roMoveNext (roId, horisontalDelta, verticalDelta, setManually, segmentLine._id)
		} else {
			ServerPlayoutAPI.roSetNext(runningOrder._id, segmentLine._id, setManually)
			return segmentLine._id
		}

	}
	export function roActivateHold (roId: string) {
		check(roId, String)
		console.log('roActivateHold')

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		if (!runningOrder.currentSegmentLineId) throw new Meteor.Error(400, `RunningOrder "${roId}" no current segmentline!`)
		if (!runningOrder.nextSegmentLineId) throw new Meteor.Error(400, `RunningOrder "${roId}" no current segmentline!`)

		let currentSegmentLine = SegmentLines.findOne({_id: runningOrder.currentSegmentLineId})
		if (!currentSegmentLine) throw new Meteor.Error(404, `Segment Line "${runningOrder.currentSegmentLineId}" not found!`)
		let nextSegmentLine = SegmentLines.findOne({_id: runningOrder.nextSegmentLineId})
		if (!nextSegmentLine) throw new Meteor.Error(404, `Segment Line "${runningOrder.nextSegmentLineId}" not found!`)

		if (currentSegmentLine.holdMode !== SegmentLineHoldMode.FROM || nextSegmentLine.holdMode !== SegmentLineHoldMode.TO) {
			throw new Meteor.Error(400, `RunningOrder "${roId}" incompatible pair of HoldMode!`)
		}

		if (runningOrder.holdState) {
			throw new Meteor.Error(400, `RunningOrder "${roId}" already doing a hold!`)
		}

		RunningOrders.update(roId, { $set: { holdState: RunningOrderHoldState.PENDING } })

		updateTimeline(runningOrder.studioInstallationId)

	}
	export function roStoriesMoved (roId: string, onAirNextWindowWidth: number | undefined, nextPosition: number | undefined) {
		check(roId, String)
		check(onAirNextWindowWidth, Match.Maybe(Number))
		check(nextPosition, Match.Maybe(Number))

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		if (runningOrder.nextSegmentLineId) {
			let currentSegmentLine: SegmentLine | undefined = undefined
			let nextSegmentLine: SegmentLine | undefined = undefined
			if (runningOrder.currentSegmentLineId) {
				currentSegmentLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)
			}
			if (runningOrder.nextSegmentLineId) {
				nextSegmentLine = SegmentLines.findOne(runningOrder.nextSegmentLineId)
			}
			if (currentSegmentLine && onAirNextWindowWidth === 2) { // the next line was next to onAir line
				const newNextLine = runningOrder.getSegmentLines({
					_rank: {
						$gt: currentSegmentLine._rank
					}
				}, {
					limit: 1
				})[0]
				setNextSegmentLine(runningOrder, newNextLine || null)
			} else if (!currentSegmentLine && nextSegmentLine && onAirNextWindowWidth === undefined && nextPosition !== undefined) {
				const newNextLine = runningOrder.getSegmentLines({}, {
					limit: nextPosition
				})[0]
				setNextSegmentLine(runningOrder, newNextLine || null)

			}
		}
	}
	export function roDisableNextSegmentLineItem (roId: string, undo?: boolean): string | null {
		check(roId, String)

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.currentSegmentLineId) throw new Meteor.Error(401, `No current segmentLine!`)

		let studio = runningOrder.getStudioInstallation()

		let currentSegmentLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)
		if (!currentSegmentLine) throw new Meteor.Error(404, `SegmentLine "${runningOrder.currentSegmentLineId}" not found!`)

		let nextSegmentLine = (runningOrder.nextSegmentLineId ? SegmentLines.findOne(runningOrder.nextSegmentLineId) : undefined)

		let currentSement = Segments.findOne(currentSegmentLine.segmentId)
		if (!currentSement) throw new Meteor.Error(404, `Segment "${currentSegmentLine.segmentId}" not found!`)

		let o = getResolvedSegment(studio, runningOrder, currentSement)

		// @ts-ignore stringify
		// logger.info(o)
		// logger.info(JSON.stringify(o, '', 2))

		let allowedSourceLayers: {[layerId: string]: ISourceLayerExtended} = {}
		_.each(o.segmentExtended.sourceLayers, (sourceLayer: ISourceLayerExtended) => {
			if (sourceLayer.allowDisable) allowedSourceLayers[sourceLayer._id] = sourceLayer
		})

		// logger.info('allowedSourceLayers', allowedSourceLayers)

		// logger.info('nowInSegmentLine', nowInSegmentLine)
		// logger.info('filteredSegmentLineItems', filteredSegmentLineItems)
		let getNextSegmentLineItem = (segmentLine: SegmentLine, undo?: boolean) => {
			// Find next segmentLineItem to disable

			let nowInSegmentLine = 0
			if (
				segmentLine.startedPlayback &&
				segmentLine.timings &&
				segmentLine.timings.startedPlayback
			) {
				let lastStartedPlayback = _.last(segmentLine.timings.startedPlayback)

				if (lastStartedPlayback) {
					nowInSegmentLine = getCurrentTime() - lastStartedPlayback
				}
			}

			let segmentLineItems: Array<SegmentLineItemResolved> = getOrderedSegmentLineItem(segmentLine)

			let findLast: boolean = !!undo

			let filteredSegmentLineItems = _.sortBy(
				_.filter(segmentLineItems, (sli: SegmentLineItemResolved) => {
					let sourceLayer = allowedSourceLayers[sli.sourceLayerId]
					if (sourceLayer && sourceLayer.allowDisable && !sli.virtual) return true
					return false
				}),
				(sli: SegmentLineItemResolved) => {
					let sourceLayer = allowedSourceLayers[sli.sourceLayerId]
					return sourceLayer._rank || -9999
				}
			)
			if (findLast) filteredSegmentLineItems.reverse()

			let nextSegmentLineItem: SegmentLineItemResolved | undefined = _.find(filteredSegmentLineItems, (sli) => {
				logger.info('sli.resolvedStart', sli.resolvedStart)
				return (
					sli.resolvedStart >= nowInSegmentLine &&
					(
						(
							!undo &&
							!sli.disabled
						) || (
							undo &&
							sli.disabled
						)
					)
				)
			})
			return nextSegmentLineItem
		}

		if (nextSegmentLine) {
			// pretend that the next segmentLine never has played (even if it has)
			nextSegmentLine.startedPlayback = false
		}

		let sls = [
			currentSegmentLine,
			nextSegmentLine // If not found in currently playing segmentLine, let's look in the next one:
		]
		if (undo) sls.reverse()

		let nextSegmentLineItem: SegmentLineItemResolved | undefined

		_.each(sls, (sl) => {
			if (sl && !nextSegmentLineItem) {
				nextSegmentLineItem = getNextSegmentLineItem(sl, undo)
			}
		})

		if (nextSegmentLineItem) {
			logger.info((undo ? 'Disabling' : 'Enabling') + ' next segmentLineItem ' + nextSegmentLineItem._id)
			SegmentLineItems.update(nextSegmentLineItem._id, {$set: {
				disabled: !undo
			}})
			updateTimeline(studio._id)

			return nextSegmentLineItem._id
		} else {
			return null
		}
	}

	export function sliPlaybackStartedCallback (roId: string, sliId: string, startedPlayback: Time) {
		check(roId, String)
		check(sliId, String)
		check(startedPlayback, Number)

		// This method is called when an auto-next event occurs
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		let segLineItem = SegmentLineItems.findOne({
			_id: sliId,
			runningOrderId: roId
		})
		if (!segLineItem) {
			throw new Meteor.Error(404, `Segment line item "${sliId}" in running order "${roId}" not found!`)
		}

		let segLine = SegmentLines.findOne({
			_id: segLineItem.segmentLineId,
			runningOrderId: roId
		})
		if (!segLine) {
			throw new Meteor.Error(404, `Segment line "${segLineItem._id}" in running order "${roId}" not found!`)
		}

		if (!segLineItem.startedPlayback) {
			logger.info(`Playout reports segmentLineItem "${sliId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

			reportSegmentLineItemHasStarted(segLineItem, startedPlayback)

			// We don't need to bother with an updateTimeline(), as this hasnt changed anything, but lets us accurately add started items when reevaluating
		}
	}

	export function slPlaybackStartedCallback (roId: string, slId: string, startedPlayback: Time) {
		check(roId, String)
		check(slId, String)
		check(startedPlayback, Number)

		// This method is called when an auto-next event occurs
		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(501, `RunningOrder "${roId}" is not active!`)

		let playingSegmentLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})

		let currentSegmentLine = (runningOrder.currentSegmentLineId ?
			SegmentLines.findOne(runningOrder.currentSegmentLineId)
			: null
		)

		if (playingSegmentLine) {
			// make sure we don't run multiple times, even if TSR calls us multiple times
			if (!playingSegmentLine.startedPlayback) {
				logger.info(`Playout reports segmentLine "${slId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

				if (runningOrder.currentSegmentLineId === slId) {
					// this is the current segment line, it has just started playback
					if (runningOrder.previousSegmentLineId) {
						let prevSegLine = SegmentLines.findOne(runningOrder.previousSegmentLineId)

						if (!prevSegLine) {
							// We couldn't find the previous segment line: this is not a critical issue, but is clearly is a symptom of a larger issue
							logger.error(`Previous segment line "${runningOrder.previousSegmentLineId}" on running order "${roId}" could not be found.`)
						} else if (!prevSegLine.duration) {
							segmentLineStoppedPlaying(roId, prevSegLine, startedPlayback)
						}
					}

					setRunningOrderStartedPlayback(runningOrder, startedPlayback) // Set startedPlayback on the running order if this is the first item to be played
				} else if (runningOrder.nextSegmentLineId === slId) {
					// this is the next segment line, clearly an autoNext has taken place
					if (runningOrder.currentSegmentLineId) {
						// let currentSegmentLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)

						if (!currentSegmentLine) {
							// We couldn't find the previous segment line: this is not a critical issue, but is clearly is a symptom of a larger issue
							logger.error(`Previous segment line "${runningOrder.currentSegmentLineId}" on running order "${roId}" could not be found.`)
						} else if (!currentSegmentLine.duration) {
							segmentLineStoppedPlaying(roId, currentSegmentLine, startedPlayback)
						}
					}

					setRunningOrderStartedPlayback(runningOrder, startedPlayback) // Set startedPlayback on the running order if this is the first item to be played

					let segmentLinesAfter = runningOrder.getSegmentLines({
						_rank: {
							$gt: playingSegmentLine._rank,
						},
						_id: { $ne: playingSegmentLine._id }
					})

					let nextSegmentLine: SegmentLine | null = _.first(segmentLinesAfter) || null

					const roChange = {
						previousSegmentLineId: runningOrder.currentSegmentLineId,
						currentSegmentLineId: playingSegmentLine._id,
						holdState: RunningOrderHoldState.NONE,
					}

					RunningOrders.update(runningOrder._id, {
						$set: roChange
					})
					runningOrder = _.extend(runningOrder, roChange) as RunningOrder

					setNextSegmentLine(runningOrder, nextSegmentLine)
				} else {
					// a segment line is being played that has not been selected for playback by Core
					// show must go on, so find next segmentLine and update the RunningOrder, but log an error
					let segmentLinesAfter = runningOrder.getSegmentLines({
						_rank: {
							$gt: playingSegmentLine._rank,
						},
						_id: { $ne: playingSegmentLine._id }
					})

					let nextSegmentLine: SegmentLine | null = segmentLinesAfter[0] || null

					setRunningOrderStartedPlayback(runningOrder, startedPlayback) // Set startedPlayback on the running order if this is the first item to be played

					const roChange = {
						previousSegmentLineId: null,
						currentSegmentLineId: playingSegmentLine._id,
					}

					RunningOrders.update(runningOrder._id, {
						$set: roChange
					})
					runningOrder = _.extend(runningOrder, roChange) as RunningOrder
					setNextSegmentLine(runningOrder, nextSegmentLine)

					logger.error(`Segment Line "${playingSegmentLine._id}" has started playback by the playout gateway, but has not been selected for playback!`)
				}

				reportSegmentLineHasStarted(playingSegmentLine, startedPlayback)

				afterTake(runningOrder, playingSegmentLine, currentSegmentLine || null)
			}
		} else {
			throw new Meteor.Error(404, `Segment line "${slId}" in running order "${roId}" not found!`)
		}
	}
	export const sliTakeNow = function sliTakeNow (roId: string, slId: string, sliId: string) {
		check(roId, String)
		check(slId, String)
		check(sliId, String)

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in an active running order!`)

		let slItem = SegmentLineItems.findOne({
			_id: sliId,
			runningOrderId: roId
		})
		if (!slItem) throw new Meteor.Error(404, `Segment Line Item "${sliId}" not found!`)

		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in a current segment line!`)

		const si = runningOrder.getStudioInstallation()
		const sourceL = si.sourceLayers.find(i => i._id === slItem!.sourceLayerId)
		if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) throw new Meteor.Error(403, `Segment Line "${slId}" is not a GRAPHICS item!`)

		let newSegmentLineItem = convertAdLibToSLineItem(slItem, segLine, false)
		if (newSegmentLineItem.content && newSegmentLineItem.content.timelineObjects) {
			newSegmentLineItem.content.timelineObjects = prefixAllObjectIds(_.compact(newSegmentLineItem.content.timelineObjects), newSegmentLineItem._id)
		}

		// disable the original SLI if from the same SL
		if (slItem.segmentLineId === segLine._id) {
			const segmentLineItems = getResolvedSegmentLineItems(segLine)
			const resSlItem = segmentLineItems.find(item => item._id === slItem!._id)

			if (slItem.startedPlayback && slItem.startedPlayback <= getCurrentTime()) {
				if (resSlItem && resSlItem.duration !== undefined && (slItem.infiniteMode || slItem.startedPlayback + resSlItem.duration >= getCurrentTime())) {
					logger.debug(`Segment Line Item "${slItem._id}" is currently live and cannot be used as an ad-lib`)
					return literal<ClientAPI.ClientResponse>({
						error: 409,
						message: `Segment Line Item "${slItem._id}" is currently live and cannot be used as an ad-lib`
					})
				}
			}

			SegmentLineItems.update(slItem._id, {$set: {
				disabled: true,
				hidden: true
			}})
		}
		SegmentLineItems.insert(newSegmentLineItem)

		cropInfinitesOnLayer(runningOrder, segLine, newSegmentLineItem)
		stopInfinitesRunningOnLayer(runningOrder, segLine, newSegmentLineItem.sourceLayerId)
		updateTimeline(runningOrder.studioInstallationId)

		return literal<ClientAPI.ClientResponse>({
			success: 200
		})
	}
	export const salliPlaybackStart = syncFunction(function salliPlaybackStart (roId: string, slId: string, slaiId: string, queue: boolean) {
		check(roId, String)
		check(slId, String)
		check(slaiId, String)

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in an active running order!`)

		let adLibItem = SegmentLineAdLibItems.findOne({
			_id: slaiId,
			runningOrderId: roId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Segment Line Ad Lib Item "${slaiId}" not found!`)

		if (queue) {
			// insert a NEW, adlibbed segmentLine after this segmentLine
			slId = adlibQueueInsertSegmentLine (runningOrder, slId, adLibItem )
		}
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		if (!queue && runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in a current segment line!`)
		let newSegmentLineItem = convertAdLibToSLineItem(adLibItem, segLine, queue)
		SegmentLineItems.insert(newSegmentLineItem)

		// logger.debug('adLibItemStart', newSegmentLineItem)
		if (queue) {
			ServerPlayoutAPI.roSetNext(runningOrder._id, slId)
		} else {
			cropInfinitesOnLayer(runningOrder, segLine, newSegmentLineItem)
			stopInfinitesRunningOnLayer(runningOrder, segLine, newSegmentLineItem.sourceLayerId)
			updateTimeline(runningOrder.studioInstallationId)
		}
	})
	export const robaliPlaybackStart = syncFunction(function robaliPlaybackStart (roId: string, slId: string, robaliId: string, queue: boolean) {
		check(roId, String)
		check(slId, String)
		check(robaliId, String)
		logger.info('robaliPlaybackStart')

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		let adLibItem = RunningOrderBaselineAdLibItems.findOne({
			_id: robaliId,
			runningOrderId: roId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Running Order Baseline Ad Lib Item "${robaliId}" not found!`)
		if (queue) {
			// insert a NEW, adlibbed segmentLine after this segmentLine
			slId = adlibQueueInsertSegmentLine (runningOrder, slId, adLibItem )
		}

		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Running Order Baseline Ad Lib Items can be only placed in an active running order!`)
		if (!queue && runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Running Order Baseline Ad Lib Items can be only placed in a current segment line!`)

		let newSegmentLineItem = convertAdLibToSLineItem(adLibItem, segLine, queue)
		SegmentLineItems.insert(newSegmentLineItem)
		// logger.debug('adLibItemStart', newSegmentLineItem)

		if (queue) {
			ServerPlayoutAPI.roSetNext(runningOrder._id, slId)
		} else {
			cropInfinitesOnLayer(runningOrder, segLine, newSegmentLineItem)
			stopInfinitesRunningOnLayer(runningOrder, segLine, newSegmentLineItem.sourceLayerId)
			updateTimeline(runningOrder.studioInstallationId)
		}
	})
	export function adlibQueueInsertSegmentLine (ro: RunningOrder, slId: string, sladli: SegmentLineAdLibItem) {

		// let segmentLines = ro.getSegmentLines()
		logger.info('adlibQueueInsertSegmentLine')

		let segmentLine = SegmentLines.findOne(slId)
		if (!segmentLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)

		let nextSegmentLine = fetchAfter(SegmentLines, {
			runningOrderId: ro._id
		}, segmentLine._rank)

		let newRank = getRank(segmentLine, nextSegmentLine, 0, 1)

		let newSegmentLineId = Random.id()
		SegmentLines.insert({
			_id: newSegmentLineId,
			_rank: 99999, // something high, so it will be placed last
			mosId: '',
			segmentId: segmentLine.segmentId,
			runningOrderId: ro._id,
			slug: sladli.name,
			dynamicallyInserted: true,
			afterSegmentLine: segmentLine._id,
			typeVariant: 'adlib'
		})

		updateSegmentLines(ro._id) // place in order

		return newSegmentLineId

	}
	export function salliStop (roId: string, slId: string, sliId: string) {
		check(roId, String)
		check(slId, String)
		check(sliId, String)

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
			_id: getSliGroupId(sliId)
		})
		let parentOffset = 0
		if (!alCopyItem) throw new Meteor.Error(404, `Segment Line Ad Lib Copy Item "${sliId}" not found!`)
		if (!alCopyItemTObj) throw new Meteor.Error(404, `Segment Line Ad Lib Copy Item "${sliId}" not found in the playout Timeline!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Ad Lib Copy Items can be only manipulated in an active running order!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Copy Items can be only manipulated in a current segment line!`)
		if (!alCopyItem.dynamicallyInserted) throw new Meteor.Error(501, `"${sliId}" does not appear to be a dynamic Segment Line Item!`)
		if (!alCopyItem.adLibSourceId) throw new Meteor.Error(501, `"${sliId}" does not appear to be a Segment Line Ad Lib Copy Item!`)

		// The ad-lib item positioning will be relative to the startedPlayback of the segment line
		if (segLine.startedPlayback) {
			parentOffset = segLine.getLastStartedPlayback() || parentOffset
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
		}, {
			$set: {
				duration: newExpectedDuration
			}
		})

		updateTimeline(runningOrder.studioInstallationId)
	}
	export const sourceLayerStickyItemStart = syncFunction(function sourceLayerStickyItemStart (roId: string, sourceLayerId: string) {
		check(roId, String)
		check(sourceLayerId, String)

		const runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Items can be only manipulated in an active running order!`)
		if (!runningOrder.currentSegmentLineId) throw new Meteor.Error(400, `A segment line needs to be active to place a sticky item`)

		const studio = StudioInstallations.findOne(runningOrder.studioInstallationId)
		if (!studio) throw new Meteor.Error(501, `Studio "${runningOrder.studioInstallationId}" not found!`)

		const sourceLayer = studio.sourceLayers.find(i => i._id === sourceLayerId)
		if (!sourceLayer) throw new Meteor.Error(404, `Source layer "${sourceLayerId}" not found!`)
		if (!sourceLayer.isSticky) throw new Meteor.Error(400, `Only sticky layers can be restarted. "${sourceLayerId}" is not sticky.`)

		const lastSegmentLineItems = SegmentLineItems.find({
			runningOrderId: runningOrder._id,
			sourceLayerId: sourceLayer._id,
			startedPlayback: {
				$exists: true
			}
		}, {
			sort: {
				startedPlayback: -1
			},
			limit: 1
		}).fetch()

		if (lastSegmentLineItems.length > 0) {
			const currentSegmentLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)
			if (!currentSegmentLine) throw new Meteor.Error(501, `Current Segment Line "${runningOrder.currentSegmentLineId}" could not be found.`)

			const lastItem = convertSLineToAdLibItem(lastSegmentLineItems[0])
			const newAdLibSegmentLineItem = convertAdLibToSLineItem(lastItem, currentSegmentLine, false)

			SegmentLineItems.insert(newAdLibSegmentLineItem)

			// logger.debug('adLibItemStart', newSegmentLineItem)

			cropInfinitesOnLayer(runningOrder, currentSegmentLine, newAdLibSegmentLineItem)
			stopInfinitesRunningOnLayer(runningOrder, currentSegmentLine, newAdLibSegmentLineItem.sourceLayerId)

			updateTimeline(runningOrder.studioInstallationId)
		}
	})
	export function sourceLayerOnLineStop (roId: string, slId: string, sourceLayerId: string) {
		check(roId, String)
		check(slId, String)
		check(sourceLayerId, String)

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Items can be only manipulated in an active running order!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Items can be only manipulated in a current segment line!`)
		if (!segLine.getLastStartedPlayback()) throw new Meteor.Error(405, `Segment Line "${slId}" has yet to start playback!`)

		const now = getCurrentTime()
		const relativeNow = now - (segLine.getLastStartedPlayback() || 0)
		const orderedItems = getResolvedSegmentLineItems(segLine)

		// console.log(JSON.stringify(orderedItems.filter(i => i.sourceLayerId === sourceLayerId).map(i => {
		//  	return {
		//  		startTime: i.trigger.value,
		//  		duration: i.duration || 0,
		//  		id: i._id
		//  	}
		// }), null, 2))

		orderedItems.filter(i => i.sourceLayerId === sourceLayerId).forEach((i) => {
			if (i.startedPlayback && !i.durationOverride && (i.trigger.value < relativeNow) && (((i.trigger.value as number) + (i.duration || 0) > relativeNow) || i.duration === 0)) {
				const newExpectedDuration = now - i.startedPlayback

				console.log(`Cropping item "${i._id}" at ${newExpectedDuration}`)

				SegmentLineItems.update({
		 			_id: i._id
		 		}, {
		 			$set: {
		 				durationOverride: newExpectedDuration
		 			}
		 		})
			}
		})

		updateSourceLayerInfinitesAfterLine(runningOrder, false, segLine)

		updateTimeline(runningOrder.studioInstallationId)
	}
	export const roToggleSegmentLineArgument = syncFunction(function roToggleSegmentLineArgument (roId: string, slId: string, property: string, value: string) {
		check(roId, String)
		check(slId, String)

		const runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `Running order "${roId}" not found!`)

		let segmentLine = SegmentLines.findOne(slId)
		if (!segmentLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)

		const rArguments = segmentLine.runtimeArguments || {}

		if (rArguments[property] === value) {
			// unset property
			const mUnset = {}
			mUnset['runtimeArguments.' + property] = 1
			SegmentLines.update(segmentLine._id, {$unset: mUnset, $set: {
				dirty: true
			}})
		} else {
			// set property
			const mSet: any = {}
			mSet['runtimeArguments.' + property] = value
			mSet.dirty = true
			SegmentLines.update(segmentLine._id, {$set: mSet})
		}

		segmentLine = SegmentLines.findOne(slId)

		if (!segmentLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)

		refreshSegmentLine(runningOrder, segmentLine)

		// Only take time to update the timeline if there's a point to do it
		if (runningOrder.active) {
			// If this SL is RO's next, check if current SL has autoNext
			if ((runningOrder.nextSegmentLineId === segmentLine._id) && runningOrder.currentSegmentLineId) {
				const currentSegmentLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)
				if (currentSegmentLine && currentSegmentLine.autoNext) {
					updateTimeline(runningOrder.studioInstallationId)
				}
			// If this is RO's current SL, update immediately
			} else if (runningOrder.currentSegmentLineId === segmentLine._id) {
				updateTimeline(runningOrder.studioInstallationId)
			}
		}
	})
	export function timelineTriggerTimeUpdateCallback (timelineObjId: string, time: number) {
		check(timelineObjId, String)
		check(time, Number)

		let tObj = Timeline.findOne(timelineObjId)
		if (!tObj) throw new Meteor.Error(404, `Timeline obj "${timelineObjId}" not found!`)

		if (tObj.metadata && tObj.metadata.segmentLineItemId) {
			logger.debug('Update segment line item: ', tObj.metadata.segmentLineItemId, (new Date(time)).toTimeString())
			SegmentLineItems.update({
				_id: tObj.metadata.segmentLineItemId
			}, {
				$set: {
					trigger: {
						type: TriggerType.TIME_ABSOLUTE,
						value: time
					}
				}
			})
		}
	}
	export function saveEvaluation (evaluation: EvaluationBase): string {
		let id = Evaluations.insert(_.extend(evaluation, {
			userId: this.userId,
			timestamp: getCurrentTime(),
		}))
		Meteor.defer(() => {

			let studio = StudioInstallations.findOne(evaluation.studioId)
			if (!studio) throw new Meteor.Error(500, `Studio ${evaluation.studioId} not found!`)

			let webhookUrl = studio.getConfigValue('slack_evaluation')

			if (webhookUrl) {
				// Only send notes if not everything is OK
				let q0 = _.find(evaluation.answers, (_answer, key) => {
					return key === 'q0'
				})

				if (q0 !== 'nothing') {

					let ro = RunningOrders.findOne(evaluation.runningOrderId)

					let message = 'Uh-oh, message from RunningOrder "' + (ro ? ro.name : 'N/A' ) + '": \n' +
						_.values(evaluation.answers).join(', ')

					let hostUrl = studio.getConfigValue('sofie_url')
					if (hostUrl && ro) {
						message += '\n<' + hostUrl + '/ro/' + ro._id + '|' + ro.name + '>'
					}

					sendSlackMessageToWebhook(message, webhookUrl)
				}

			}
		})
		return id
	}
}

let methods = {}
methods[PlayoutAPI.methods.roPrepareForBroadcast] = (roId: string) => {
	return ServerPlayoutAPI.roPrepareForBroadcast(roId)
}
methods[PlayoutAPI.methods.roResetRunningOrder] = (roId: string) => {
	return ServerPlayoutAPI.roResetRunningOrder(roId)
}
methods[PlayoutAPI.methods.roResetAndActivate] = (roId: string) => {
	return ServerPlayoutAPI.roResetAndActivate(roId)
}
methods[PlayoutAPI.methods.roActivate] = (roId: string, rehearsal: boolean) => {
	return ServerPlayoutAPI.roActivate(roId, rehearsal)
}
methods[PlayoutAPI.methods.roDeactivate] = (roId: string, rehearsal: boolean) => {
	return ServerPlayoutAPI.roDeactivate(roId, rehearsal)
}
methods[PlayoutAPI.methods.reloadData] = (roId: string) => {
	return ServerPlayoutAPI.reloadData(roId)
}
methods[PlayoutAPI.methods.segmentLineItemTakeNow] = (roId: string, slId: string, sliId: string) => {
	return ServerPlayoutAPI.sliTakeNow(roId, slId, sliId)
}
methods[PlayoutAPI.methods.roTake] = (roId: string) => {
	return ServerPlayoutAPI.roTake(roId)
}
methods[PlayoutAPI.methods.userRoTake] = (roId: string) => {
	return ServerPlayoutAPI.userRoTake(roId)
}
methods[PlayoutAPI.methods.roToggleSegmentLineArgument] = (roId: string, slId: string, property: string, value: string) => {
	return ServerPlayoutAPI.roToggleSegmentLineArgument(roId, slId, property, value)
}
methods[PlayoutAPI.methods.roSetNext] = (roId: string, slId: string) => {
	return ServerPlayoutAPI.roSetNext(roId, slId, true)
}
methods[PlayoutAPI.methods.roMoveNext] = (roId: string, horisontalDelta: number, verticalDelta: number) => {
	return ServerPlayoutAPI.roMoveNext(roId, horisontalDelta, verticalDelta, true)
}
methods[PlayoutAPI.methods.roActivateHold] = (roId: string) => {
	return ServerPlayoutAPI.roActivateHold(roId)
}
methods[PlayoutAPI.methods.roStoriesMoved] = (roId: string, onAirNextWindowWidth: number | undefined, nextPosition: number | undefined) => {
	return ServerPlayoutAPI.roStoriesMoved(roId, onAirNextWindowWidth, nextPosition)
}
methods[PlayoutAPI.methods.roDisableNextSegmentLineItem] = (roId: string, undo?: boolean) => {
	return ServerPlayoutAPI.roDisableNextSegmentLineItem(roId, undo)
}
methods[PlayoutAPI.methods.segmentLinePlaybackStartedCallback] = (roId: string, slId: string, startedPlayback: number) => {
	return ServerPlayoutAPI.slPlaybackStartedCallback(roId, slId, startedPlayback)
}
methods[PlayoutAPI.methods.segmentLineItemPlaybackStartedCallback] = (roId: string, sliId: string, startedPlayback: number) => {
	return ServerPlayoutAPI.sliPlaybackStartedCallback(roId, sliId, startedPlayback)
}
methods[PlayoutAPI.methods.segmentAdLibLineItemStart] = (roId: string, slId: string, salliId: string, queue: boolean) => {
	return ServerPlayoutAPI.salliPlaybackStart(roId, slId, salliId, queue)
}
methods[PlayoutAPI.methods.runningOrderBaselineAdLibItemStart] = (roId: string, slId: string, robaliId: string, queue: boolean) => {
	return ServerPlayoutAPI.robaliPlaybackStart(roId, slId, robaliId, queue)
}
methods[PlayoutAPI.methods.segmentAdLibLineItemStop] = (roId: string, slId: string, sliId: string) => {
	return ServerPlayoutAPI.salliStop(roId, slId, sliId)
}
methods[PlayoutAPI.methods.sourceLayerOnLineStop] = (roId: string, slId: string, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerOnLineStop(roId, slId, sourceLayerId)
}
methods[PlayoutAPI.methods.timelineTriggerTimeUpdateCallback] = (timelineObjId: string, time: number) => {
	return ServerPlayoutAPI.timelineTriggerTimeUpdateCallback(timelineObjId, time)
}
methods[PlayoutAPI.methods.sourceLayerStickyItemStart] = (roId: string, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerStickyItemStart(roId, sourceLayerId)
}
methods[PlayoutAPI.methods.saveEvaluation] = (evaluation: EvaluationBase) => {
	return ServerPlayoutAPI.saveEvaluation(evaluation)
}

_.each(methods, (fcn: Function, key) => {
	methods[key] = function (...args: any[]) {
		// logger.info('------- Method call -------')
		// logger.info(key)
		// logger.info(args)
		// logger.info('---------------------------')
		try {
			return fcn.apply(this, args)
		} catch (e) {
			logger.error(e.message || e.reason || (e.toString ? e.toString() : null) || e)
			throw e
		}
	}
})

// Apply methods:
setMeteorMethods(methods)

// Temporary methods
setMeteorMethods({
	'debug__printTime': () => {
		let now = getCurrentTime()
		logger.debug(new Date(now))
		return now
	},
})

function beforeTake (roData: RoData, currentSegmentLine: SegmentLine | null, nextSegmentLine: SegmentLine) {
	if (currentSegmentLine) {
		const adjacentSL = _.find(roData.segmentLines, (sl) => {
			return (
				sl.segmentId === currentSegmentLine.segmentId &&
				sl._rank > currentSegmentLine._rank
			)
		})
		if (!adjacentSL || adjacentSL._id !== nextSegmentLine._id) {
			// adjacent Segment Line isn't the next segment line, do not overflow
			return
		}
		let ps: Array<Promise<any>> = []
		const currentSLIs = currentSegmentLine.getAllSegmentLineItems()
		currentSLIs.forEach((item) => {
			if (item.overflows && typeof item.expectedDuration === 'number' && item.expectedDuration > 0 && item.duration === undefined && item.durationOverride === undefined) {
				// Clone an overflowing segment line item
				let overflowedItem = _.extend({
					_id: Random.id(),
					segmentLineId: nextSegmentLine._id,
					trigger: {
						type: TriggerType.TIME_ABSOLUTE,
						value: 0
					},
					dynamicallyInserted: true,
					continuesRefId: item._id,

					// Subtract the amount played from the expected duration
					expectedDuration: Math.max(0, item.expectedDuration - ((item.startedPlayback || currentSegmentLine.getLastStartedPlayback() || getCurrentTime()) - getCurrentTime()))
				}, _.omit(clone(item) as SegmentLineItem, 'startedPlayback', 'duration', 'overflows'))

				if (overflowedItem.expectedDuration > 0) {
					ps.push(asyncCollectionInsert(SegmentLineItems, overflowedItem))
					roData.segmentLineItems.push(overflowedItem) // update the cache
				}
			}
		})
		waitForPromiseAll(ps)
	}
}

function afterTake (runningOrder: RunningOrder, takeSegmentLine: SegmentLine, previousSegmentLine: SegmentLine | null) {
	// This function should be called at the end of a "take" event (when the SegmentLines have been updated)
	updateTimeline(runningOrder.studioInstallationId)

	// defer these so that the playout gateway has the chance to learn about the changes
	Meteor.setTimeout(() => {
		if (takeSegmentLine.updateStoryStatus) {
			sendStoryStatus(runningOrder, takeSegmentLine)
		}

		triggerExternalMessage(runningOrder, takeSegmentLine, previousSegmentLine)
	}, 40)
}

function getResolvedSegmentLineItems (line: SegmentLine): SegmentLineItem[] {
	const items = line.getAllSegmentLineItems()

	const itemMap: { [key: string]: SegmentLineItem } = {}
	items.forEach(i => itemMap[i._id] = i)

	const objs = items.map(i => clone(createSegmentLineItemGroup(i, i.durationOverride || i.duration || i.expectedDuration || 0)))
	objs.forEach(o => {
		if (o.trigger.type === TriggerType.TIME_ABSOLUTE && (o.trigger.value === 0 || o.trigger.value === 'now')) {
			o.trigger.value = 1
		}
	})
	const events = Resolver.getTimelineInWindow(transformTimeline(objs))

	let eventMap = events.resolved.map(e => {
		const id = ((e as any || {}).metadata || {}).segmentLineItemId
		return {
			start: e.resolved.startTime || 0,
			end: e.resolved.endTime || 0,
			id: id,
			item: itemMap[id]
		}
	})
	events.unresolved.forEach(e => {
		const id = ((e as any || {}).metadata || {}).segmentLineItemId
		eventMap.push({
			start: 0,
			end: 0,
			id: id,
			item: itemMap[id]
		})
	})
	if (events.unresolved.length > 0) {
		logger.warn('got ' + events.unresolved.length + ' unresolved items for sli #' + line._id)
	}
	if (items.length !== eventMap.length) {
		logger.warn('got ' + eventMap.length + ' ordered items. expected ' + items.length + '. for sli #' + line._id)
	}

	eventMap.sort((a, b) => {
		if (a.start < b.start) {
			return -1
		} else if (a.start > b.start) {
			return 1
		} else {
			if (a.item.isTransition === b.item.isTransition) {
				return 0
			} else if (b.item.isTransition) {
				return 1
			} else {
				return -1
			}
		}
	})

	const processedItems = eventMap.map(e => _.extend(e.item, {
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: Math.max(0, e.start - 1)
		},
		duration: Math.max(0, e.end - e.start)
	}) as SegmentLineItem)

	// crop infinite items
	processedItems.forEach((value, index, source) => {
		if (value.infiniteMode) {
			for (let i = index + 1; i < source.length; i++) {
				const li = source[i]
				if (value.sourceLayerId === li.sourceLayerId) {
					value.duration = (li.trigger.value as number) - (value.trigger.value as number)
					return
				}
			}
		}
	})

	return processedItems
}
interface SegmentLineItemResolved extends SegmentLineItem {
	/** Resolved start time of the segmentLineItem */
	resolvedStart: number
	/** Whether the segmentLineItem was successfully resolved */
	resolved: boolean
}
function getOrderedSegmentLineItem (line: SegmentLine): Array<SegmentLineItemResolved> {
	const items = line.getAllSegmentLineItems()

	const itemMap: { [key: string]: SegmentLineItem } = {}
	items.forEach(i => itemMap[i._id] = i)

	const objs: Array<TimelineObj> = items.map(
		i => clone(createSegmentLineItemGroup(i, i.durationOverride || i.duration || i.expectedDuration || 0))
	)
	objs.forEach(o => {
		if (o.trigger.type === TriggerType.TIME_ABSOLUTE && (o.trigger.value === 0 || o.trigger.value === 'now')) {
			o.trigger.value = 100
		}
	})
	const tlResolved = Resolver.getTimelineInWindow(transformTimeline(objs))

	let resolvedItems: Array<SegmentLineItemResolved> = []
	interface IEvent {
		start: number,
		id: string,
		item: SegmentLineItemResolved
	}
	_.each(tlResolved.resolved, e => {
		const id = ((e as any || {}).metadata || {}).segmentLineItemId
		let item = _.clone(itemMap[id]) as SegmentLineItemResolved
		item.resolvedStart = e.resolved.startTime || 0
		item.resolved = true
		resolvedItems.push(item)
	})
	_.each(tlResolved.unresolved, e => {
		const id = ((e as any || {}).metadata || {}).segmentLineItemId

		let item = _.clone(itemMap[id]) as SegmentLineItemResolved
		item.resolvedStart = 0
		item.resolved = false

		resolvedItems.push(item)
	})
	if (tlResolved.unresolved.length > 0) {
		 logger.warn('got ' + tlResolved.unresolved.length + ' unresolved items for sli #' + line._id)
	}
	if (items.length !== resolvedItems.length) {
		logger.warn('got ' + resolvedItems.length + ' ordered items. expected ' + items.length + '. for sli #' + line._id)
	}

	resolvedItems.sort((a, b) => {
		if (a.resolvedStart < b.resolvedStart) return -1
		if (a.resolvedStart > b.resolvedStart) return 1

		if (a.isTransition === b.isTransition) return 0
		if (b.isTransition) return 1
		return -1
	})

	return resolvedItems
}

const updateSourceLayerInfinitesAfterLine: (runningOrder: RunningOrder, runUntilEnd: boolean, previousLine?: SegmentLine) => void
 = syncFunctionIgnore(function updateSourceLayerInfinitesAfterLine (runningOrder: RunningOrder, runUntilEnd: boolean, previousLine?: SegmentLine) {
	let activeInfiniteItems: { [layer: string]: SegmentLineItem } = {}
	let activeInfiniteItemsSegmentId: { [layer: string]: string } = {}

	if (previousLine) {
		// figure out the baseline to set
		let prevItems = getOrderedSegmentLineItem(previousLine)
		for (let item of prevItems) {
			if (!item.infiniteMode || item.duration || item.durationOverride || item.expectedDuration) {
				delete activeInfiniteItems[item.sourceLayerId]
				delete activeInfiniteItemsSegmentId[item.sourceLayerId]
				continue
			}

			if (!item.infiniteId) {
				// ensure infinite id is set
				item.infiniteId = item._id
				SegmentLineItems.update(item._id, { $set: { infiniteId: item.infiniteId } })
			}

			if (item.infiniteMode === SegmentLineItemLifespan.OutOnNextSegmentLine) {
				continue
			}

			activeInfiniteItems[item.sourceLayerId] = item
			activeInfiniteItemsSegmentId[item.sourceLayerId] = previousLine.segmentId
		}
	}

	let linesToProcess = runningOrder.getSegmentLines()
	if (previousLine) {
		linesToProcess = linesToProcess.filter(l => l._rank > previousLine._rank)
	}

	for (let line of linesToProcess) {
		// Drop any that relate only to previous segments
		for (let k in activeInfiniteItemsSegmentId) {
			let s = activeInfiniteItemsSegmentId[k]
			let i = activeInfiniteItems[k]
			if (!i.infiniteMode || i.infiniteMode === SegmentLineItemLifespan.OutOnNextSegment && s !== line.segmentId) {
				delete activeInfiniteItems[k]
				delete activeInfiniteItemsSegmentId[k]
			}
		}

		// ensure any currently defined infinites are still wanted
		let currentItems = getOrderedSegmentLineItem(line)
		let currentInfinites = currentItems.filter(i => i.infiniteId && i.infiniteId !== i._id)
		let removedInfinites: string[] = []
		for (let item of currentInfinites) {
			const active = activeInfiniteItems[item.sourceLayerId]
			if (!active || active.infiniteId !== item.infiniteId) {
				// Previous item no longer enforces the existence of this one
				SegmentLineItems.remove(item)
				removedInfinites.push(item._id)
			}
		}

		// stop if not running to the end and there is/was nothing active
		const midInfinites = currentInfinites.filter(i => !i.expectedDuration && i.infiniteMode)
		if (!runUntilEnd && Object.keys(activeInfiniteItemsSegmentId).length === 0 && midInfinites.length === 0) {
			break
		}

		// figure out what infinites are to be extended
		currentItems = currentItems.filter(i => removedInfinites.indexOf(i._id) < 0)
		for (let k in activeInfiniteItems) {
			let newItem = activeInfiniteItems[k]

			// If something exists on the layer, the infinite must be stopped and potentially replaced
			const exist = currentItems.filter(i => i.sourceLayerId === newItem.sourceLayerId)
			if (exist && exist.length > 0) {
				// remove the existing, as we need to update its contents
				const existInf = exist.findIndex(e => !!e.infiniteId && e.infiniteId === newItem.infiniteId)
				if (existInf >= 0) {
					SegmentLineItems.remove(exist[existInf]._id)
					removedInfinites.push(exist[existInf]._id)
					exist.splice(existInf, 1)
				}

				if (exist.length > 0) {
					// It will be stopped by this line
					delete activeInfiniteItems[k]
					delete activeInfiniteItemsSegmentId[k]

					// if we matched with an infinite, then make sure that infinite is kept going
					if (exist[exist.length - 1].infiniteMode && exist[exist.length - 1].infiniteMode !== SegmentLineItemLifespan.OutOnNextSegmentLine) {
						activeInfiniteItems[k] = exist[0]
						activeInfiniteItemsSegmentId[k] = line.segmentId
					}

					// If something starts at the beginning, then dont bother adding this infinite.
					// Otherwise we should add the infinite but set it to end at the start of the first item
					if (exist[0].trigger.type === TriggerType.TIME_ABSOLUTE) {
						if (exist[0].trigger.value === 0) {
							// skip the infinite, as it will never show
							continue
						}
					}
				}
			}

			newItem.segmentLineId = line._id
			newItem.continuesRefId = newItem._id
			newItem.trigger = {
				type: TriggerType.TIME_ABSOLUTE,
				value: 0
			}
			newItem._id = newItem.infiniteId + '_' + line._id

			if (exist && exist.length) {
				newItem.expectedDuration = `#${getSliGroupId(exist[0])}.start - #.start`
				newItem.infiniteMode = SegmentLineItemLifespan.Normal // it is no longer infinite, and the ui needs this to draw properly
			}

			SegmentLineItems.insert(newItem)
		}

		// find any new infinites exposed by this
		for (let item of currentItems.filter(i => removedInfinites.indexOf(i._id) < 0)) {
			if (!item.infiniteMode || item.duration || item.durationOverride || item.expectedDuration) {
				delete activeInfiniteItems[item.sourceLayerId]
				delete activeInfiniteItemsSegmentId[item.sourceLayerId]
				continue
			}

			if (item.infiniteMode === SegmentLineItemLifespan.OutOnNextSegmentLine) {
				continue
			}

			if (!item.infiniteId) {
				// ensure infinite id is set
				item.infiniteId = item._id
				SegmentLineItems.update(item._id, { $set: { infiniteId: item.infiniteId } })
			}

			activeInfiniteItems[item.sourceLayerId] = item
			activeInfiniteItemsSegmentId[item.sourceLayerId] = line.segmentId
		}
	}
})

const cropInfinitesOnLayer = syncFunction(function cropInfinitesOnLayer (runningOrder: RunningOrder, segLine: SegmentLine, newItem: SegmentLineItem) {
	const studio: StudioInstallation = runningOrder.getStudioInstallation()
	const sourceLayerLookup = normalizeArray(studio.sourceLayers, '_id')
	const newItemExclusivityGroup = sourceLayerLookup[newItem.sourceLayerId].exclusiveGroup

	const items = getOrderedSegmentLineItem(segLine).filter(i =>
		(i.sourceLayerId === newItem.sourceLayerId
			|| (newItemExclusivityGroup && sourceLayerLookup[i.sourceLayerId] && sourceLayerLookup[i.sourceLayerId].exclusiveGroup === newItemExclusivityGroup)
		) && i._id !== newItem._id
	)

	for (const i of items) {
		if (i.infiniteMode && !i.expectedDuration && i.dynamicallyInserted) {
			SegmentLineItems.update({
				_id: i._id
			}, { $set: {
				expectedDuration: `#${getSliGroupId(newItem)}.start - #.start`,
				infiniteMode: SegmentLineItemLifespan.Normal
			}})
		}
	}
})

const stopInfinitesRunningOnLayer = syncFunction(function stopInfinitesRunningOnLayer (runningOrder: RunningOrder, segLine: SegmentLine, sourceLayer: string) {
	let remainingLines = runningOrder.getSegmentLines().filter(l => l._rank > segLine._rank)
	for (let line of remainingLines) {
		let continuations = line.getAllSegmentLineItems().filter(i => i.infiniteMode && i.infiniteId && i.infiniteId !== i._id && i.sourceLayerId === sourceLayer)
		if (continuations.length === 0) {
			break
		}

		continuations.forEach(i => SegmentLineItems.remove(i))
	}

	// ensure adlib is extended correctly if infinite
	updateSourceLayerInfinitesAfterLine(runningOrder, false, segLine)
})

function convertSLineToAdLibItem (segmentLineItem: SegmentLineItem): SegmentLineAdLibItem {
	const oldId = segmentLineItem._id
	const newId = Random.id()
	const newAdLibItem = literal<SegmentLineAdLibItem>(_.extend(
		segmentLineItem,
		{
			_id: newId,
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: 'now'
			},
			dynamicallyInserted: true,
			expectedDuration: segmentLineItem.expectedDuration || 0 // set duration to infinite if not set by AdLibItem
		}
	))
	delete newAdLibItem.trigger

	if (newAdLibItem.content && newAdLibItem.content.timelineObjects) {
		let contentObjects = newAdLibItem.content.timelineObjects
		const objs = prefixAllObjectIds(_.compact(contentObjects), newId + '_')
		newAdLibItem.content.timelineObjects = objs
	}
	return newAdLibItem
}

function convertAdLibToSLineItem (adLibItem: SegmentLineAdLibItem | SegmentLineItem, segmentLine: SegmentLine, queue: boolean): SegmentLineItem {
	const oldId = adLibItem._id
	const newId = Random.id()
	const newSLineItem = literal<SegmentLineItem>(_.extend(
		_.clone(adLibItem),
		{
			_id: newId,
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: ( queue ? 0 : 'now')
			},
			segmentLineId: segmentLine._id,
			adLibSourceId: adLibItem._id,
			dynamicallyInserted: !queue,
			expectedDuration: adLibItem.expectedDuration || 0, // set duration to infinite if not set by AdLibItem
			timings: {
				take: [getCurrentTime()]
			}
		}
	))

	if (newSLineItem.content && newSLineItem.content.timelineObjects) {
		let contentObjects = newSLineItem.content.timelineObjects
		const objs = prefixAllObjectIds(_.compact(contentObjects), newId + '_')
		newSLineItem.content.timelineObjects = objs
	}
	return newSLineItem
}

function setRunningOrderStartedPlayback (runningOrder: RunningOrder, startedPlayback: Time) {
	if (!runningOrder.startedPlayback) { // Set startedPlayback on the running order if this is the first item to be played
		reportRunningOrderHasStarted(runningOrder, startedPlayback)
	}
}

function segmentLineStoppedPlaying (roId: string, segmentLine: SegmentLine, stoppedPlayingTime: Time) {
	const lastStartedPlayback = segmentLine.getLastStartedPlayback()
	if (segmentLine.startedPlayback && lastStartedPlayback && lastStartedPlayback > 0) {
		SegmentLines.update(segmentLine._id, {
			$set: {
				duration: stoppedPlayingTime - lastStartedPlayback
			},
			$push: {
				'timings.stoppedPlayback': stoppedPlayingTime
			}
		})
		segmentLine.duration = stoppedPlayingTime - lastStartedPlayback
		pushOntoPath(segmentLine, 'timings.stoppedPlayback', stoppedPlayingTime)
	} else {
		// logger.warn(`Segment line "${segmentLine._id}" has never started playback on running order "${roId}".`)
	}
}

function createSegmentLineGroup (segmentLine: SegmentLine, duration: number | string): TimelineObj {
	let slGrp = literal<TimelineObjGroupSegmentLine>({
		_id: getSlGroupId(segmentLine),
		id: '',
		siId: '', // added later
		roId: '', // added later
		deviceId: [],
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 'now'
		},
		duration: duration,
		priority: 5,
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
	return literal<TimelineObjSegmentLineAbstract>({
		_id: getSlFirstObjectId(segmentLine),
		id: '',
		siId: '', // added later
		roId: '', // added later
		deviceId: [],
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		duration: 0,
		LLayer: 'core_abstract',
		isAbstract: true,
		content: {
			type: TimelineContentTypeOther.NOTHING,
		},
		// isGroup: true,
		inGroup: segmentLineGroup._id,
		slId: segmentLine._id
	})
}
function createSegmentLineItemGroupFirstObject (segmentLineItem: SegmentLineItem, segmentLineItemGroup: TimelineObj, firstObjClasses?: string[]): TimelineObj {
	return literal<TimelineObjSegmentLineItemAbstract>({
		_id: getSliFirstObjectId(segmentLineItem),
		id: '',
		siId: '', // added later
		roId: '', // added later
		deviceId: [],
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		duration: 0,
		LLayer: segmentLineItem.sourceLayerId + '_firstobject',
		isAbstract: true,
		content: {
			type: TimelineContentTypeOther.NOTHING,
		},
		classes: firstObjClasses,
		inGroup: segmentLineItemGroup._id,
		sliId: segmentLineItem._id,
	})
}

function createSegmentLineItemGroup (
	item: SegmentLineItem,
	duration: number | string,
	segmentLineGroup?: TimelineObj
): TimelineObj {
	return literal<TimelineObjGroup>({
		_id: getSliGroupId(item),
		id: '',
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
		duration: duration,
		LLayer: item.sourceLayerId,
		metadata: {
			segmentLineItemId: item._id
		}
	})
}

function transformBaselineItemsIntoTimeline (items: RunningOrderBaselineItem[]): Array<TimelineObj> {
	let timelineObjs: Array<TimelineObj> = []
	_.each(items, (item: RunningOrderBaselineItem) => {
		// the baseline items are layed out without any grouping
		_.each(item.objects, (o: TimelineObj) => {
			// do some transforms maybe?
			timelineObjs.push(o)
		})
	})
	return timelineObjs
}

function transformSegmentLineIntoTimeline (items: SegmentLineItem[], firstObjClasses: string[], segmentLineGroup?: TimelineObj, allowTransition?: boolean, triggerOffsetForTransition?: string, holdState?: RunningOrderHoldState, showHoldExcept?: boolean): Array<TimelineObj> {
	let timelineObjs: Array<TimelineObj> = []

	const isHold = holdState === RunningOrderHoldState.ACTIVE

	_.each(clone(items), (item: SegmentLineItem) => {
		if (item.disabled) return
		if (item.isTransition && (!allowTransition || isHold)) {
			return
		}

		if (
			item.content &&
			item.content.timelineObjects
		) {
			let tos = item.content.timelineObjects

			if (item.trigger.type === TriggerType.TIME_ABSOLUTE && item.trigger.value === 0) {
				// If timed absolute and there is a transition delay, then apply delay
				if (!item.isTransition && allowTransition && triggerOffsetForTransition && !item.adLibSourceId) {
					item.trigger.type = TriggerType.TIME_RELATIVE
					item.trigger.value = `${triggerOffsetForTransition} + ${item.trigger.value}`
				}
			}

			// create a segmentLineItem group for the items and then place all of them there
			const segmentLineItemGroup = createSegmentLineItemGroup(item, item.durationOverride || item.duration || item.expectedDuration || 0, segmentLineGroup)
			timelineObjs.push(segmentLineItemGroup)
			timelineObjs.push(createSegmentLineItemGroupFirstObject(item, segmentLineItemGroup, firstObjClasses))

			if (!item.virtual) {
				_.each(tos, (o: TimelineObj) => {
					if (o.holdMode) {
						if (isHold && !showHoldExcept && o.holdMode === TimelineObjHoldMode.EXCEPT) {
							return
						}
						if (!isHold && o.holdMode === TimelineObjHoldMode.ONLY) {
							return
						}
					}

					if (segmentLineGroup) {
						o.inGroup = segmentLineItemGroup._id

						// If we are leaving a HOLD, the transition was suppressed, so force it to run now
						if (item.isTransition && holdState === RunningOrderHoldState.COMPLETE) {
							o.trigger.value = TriggerType.TIME_ABSOLUTE
							o.trigger.value = 'now'
						}
					}

					timelineObjs.push(o)
				})
			}
		}
	})
	return timelineObjs
}

export function addLookeaheadObjectsToTimeline (roData: RoData, studioInstallation: StudioInstallation, timelineObjs: TimelineObj[]) {
	let activeRunningOrder = roData.runningOrder

	_.each(studioInstallation.mappings || {}, (m, l) => {

		const res = findLookaheadForLLayer(roData, l, m.lookahead)
		if (res.length === 0) {
			return
		}

		for (let i = 0; i < res.length; i++) {
			const r = clone(res[i].obj) as TimelineObj

			r._id = 'lookahead_' + i + '_' + r._id
			r.priority = 0.1
			r.duration = res[i].slId !== activeRunningOrder.currentSegmentLineId ? 0 : `#${res[i].obj._id}.start - #.start`
			r.trigger = i === 0 ? {
				type: TriggerType.LOGICAL,
				value: '1'
			} : { // Start with previous clip if possible
				type: TriggerType.TIME_RELATIVE,
				value: `#${res[i - 1].obj._id}.start + 0`
			}
			r.isBackground = true
			delete r.inGroup // force it to be cleared

			if (m.lookahead !== LookaheadMode.WHEN_CLEAR) {
				r.originalLLayer = r.LLayer
				r.LLayer += '_lookahead'
			}

			timelineObjs.push(r)
		}
	})
}

export function findLookaheadForLLayer (roData: RoData, layer: string, mode: LookaheadMode): {obj: TimelineObj, slId: string}[] {
	let activeRunningOrder: RunningOrder = roData.runningOrder

	if (mode === undefined || mode === LookaheadMode.NONE) {
		return []
	}

	interface SegmentLineInfo {
		id: string
		segmentId: string
		line: SegmentLine
	}
	// find all slis that touch the layer
	const layerItems = _.filter(roData.segmentLineItems, (sli: SegmentLineItem) => {
		return !!(
			sli.content &&
			sli.content.timelineObjects &&
			_.find(sli.content.timelineObjects as TimelineObj[], (o) => (o && o.LLayer === layer))
		)
	})
	if (layerItems.length === 0) {
		return []
	}

	// If mode is retained, and only one use, we can take a shortcut
	if (mode === LookaheadMode.RETAIN && layerItems.length === 1) {
		const i = layerItems[0]
		if (i.content && i.content.timelineObjects) {
			const r = i.content.timelineObjects.find(o => o !== null && o.LLayer === layer)
			return r ? [{ obj: r, slId: i.segmentLineId }] : []
		}

		return []
	}

	// have slis grouped by sl, so we can look based on rank to choose the correct one
	const grouped: {[segmentLineId: string]: SegmentLineItem[]} = {}
	layerItems.forEach(i => {
		if (!grouped[i.segmentLineId]) {
			grouped[i.segmentLineId] = []
		}

		grouped[i.segmentLineId].push(i)
	})

	let segmentLinesInfo: SegmentLineInfo[] | undefined
	let currentPos = 0
	let currentSegmentId: string | undefined

	if (!segmentLinesInfo) {
		// calculate ordered list of segmentlines, which can be cached for other llayers
		const lines = roData.segmentLines.map(l => ({ id: l._id, rank: l._rank, segmentId: l.segmentId, line: l }))
		lines.sort((a, b) => {
			if (a.rank < b.rank) {
				return -1
			}
			if (a.rank > b.rank) {
				return 1
			}
			return 0
		})

		const currentIndex = lines.findIndex(l => l.id === activeRunningOrder.currentSegmentLineId)
		let res: SegmentLineInfo[] = []
		if (currentIndex >= 0) {
			res = res.concat(lines.slice(0, currentIndex + 1))
			currentSegmentId = res[res.length - 1].segmentId
			currentPos = currentIndex
		}

		const nextLine = activeRunningOrder.nextSegmentLineId
			? lines.findIndex(l => l.id === activeRunningOrder.nextSegmentLineId)
			: (currentIndex >= 0 ? currentIndex + 1 : -1)

		if (nextLine >= 0) {
			res = res.concat(...lines.slice(nextLine))
		}

		segmentLinesInfo = res.map(l => ({ id: l.id, segmentId: l.segmentId, line: l.line }))
	}

	if (segmentLinesInfo.length === 0) {
		return []
	}

	interface GroupedSegmentLineItems {
		slId: string
		segmentId: string
		items: SegmentLineItem[]
		line: SegmentLine
	}

	const orderedGroups: GroupedSegmentLineItems[] = segmentLinesInfo.map(i => ({
		slId: i.id,
		segmentId: i.segmentId,
		line: i.line,
		items: grouped[i.id] || []
	}))

	// Start by taking the value from the current (if any), or search forwards
	let sliGroup: GroupedSegmentLineItems | undefined
	let sliGroupIndex: number = -1
	for (let i = currentPos; i < orderedGroups.length; i++) {
		const v = orderedGroups[i]
		if (v.items.length > 0) {
			sliGroup = v
			sliGroupIndex = i
			break
		}
	}
	// If set to retain, then look backwards
	if (mode === LookaheadMode.RETAIN) {
		for (let i = currentPos - 1; i >= 0; i--) {
			const v = orderedGroups[i]

			// abort if we have a sli potential match is for another segment
			if (sliGroup && v.segmentId !== currentSegmentId) {
				break
			}

			if (v.items.length > 0) {
				sliGroup = v
				sliGroupIndex = i
				break
			}
		}
	}

	if (!sliGroup) {
		return []
	}

	let findObjectForSegmentLine = (): TimelineObj[] => {
		if (!sliGroup || sliGroup.items.length === 0) {
			return []
		}

		let rawObjs: (TimelineObj | null)[] = []
		sliGroup.items.forEach(i => {
			if (i.content && i.content.timelineObjects) {
				rawObjs = rawObjs.concat(i.content.timelineObjects)
			}
		})
		let allObjs = _.compact(rawObjs)

		if (allObjs.length === 0) {
			// Should never happen. suggests something got 'corrupt' during this process
			return []
		}
		if (allObjs.length > 1) {
			if (sliGroup.line) {
				const orderedItems = getOrderedSegmentLineItem(sliGroup.line)

				let allowTransition = false
				if (sliGroupIndex >= 1 && activeRunningOrder.currentSegmentLineId) {
					const prevSliGroup = orderedGroups[sliGroupIndex - 1]
					allowTransition = !prevSliGroup.line.disableOutTransition
				}

				const transObj = orderedItems.find(i => !!i.isTransition)
				const transObj2 = transObj ? sliGroup.items.find(l => l._id === transObj._id) : undefined
				const hasTransition = allowTransition && transObj2 && transObj2.content && transObj2.content.timelineObjects && transObj2.content.timelineObjects.find(o => o != null && o.LLayer === layer)

				const res: TimelineObj[] = []
				orderedItems.forEach(i => {
					if (!sliGroup || (!allowTransition && i.isTransition)) {
						return
					}

					const item = sliGroup.items.find(l => l._id === i._id)
					if (!item || !item.content || !item.content.timelineObjects) {
						return
					}

					// If there is a transition and this item is abs0, it is assumed to be the primary sli and so does not need lookahead
					if (hasTransition && !i.isTransition && item.trigger.type === TriggerType.TIME_ABSOLUTE && item.trigger.value === 0) {
						return
					}

					// Note: This is assuming that there is only one use of a layer in each sli.
					const obj = item.content.timelineObjects.find(o => o !== null && o.LLayer === layer)
					if (obj) {
						res.push(obj)
					}
				})

				return res
			}
		}

		return allObjs
	}

	const res: {obj: TimelineObj, slId: string}[] = []

	const slId = sliGroup.slId
	const objs = findObjectForSegmentLine()
	objs.forEach(o => res.push({ obj: o, slId: slId }))

	// this is the current one, so look ahead to next to find the next thing to preload too
	if (sliGroup && sliGroup.slId === activeRunningOrder.currentSegmentLineId) {
		sliGroup = undefined
		for (let i = currentPos + 1; i < orderedGroups.length; i++) {
			const v = orderedGroups[i]
			if (v.items.length > 0) {
				sliGroup = v
				sliGroupIndex = i
				break
			}
		}

		if (sliGroup) {
			const slId2 = sliGroup.slId
			const objs2 = findObjectForSegmentLine()
			objs2.forEach(o => res.push({ obj: o, slId: slId2 }))
		}
	}

	return res
}

let updateTimelineFromMosDataTimeouts = {}
export function updateTimelineFromMosData (roId: string, changedLines?: Array<string>) {
	const runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	let data = updateTimelineFromMosDataTimeouts[roId]
	if (data) {
		Meteor.clearTimeout(data.timeout)
		if (data.changedLines) {
			data.changedLines = changedLines ? data.changedLines.concat(changedLines) : undefined
		}
	} else {
		data = {
			changedLines: changedLines
		}
	}

	data.timeout = Meteor.setTimeout(() => {
		delete updateTimelineFromMosDataTimeouts[roId]

		// infinite items only need to be recalculated for those after where the edit was made (including the edited line)
		let prevLine: SegmentLine | undefined
		if (data.changedLines) {
			const firstLine = SegmentLines.findOne({
				runningOrderId: roId,
				_id: { $in: data.changedLines }
			}, { sort: { _rank: 1 } })
			if (firstLine) {
				prevLine = SegmentLines.findOne({
					runningOrderId: roId,
					_rank: { $lt: firstLine._rank }
				}, { sort: { _rank: -1 } })
			}
		}

		updateSourceLayerInfinitesAfterLine(runningOrder, true, prevLine)

		if (runningOrder.active) {
			updateTimeline(runningOrder.studioInstallationId)
		}
	}, 1000)

	updateTimelineFromMosDataTimeouts[roId] = data
}

function prefixAllObjectIds (objList: TimelineObj[], prefix: string) {
	const changedIds = objList.map(o => o._id)

	let replaceIds = (str: string) => {
		return str.replace(/#([a-zA-Z0-9_]+)\./g, (m) => {
			const id = m.substr(1, m.length - 2)
			return changedIds.indexOf(id) >= 0 ? '#' + prefix + id + '.' : m
		})
	}

	return objList.map(i => {
		const o = clone(i)

		o._id = prefix + o._id

		if (typeof o.duration === 'string') {
			o.duration = replaceIds(o.duration)
		}
		if (typeof o.trigger.value === 'string') {
			o.trigger.value = replaceIds(o.trigger.value)
		}

		if (typeof o.inGroup === 'string') {
			o.inGroup = changedIds.indexOf(o.inGroup) === -1 ? o.inGroup : prefix + o.inGroup
		}

		return o
	})
}

/**
 * Updates the Timeline to reflect the state in the RunningOrder, Segments, Segmentlines etc...
 * @param studioInstallationId id of the studioInstallation to update
 * @param forceNowToTime if set, instantly forces all "now"-objects to that time (used in autoNext)
 */
export const updateTimeline: (studioInstallationId: string, forceNowToTime?: Time) => void
= syncFunctionIgnore(function updateTimeline (studioInstallationId: string, forceNowToTime?: Time) {
	logger.debug('updateTimeline running...')

	let timelineObjs: Array<TimelineObj> = []

	const promiseActiveRunningOrder = asyncCollectionFindOne(RunningOrders, {
		studioInstallationId: studioInstallationId,
		active: true
	})
	let promiseStudioInstallation = asyncCollectionFindOne(StudioInstallations, studioInstallationId)

	let activeRunningOrder = waitForPromise(promiseActiveRunningOrder)
	let studioInstallation = waitForPromise(promiseStudioInstallation)

	if (!studioInstallation) throw new Meteor.Error(404, 'studioInstallation "' + studioInstallationId + '" not found!')
	if (activeRunningOrder) {

		// remove anything not related to active running order:
		let promiseClearTimeline: Promise<void> = asyncCollectionRemove(Timeline, {
			siId: studioInstallationId,
			roId: {
				$not: {
					$eq: activeRunningOrder._id
				}
			}
		})
		// Start with fetching stuff from database:
		let promiseBaselineItems: Promise<Array<RunningOrderBaselineItem>> = asyncCollectionFindFetch(RunningOrderBaselineItems, {
			runningOrderId: activeRunningOrder._id
		})
		let roData: RoData = activeRunningOrder.fetchAllData()

		let currentSegmentLine: SegmentLine | undefined
		let nextSegmentLine: SegmentLine | undefined
		let currentSegmentLineGroup: TimelineObj | undefined
		let previousSegmentLineGroup: TimelineObj | undefined

		let currentSegmentLineItems: Array<SegmentLineItem> = []
		let previousSegmentLine: SegmentLine | undefined

		// Fetch the nextSegmentLine first, because that affects how the currentSegmentLine will be treated
		if (activeRunningOrder.nextSegmentLineId) {
			// We may be at the beginning of a show, and there can be no currentSegmentLine and we are waiting for the user to Take
			nextSegmentLine = roData.segmentLinesMap[activeRunningOrder.nextSegmentLineId]
			if (!nextSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRunningOrder.nextSegmentLineId}" not found!`)
		}

		if (activeRunningOrder.currentSegmentLineId) {
			currentSegmentLine = roData.segmentLinesMap[activeRunningOrder.currentSegmentLineId]
			if (!currentSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRunningOrder.currentSegmentLineId}" not found!`)

			if (activeRunningOrder.previousSegmentLineId) {
				previousSegmentLine = roData.segmentLinesMap[activeRunningOrder.previousSegmentLineId]
				if (!previousSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRunningOrder.previousSegmentLineId}" not found!`)
			}
		}
		// Default timelineobjects:
		let baselineItems = waitForPromise(promiseBaselineItems)
		if (baselineItems) {
			timelineObjs = timelineObjs.concat(transformBaselineItemsIntoTimeline(baselineItems))
		}

		// Currently playing:
		if (currentSegmentLine) {

			const currentSegmentLineItems = currentSegmentLine.getAllSegmentLineItems()
			const currentInfiniteItems = currentSegmentLineItems.filter(l => (l.infiniteMode && l.infiniteId && l.infiniteId !== l._id))
			const currentNormalItems = currentSegmentLineItems.filter(l => !(l.infiniteMode && l.infiniteId && l.infiniteId !== l._id))

			let allowTransition = false

			if (previousSegmentLine) {
				allowTransition = !previousSegmentLine.disableOutTransition

				if (previousSegmentLine.getLastStartedPlayback()) {
					const overlapDuration = calcOverlapDuration(previousSegmentLine, currentSegmentLine, currentSegmentLineItems)

					previousSegmentLineGroup = createSegmentLineGroup(previousSegmentLine, `#${getSlGroupId(currentSegmentLine)}.start + ${overlapDuration} - #.start`)
					previousSegmentLineGroup.priority = -1
					previousSegmentLineGroup.trigger = literal<TimelineTrigger>({
						type: TriggerType.TIME_ABSOLUTE,
						value: previousSegmentLine.getLastStartedPlayback() || 0
					})

					// If a SegmentLineItem is infinite, and continued in the new SegmentLine, then we want to add the SegmentLineItem only there to avoid id collisions
					const skipIds = currentInfiniteItems.map(l => l.infiniteId || '')
					const previousSegmentLineItems = previousSegmentLine.getAllSegmentLineItems().filter(l => !l.infiniteId || skipIds.indexOf(l.infiniteId) < 0)

					const groupClasses: string[] = ['previous_sl']
					let prevObjs = [previousSegmentLineGroup]
					prevObjs = prevObjs.concat(
						transformSegmentLineIntoTimeline(previousSegmentLineItems, groupClasses, previousSegmentLineGroup, undefined, undefined, activeRunningOrder.holdState, undefined))

					prevObjs = prefixAllObjectIds(prevObjs, 'previous_')

					// If autonext with an overlap, keep the previous line alive for the specified overlap
					if (previousSegmentLine.autoNext && previousSegmentLine.autoNextOverlap) {
						previousSegmentLineGroup.duration = `#${getSlGroupId(currentSegmentLine)}.start + ${previousSegmentLine.autoNextOverlap || 0} - #.start`
					}

					timelineObjs = timelineObjs.concat(prevObjs)
				}
			}

			// fetch items
			// fetch the timelineobjs in items
			const isFollowed = nextSegmentLine && currentSegmentLine.autoNext
			currentSegmentLineGroup = createSegmentLineGroup(currentSegmentLine, (isFollowed ? (currentSegmentLine.expectedDuration || 0) : 0))
			if (currentSegmentLine.startedPlayback && currentSegmentLine.getLastStartedPlayback()) { // If we are recalculating the currentLine, then ensure it doesnt think it is starting now
				currentSegmentLineGroup.trigger = literal<TimelineTrigger>({
					type: TriggerType.TIME_ABSOLUTE,
					value: currentSegmentLine.getLastStartedPlayback() || 0
				})
			}

			// any continued infinite lines need to skip the group, as they need a different start trigger
			for (let item of currentInfiniteItems) {
				const infiniteGroup = createSegmentLineGroup(currentSegmentLine, item.expectedDuration || 0)
				infiniteGroup._id = getSlGroupId(item._id) + '_infinite'
				infiniteGroup.priority = 1

				const groupClasses: string[] = ['current_sl']
				// If the previousSegmentLine also contains another segment of this infinite sli, then we label our new one as such
				if (previousSegmentLine && previousSegmentLine.getAllSegmentLineItems().filter(i => i.infiniteId && i.infiniteId === item.infiniteId)) {
					groupClasses.push('continues_infinite')
				}

				if (item.infiniteId) {
					const originalItem = _.find(roData.segmentLineItems, (sli => sli._id === item.infiniteId))

					if (originalItem && originalItem.startedPlayback) {
						infiniteGroup.trigger = literal<TimelineTrigger>({
							type: TriggerType.TIME_ABSOLUTE,
							value: originalItem.startedPlayback
						})
					}
				}

				// Still show objects flagged as 'HoldMode.EXCEPT' if this is a infinite continuation as they belong to the previous too
				const showHoldExcept = item.infiniteId !== item._id
				timelineObjs = timelineObjs.concat(infiniteGroup, transformSegmentLineIntoTimeline([item], groupClasses, infiniteGroup, undefined, undefined, activeRunningOrder.holdState, showHoldExcept))
			}

			const groupClasses: string[] = ['current_sl']
			timelineObjs = timelineObjs.concat(currentSegmentLineGroup, transformSegmentLineIntoTimeline(currentNormalItems, groupClasses, currentSegmentLineGroup, allowTransition, currentSegmentLine.transitionDelay, activeRunningOrder.holdState, undefined))

			timelineObjs.push(createSegmentLineGroupFirstObject(currentSegmentLine, currentSegmentLineGroup))

			// only add the next objects into the timeline if the next segment is autoNext
			if (nextSegmentLine && currentSegmentLine.autoNext) {
				// console.log('This segment line will autonext')
				let nextSegmentLineItemGroup = createSegmentLineGroup(nextSegmentLine, 0)
				if (currentSegmentLineGroup) {
					const nextSegmentLineItems = nextSegmentLine.getAllSegmentLineItems()
					const overlapDuration = calcOverlapDuration(currentSegmentLine, nextSegmentLine, nextSegmentLineItems)

					nextSegmentLineItemGroup.trigger = literal<TimelineTrigger>({
						type: TriggerType.TIME_RELATIVE,
						value: `#${currentSegmentLineGroup._id}.end - ${overlapDuration}`
					})
					if (typeof currentSegmentLineGroup.duration === 'number') {
						currentSegmentLineGroup.duration += currentSegmentLine.autoNextOverlap || 0
					}
				}

				let toSkipIds = currentSegmentLineItems.filter(i => i.infiniteId).map(i => i.infiniteId)

				let nextItems = nextSegmentLine.getAllSegmentLineItems()
				nextItems = nextItems.filter(i => !i.infiniteId || toSkipIds.indexOf(i.infiniteId) === -1)

				const groupClasses: string[] = ['next_sl']
				timelineObjs = timelineObjs.concat(
					nextSegmentLineItemGroup,
					transformSegmentLineIntoTimeline(nextItems, groupClasses, nextSegmentLineItemGroup, currentSegmentLine && !currentSegmentLine.disableOutTransition, nextSegmentLine.transitionDelay))
				timelineObjs.push(createSegmentLineGroupFirstObject(nextSegmentLine, nextSegmentLineItemGroup))
			}
		}

		if (!activeRunningOrder.nextSegmentLineId && !activeRunningOrder.currentSegmentLineId) {
			// maybe at the end of the show
			logger.info(`No next segmentLine and no current segment line set on running order "${activeRunningOrder._id}".`)
		}

		// next (on pvw (or on pgm if first))
		// addLookeaheadObjectsToTimeline(activeRunningOrder, studioInstallation, timelineObjs)
		addLookeaheadObjectsToTimeline(roData, studioInstallation, timelineObjs)

		// console.log(JSON.stringify(timelineObjs))

		// processTimelineObjects(studioInstallation, timelineObjs)
		processTimelineObjects(studioInstallation, activeRunningOrder, timelineObjs)

		// logger.debug('timelineObjs', timelineObjs)

		if (forceNowToTime) { // used when autoNexting
			setNowToTimeInObjects(timelineObjs, forceNowToTime)
		}

		// TODO: Specific implementations, to be refactored into Blueprints:
		setLawoObjectsTriggerValue(timelineObjs, currentSegmentLine)
		timelineObjs = validateNoraPreload(timelineObjs)

		waitForPromise(promiseClearTimeline)

		// console.log('full', JSON.stringify(timelineObjs, undefined, 4))

		saveIntoDb<TimelineObj, TimelineObj>(Timeline, {
			roId: activeRunningOrder._id
		}, timelineObjs, {
			beforeUpdate: (o: TimelineObj, oldO: TimelineObj): TimelineObj => {
				// do not overwrite trigger when the trigger has been denowified
				if (o.trigger.value === 'now' && oldO.trigger.setFromNow) {
					o.trigger.type = oldO.trigger.type
					o.trigger.value = oldO.trigger.value
				}
				return o
			}
		})
	} else {
		// remove everything:
		Timeline.remove({
			siId: studioInstallationId,
			statObject: {$ne: true},
			recordingObject: {$ne: true}
		})
	}

	// Ensure recording is running
	const activeRecording = RecordedFiles.findOne({
		stoppedAt: {$exists: false}
	}, {
		sort: {
			startedAt: 1 // TODO - is order correct?
		}
	})
	if (activeRecording) {
		const recordingTimelineObjs = generateRecordingTimelineObjs(studioInstallation, activeRecording)

		processTimelineObjects(studioInstallation, undefined, recordingTimelineObjs)
		timelineObjs = timelineObjs.concat(recordingTimelineObjs)

		saveIntoDb<TimelineObj, TimelineObj>(Timeline, {
			siId: studioInstallationId,
			recordingObject: true
		}, recordingTimelineObjs, {
			beforeUpdate: (o: TimelineObj, oldO: TimelineObj): TimelineObj => {
				// do not overwrite trigger when the trigger has been denowified
				if (o.trigger.value === 'now' && oldO.trigger.setFromNow) {
					o.trigger.type = oldO.trigger.type
					o.trigger.value = oldO.trigger.value
				}
				return o
			}
		})
	} else {
		Timeline.remove({
			siId: studioInstallationId,
			recordingObject: true
		})
	}

	// afterUpdateTimeline(studioInstallation)
	afterUpdateTimeline(studioInstallation, timelineObjs)
	logger.debug('updateTimeline done!')
})
function calcOverlapDuration (fromSl: SegmentLine, toSl: SegmentLine, toSLItems: SegmentLineItem[]): number {
	const allowTransition: boolean = !fromSl.disableOutTransition
	let overlapDuration: number = toSl.transitionDuration || 0
	if (!toSl.transitionDuration && allowTransition) {
		if (!toSLItems) toSLItems = toSl.getAllSegmentLineItems()
		const transitionObjs = toSLItems.filter(i => i.isTransition)
		overlapDuration = (transitionObjs && transitionObjs.length > 0) ? transitionObjs[0].duration || 0 : 0
	} else if (!allowTransition) {
		overlapDuration = fromSl.autoNextOverlap || 0
	}

	return Math.max(overlapDuration, toSl.overlapDuration || 0)
}
/**
 * Fix the timeline objects, adds properties like deviceId and siId to the timeline objects
 * @param studioInstallation
 * @param timelineObjs Array of timeline objects
 */
function processTimelineObjects (studioInstallation: StudioInstallation, parentRunningOrder: RunningOrder | undefined, timelineObjs: Array<TimelineObj>): void {
	// Pre-process the timelineObjects:

	// first, split out any grouped objects, to make the timeline shallow:
	let fixObjectChildren = (o: TimelineObjGroup) => {
		// Unravel children objects and put them on the (flat) timelineObjs array
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
		if (parentRunningOrder) o.roId = parentRunningOrder._id
		fixObjectChildren(o as TimelineObjGroup)
	})

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

	// Add deviceIds to all children objects
	let groupDeviceIds: {[groupId: string]: Array<string>} = {}
	_.each(timelineObjs, (o) => {
		o.siId = studioInstallation._id
		if (!o.isGroup) {
			const layerId = o.originalLLayer || o.LLayer + ''
			let LLayerMapping = (studioInstallation.mappings || {})[layerId]

			if (!LLayerMapping && o.isAbstract) {
				// If the item is abstract, then use the core_abstract mapping, but leave it on the orignal LLayer
				// We do this because the layer is only needed due to how we construct and run the timeline
				LLayerMapping = (studioInstallation.mappings || {})['core_abstract']
			}

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
		if (!shouldRunAgain && shouldNotRunAgain) break
	}

	const missingDev = groupObjs.filter(o => !o.deviceId || !o.deviceId[0]).map(o => o._id)
	if (missingDev.length > 0) {
		logger.warn('Found groups without any deviceId: ' + missingDev)
	}
}

/**
 * To be called after an update to the timeline has been made, will add/update the "statObj" - an object
 * containing the hash of the timeline, used to determine if the timeline should be updated in the gateways
 * @param studioInstallationId id of the studioInstallation to update
 */
export function afterUpdateTimeline (studioInstallation: StudioInstallation, timelineObjs?: Array<TimelineObj>) {

	// logger.info('afterUpdateTimeline')
	if (!timelineObjs) {
		timelineObjs = Timeline.find({
			siId: studioInstallation._id,
			statObject: {$ne: true}
		}).fetch()
	}
	let ps: Array<Promise<any>> = []
	let deviceIdObjs: {[deviceId: string]: Array<TimelineObj>} = {}

	if (timelineObjs.length) {
		_.each(timelineObjs, (o: TimelineObj) => {
			if (o.statObject !== true) {
				_.each(o.deviceId || [], (deviceId: string) => {
					if (!deviceIdObjs[deviceId]) deviceIdObjs[deviceId] = []
					deviceIdObjs[deviceId].push(o)
				})
			}
		})
	} else {
		// there are no objects, timeline is empty
		// well, we still want to update out statobjs, use their deviceIds then:
		let statObjs = Timeline.find({
			siId: studioInstallation._id,
			statObject: true
		}).fetch()
		_.each(statObjs, (o: TimelineObj) => {
			_.each(o.deviceId || [], (deviceId: string) => {
				if (!deviceIdObjs[deviceId]) deviceIdObjs[deviceId] = []
			})
		})
	}

	// Collect statistics, per device
	_.each(deviceIdObjs, (objs, deviceId) => {
		// console.log('deviceId', deviceId)

		// Number of objects
		let objCount = objs.length
		// Hash of all objects
		objs = objs.sort((a, b) => {
			if (a._id < b._id) return 1
			if (a._id > b._id) return -1
			return 0
		})
		let objHash = getHash(stringifyObjects(objs))

		// const hashes = {}
		// for (let o of objs) {
		// 	hashes[o._id] = getHash(stringifyObjects([o]))
		// 	if (o._id === 'lookahead_0_7C8oNgssOd2yG0ynN9C1vquc8yc_') {
		// 		console.log('OBJ: ' + stringifyObjects(o))
		// 	}
		// }
		// console.log('obj hashes: ' + JSON.stringify(hashes))

		// save into "magic object":
		let magicId = studioInstallation._id + '_' + deviceId + '_statObj'
		let statObj: TimelineObj = {
			_id: magicId,
			id: '',
			siId: studioInstallation._id,
			statObject: true,
			roId: '',
			deviceId: [deviceId],
			content: {
				type: TimelineContentTypeOther.NOTHING,
				modified: getCurrentTime(),
				objCount: objCount,
				objHash: objHash
			},
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: 0 // never
			},
			duration: 0,
			isAbstract: true,
			LLayer: '__stat'
		}
		// processTimelineObjects(studioInstallation, [statObj])

		ps.push(asyncCollectionUpsert(Timeline, magicId, {$set: statObj}))
	})
	waitForPromiseAll(ps)
}

/**
 * goes through timelineObjs and forces the "now"-values to the absolute time specified
 * @param timelineObjs Array of (flat) timeline objects
 * @param now The time to set the "now":s to
 */
function setNowToTimeInObjects (timelineObjs: Array<TimelineObj>, now: Time): void {
	_.each(timelineObjs, (o) => {
		if (o.trigger.type === TriggerType.TIME_ABSOLUTE &&
			o.trigger.value === 'now'
		) {
			o.trigger.value = now
			o.trigger.setFromNow = true
		}
	})
}

function setLawoObjectsTriggerValue (timelineObjs: Array<TimelineObj>, currentSegmentLine: SegmentLine | undefined) {

	_.each(timelineObjs, (obj) => {
		if (obj.content.type === TimelineContentTypeLawo.SOURCE ) {
			let lawoObj = obj as TimelineObjLawo & TimelineObj

			_.each(lawoObj.content.attributes, (val, key) => {
				// set triggerValue to the current playing segment, thus triggering commands to be sent when nexting:
				lawoObj.content.attributes[key].triggerValue = (currentSegmentLine || {_id: ''})._id
			})
		}
	})
}

function validateNoraPreload (timelineObjs: Array<TimelineObj>) {
	const toRemoveIds: Array<string> = []
	_.each(timelineObjs, obj => {
		// ignore normal objects
		if (obj.content.type !== TimelineContentTypeHttp.POST) return
		if (!obj.isBackground) return

		const obj2 = obj as TimelineObjHTTPRequest & TimelineObj
		if (obj2.content.params && obj2.content.params.template && (obj2.content.params.template as any).event === 'take') {
			(obj2.content.params.template as any).event = 'cue'
		} else {
			// something we don't understand, so dont lookahead on it
			toRemoveIds.push(obj._id)
		}
	})

	return timelineObjs.filter(o => toRemoveIds.indexOf(o._id) === -1)
}
