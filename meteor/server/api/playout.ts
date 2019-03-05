
/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import { RunningOrders, RunningOrder, RunningOrderHoldState, RoData, DBRunningOrder } from '../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines, DBSegmentLine } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItems, SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { RunningOrderBaselineItems, RunningOrderBaselineItem } from '../../lib/collections/RunningOrderBaselineItems'
import { getCurrentTime,
	saveIntoDb,
	literal,
	Time,
	stringifyObjects,
	fetchAfter,
	normalizeArray,
	asyncCollectionUpdate,
	asyncCollectionRemove,
	waitForPromiseAll,
	asyncCollectionInsert,
	asyncCollectionUpsert,
	asyncCollectionFindFetch,
	waitForPromise,
	asyncCollectionFindOne,
	pushOntoPath,
	extendMandadory,
	caught
} from '../../lib/lib'
import {
	Timeline,
	TimelineObjGeneric,
	TimelineContentTypeOther,
	TimelineObjSegmentLineAbstract,
	TimelineObjSegmentLineItemAbstract,
	TimelineObjGroup,
	TimelineObjGroupSegmentLine,
	TimelineObjType,
	TimelineObjRunningOrder,
	TimelineObjRecording,
	TimelineObjStat,
} from '../../lib/collections/Timeline'
import {
	TimelineContentTypeLawo,
	TimelineObjLawo,
	TimelineContentTypeHttp,
	TimelineObjHTTPRequest,
	Timeline as TimelineTypes
} from 'timeline-state-resolver-types'
import { TriggerType } from 'superfly-timeline'
import { Segments, Segment } from '../../lib/collections/Segments'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../logging'
import { PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import {
	getSliGroupId,
	getSlGroupId,
	getSlFirstObjectId,
	getSliFirstObjectId,
	IConfigItem,
	LookaheadMode,
	SourceLayerType,
	SegmentLineItemLifespan,
	SegmentLineHoldMode,
	TimelineObjHoldMode,
	MOS,
	TimelineObjectCoreExt,
	VTContent
} from 'tv-automation-sofie-blueprints-integration'
import {
	loadBlueprints,
	postProcessSegmentLineAdLibItems,
	postProcessSegmentLineBaselineItems,
	RunningOrderContext,
	getBlueprintOfRunningOrder,
	SegmentLineContext
} from './blueprints'
import { RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItems } from '../../lib/collections/RunningOrderBaselineAdLibItems'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import { CachePrefix } from '../../lib/collections/RunningOrderDataCache'
import { PlayoutAPI } from '../../lib/api/playout'
import { getHash } from '../lib'
import { syncFunction, syncFunctionIgnore } from '../codeControl'
import { getResolvedSegment, ISourceLayerExtended } from '../../lib/RunningOrder'
let clone = require('fast-clone')
import { Resolver } from 'superfly-timeline'
import { transformTimeline } from '../../lib/timeline'
import { ClientAPI } from '../../lib/api/client'
import { setMeteorMethods, Methods } from '../methods'
import { sendStoryStatus, updateStory } from './integration/mos'
import { updateSegmentLines, reloadRunningOrderData } from './runningOrder'
import { runPostProcessBlueprint } from '../../server/api/runningOrder'
import { RecordedFiles } from '../../lib/collections/RecordedFiles'
import { generateRecordingTimelineObjs } from './testTools'
import {
	reportRunningOrderHasStarted,
	reportSegmentLineHasStarted,
	reportSegmentLineItemHasStarted,
	reportSegmentLineHasStopped,
	reportSegmentLineItemHasStopped
} from './asRunLog'

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
			// logger.warn('Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, '_id'))
			throw new Meteor.Error(409, 'Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, '_id'))
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

		return { success: 200 }
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
	export function roDeactivate (roId: string) {
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

		return ClientAPI.responseSuccess(
			reloadRunningOrderData(runningOrder)
		)
	}
	function resetRunningOrder (runningOrder: RunningOrder) {
		logger.info('resetRunningOrder ' + runningOrder._id)
		// Remove all dunamically inserted items (adlibs etc)
		SegmentLineItems.remove({
			runningOrderId: runningOrder._id,
			dynamicallyInserted: true
		})

		SegmentLines.remove({
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

		// Reset all segment line items that were modified for holds
		SegmentLineItems.update({
			runningOrderId: runningOrder._id,
			extendOnHold: true,
			infiniteId: { $exists: true },
		}, {
			$unset: {
				infiniteId: 0,
				infiniteMode: 0,
			}
		}, {multi: true})

		// Reset any segment line items that were modified by inserted adlibs
		SegmentLineItems.update({
			runningOrderId: runningOrder._id,
			$or: [
				{ originalExpectedDuration: { $exists: true } },
				{ originalInfiniteMode: { $exists: true } }
			]
		}, {
			$rename: {
				originalExpectedDuration: 'expectedDuration',
				originalInfiniteMode: 'infiniteMode'
			}
		}, {multi: true})

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

		// ensure that any removed infinites are restored
		updateSourceLayerInfinitesAfterLine(runningOrder)

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

		const ssrcBgs: Array<IConfigItem> = _.compact([
			studio.config.find((o) => o._id === 'atemSSrcBackground'),
			studio.config.find((o) => o._id === 'atemSSrcBackground2')
		])
		if (ssrcBgs.length > 1) logger.info(ssrcBgs[0].value + ' and ' + ssrcBgs[1].value + ' will be loaded to atems')
		if (ssrcBgs.length > 0) logger.info(ssrcBgs[0].value + ' will be loaded to atems')

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
	export function areThereActiveROsInStudio (studioInstallationId: string, excludeROId: string): RunningOrder[] {
		let anyOtherActiveRunningOrders = RunningOrders.find({
			studioInstallationId: studioInstallationId,
			active: true,
			_id: {
				$ne: excludeROId
			}
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

		let studio = runningOrder.getStudioInstallation()

		const anyOtherActiveRunningOrders = areThereActiveROsInStudio(studio._id, runningOrder._id)

		if (anyOtherActiveRunningOrders.length) {
			// logger.warn('Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, '_id'))
			throw new Meteor.Error(409, 'Only one running-order can be active at the same time. Active runningOrders: ' + _.pluck(anyOtherActiveRunningOrders, '_id'))
		}

		let wasInactive = !runningOrder.active

		let m = {
			active: true,
			rehearsal: rehearsal,
		}
		RunningOrders.update(runningOrder._id, {
			$set: m
		})
		// Update local object:
		runningOrder.active = true
		runningOrder.rehearsal = rehearsal

		if (!runningOrder.nextSegmentLineId) {
			let segmentLines = runningOrder.getSegmentLines()
			let firstSegmentLine = _.first(segmentLines)
			if (firstSegmentLine) {
				setNextSegmentLine(runningOrder, firstSegmentLine)
			}
		}

		if (wasInactive) {

			logger.info('Building baseline items...')

			const showStyleBase = runningOrder.getShowStyleBase()
			let blueprint = loadBlueprints(showStyleBase)

			const context = new RunningOrderContext(runningOrder)

			const res = blueprint.getBaseline(context)
			const baselineItems = postProcessSegmentLineBaselineItems(context, res.baselineItems)
			const adlibItems = postProcessSegmentLineAdLibItems(context, res.adLibItems, 'baseline')

			// TODO - should any notes be logged as a warning, or is that done already?

			if (baselineItems) {
				logger.info(`... got ${baselineItems.length} items from baseline.`)

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
				logger.info(`... got ${adlibItems.length} adLib items from baseline.`)
				saveIntoDb<RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItem>(RunningOrderBaselineAdLibItems, {
					runningOrderId: runningOrder._id
				}, adlibItems)
			}

			updateTimeline(studio._id)

			Meteor.defer(() => {
				let bp = getBlueprintOfRunningOrder(runningOrder)
				if (bp.onRunningOrderActivate) {
					Promise.resolve(bp.onRunningOrderActivate(new RunningOrderContext(runningOrder)))
					.catch(logger.error)
				}
			})
		}
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

		Meteor.defer(() => {
			let bp = getBlueprintOfRunningOrder(runningOrder)
			if (bp.onRunningOrderDeActivate) {
				Promise.resolve(bp.onRunningOrderDeActivate(new RunningOrderContext(runningOrder)))
				.catch(logger.error)
			}
		})
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

		// Reset any segment line items that were modified by inserted adlibs
		ps.push(asyncCollectionUpdate(SegmentLineItems, {
			runningOrderId: segmentLine.runningOrderId,
			segmentLineId: segmentLine._id,
			$or: [
				{ originalExpectedDuration: { $exists: true } },
				{ originalInfiniteMode: { $exists: true } }
			]
		}, {
			$rename: {
				originalExpectedDuration: 'expectedDuration',
				originalInfiniteMode: 'infiniteMode'
			}
		}, {
			multi: true
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
				const ro = RunningOrders.findOne(segmentLine.runningOrderId)
				if (!ro) throw new Meteor.Error(404, `Running Order "${segmentLine.runningOrderId}" not found!`)

				const prevLine = getPreviousSegmentLine(ro, segmentLine)
				updateSourceLayerInfinitesAfterLine(ro, prevLine)
				// do nothing
			})
		}
	}
	function getPreviousSegmentLine (runningOrder: DBRunningOrder, segmentLine: DBSegmentLine) {
		return SegmentLines.findOne({
			runningOrderId: runningOrder._id,
			_rank: { $lt: segmentLine._rank }
		}, { sort: { _rank: -1 } })
	}
	function refreshSegmentLine (runningOrder: DBRunningOrder, segmentLine: DBSegmentLine) {
		const ro = new RunningOrder(runningOrder)
		const story = ro.fetchCache(CachePrefix.FULLSTORY + segmentLine._id) as MOS.IMOSROFullStory
		const sl = new SegmentLine(segmentLine)
		updateStory(ro, sl, story)

		const segment = sl.getSegment()
		if (segment) {
			// this could be run after the segment, if we were capable of limiting that
			runPostProcessBlueprint(ro, segment)
		}

		const prevLine = getPreviousSegmentLine(runningOrder, sl)
		updateSourceLayerInfinitesAfterLine(ro, prevLine)
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
	export function roTake (roId: string | RunningOrder ): void {
		let now = getCurrentTime()
		let runningOrder: RunningOrder = (
			_.isObject(roId) ? roId as RunningOrder :
			_.isString(roId) ? RunningOrders.findOne(roId) :
			undefined
		) as RunningOrder
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(501, `RunningOrder "${roId}" is not active!`)
		if (!runningOrder.nextSegmentLineId) throw new Meteor.Error(500, 'nextSegmentLineId is not set!')

		let firstTake = !runningOrder.startedPlayback

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
				SegmentLineItems.remove({
					segmentLineId: currentSegmentLine._id,
					extendOnHold: true,
					dynamicallyInserted: true
				})
			}
			if (runningOrder.previousSegmentLineId) {
				let previousSegmentLine = SegmentLines.findOne(runningOrder.previousSegmentLineId)
				if (!previousSegmentLine) throw new Meteor.Error(404, 'previousSegmentLine not found!')

				// Clear the extended mark on the original
				SegmentLineItems.update({
					segmentLineId: previousSegmentLine._id,
					extendOnHold: true,
					dynamicallyInserted: false
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
		// let takeSegment = roData.segmentsMap[takeSegmentLine.segmentId]
		let segmentLineAfter = fetchAfter(roData.segmentLines, {
			runningOrderId: runningOrder._id
		}, takeSegmentLine._rank)

		let nextSegmentLine: DBSegmentLine | null = segmentLineAfter || null

		// beforeTake(runningOrder, previousSegmentLine || null, takeSegmentLine)
		beforeTake(roData, previousSegmentLine || null, takeSegmentLine)
		let bp = getBlueprintOfRunningOrder(runningOrder)
		if (bp.onPreTake) {
			try {
				waitForPromise(
					Promise.resolve(bp.onPreTake(new SegmentLineContext(runningOrder, takeSegmentLine)))
					.catch(logger.error)
				)
			} catch (e) {
				logger.error(e)
			}
		}

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
				sli.infiniteId = sli._id
				sli.infiniteMode = SegmentLineItemLifespan.OutOnNextSegmentLine
				SegmentLineItems.update(sli._id, {
					$set: {
						infiniteMode: SegmentLineItemLifespan.OutOnNextSegmentLine,
						infiniteId: sli._id,
					}
				})

				// make the extension
				const newSli = clone(sli) as SegmentLineItem
				newSli.segmentLineId = m.currentSegmentLineId
				newSli.expectedDuration = 0
				const content = newSli.content as VTContent
				if (content.fileName && content.sourceDuration && sli.startedPlayback) {
					content.seek = Math.min(content.sourceDuration, getCurrentTime() - sli.startedPlayback)
				}
				newSli.dynamicallyInserted = true
				newSli._id = sli._id + '_hold'

				// This gets deleted once the nextsegment line is activated, so it doesnt linger for long
				ps.push(asyncCollectionUpsert(SegmentLineItems, newSli._id, newSli))
				roData.segmentLineItems.push(newSli) // update the local collection

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

		Meteor.defer(() => {
			let bp = getBlueprintOfRunningOrder(runningOrder)
			if (firstTake) {
				if (bp.onRunningOrderFirstTake) {
					Promise.resolve(bp.onRunningOrderFirstTake(new SegmentLineContext(runningOrder, takeSegmentLine)))
					.catch(logger.error)
				}
			}

			if (bp.onPostTake) {
				Promise.resolve(bp.onPostTake(new SegmentLineContext(runningOrder, takeSegmentLine)))
				.catch(logger.error)
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

		return ClientAPI.responseSuccess()
	}
	export function roMoveNext (
		roId: string,
		horisontalDelta: number,
		verticalDelta: number,
		setManually: boolean,
		currentNextSegmentLineItemId?: string
	): string {
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

			if (!segment) throw new Meteor.Error(404, `No Segment found!`)

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
		logger.debug('roActivateHold')

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		if (!runningOrder.currentSegmentLineId) throw new Meteor.Error(400, `RunningOrder "${roId}" no current segmentline!`)
		if (!runningOrder.nextSegmentLineId) throw new Meteor.Error(400, `RunningOrder "${roId}" no next segmentline!`)

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

		return ClientAPI.responseSuccess()
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
	export function roDisableNextSegmentLineItem (roId: string, undo?: boolean) {
		check(roId, String)

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.currentSegmentLineId) throw new Meteor.Error(401, `No current segmentLine!`)

		let studio = runningOrder.getStudioInstallation()

		let showStyleBase = runningOrder.getShowStyleBase()

		let currentSegmentLine = SegmentLines.findOne(runningOrder.currentSegmentLineId)
		if (!currentSegmentLine) throw new Meteor.Error(404, `SegmentLine "${runningOrder.currentSegmentLineId}" not found!`)

		let nextSegmentLine = (runningOrder.nextSegmentLineId ? SegmentLines.findOne(runningOrder.nextSegmentLineId) : undefined)

		let currentSement = Segments.findOne(currentSegmentLine.segmentId)
		if (!currentSement) throw new Meteor.Error(404, `Segment "${currentSegmentLine.segmentId}" not found!`)

		let o = getResolvedSegment(showStyleBase, runningOrder, currentSement)

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

			return ClientAPI.responseSuccess()
		} else {
			return ClientAPI.responseError('Found no future segmentLineItems')
		}
	}

	export function sliPlaybackStartedCallback (roId: string, sliId: string, startedPlayback: Time) {
		check(roId, String)
		check(sliId, String)
		check(startedPlayback, Number)

		// This method is called when an auto-next event occurs
		let segLineItem = SegmentLineItems.findOne({
			_id: sliId,
			runningOrderId: roId
		})
		if (!segLineItem) throw new Meteor.Error(404, `Segment line item "${sliId}" in running order "${roId}" not found!`)

		let isPlaying: boolean = !!(
			segLineItem.startedPlayback &&
			!segLineItem.stoppedPlayback
		)
		if (!isPlaying) {
			logger.info(`Playout reports segmentLineItem "${sliId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

			reportSegmentLineItemHasStarted(segLineItem, startedPlayback)

			// We don't need to bother with an updateTimeline(), as this hasn't changed anything, but lets us accurately add started items when reevaluating
		}
	}
	export function sliPlaybackStoppedCallback (roId: string, sliId: string, stoppedPlayback: Time) {
		check(roId, String)
		check(sliId, String)
		check(stoppedPlayback, Number)

		// This method is called when an auto-next event occurs
		let segLineItem = SegmentLineItems.findOne({
			_id: sliId,
			runningOrderId: roId
		})
		if (!segLineItem) throw new Meteor.Error(404, `Segment line item "${sliId}" in running order "${roId}" not found!`)

		let isPlaying: boolean = !!(
			segLineItem.startedPlayback &&
			!segLineItem.stoppedPlayback
		)
		if (isPlaying) {
			logger.info(`Playout reports segmentLineItem "${sliId}" has stopped playback on timestamp ${(new Date(stoppedPlayback)).toISOString()}`)

			reportSegmentLineItemHasStopped(segLineItem, stoppedPlayback)
		}
	}

	export function slPlaybackStartedCallback (roId: string, slId: string, startedPlayback: Time) {
		check(roId, String)
		check(slId, String)
		check(startedPlayback, Number)

		// This method is called when a segmentLine starts playing (like when an auto-next event occurs, or a manual next)

		let playingSegmentLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})

		if (playingSegmentLine) {
			// make sure we don't run multiple times, even if TSR calls us multiple times

			const isPlaying = (
				playingSegmentLine.startedPlayback &&
				!playingSegmentLine.stoppedPlayback
			)
			if (!isPlaying) {
				logger.info(`Playout reports segmentLine "${slId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

				let runningOrder = RunningOrders.findOne(roId)
				if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
				if (!runningOrder.active) throw new Meteor.Error(501, `RunningOrder "${roId}" is not active!`)

				let currentSegmentLine = (runningOrder.currentSegmentLineId ?
					SegmentLines.findOne(runningOrder.currentSegmentLineId)
					: null
				)

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
	export function slPlaybackStoppedCallback (roId: string, slId: string, stoppedPlayback: Time) {
		check(roId, String)
		check(slId, String)
		check(stoppedPlayback, Number)

		// This method is called when a segmentLine stops playing (like when an auto-next event occurs, or a manual next)

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		let segmentLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})

		if (segmentLine) {
			// make sure we don't run multiple times, even if TSR calls us multiple times

			const isPlaying = (
				segmentLine.startedPlayback &&
				!segmentLine.stoppedPlayback
			)
			if (isPlaying) {
				logger.info(`Playout reports segmentLine "${slId}" has stopped playback on timestamp ${(new Date(stoppedPlayback)).toISOString()}`)

				reportSegmentLineHasStopped(segmentLine, stoppedPlayback)
			}
		} else {
			throw new Meteor.Error(404, `Segment line "${slId}" in running order "${roId}" not found!`)
		}
	}
	export const segmentLineItemTakeNow = function segmentLineItemTakeNow (roId: string, slId: string, sliId: string) {
		check(roId, String)
		check(slId, String)
		check(sliId, String)

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in an active running order!`)

		let slItem = SegmentLineItems.findOne({
			_id: sliId,
			runningOrderId: roId
		}) as SegmentLineItem
		if (!slItem) throw new Meteor.Error(404, `Segment Line Item "${sliId}" not found!`)

		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		if (runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in a current segment line!`)

		let showStyleBase = runningOrder.getShowStyleBase()
		const sourceL = showStyleBase.sourceLayers.find(i => i._id === slItem.sourceLayerId)
		if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) throw new Meteor.Error(403, `Segment Line "${slId}" is not a GRAPHICS item!`)

		let newSegmentLineItem = convertAdLibToSLineItem(slItem, segLine, false)
		if (newSegmentLineItem.content && newSegmentLineItem.content.timelineObjects) {
			newSegmentLineItem.content.timelineObjects = prefixAllObjectIds(
				_.compact(
					_.map(newSegmentLineItem.content.timelineObjects, (obj) => {
						return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
							// @ts-ignore _id
							_id: obj.id || obj._id,
							siId: '', // set later
							objectType: TimelineObjType.RUNNINGORDER
						})
					})
				),
				newSegmentLineItem._id
			)
		}

		// disable the original SLI if from the same SL
		if (slItem.segmentLineId === segLine._id) {
			const segmentLineItems = getResolvedSegmentLineItems(segLine)
			const resSlItem = segmentLineItems.find(item => item._id === slItem._id)

			if (slItem.startedPlayback && slItem.startedPlayback <= getCurrentTime()) {
				if (resSlItem && resSlItem.duration !== undefined && (slItem.infiniteMode || slItem.startedPlayback + resSlItem.duration >= getCurrentTime())) {
					// logger.debug(`Segment Line Item "${slItem._id}" is currently live and cannot be used as an ad-lib`)
					throw new Meteor.Error(409, `Segment Line Item "${slItem._id}" is currently live and cannot be used as an ad-lib`)
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
	}
	export const segmentAdLibLineItemStart = syncFunction(function segmentAdLibLineItemStart (roId: string, slId: string, slaiId: string, queue: boolean) {
		check(roId, String)
		check(slId, String)
		check(slaiId, String)

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in an active running order!`)
		if (runningOrder.holdState === RunningOrderHoldState.ACTIVE || runningOrder.holdState === RunningOrderHoldState.PENDING) {
			throw new Meteor.Error(403, `Segment Line Ad Lib Items can not be used in combination with hold!`)
		}
		let adLibItem = SegmentLineAdLibItems.findOne({
			_id: slaiId,
			runningOrderId: roId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Segment Line Ad Lib Item "${slaiId}" not found!`)
		if (!queue && runningOrder.currentSegmentLineId !== slId) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in a current segment line!`)

		let orgSlId = slId
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
			// keep infinite sLineItems
			SegmentLineItems.find({ runningOrderId: roId, segmentLineId: orgSlId }).forEach(sli => {
				if (sli.infiniteMode && sli.infiniteMode >= SegmentLineItemLifespan.Infinite) {
					let newSegmentLineItem = convertAdLibToSLineItem(sli, segLine!, queue)
					SegmentLineItems.insert(newSegmentLineItem)
				}
			})

			ServerPlayoutAPI.roSetNext(runningOrder._id, slId)
		} else {
			cropInfinitesOnLayer(runningOrder, segLine, newSegmentLineItem)
			stopInfinitesRunningOnLayer(runningOrder, segLine, newSegmentLineItem.sourceLayerId)
			updateTimeline(runningOrder.studioInstallationId)
		}
	})
	export const runningOrderBaselineAdLibItemStart = syncFunction(function runningOrderBaselineAdLibItemStart (roId: string, slId: string, robaliId: string, queue: boolean) {
		check(roId, String)
		check(slId, String)
		check(robaliId, String)
		logger.debug('runningOrderBaselineAdLibItemStart')

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)
		if (!runningOrder.active) throw new Meteor.Error(403, `Running Order Baseline Ad Lib Items can be only placed in an active running order!`)
		if (runningOrder.holdState === RunningOrderHoldState.ACTIVE || runningOrder.holdState === RunningOrderHoldState.PENDING) {
			throw new Meteor.Error(403, `Segment Line Ad Lib Items can not be used in combination with hold!`)
		}

		let adLibItem = RunningOrderBaselineAdLibItems.findOne({
			_id: robaliId,
			runningOrderId: roId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Running Order Baseline Ad Lib Item "${robaliId}" not found!`)
		let orgSlId = slId
		if (queue) {
			// insert a NEW, adlibbed segmentLine after this segmentLine
			slId = adlibQueueInsertSegmentLine (runningOrder, slId, adLibItem )
		}

		let segLine = SegmentLines.findOne({
			_id: slId,
			runningOrderId: roId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		if (!queue && runningOrder.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Running Order Baseline Ad Lib Items can be only placed in a current segment line!`)

		let newSegmentLineItem = convertAdLibToSLineItem(adLibItem, segLine, queue)
		SegmentLineItems.insert(newSegmentLineItem)
		// logger.debug('adLibItemStart', newSegmentLineItem)

		if (queue) {
			// keep infinite sLineItems
			SegmentLineItems.find({ runningOrderId: roId, segmentLineId: orgSlId }).forEach(sli => {
				console.log(sli.name + ' has life span of ' + sli.infiniteMode)
				if (sli.infiniteMode && sli.infiniteMode >= SegmentLineItemLifespan.Infinite) {
					let newSegmentLineItem = convertAdLibToSLineItem(sli, segLine!, queue)
					SegmentLineItems.insert(newSegmentLineItem)
				}
			})

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

		// let nextSegmentLine = fetchAfter(SegmentLines, {
		// 	runningOrderId: ro._id
		// }, segmentLine._rank)

		// let newRank = getRank(segmentLine, nextSegmentLine, 0, 1)

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
	export function segmentAdLibLineItemStop (roId: string, slId: string, sliId: string) {
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

		let showStyleBase = runningOrder.getShowStyleBase()

		const sourceLayer = showStyleBase.sourceLayers.find(i => i._id === sourceLayerId)
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
			if (!i.durationOverride) {
				let newExpectedDuration: number | undefined = undefined

				if (i.infiniteId && i.infiniteId !== i._id && segLine) {
					let segLineStarted = segLine.getLastStartedPlayback()
					if (segLineStarted) {
						newExpectedDuration = now - segLineStarted
					}
				} else if (i.startedPlayback && (i.trigger.value < relativeNow) && (((i.trigger.value as number) + (i.duration || 0) > relativeNow) || i.duration === 0)) {
					newExpectedDuration = now - i.startedPlayback
				}

				if (newExpectedDuration !== undefined) {
					console.log(`Cropping item "${i._id}" at ${newExpectedDuration}`)

					SegmentLineItems.update({
						_id: i._id
					}, {
						$set: {
							durationOverride: newExpectedDuration
						}
					})
				}
			}
		})

		updateSourceLayerInfinitesAfterLine(runningOrder, segLine)

		updateTimeline(runningOrder.studioInstallationId)
	}
	export const roToggleSegmentLineArgument = syncFunction(function roToggleSegmentLineArgument (roId: string, slId: string, property: string, value: string) {
		check(roId, String)
		check(slId, String)

		const runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `Running order "${roId}" not found!`)
		if (runningOrder.holdState === RunningOrderHoldState.ACTIVE || runningOrder.holdState === RunningOrderHoldState.PENDING) {
			throw new Meteor.Error(403, `Segment Line Arguments can not be toggled when hold is used!`)
		}

		let segmentLine = SegmentLines.findOne(slId)
		if (!segmentLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)

		const rArguments = segmentLine.runtimeArguments || {}

		if (rArguments[property] === value) {
			// unset property
			const mUnset: any = {}
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
		return ClientAPI.responseSuccess()
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
}

let methods: Methods = {}
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
methods[PlayoutAPI.methods.roDeactivate] = (roId: string) => {
	return ServerPlayoutAPI.roDeactivate(roId)
}
methods[PlayoutAPI.methods.reloadData] = (roId: string) => {
	return ServerPlayoutAPI.reloadData(roId)
}
methods[PlayoutAPI.methods.segmentLineItemTakeNow] = (roId: string, slId: string, sliId: string) => {
	return ServerPlayoutAPI.segmentLineItemTakeNow(roId, slId, sliId)
}
methods[PlayoutAPI.methods.roTake] = (roId: string) => {
	return ServerPlayoutAPI.roTake(roId)
}
methods[PlayoutAPI.methods.roToggleSegmentLineArgument] = (roId: string, slId: string, property: string, value: string) => {
	return ServerPlayoutAPI.roToggleSegmentLineArgument(roId, slId, property, value)
}
methods[PlayoutAPI.methods.roSetNext] = (roId: string, slId: string) => {
	return ServerPlayoutAPI.roSetNext(roId, slId, true)
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
	return ServerPlayoutAPI.segmentAdLibLineItemStart(roId, slId, salliId, queue)
}
methods[PlayoutAPI.methods.runningOrderBaselineAdLibItemStart] = (roId: string, slId: string, robaliId: string, queue: boolean) => {
	return ServerPlayoutAPI.runningOrderBaselineAdLibItemStart(roId, slId, robaliId, queue)
}
methods[PlayoutAPI.methods.segmentAdLibLineItemStop] = (roId: string, slId: string, sliId: string) => {
	return ServerPlayoutAPI.segmentAdLibLineItemStop(roId, slId, sliId)
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
	// or after a new segmentLine has started playing
	updateTimeline(runningOrder.studioInstallationId)

	// defer these so that the playout gateway has the chance to learn about the changes
	Meteor.setTimeout(() => {
		if (takeSegmentLine.updateStoryStatus) {
			sendStoryStatus(runningOrder, takeSegmentLine)
		}
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

	const objs: Array<TimelineObjRunningOrder> = items.map(
		i => clone(createSegmentLineItemGroup(i, i.durationOverride || i.duration || i.expectedDuration || 0))
	)
	objs.forEach(o => {
		if (o.trigger.type === TriggerType.TIME_ABSOLUTE && (o.trigger.value === 0 || o.trigger.value === 'now')) {
			o.trigger.value = 100
		}
	})
	const tlResolved = Resolver.getTimelineInWindow(transformTimeline(objs))

	let resolvedItems: Array<SegmentLineItemResolved> = []
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

export const updateSourceLayerInfinitesAfterLine: (runningOrder: RunningOrder, previousLine?: SegmentLine, runUntilEnd?: boolean) => void
 = syncFunctionIgnore(updateSourceLayerInfinitesAfterLineInner)
export function updateSourceLayerInfinitesAfterLineInner (runningOrder: RunningOrder, previousLine?: SegmentLine, runUntilEnd?: boolean): string {
	let activeInfiniteItems: { [layer: string]: SegmentLineItem } = {}
	let activeInfiniteItemsSegmentId: { [layer: string]: string } = {}

	if (previousLine === undefined) {
		// If running from start (no previousLine), then always run to the end
		runUntilEnd = true
	}

	if (previousLine) {
		let ps: Array<Promise<any>> = []
		// figure out the baseline to set
		let prevItems = getOrderedSegmentLineItem(previousLine)
		_.each(prevItems, item => {
			if (!item.infiniteMode || item.duration || item.durationOverride || item.expectedDuration) {
				delete activeInfiniteItems[item.sourceLayerId]
				delete activeInfiniteItemsSegmentId[item.sourceLayerId]
			} else {
				if (!item.infiniteId) {
					// ensure infinite id is set
					item.infiniteId = item._id
					ps.push(
						asyncCollectionUpdate(SegmentLineItems, item._id, {
							$set: { infiniteId: item.infiniteId }
						})
					)
					logger.debug(`updateSourceLayerInfinitesAfterLine: marked "${item._id}" as start of infinite`)
				}
				if (item.infiniteMode !== SegmentLineItemLifespan.OutOnNextSegmentLine) {
					activeInfiniteItems[item.sourceLayerId] = item
					activeInfiniteItemsSegmentId[item.sourceLayerId] = previousLine.segmentId
				}
			}
		})
		waitForPromiseAll(ps)
	}

	let segmentLinesToProcess = runningOrder.getSegmentLines()
	if (previousLine) {
		segmentLinesToProcess = segmentLinesToProcess.filter(l => l._rank > previousLine._rank)
	}

	// Prepare segmentLineItems:
	let psPopulateCache: Array<Promise<any>> = []
	const currentItemsCache: {[segmentLineId: string]: SegmentLineItemResolved[]} = {}
	_.each(segmentLinesToProcess, (segmentLine) => {
		psPopulateCache.push(new Promise((resolve, reject) => {
			try {
				let currentItems = getOrderedSegmentLineItem(segmentLine)

				currentItemsCache[segmentLine._id] = currentItems
				resolve()
			} catch (e) {
				reject(e)
			}
		}))
	})
	waitForPromiseAll(psPopulateCache)

	let ps: Array<Promise<any>> = []
	for (let segmentLine of segmentLinesToProcess) {
		// Drop any that relate only to previous segments
		for (let k in activeInfiniteItemsSegmentId) {
			let s = activeInfiniteItemsSegmentId[k]
			let i = activeInfiniteItems[k]
			if (!i.infiniteMode || i.infiniteMode === SegmentLineItemLifespan.OutOnNextSegment && s !== segmentLine.segmentId) {
				delete activeInfiniteItems[k]
				delete activeInfiniteItemsSegmentId[k]
			}
		}

		// ensure any currently defined infinites are still wanted
		// let currentItems = getOrderedSegmentLineItem(segmentLine)
		let currentItems = currentItemsCache[segmentLine._id]
		if (!currentItems) throw new Meteor.Error(500, `currentItemsCache didn't contain "${segmentLine._id}", which it should have`)

		let currentInfinites = currentItems.filter(i => i.infiniteId && i.infiniteId !== i._id)
		let removedInfinites: string[] = []

		for (let segmentLineItem of currentInfinites) {
			const active = activeInfiniteItems[segmentLineItem.sourceLayerId]
			if (!active || active.infiniteId !== segmentLineItem.infiniteId) {
				// Previous item no longer enforces the existence of this one
				ps.push(asyncCollectionRemove(SegmentLineItems, segmentLineItem._id))

				removedInfinites.push(segmentLineItem._id)
				logger.debug(`updateSourceLayerInfinitesAfterLine: removed old infinite "${segmentLineItem._id}" from "${segmentLineItem.segmentLineId}"`)
			}
		}

		// stop if not running to the end and there is/was nothing active
		const midInfinites = currentInfinites.filter(i => !i.expectedDuration && i.infiniteMode)
		if (!runUntilEnd && Object.keys(activeInfiniteItemsSegmentId).length === 0 && midInfinites.length === 0) {
			// TODO - this guard is useless, as all shows have klokke and logo as infinites throughout...
			// This should instead do a check after each iteration to check if anything changed (even fields such as name on the sli)
			// If nothing changed, then it is safe to assume that it doesnt need to go further
			return segmentLine._id
		}

		// figure out what infinites are to be extended
		currentItems = currentItems.filter(i => removedInfinites.indexOf(i._id) < 0)
		let oldInfiniteContinuation: string[] = []
		let newInfiniteContinations: SegmentLineItem[] = []
		for (let k in activeInfiniteItems) {
			let newItem: SegmentLineItem = activeInfiniteItems[k]

			let existingItem: SegmentLineItemResolved | undefined = undefined
			let allowInsert: boolean = true

			// If something exists on the layer, the infinite must be stopped and potentially replaced
			const existingItems = currentItems.filter(i => i.sourceLayerId === newItem.sourceLayerId)
			if (existingItems && existingItems.length > 0) {
				// remove the existing, as we need to update its contents
				const existInf = existingItems.findIndex(e => !!e.infiniteId && e.infiniteId === newItem.infiniteId)
				if (existInf >= 0) {
					existingItem = existingItems[existInf]
					oldInfiniteContinuation.push(existingItem._id)

					existingItems.splice(existInf, 1)
				}

				if (existingItems.length > 0) {
					// It will be stopped by this line
					delete activeInfiniteItems[k]
					delete activeInfiniteItemsSegmentId[k]

					const lastExistingItem = _.last(existingItems) as SegmentLineItemResolved
					const firstExistingItem = _.first(existingItems) as SegmentLineItemResolved
					// if we matched with an infinite, then make sure that infinite is kept going
					if (lastExistingItem.infiniteMode && lastExistingItem.infiniteMode !== SegmentLineItemLifespan.OutOnNextSegmentLine) {
						activeInfiniteItems[k] = existingItems[0]
						activeInfiniteItemsSegmentId[k] = segmentLine.segmentId
					}

					// If something starts at the beginning, then dont bother adding this infinite.
					// Otherwise we should add the infinite but set it to end at the start of the first item
					if (firstExistingItem.trigger.type === TriggerType.TIME_ABSOLUTE && firstExistingItem.trigger.value === 0) {
						// skip the infinite, as it will never show
						allowInsert = false
					}
				}
			}
			newItem.segmentLineId = segmentLine._id
			newItem.continuesRefId = newItem._id
			newItem.trigger = {
				type: TriggerType.TIME_ABSOLUTE,
				value: 0
			}
			newItem._id = newItem.infiniteId + '_' + segmentLine._id
			newItem.startedPlayback = undefined
			newItem.stoppedPlayback = undefined
			newItem.timings = undefined

			if (existingItems && existingItems.length) {
				newItem.expectedDuration = `#${getSliGroupId(existingItems[0])}.start - #.start`
				newItem.infiniteMode = SegmentLineItemLifespan.Normal // it is no longer infinite, and the ui needs this to draw properly
			}

			if (existingItem) { // Some properties need to be persisted
				newItem.durationOverride = existingItem.durationOverride
				newItem.startedPlayback = existingItem.startedPlayback
				newItem.stoppedPlayback = existingItem.stoppedPlayback
				newItem.timings = existingItem.timings
			}

			let itemToInsert: SegmentLineItem | null = (allowInsert ? newItem : null)
			if (itemToInsert) {
				newInfiniteContinations.push(itemToInsert)

				delete itemToInsert['resolvedStart']
				delete itemToInsert['resolved']
			}

			if (existingItem && itemToInsert && _.isEqual(existingItem, itemToInsert)) {
				// no change, since the new item is equal to the existing one
				// logger.debug(`updateSourceLayerInfinitesAfterLine: no change to infinite continuation "${itemToInsert._id}"`)
			} else if (existingItem && itemToInsert && existingItem._id === itemToInsert._id ) {
				// same _id; we can do an update:
				ps.push(asyncCollectionUpdate(SegmentLineItems, itemToInsert._id, itemToInsert))// note; not a $set, because we want to replace the object
				logger.debug(`updateSourceLayerInfinitesAfterLine: updated infinite continuation "${itemToInsert._id}"`)
			} else {
				if (existingItem) {
					ps.push(asyncCollectionRemove(SegmentLineItems, existingItem._id))
				}
				if (itemToInsert) {
					ps.push(asyncCollectionInsert(SegmentLineItems, itemToInsert))
					logger.debug(`updateSourceLayerInfinitesAfterLine: inserted infinite continuation "${itemToInsert._id}"`)
				}
			}
		}

		// find any new infinites exposed by this
		currentItems = currentItems.filter(i => oldInfiniteContinuation.indexOf(i._id) < 0)
		for (let segmentLineItem of newInfiniteContinations.concat(currentItems)) {
			if (
				!segmentLineItem.infiniteMode ||
				segmentLineItem.duration ||
				segmentLineItem.durationOverride ||
				segmentLineItem.expectedDuration
			) {
				delete activeInfiniteItems[segmentLineItem.sourceLayerId]
				delete activeInfiniteItemsSegmentId[segmentLineItem.sourceLayerId]
			} else if (segmentLineItem.infiniteMode !== SegmentLineItemLifespan.OutOnNextSegmentLine) {
				if (!segmentLineItem.infiniteId) {
					// ensure infinite id is set
					segmentLineItem.infiniteId = segmentLineItem._id
					ps.push(asyncCollectionUpdate(SegmentLineItems, segmentLineItem._id, { $set: {
						infiniteId: segmentLineItem.infiniteId }
					}))
					logger.debug(`updateSourceLayerInfinitesAfterLine: marked "${segmentLineItem._id}" as start of infinite`)
				}

				activeInfiniteItems[segmentLineItem.sourceLayerId] = segmentLineItem
				activeInfiniteItemsSegmentId[segmentLineItem.sourceLayerId] = segmentLine.segmentId
			}
		}
	}

	waitForPromiseAll(ps)
	return ''
}

const cropInfinitesOnLayer = syncFunction(function cropInfinitesOnLayer (runningOrder: RunningOrder, segmentLine: SegmentLine, newItem: SegmentLineItem) {
	let showStyleBase = runningOrder.getShowStyleBase()
	const sourceLayerLookup = normalizeArray(showStyleBase.sourceLayers, '_id')
	const newItemExclusivityGroup = sourceLayerLookup[newItem.sourceLayerId].exclusiveGroup

	const items = segmentLine.getAllSegmentLineItems().filter(i =>
		(i.sourceLayerId === newItem.sourceLayerId
			|| (newItemExclusivityGroup && sourceLayerLookup[i.sourceLayerId] && sourceLayerLookup[i.sourceLayerId].exclusiveGroup === newItemExclusivityGroup)
		) && i._id !== newItem._id && i.infiniteMode
	)

	let ps: Array<Promise<any>> = []
	for (const i of items) {
		ps.push(asyncCollectionUpdate(SegmentLineItems, i._id, { $set: {
			expectedDuration: `#${getSliGroupId(newItem)}.start + ${newItem.adlibPreroll || 0} - #.start`,
			originalExpectedDuration: i.originalExpectedDuration !== undefined ? i.originalExpectedDuration : i.expectedDuration,
			infiniteMode: SegmentLineItemLifespan.Normal,
			originalInfiniteMode: i.originalInfiniteMode !== undefined ? i.originalInfiniteMode : i.infiniteMode
		}}))
	}
	waitForPromiseAll(ps)
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
	updateSourceLayerInfinitesAfterLine(runningOrder, segLine)
})

function convertSLineToAdLibItem (segmentLineItem: SegmentLineItem): SegmentLineAdLibItem {
	// const oldId = segmentLineItem._id
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
			infiniteMode: segmentLineItem.originalInfiniteMode !== undefined ? segmentLineItem.originalInfiniteMode : segmentLineItem.infiniteMode,
			expectedDuration: segmentLineItem.originalExpectedDuration !== undefined ? segmentLineItem.originalExpectedDuration : segmentLineItem.expectedDuration || 0 // set duration to infinite if not set by AdLibItem
		}
	))
	delete newAdLibItem.trigger
	delete newAdLibItem.timings
	delete newAdLibItem.startedPlayback
	delete newAdLibItem['infiniteId']
	delete newAdLibItem['stoppedPlayback']

	if (newAdLibItem.content && newAdLibItem.content.timelineObjects) {
		let contentObjects = newAdLibItem.content.timelineObjects
		const objs = prefixAllObjectIds(
			_.compact(
				_.map(contentObjects, (obj: TimelineObjectCoreExt) => {
					return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
						// @ts-ignore _id
						_id: obj.id || obj['_id'],
						siId: '', // set later
						objectType: TimelineObjType.RUNNINGORDER
					})
				})
			),
			newId + '_'
		)
		newAdLibItem.content.timelineObjects = objs
	}
	return newAdLibItem
}

function convertAdLibToSLineItem (adLibItem: SegmentLineAdLibItem | SegmentLineItem, segmentLine: SegmentLine, queue: boolean): SegmentLineItem {
	// const oldId = adLibItem._id
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
		const objs = prefixAllObjectIds(_.compact(
			_.map(contentObjects, (obj) => {
				return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
					// @ts-ignore _id
					_id: obj.id || obj['_id'],
					siId: '',
					objectType: TimelineObjType.RUNNINGORDER
				})
			})
		), newId + '_')
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
			}
		})
		segmentLine.duration = stoppedPlayingTime - lastStartedPlayback
		pushOntoPath(segmentLine, 'timings.stoppedPlayback', stoppedPlayingTime)
	} else {
		// logger.warn(`Segment line "${segmentLine._id}" has never started playback on running order "${roId}".`)
	}
}

function createSegmentLineGroup (segmentLine: SegmentLine, duration: number | string): TimelineObjGroupSegmentLine & TimelineObjRunningOrder {
	let slGrp = literal<TimelineObjGroupSegmentLine & TimelineObjRunningOrder>({
		_id: getSlGroupId(segmentLine),
		id: '',
		siId: '', // added later
		roId: segmentLine.runningOrderId,
		objectType: TimelineObjType.RUNNINGORDER,
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
function createSegmentLineGroupFirstObject (
	segmentLine: SegmentLine,
	segmentLineGroup: TimelineObjRunningOrder,
	previousSegmentLine?: SegmentLine
): TimelineObjSegmentLineAbstract {
	return literal<TimelineObjSegmentLineAbstract>({
		_id: getSlFirstObjectId(segmentLine),
		id: '',
		siId: '', // added later
		roId: segmentLine.runningOrderId,
		objectType: TimelineObjType.RUNNINGORDER,
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
		slId: segmentLine._id,
		classes: (segmentLine.classes || []).concat(previousSegmentLine ? previousSegmentLine.classesForNext || [] : [])
	})
}
function createSegmentLineItemGroupFirstObject (
	segmentLineItem: SegmentLineItem,
	segmentLineItemGroup: TimelineObjRunningOrder,
	firstObjClasses?: string[]
): TimelineObjSegmentLineItemAbstract {
	return literal<TimelineObjSegmentLineItemAbstract>({
		_id: getSliFirstObjectId(segmentLineItem),
		id: '',
		siId: '', // added later
		roId: segmentLineItem.runningOrderId,
		objectType: TimelineObjType.RUNNINGORDER,
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
	segmentLineGroup?: TimelineObjRunningOrder
): TimelineObjGroup & TimelineObjRunningOrder {
	return literal<TimelineObjGroup & TimelineObjRunningOrder>({
		_id: getSliGroupId(item),
		id: '',
		content: {
			type: TimelineContentTypeOther.GROUP,
			objects: []
		},
		inGroup: segmentLineGroup && segmentLineGroup._id,
		isGroup: true,
		siId: '',
		roId: item.runningOrderId,
		objectType: TimelineObjType.RUNNINGORDER,
		trigger: item.trigger,
		duration: duration,
		LLayer: item.sourceLayerId,
		metadata: {
			segmentLineItemId: item._id
		}
	})
}

function transformBaselineItemsIntoTimeline (ro: RunningOrder, items: RunningOrderBaselineItem[]): Array<TimelineObjRunningOrder> {
	let timelineObjs: Array<TimelineObjRunningOrder> = []
	_.each(items, (item: RunningOrderBaselineItem) => {
		// the baseline items are layed out without any grouping
		_.each(item.objects, (o: TimelineObjGeneric) => {
			// do some transforms maybe?
			timelineObjs.push(extendMandadory<TimelineObjGeneric, TimelineObjRunningOrder>(o, {
				roId: ro._id,
				objectType: TimelineObjType.RUNNINGORDER
			}))
		})
	})
	return timelineObjs
}

interface TransformTransitionProps {
	allowed: boolean
	preroll?: number
	transitionPreroll?: number | null
	transitionKeepalive?: number | null
}

function transformSegmentLineIntoTimeline (
	runningOrder: RunningOrder,
	items: SegmentLineItem[],
	firstObjClasses: string[],
	segmentLineGroup?: TimelineObjRunningOrder,
	transitionProps?: TransformTransitionProps,
	holdState?: RunningOrderHoldState,
	showHoldExcept?: boolean
): Array<TimelineObjRunningOrder> {
	let timelineObjs: Array<TimelineObjRunningOrder> = []

	const isHold = holdState === RunningOrderHoldState.ACTIVE
	const allowTransition = transitionProps && transitionProps.allowed && !isHold && holdState !== RunningOrderHoldState.COMPLETE
	const transition: SegmentLineItem | undefined = allowTransition ? clone(items.find(i => !!i.isTransition)) : undefined
	const transitionSliDelay = transitionProps ? Math.max(0, (transitionProps.preroll || 0) - (transitionProps.transitionPreroll || 0)) : 0
	const transitionContentsDelay = transitionProps ? (transitionProps.transitionPreroll || 0) - (transitionProps.preroll || 0) : 0

	_.each(clone(items), (item: SegmentLineItem) => {
		if (item.disabled) return
		if (item.isTransition && (!allowTransition || isHold)) {
			return
		}

		if (item.infiniteId && item.infiniteId !== item._id) {
			item._id = item.infiniteId
		}

		if (
			item.content &&
			item.content.timelineObjects
		) {
			let tos: TimelineObjectCoreExt[] = item.content.timelineObjects

			const isInfiniteContinuation = item.infiniteId && item.infiniteId !== item._id
			if (item.trigger.type === TriggerType.TIME_ABSOLUTE && item.trigger.value === 0 && !isInfiniteContinuation) {
				// If timed absolute and there is a transition delay, then apply delay
				if (!item.isTransition && allowTransition && transition && !item.adLibSourceId) {
					const transitionContentsDelayStr = transitionContentsDelay < 0 ? `- ${-transitionContentsDelay}` : `+ ${transitionContentsDelay}`
					item.trigger.type = TriggerType.TIME_RELATIVE
					item.trigger.value = `#${getSliGroupId(transition)}.start ${transitionContentsDelayStr}`
				} else if (item.isTransition && transitionSliDelay) {
					item.trigger.type = TriggerType.TIME_ABSOLUTE
					item.trigger.value = Math.max(0, transitionSliDelay)
				}
			}

			// create a segmentLineItem group for the items and then place all of them there
			const segmentLineItemGroup = createSegmentLineItemGroup(item, item.durationOverride || item.duration || item.expectedDuration || 0, segmentLineGroup)
			timelineObjs.push(segmentLineItemGroup)

			if (!item.virtual) {
				timelineObjs.push(createSegmentLineItemGroupFirstObject(item, segmentLineItemGroup, firstObjClasses))

				_.each(tos, (o: TimelineObjectCoreExt) => {
					if (o.holdMode) {
						if (isHold && !showHoldExcept && o.holdMode === TimelineObjHoldMode.EXCEPT) {
							return
						}
						if (!isHold && o.holdMode === TimelineObjHoldMode.ONLY) {
							return
						}
					}
					// if (segmentLineGroup) {
						// If we are leaving a HOLD, the transition was suppressed, so force it to run now
						// if (item.isTransition && holdState === RunningOrderHoldState.COMPLETE) {
						// 	o.trigger.value = TriggerType.TIME_ABSOLUTE
						// 	o.trigger.value = 'now'
						// }
					// }

					timelineObjs.push(extendMandadory<TimelineObjectCoreExt, TimelineObjRunningOrder>(o, {
						// @ts-ignore _id
						_id: o.id || o['_id'],
						siId: '', // set later
						inGroup: segmentLineGroup ? segmentLineItemGroup._id : undefined,
						roId: runningOrder._id,
						objectType: TimelineObjType.RUNNINGORDER
					}))
				})
			}
		}
	})
	return timelineObjs
}

export function getLookeaheadObjects (roData: RoData, studioInstallation: StudioInstallation ): Array<TimelineObjGeneric> {
	let activeRunningOrder = roData.runningOrder

	const timelineObjs: Array<TimelineObjGeneric> = []
	_.each(studioInstallation.mappings || {}, (m, l) => {

		const res = findLookaheadForLLayer(roData, l, m.lookahead)
		if (res.length === 0) {
			return
		}

		for (let i = 0; i < res.length; i++) {
			const r = clone(res[i].obj) as TimelineObjGeneric

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

			if (m.lookahead === LookaheadMode.PRELOAD) {
				r.originalLLayer = r.LLayer
				r.LLayer += '_lookahead'
			}

			timelineObjs.push(r)
		}
	})
	return timelineObjs
}

export function findLookaheadForLLayer (
	roData: RoData,
	layer: string,
	mode: LookaheadMode
): Array<{
	obj: TimelineObjRunningOrder,
	slId: string
}> {
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
			_.find(sli.content.timelineObjects, (o) => (o && o.LLayer === layer))
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
			return r ? [{ obj: r as TimelineObjRunningOrder, slId: i.segmentLineId }] : []
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

	let findObjectForSegmentLine = (): TimelineObjRunningOrder[] => {
		if (!sliGroup || sliGroup.items.length === 0) {
			return []
		}

		let rawObjs: (TimelineObjRunningOrder | null)[] = []
		sliGroup.items.forEach(i => {
			if (i.content && i.content.timelineObjects) {
				rawObjs = rawObjs.concat(i.content.timelineObjects as TimelineObjRunningOrder[])
			}
		})
		let allObjs: TimelineObjRunningOrder[] = _.compact(rawObjs)

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

				const res: TimelineObjRunningOrder[] = []
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
						res.push(obj as TimelineObjRunningOrder)
					}
				})

				return res
			}
		}

		return allObjs
	}

	const res: {obj: TimelineObjRunningOrder, slId: string}[] = []

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

interface UpdateTimelineFromMosDataTimeout {
	timeout?: number
	changedLines?: string[]
}
let updateTimelineFromMosDataTimeouts: {
	[id: string]: UpdateTimelineFromMosDataTimeout
} = {}
export function updateTimelineFromMosData (roId: string, changedLines?: Array<string>) {
	const runningOrder = RunningOrders.findOne(roId)
	if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	let data: UpdateTimelineFromMosDataTimeout = updateTimelineFromMosDataTimeouts[roId]
	if (data) {
		if (data.timeout) Meteor.clearTimeout(data.timeout)
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

		updateSourceLayerInfinitesAfterLine(runningOrder, prevLine, true)

		if (runningOrder.active) {
			updateTimeline(runningOrder.studioInstallationId)
		}
	}, 1000)

	updateTimelineFromMosDataTimeouts[roId] = data
}

function prefixAllObjectIds<T extends TimelineObjGeneric> (objList: T[], prefix: string): T[] {
	const changedIds = objList.map(o => o._id)

	let replaceIds = (str: string) => {
		return str.replace(/#([a-zA-Z0-9_]+)/g, (m) => {
			const id = m.substr(1, m.length - 1)
			return changedIds.indexOf(id) >= 0 ? '#' + prefix + id : m
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

	let timelineObjs: Array<TimelineObjGeneric> = []

	let studioInstallation = StudioInstallations.findOne(studioInstallationId)
	if (!studioInstallation) throw new Meteor.Error(404, 'studioInstallation "' + studioInstallationId + '" not found!')

	const applyTimelineObjs = (_timelineObjs: TimelineObjGeneric[]) => {
		timelineObjs = timelineObjs.concat(_timelineObjs)
	}

	waitForPromiseAll([
		caught(getTimelineRunningOrder(studioInstallation).then(applyTimelineObjs)),
		caught(getTimelineRecording(studioInstallation).then(applyTimelineObjs))
	])

	processTimelineObjects(studioInstallation, timelineObjs)

	if (forceNowToTime) { // used when autoNexting
		setNowToTimeInObjects(timelineObjs, forceNowToTime)
	}

	saveIntoDb<TimelineObjGeneric, TimelineObjGeneric>(Timeline, {
		siId: studioInstallation._id
	}, timelineObjs, {
		beforeUpdate: (o: TimelineObjGeneric, oldO: TimelineObjGeneric): TimelineObjGeneric => {
			// do not overwrite trigger when the trigger has been denowified
			if (o.trigger.value === 'now' && oldO.trigger.setFromNow) {
				o.trigger.type = oldO.trigger.type
				o.trigger.value = oldO.trigger.value
			}
			return o
		}
	})

	afterUpdateTimeline(studioInstallation, timelineObjs)
	logger.debug('updateTimeline done!')
})

/**
 * Returns timeline objects related to runningOrders in a studio
 */
function getTimelineRunningOrder (studioInstallation: StudioInstallation): Promise<TimelineObjRunningOrder[]> {

	return new Promise((resolve, reject) => {
		try {
			let timelineObjs: Array<TimelineObjGeneric> = []

			const promiseActiveRunningOrder = asyncCollectionFindOne(RunningOrders, {
				studioInstallationId: studioInstallation._id,
				active: true
			})
			// let promiseStudioInstallation = asyncCollectionFindOne(StudioInstallations, studioInstallation._id)
			let activeRunningOrder = waitForPromise(promiseActiveRunningOrder)

			if (activeRunningOrder) {

				// remove anything not related to active running order:
				let promiseClearTimeline: Promise<void> = asyncCollectionRemove(Timeline, {
					siId: studioInstallation._id,
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

				// Default timelineobjects:
				let baselineItems = waitForPromise(promiseBaselineItems)

				timelineObjs = timelineObjs.concat(buildTimelineObjsForRunningOrder(roData, baselineItems))

				// next (on pvw (or on pgm if first))
				timelineObjs = timelineObjs.concat(getLookeaheadObjects(roData, studioInstallation))

				// console.log(JSON.stringify(timelineObjs))

				// TODO: Specific implementations, to be refactored into Blueprints:
				setLawoObjectsTriggerValue(timelineObjs, activeRunningOrder.currentSegmentLineId || undefined)
				timelineObjs = validateNoraPreload(timelineObjs)

				waitForPromise(promiseClearTimeline)

				// console.log('full', JSON.stringify(timelineObjs, undefined, 4))

				resolve(
					_.map<TimelineObjGeneric, TimelineObjRunningOrder>(timelineObjs, (timelineObj) => {

						return extendMandadory<TimelineObjGeneric, TimelineObjRunningOrder>(timelineObj, {
							roId: activeRunningOrder._id,
							objectType: TimelineObjType.RUNNINGORDER
						})
					})
				)
			} else {
				resolve([])
				// remove everything:
				// Timeline.remove({
				// 	siId: studioInstallationId,
				// 	objectType: TimelineObjType.RUNNINGORDER,
				// 	statObject: {$ne: true},
				// })
			}
		} catch (e) {
			reject(e)
		}
	})

}
/**
 * Returns timeline objects related to Test Recordings in a studio
 */
function getTimelineRecording (studioInstallation: StudioInstallation, forceNowToTime?: Time): Promise<TimelineObjRecording[]> {

	return new Promise((resolve, reject) => {
		try {
			let recordingTimelineObjs: TimelineObjRecording[] = []

			const activeRecordings = RecordedFiles.find({ // TODO: ask Julian if this is okay, having multiple recordings at the same time?
				studioId: studioInstallation._id,
				stoppedAt: {$exists: false}
			}, {
				sort: {
					startedAt: 1 // TODO - is order correct?
				}
			}).forEach((activeRecording) => {
				recordingTimelineObjs = recordingTimelineObjs.concat(
					generateRecordingTimelineObjs(studioInstallation, activeRecording)
				)
			})

			resolve(recordingTimelineObjs)
		} catch (e) {
			reject(e)
		}
	})
	// Timeline.remove({
	// 	siId: studioInstallationId,
	// 	recordingObject: true
	// })
}

export function buildTimelineObjsForRunningOrder (roData: RoData, baselineItems: RunningOrderBaselineItem[]): TimelineObjRunningOrder[] {
	let timelineObjs: Array<TimelineObjRunningOrder> = []
	let currentSegmentLineGroup: TimelineObjRunningOrder | undefined
	let previousSegmentLineGroup: TimelineObjRunningOrder | undefined

	let currentSegmentLine: SegmentLine | undefined
	let nextSegmentLine: SegmentLine | undefined

	// let currentSegmentLineItems: Array<SegmentLineItem> = []
	let previousSegmentLine: SegmentLine | undefined

	let activeRunningOrder = roData.runningOrder

	timelineObjs.push(literal<TimelineObjRunningOrder>({
		siId: '', // set later
		id: '', // set later
		objectType: TimelineObjType.RUNNINGORDER,
		roId: roData.runningOrder._id,
		_id: activeRunningOrder._id + '_status',
		trigger: {
			type: TriggerType.LOGICAL,
			value: '1'
		},
		LLayer: 'ro_status',
		isAbstract: true,
		content: {},
		classes: [activeRunningOrder.rehearsal ? 'ro_rehersal' : 'ro_active']
	}))

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

	if (baselineItems) {
		timelineObjs = timelineObjs.concat(transformBaselineItemsIntoTimeline(roData.runningOrder, baselineItems))
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
				const prevSlOverlapDuration = calcSlKeepaliveDuration(previousSegmentLine, currentSegmentLine, true)
				previousSegmentLineGroup = createSegmentLineGroup(previousSegmentLine, `#${getSlGroupId(currentSegmentLine)}.start + ${prevSlOverlapDuration} - #.start`)
				previousSegmentLineGroup.priority = -1
				previousSegmentLineGroup.trigger = literal<TimelineTypes.TimelineTrigger>({
					type: TriggerType.TIME_ABSOLUTE,
					value: previousSegmentLine.getLastStartedPlayback() || 0
				})

				// If a SegmentLineItem is infinite, and continued in the new SegmentLine, then we want to add the SegmentLineItem only there to avoid id collisions
				const skipIds = currentInfiniteItems.map(l => l.infiniteId || '')
				const previousSegmentLineItems = previousSegmentLine.getAllSegmentLineItems().filter(l => !l.infiniteId || skipIds.indexOf(l.infiniteId) < 0)

				const groupClasses: string[] = ['previous_sl']
				let prevObjs: TimelineObjRunningOrder[] = [previousSegmentLineGroup]
				prevObjs = prevObjs.concat(
					transformSegmentLineIntoTimeline(roData.runningOrder, previousSegmentLineItems, groupClasses, previousSegmentLineGroup, undefined, activeRunningOrder.holdState, undefined))

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
		const currentSLDuration = !isFollowed ? 0 : calcSlTargetDuration(previousSegmentLine, currentSegmentLine)
		currentSegmentLineGroup = createSegmentLineGroup(currentSegmentLine, currentSLDuration)
		if (currentSegmentLine.startedPlayback && currentSegmentLine.getLastStartedPlayback()) { // If we are recalculating the currentLine, then ensure it doesnt think it is starting now
			currentSegmentLineGroup.trigger = literal<TimelineTypes.TimelineTrigger>({
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

				// If we are a continuation, set the same start point to ensure that anything timed is correct
				if (originalItem && originalItem.startedPlayback) {
					infiniteGroup.trigger = literal<TimelineTypes.TimelineTrigger>({
						type: TriggerType.TIME_ABSOLUTE,
						value: originalItem.startedPlayback
					})

					// If an absolute time has been set by a hotkey, then update the duration to be correct
					const slStartedPlayback = currentSegmentLine.getLastStartedPlayback()
					if (item.durationOverride && slStartedPlayback) {
						const originalEndTime = slStartedPlayback + item.durationOverride
						infiniteGroup.duration = originalEndTime - originalItem.startedPlayback
					}
				}
			}

			// Still show objects flagged as 'HoldMode.EXCEPT' if this is a infinite continuation as they belong to the previous too
			const showHoldExcept = item.infiniteId !== item._id
			timelineObjs = timelineObjs.concat(infiniteGroup, transformSegmentLineIntoTimeline(roData.runningOrder, [item], groupClasses, infiniteGroup, undefined, activeRunningOrder.holdState, showHoldExcept))
		}

		const groupClasses: string[] = ['current_sl']
		const transProps: TransformTransitionProps = {
			allowed: allowTransition,
			preroll: currentSegmentLine.prerollDuration,
			transitionPreroll: currentSegmentLine.transitionPrerollDuration,
			transitionKeepalive: currentSegmentLine.transitionKeepaliveDuration
		}
		timelineObjs = timelineObjs.concat(
			currentSegmentLineGroup,
			transformSegmentLineIntoTimeline(roData.runningOrder, currentNormalItems, groupClasses, currentSegmentLineGroup, transProps, activeRunningOrder.holdState, undefined)
		)

		timelineObjs.push(createSegmentLineGroupFirstObject(currentSegmentLine, currentSegmentLineGroup, previousSegmentLine))

		// only add the next objects into the timeline if the next segment is autoNext
		if (nextSegmentLine && currentSegmentLine.autoNext) {
			// console.log('This segment line will autonext')
			let nextSegmentLineItemGroup = createSegmentLineGroup(nextSegmentLine, 0)
			if (currentSegmentLineGroup) {
				const overlapDuration = calcSlOverlapDuration(currentSegmentLine, nextSegmentLine)

				nextSegmentLineItemGroup.trigger = literal<TimelineTypes.TimelineTrigger>({
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
			const transProps: TransformTransitionProps = {
				allowed: currentSegmentLine && !currentSegmentLine.disableOutTransition,
				preroll: nextSegmentLine.prerollDuration,
				transitionPreroll: nextSegmentLine.transitionPrerollDuration,
				transitionKeepalive: nextSegmentLine.transitionKeepaliveDuration
			}
			timelineObjs = timelineObjs.concat(
				nextSegmentLineItemGroup,
				transformSegmentLineIntoTimeline(roData.runningOrder, nextItems, groupClasses, nextSegmentLineItemGroup, transProps)
			)
			timelineObjs.push(createSegmentLineGroupFirstObject(nextSegmentLine, nextSegmentLineItemGroup, currentSegmentLine))
		}
	}

	if (!nextSegmentLine && !currentSegmentLine) {
		// maybe at the end of the show
		logger.info(`No next segmentLine and no current segment line set on running order "${activeRunningOrder._id}".`)
	}

	return timelineObjs
}

function calcSlKeepaliveDuration (fromSl: SegmentLine, toSl: SegmentLine, relativeToFrom: boolean): number {
	const allowTransition: boolean = !fromSl.disableOutTransition
	if (!allowTransition) {
		return fromSl.autoNextOverlap || 0
	}

	if (relativeToFrom) { // TODO remove
		if (toSl.transitionKeepaliveDuration === undefined || toSl.transitionKeepaliveDuration === null) {
			return (toSl.prerollDuration || 0)
		}

		const transSliDelay = Math.max(0, (toSl.prerollDuration || 0) - (toSl.transitionPrerollDuration || 0))
		return transSliDelay + (toSl.transitionKeepaliveDuration || 0)
	}

	// if (toSl.transitionKeepaliveDuration === undefined || toSl.transitionKeepaliveDuration === null) {
	// 	return (fromSl.autoNextOverlap || 0)
	// }

	return 0
}
function calcSlTargetDuration (prevSl: SegmentLine | undefined, currentSl: SegmentLine): number {
	if (currentSl.expectedDuration === undefined) {
		return 0
	}

	// This is a horrible hack, to compensate for the expectedDuration mangling in the blueprints which is
	// needed to get the show runtime to be correct. This just inverts that mangling before running as 'intended'
	const maxPreroll = Math.max(currentSl.transitionPrerollDuration ? currentSl.transitionPrerollDuration : 0, currentSl.prerollDuration || 0)
	const maxKeepalive = Math.max(currentSl.transitionKeepaliveDuration ? currentSl.transitionKeepaliveDuration : 0, currentSl.prerollDuration || 0)
	const lengthAdjustment = maxPreroll - maxKeepalive
	const rawExpectedDuration = (currentSl.expectedDuration || 0) - lengthAdjustment

	if (!prevSl || prevSl.disableOutTransition) {
		return rawExpectedDuration + (currentSl.prerollDuration || 0)
	}

	let prerollDuration = (currentSl.transitionPrerollDuration || currentSl.prerollDuration || 0)
	return rawExpectedDuration + (prevSl.autoNextOverlap || 0) + prerollDuration
}
function calcSlOverlapDuration (fromSl: SegmentLine, toSl: SegmentLine): number {
	const allowTransition: boolean = !fromSl.disableOutTransition
	let overlapDuration: number = toSl.prerollDuration || 0
	if (allowTransition && toSl.transitionPrerollDuration) {
		overlapDuration = calcSlKeepaliveDuration(fromSl, toSl, true)
	}

	if (fromSl.autoNext) {
		overlapDuration += (fromSl.autoNextOverlap || 0)
	}

	return overlapDuration
}
/**
 * Fix the timeline objects, adds properties like deviceId and siId to the timeline objects
 * @param studioInstallation
 * @param timelineObjs Array of timeline objects
 */
function processTimelineObjects (studioInstallation: StudioInstallation, timelineObjs: Array<TimelineObjGeneric>): void {
	// first, split out any grouped objects, to make the timeline shallow:
	let fixObjectChildren = (o: TimelineObjGeneric) => {
		// Unravel children objects and put them on the (flat) timelineObjs array
		if (o.isGroup && o.content && o.content.objects && o.content.objects.length) {
			// let o2 = o as TimelineObjGeneric
			_.each(o.content.objects, (child: TimelineTypes.TimelineObject) => {
				let childFixed: TimelineObjGeneric = extendMandadory<TimelineTypes.TimelineObject, TimelineObjGeneric>(child, {
					// @ts-ignore _id
					_id: child.id || child['_id'],
					siId: o.siId,
					objectType: o.objectType,
					inGroup: o._id
				})
				if (!childFixed._id) logger.error(`TimelineObj missing _id attribute (child of ${o._id})`, childFixed)
				delete childFixed['id']
				timelineObjs.push(childFixed)
				fixObjectChildren(childFixed as TimelineObjGroup)
			})
			delete o.content.objects
		}
	}
	_.each(timelineObjs, (o: TimelineObjGeneric) => {
		o._id = o._id || o.id
		if (!o._id) logger.error('TimelineObj missing _id attribute', o)
		delete o.id
		o.siId = studioInstallation._id

		fixObjectChildren(o)
	})
}

/**
 * To be called after an update to the timeline has been made, will add/update the "statObj" - an object
 * containing the hash of the timeline, used to determine if the timeline should be updated in the gateways
 * @param studioInstallationId id of the studioInstallation to update
 */
export function afterUpdateTimeline (studioInstallation: StudioInstallation, timelineObjs?: Array<TimelineObjGeneric>) {

	// logger.info('afterUpdateTimeline')
	if (!timelineObjs) {
		timelineObjs = Timeline.find({
			siId: studioInstallation._id,
			statObject: {$ne: true}
		}).fetch()
	}

	// Number of objects
	let objCount = timelineObjs.length
	// Hash of all objects
	timelineObjs = timelineObjs.sort((a, b) => {
		if (a._id < b._id) return 1
		if (a._id > b._id) return -1
		return 0
	})
	let objHash = getHash(stringifyObjects(timelineObjs))

	// save into "magic object":
	let magicId = studioInstallation._id + '_statObj'
	let statObj: TimelineObjStat = {
		_id: magicId,
		id: '',
		siId: studioInstallation._id,
		objectType: TimelineObjType.STAT,
		statObject: true,
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

	waitForPromise(asyncCollectionUpsert(Timeline, magicId, {$set: statObj}))
}

/**
 * goes through timelineObjs and forces the "now"-values to the absolute time specified
 * @param timelineObjs Array of (flat) timeline objects
 * @param now The time to set the "now":s to
 */
function setNowToTimeInObjects (timelineObjs: Array<TimelineObjGeneric>, now: Time): void {
	_.each(timelineObjs, (o) => {
		if (o.trigger.type === TriggerType.TIME_ABSOLUTE &&
			o.trigger.value === 'now'
		) {
			o.trigger.value = now
			o.trigger.setFromNow = true
		}
	})
}

function setLawoObjectsTriggerValue (timelineObjs: Array<TimelineObjGeneric>, currentSegmentLineId: string | undefined) {

	_.each(timelineObjs, (obj) => {
		if (obj.content.type === TimelineContentTypeLawo.SOURCE ) {
			let lawoObj = obj as TimelineObjLawo & TimelineObjGeneric

			_.each(lawoObj.content.attributes, (val, key) => {
				// set triggerValue to the current playing segment, thus triggering commands to be sent when nexting:
				lawoObj.content.attributes[key].triggerValue = currentSegmentLineId || ''
			})
		}
	})
}

function validateNoraPreload (timelineObjs: Array<TimelineObjGeneric>) {
	const toRemoveIds: Array<string> = []
	_.each(timelineObjs, obj => {
		// ignore normal objects
		if (obj.content.type !== TimelineContentTypeHttp.POST) return
		if (!obj.isBackground) return

		const obj2 = obj as TimelineObjHTTPRequest & TimelineObjGeneric
		if (obj2.content.params && obj2.content.params.template && (obj2.content.params.template as any).event === 'take') {
			(obj2.content.params.template as any).event = 'cue'
		} else {
			// something we don't understand, so dont lookahead on it
			toRemoveIds.push(obj._id)
		}
	})

	return timelineObjs.filter(o => toRemoveIds.indexOf(o._id) === -1)
}
