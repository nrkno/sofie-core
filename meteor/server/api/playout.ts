
/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import { Rundowns, Rundown, RundownHoldState, RundownData, DBRundown } from '../../lib/collections/Rundowns'
import { SegmentLine, SegmentLines, DBSegmentLine } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItems, SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { RundownBaselineItems, RundownBaselineItem } from '../../lib/collections/RundownBaselineItems'
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
	caught,
	makePromise,
	getHash
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
	TimelineObjRundown,
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
import { TriggerType, TimelineTrigger } from 'superfly-timeline'
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
	TimelineObjectCoreExt,
	VTContent
} from 'tv-automation-sofie-blueprints-integration'
import { RundownBaselineAdLibItem, RundownBaselineAdLibItems } from '../../lib/collections/RundownBaselineAdLibItems'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import { CachePrefix } from '../../lib/collections/RundownDataCache'
import { PlayoutAPI } from '../../lib/api/playout'
import { syncFunction, syncFunctionIgnore } from '../codeControl'
import { getResolvedSegment, ISourceLayerExtended } from '../../lib/Rundown'
let clone = require('fast-clone')
import { Resolver } from 'superfly-timeline'
import { transformTimeline } from '../../lib/timeline'
import { ClientAPI } from '../../lib/api/client'
import { setMeteorMethods, Methods } from '../methods'
import { sendStoryStatus, updateStory } from './integration/mos'
import { updateSegmentLines, reloadRundownData } from './rundown'
import { runPostProcessBlueprint } from '../../server/api/rundown'
import { RecordedFiles } from '../../lib/collections/RecordedFiles'
import { generateRecordingTimelineObjs } from './testTools'
import {
	reportRundownHasStarted,
	reportSegmentLineHasStarted,
	reportSegmentLineItemHasStarted,
	reportSegmentLineHasStopped,
	reportSegmentLineItemHasStopped
} from './asRunLog'
import { Blueprints } from '../../lib/collections/Blueprints'
import { getBlueprintOfRundown, loadStudioBlueprints } from './blueprints/cache'
import { RundownContext, StudioContext, PartEventContext } from './blueprints/context'
import { postProcessStudioBaselineObjects } from './blueprints/postProcess'
const PackageInfo = require('../../package.json')

export namespace ServerPlayoutAPI {
	/**
	 * Prepare the broadcast for transmission
	 * To be triggered well before the broadcast because it may take time
	 */
	export function rundownPrepareForBroadcast (rundownId: string) {
		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (rundown.active) throw new Meteor.Error(404, `rundownPrepareForBroadcast cannot be run on an active rundown!`)
		const anyOtherActiveRundowns = areThereActiveROsInStudio(rundown.studioInstallationId, rundown._id)
		if (anyOtherActiveRundowns.length) {
			// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.pluck(anyOtherActiveRundowns, '_id'))
			throw new Meteor.Error(409, 'Only one rundown can be active at the same time. Active rundowns: ' + _.pluck(anyOtherActiveRundowns, '_id'))
		}

		resetRundown(rundown)
		prepareStudioForBroadcast(rundown.getStudioInstallation())

		return activateRundown(rundown, true) // Activate rundown (rehearsal)
	}
	/**
	 * Reset the broadcast, to be used during testing.
	 * The User might have run through the rundown and wants to start over and try again
	 */
	export function rundownResetRundown (rundownId: string) {
		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(401, `rundownResetBroadcast can only be run in rehearsal!`)

		resetRundown(rundown)

		updateTimeline(rundown.studioInstallationId)

		return { success: 200 }
	}
	/**
	 * Activate the rundown, final preparations before going on air
	 * To be triggered by the User a short while before going on air
	 */
	export function rundownResetAndActivate (rundownId: string) {
		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(402, `rundownResetAndActivate cannot be run when active!`)

		resetRundown(rundown)

		return activateRundown(rundown, false) // Activate rundown
	}
	/**
	 * Only activate the rundown, don't reset anything
	 */
	export function rundownActivate (rundownId: string, rehearsal: boolean) {
		check(rehearsal, Boolean)
		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		return activateRundown(rundown, rehearsal)
	}
	/**
	 * Deactivate the rundown
	 */
	export function rundownDeactivate (rundownId: string) {
		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		return deactivateRundown(rundown)
	}
	/**
	 * Trigger a reload of data of the rundown
	 */
	export function reloadData (rundownId: string) {
		// Reload and reset the Rundown
		check(rundownId, String)
		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		return ClientAPI.responseSuccess(
			reloadRundownData(rundown)
		)
	}
	function resetRundown (rundown: Rundown) {
		logger.info('resetRundown ' + rundown._id)
		// Remove all dunamically inserted items (adlibs etc)
		SegmentLineItems.remove({
			rundownId: rundown._id,
			dynamicallyInserted: true
		})

		SegmentLines.remove({
			rundownId: rundown._id,
			dynamicallyInserted: true
		})

		SegmentLines.update({
			rundownId: rundown._id
		}, {
			$unset: {
				duration: 1,
				startedPlayback: 1,
				timings: 1,
				runtimeArguments: 1
			}
		}, {multi: true})

		const dirtySegmentLines = SegmentLines.find({
			rundownId: rundown._id,
			dirty: true
		}).fetch()
		dirtySegmentLines.forEach(sl => {
			refreshSegmentLine(rundown, sl)
			SegmentLines.update(sl._id, {$unset: {
				dirty: 1
			}})
		})

		// Reset all segment line items that were modified for holds
		SegmentLineItems.update({
			rundownId: rundown._id,
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
			rundownId: rundown._id,
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
			rundownId: rundown._id
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
		updateSourceLayerInfinitesAfterLine(rundown)

		resetRundownPlayhead(rundown)
	}
	function resetRundownPlayhead (rundown: Rundown) {
		logger.info('resetRundownPlayhead ' + rundown._id)
		let segmentLines = rundown.getSegmentLines()

		Rundowns.update(rundown._id, {
			$set: {
				previousSegmentLineId: null,
				currentSegmentLineId: null,
				updateStoryStatus: null,
				holdState: RundownHoldState.NONE,
			}, $unset: {
				startedPlayback: 1
			}
		})

		if (rundown.active) {
			// put the first on queue:
			setNextSegmentLine(rundown, _.first(segmentLines) || null)
		} else {
			setNextSegmentLine(rundown, null)
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
	export function areThereActiveROsInStudio (studioInstallationId: string, excludeRundownId: string): Rundown[] {
		let anyOtherActiveRundowns = Rundowns.find({
			studioInstallationId: studioInstallationId,
			active: true,
			_id: {
				$ne: excludeRundownId
			}
		}).fetch()

		return anyOtherActiveRundowns
	}
	function activateRundown (rundown: Rundown, rehearsal: boolean) {
		logger.info('Activating rundown ' + rundown._id + (rehearsal ? ' (Rehearsal)' : ''))

		rehearsal = !!rehearsal
		// if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(403, `Rundown "${rundown._id}" is active and not in rehersal, cannot reactivate!`)

		let newRundown = Rundowns.findOne(rundown._id) // fetch new from db, to make sure its up to date

		if (!newRundown) throw new Meteor.Error(404, `Rundown "${rundown._id}" not found!`)
		rundown = newRundown

		let studio = rundown.getStudioInstallation()

		const anyOtherActiveRundowns = areThereActiveROsInStudio(studio._id, rundown._id)

		if (anyOtherActiveRundowns.length) {
			// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.pluck(anyOtherActiveRundowns, '_id'))
			throw new Meteor.Error(409, 'Only one rundown can be active at the same time. Active rundowns: ' + _.pluck(anyOtherActiveRundowns, '_id'))
		}

		let wasInactive = !rundown.active

		let m = {
			active: true,
			rehearsal: rehearsal,
		}
		Rundowns.update(rundown._id, {
			$set: m
		})
		// Update local object:
		rundown.active = true
		rundown.rehearsal = rehearsal

		if (!rundown.nextSegmentLineId) {
			let segmentLines = rundown.getSegmentLines()
			let firstSegmentLine = _.first(segmentLines)
			if (firstSegmentLine) {
				setNextSegmentLine(rundown, firstSegmentLine)
			}
		}

		updateTimeline(studio._id)

		Meteor.defer(() => {
			let bp = getBlueprintOfRundown(rundown)
			if (bp.onRundownActivate) {
				Promise.resolve(bp.onRundownActivate(new RundownContext(rundown, studio)))
				.catch(logger.error)
			}
		})
	}
	function deactivateRundown (rundown: Rundown) {
		logger.info('Deactivating rundown ' + rundown._id)

		let previousSegmentLine = (rundown.currentSegmentLineId ?
			SegmentLines.findOne(rundown.currentSegmentLineId)
			: null
		)

		if (previousSegmentLine) segmentLineStoppedPlaying(rundown._id, previousSegmentLine, getCurrentTime())

		Rundowns.update(rundown._id, {
			$set: {
				active: false,
				previousSegmentLineId: null,
				currentSegmentLineId: null,
				holdState: RundownHoldState.NONE,
			}
		})
		setNextSegmentLine(rundown, null)
		if (rundown.currentSegmentLineId) {
			SegmentLines.update(rundown.currentSegmentLineId, {
				$push: {
					'timings.takeOut': getCurrentTime()
				}
			})
		}

		// clean up all runtime baseline items
		RundownBaselineItems.remove({
			rundownId: rundown._id
		})

		RundownBaselineAdLibItems.remove({
			rundownId: rundown._id
		})

		updateTimeline(rundown.studioInstallationId)

		sendStoryStatus(rundown, null)

		Meteor.defer(() => {
			let bp = getBlueprintOfRundown(rundown)
			if (bp.onRundownDeActivate) {
				Promise.resolve(bp.onRundownDeActivate(new RundownContext(rundown)))
				.catch(logger.error)
			}
		})
	}
	function resetSegmentLine (segmentLine: DBSegmentLine): Promise<void> {
		let ps: Array<Promise<any>> = []

		let isDirty = segmentLine.dirty || false

		ps.push(asyncCollectionUpdate(SegmentLines, {
			rundownId: segmentLine.rundownId,
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
			rundownId: segmentLine.rundownId,
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
			rundownId: segmentLine.rundownId,
			segmentLineId: segmentLine._id,
			dynamicallyInserted: true
		}))

		// Reset any segment line items that were modified by inserted adlibs
		ps.push(asyncCollectionUpdate(SegmentLineItems, {
			rundownId: segmentLine.rundownId,
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
				const rundown = Rundowns.findOne(segmentLine.rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${segmentLine.rundownId}" not found!`)

				Promise.all(ps)
				.then(() => {
					refreshSegmentLine(rundown, segmentLine)
					resolve()
				}).catch((e) => reject())
			})
		} else {
			const rundown = Rundowns.findOne(segmentLine.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${segmentLine.rundownId}" not found!`)
			const prevLine = getPreviousSegmentLine(rundown, segmentLine)

			return Promise.all(ps)
			.then(() => {
				updateSourceLayerInfinitesAfterLine(rundown, prevLine)
				// do nothing
			})
		}
	}
	function getPreviousSegmentLine (rundown: DBRundown, segmentLine: DBSegmentLine) {
		return SegmentLines.findOne({
			rundownId: rundown._id,
			_rank: { $lt: segmentLine._rank }
		}, { sort: { _rank: -1 } })
	}
	function refreshSegmentLine (rundown: DBRundown, segmentLine: DBSegmentLine) {
		const rundown = new Rundown(rundown)
		const story = rundown.fetchCache(CachePrefix.INGEST_PART + segmentLine._id)
		const sl = new SegmentLine(segmentLine)
		updateStory(rundown, sl, story)

		const segment = sl.getSegment()
		if (segment) {
			// this could be run after the segment, if we were capable of limiting that
			runPostProcessBlueprint(rundown, segment)
		}

		const prevLine = getPreviousSegmentLine(rundown, sl)
		updateSourceLayerInfinitesAfterLine(rundown, prevLine)
	}
	function setNextSegmentLine (
		rundown: Rundown,
		nextSegmentLine: DBSegmentLine | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	) {
		let ps: Array<Promise<any>> = []
		if (nextSegmentLine) {

			if (nextSegmentLine.rundownId !== rundown._id) throw new Meteor.Error(409, `SegmentLine "${nextSegmentLine._id}" not part of rundown "${rundown._id}"`)
			if (nextSegmentLine._id === rundown.currentSegmentLineId) {
				throw new Meteor.Error(402, 'Not allowed to Next the currently playing SegmentLine')
			}
			if (nextSegmentLine.invalid) {
				throw new Meteor.Error(400, 'SegmentLine is marked as invalid, cannot set as next.')
			}

			ps.push(resetSegmentLine(nextSegmentLine))

			ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
				$set: {
					nextSegmentLineId: nextSegmentLine._id,
					nextSegmentLineManual: !!setManually,
					nextTimeOffset: nextTimeOffset || null
				}
			}))
			ps.push(asyncCollectionUpdate(SegmentLines, nextSegmentLine._id, {
				$push: {
					'timings.next': getCurrentTime()
				}
			}))
		} else {
			ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
				$set: {
					nextSegmentLineId: null,
					nextSegmentLineManual: !!setManually
				}
			}))
		}
		waitForPromiseAll(ps)
	}
	export function rundownTake (rundownId: string | Rundown): ClientAPI.ClientResponse {
		let now = getCurrentTime()
		let rundown: Rundown = (
			_.isObject(rundownId) ? rundownId as Rundown :
			_.isString(rundownId) ? Rundowns.findOne(rundownId) :
			undefined
		) as Rundown
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(501, `Rundown "${rundownId}" is not active!`)
		if (!rundown.nextSegmentLineId) throw new Meteor.Error(500, 'nextSegmentLineId is not set!')

		let timeOffset: number | null = rundown.nextTimeOffset || null

		let firstTake = !rundown.startedPlayback
		let rundownData = rundown.fetchAllData()

		const currentSL = rundown.currentSegmentLineId ? rundownData.segmentLinesMap[rundown.currentSegmentLineId] : undefined
		if (currentSL && currentSL.transitionDuration) {
			const prevSL = rundown.previousSegmentLineId ? rundownData.segmentLinesMap[rundown.previousSegmentLineId] : undefined
			const allowTransition = prevSL && !prevSL.disableOutTransition

			// If there was a transition from the previous SL, then ensure that has finished before another take is permitted
			if (allowTransition) {
				const start = currentSL.getLastStartedPlayback()
				if (start && now < start + currentSL.transitionDuration) {
					return ClientAPI.responseError('Cannot take during a transition')
				}
			}
		}

		if (rundown.holdState === RundownHoldState.COMPLETE) {
			Rundowns.update(rundown._id, {
				$set: {
					holdState: RundownHoldState.NONE
				}
			})
		// If hold is active, then this take is to clear it
		} else if (rundown.holdState === RundownHoldState.ACTIVE) {
			Rundowns.update(rundown._id, {
				$set: {
					holdState: RundownHoldState.COMPLETE
				}
			})

			if (rundown.currentSegmentLineId) {
				const currentSegmentLine = rundownData.segmentLinesMap[rundown.currentSegmentLineId]
				if (!currentSegmentLine) throw new Meteor.Error(404, 'currentSegmentLine not found!')

				// Remove the current extension line
				SegmentLineItems.remove({
					segmentLineId: currentSegmentLine._id,
					extendOnHold: true,
					dynamicallyInserted: true
				})
			}
			if (rundown.previousSegmentLineId) {
				const previousSegmentLine = rundownData.segmentLinesMap[rundown.previousSegmentLineId]
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

			updateTimeline(rundown.studioInstallationId)
			return ClientAPI.responseSuccess()
		}
		let pBlueprint = makePromise(() => getBlueprintOfRundown(rundown))

		let previousSegmentLine = (rundown.currentSegmentLineId ?
			rundownData.segmentLinesMap[rundown.currentSegmentLineId]
			: null
		)
		let takeSegmentLine = rundownData.segmentLinesMap[rundown.nextSegmentLineId]
		if (!takeSegmentLine) throw new Meteor.Error(404, 'takeSegmentLine not found!')
		// let takeSegment = rundownData.segmentsMap[takeSegmentLine.segmentId]
		let segmentLineAfter = fetchAfter(rundownData.segmentLines, {
			rundownId: rundown._id,
			invalid: { $ne: true }
		}, takeSegmentLine._rank)

		let nextSegmentLine: DBSegmentLine | null = segmentLineAfter || null

		// beforeTake(rundown, previousSegmentLine || null, takeSegmentLine)
		beforeTake(rundownData, previousSegmentLine || null, takeSegmentLine)

		let blueprint = waitForPromise(pBlueprint)
		if (blueprint.onPreTake) {
			try {
				waitForPromise(
					Promise.resolve(blueprint.onPreTake(new PartEventContext(rundown, undefined, takeSegmentLine)))
					.catch(logger.error)
				)
			} catch (e) {
				logger.error(e)
			}
		}

		let ps: Array<Promise<any>> = []
		let m = {
			previousSegmentLineId: rundown.currentSegmentLineId,
			currentSegmentLineId: takeSegmentLine._id,
			holdState: !rundown.holdState || rundown.holdState === RundownHoldState.COMPLETE ? RundownHoldState.NONE : rundown.holdState + 1,
		}
		ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
			$set: m
		}))
		ps.push(asyncCollectionUpdate(SegmentLines, takeSegmentLine._id, {
			$push: {
				'timings.take': now,
				'timings.playOffset': timeOffset || 0
			}
		}))
		if (m.previousSegmentLineId) {
			ps.push(asyncCollectionUpdate(SegmentLines, m.previousSegmentLineId, {
				$push: {
					'timings.takeOut': now,
				}
			}))
		}
		rundown = _.extend(rundown, m) as Rundown

		setNextSegmentLine(rundown, nextSegmentLine)
		waitForPromiseAll(ps)

		ps = []

		// Setup the items for the HOLD we are starting
		if (m.previousSegmentLineId && m.holdState === RundownHoldState.ACTIVE) {
			let previousSegmentLine = rundownData.segmentLinesMap[m.previousSegmentLineId]
			if (!previousSegmentLine) throw new Meteor.Error(404, 'previousSegmentLine not found!')

			// Make a copy of any item which is flagged as an 'infinite' extension
			const itemsToCopy = previousSegmentLine.getAllSegmentLineItems().filter(i => i.extendOnHold)
			itemsToCopy.forEach(sli => {
				// mark current one as infinite
				sli.infiniteId = sli._id
				sli.infiniteMode = SegmentLineItemLifespan.OutOnNextSegmentLine
				ps.push(asyncCollectionUpdate(SegmentLineItems, sli._id, {
					$set: {
						infiniteMode: SegmentLineItemLifespan.OutOnNextSegmentLine,
						infiniteId: sli._id,
					}
				}))

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
				rundownData.segmentLineItems.push(newSli) // update the local collection

			})
		}
		waitForPromiseAll(ps)
		afterTake(rundown, takeSegmentLine, previousSegmentLine || null, timeOffset)

		// last:
		SegmentLines.update(takeSegmentLine._id, {
			$push: {
				'timings.takeDone': getCurrentTime()
			}
		})

		Meteor.defer(() => {
			// let bp = getBlueprintOfRundown(rundown)
			if (firstTake) {
				if (blueprint.onRundownFirstTake) {
					Promise.resolve(blueprint.onRundownFirstTake(new PartEventContext(rundown, undefined, takeSegmentLine)))
					.catch(logger.error)
				}
			}

			if (blueprint.onPostTake) {
				Promise.resolve(blueprint.onPostTake(new PartEventContext(rundown, undefined, takeSegmentLine)))
				.catch(logger.error)
			}
		})

		return ClientAPI.responseSuccess()
	}
	export function rundownSetNext (
		rundownId: string,
		nextSlId: string | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	): ClientAPI.ClientResponse {
		check(rundownId, String)
		if (nextSlId) check(nextSlId, String)

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(501, `Rundown "${rundownId}" is not active!`)

		if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) throw new Meteor.Error(501, `Rundown "${rundownId}" cannot change next during hold!`)

		let nextSegmentLine: SegmentLine | null = null
		if (nextSlId) {
			nextSegmentLine = SegmentLines.findOne(nextSlId) || null
			if (!nextSegmentLine) throw new Meteor.Error(404, `Segment Line "${nextSlId}" not found!`)
		}

		setNextSegmentLine(rundown, nextSegmentLine, setManually, nextTimeOffset)

		// remove old auto-next from timeline, and add new one
		updateTimeline(rundown.studioInstallationId)

		return ClientAPI.responseSuccess()
	}
	export function rundownMoveNext (
		rundownId: string,
		horisontalDelta: number,
		verticalDelta: number,
		setManually: boolean,
		currentNextSegmentLineItemId?: string
	): string {
		check(rundownId, String)
		check(horisontalDelta, Number)
		check(verticalDelta, Number)

		if (!horisontalDelta && !verticalDelta) throw new Meteor.Error(402, `rundownMoveNext: invalid delta: (${horisontalDelta}, ${verticalDelta})`)

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(501, `Rundown "${rundownId}" is not active!`)

		if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) throw new Meteor.Error(501, `Rundown "${rundownId}" cannot change next during hold!`)

		let currentNextSegmentLineItem: SegmentLine
		if (currentNextSegmentLineItemId) {
			currentNextSegmentLineItem = SegmentLines.findOne(currentNextSegmentLineItemId) as SegmentLine
		} else {
			if (!rundown.nextSegmentLineId) throw new Meteor.Error(501, `Rundown "${rundownId}" has no next segmentLine!`)
			currentNextSegmentLineItem = SegmentLines.findOne(rundown.nextSegmentLineId) as SegmentLine
		}

		if (!currentNextSegmentLineItem) throw new Meteor.Error(404, `SegmentLine "${rundown.nextSegmentLineId}" not found!`)

		let currentNextSegment = Segments.findOne(currentNextSegmentLineItem.segmentId) as Segment
		if (!currentNextSegment) throw new Meteor.Error(404, `Segment "${currentNextSegmentLineItem.segmentId}" not found!`)

		let segmentLines = rundown.getSegmentLines()
		let segments = rundown.getSegments()

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

		if ((segmentLine._id === rundown.currentSegmentLineId && !currentNextSegmentLineItemId) || segmentLine.invalid) {
			// Whoops, we're not allowed to next to that.
			// Skip it, then (ie run the whole thing again)
			return ServerPlayoutAPI.rundownMoveNext (rundownId, horisontalDelta, verticalDelta, setManually, segmentLine._id)
		} else {
			ServerPlayoutAPI.rundownSetNext(rundown._id, segmentLine._id, setManually)
			return segmentLine._id
		}

	}
	export function rundownActivateHold (rundownId: string) {
		check(rundownId, String)
		logger.debug('rundownActivateHold')

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		if (!rundown.currentSegmentLineId) throw new Meteor.Error(400, `Rundown "${rundownId}" no current segmentline!`)
		if (!rundown.nextSegmentLineId) throw new Meteor.Error(400, `Rundown "${rundownId}" no next segmentline!`)

		let currentSegmentLine = SegmentLines.findOne({_id: rundown.currentSegmentLineId})
		if (!currentSegmentLine) throw new Meteor.Error(404, `Segment Line "${rundown.currentSegmentLineId}" not found!`)
		let nextSegmentLine = SegmentLines.findOne({_id: rundown.nextSegmentLineId})
		if (!nextSegmentLine) throw new Meteor.Error(404, `Segment Line "${rundown.nextSegmentLineId}" not found!`)

		if (currentSegmentLine.holdMode !== SegmentLineHoldMode.FROM || nextSegmentLine.holdMode !== SegmentLineHoldMode.TO) {
			throw new Meteor.Error(400, `Rundown "${rundownId}" incompatible pair of HoldMode!`)
		}

		if (rundown.holdState) {
			throw new Meteor.Error(400, `Rundown "${rundownId}" already doing a hold!`)
		}

		Rundowns.update(rundownId, { $set: { holdState: RundownHoldState.PENDING } })

		updateTimeline(rundown.studioInstallationId)

		return ClientAPI.responseSuccess()
	}
	export function rundownStoriesMoved (rundownId: string, onAirNextWindowWidth: number | undefined, nextPosition: number | undefined) {
		check(rundownId, String)
		check(onAirNextWindowWidth, Match.Maybe(Number))
		check(nextPosition, Match.Maybe(Number))

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		if (rundown.nextSegmentLineId) {
			let currentSegmentLine: SegmentLine | undefined = undefined
			let nextSegmentLine: SegmentLine | undefined = undefined
			if (rundown.currentSegmentLineId) {
				currentSegmentLine = SegmentLines.findOne(rundown.currentSegmentLineId)
			}
			if (rundown.nextSegmentLineId) {
				nextSegmentLine = SegmentLines.findOne(rundown.nextSegmentLineId)
			}
			if (currentSegmentLine && onAirNextWindowWidth === 2) { // the next line was next to onAir line
				const newNextLine = rundown.getSegmentLines({
					_rank: {
						$gt: currentSegmentLine._rank
					}
				}, {
					limit: 1
				})[0]
				setNextSegmentLine(rundown, newNextLine || null)
			} else if (!currentSegmentLine && nextSegmentLine && onAirNextWindowWidth === undefined && nextPosition !== undefined) {
				const newNextLine = rundown.getSegmentLines({}, {
					limit: nextPosition
				})[0]
				setNextSegmentLine(rundown, newNextLine || null)

			}
		}
	}
	export function rundownDisableNextSegmentLineItem (rundownId: string, undo?: boolean) {
		check(rundownId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.currentSegmentLineId) throw new Meteor.Error(401, `No current segmentLine!`)

		let studio = rundown.getStudioInstallation()

		let showStyleBase = rundown.getShowStyleBase()

		let currentSegmentLine = SegmentLines.findOne(rundown.currentSegmentLineId)
		if (!currentSegmentLine) throw new Meteor.Error(404, `SegmentLine "${rundown.currentSegmentLineId}" not found!`)

		let nextSegmentLine = (rundown.nextSegmentLineId ? SegmentLines.findOne(rundown.nextSegmentLineId) : undefined)

		let currentSement = Segments.findOne(currentSegmentLine.segmentId)
		if (!currentSement) throw new Meteor.Error(404, `Segment "${currentSegmentLine.segmentId}" not found!`)

		let o = getResolvedSegment(showStyleBase, rundown, currentSement)

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

	export function sliPlaybackStartedCallback (rundownId: string, sliId: string, startedPlayback: Time) {
		check(rundownId, String)
		check(sliId, String)
		check(startedPlayback, Number)

		// This method is called when an auto-next event occurs
		let segLineItem = SegmentLineItems.findOne({
			_id: sliId,
			rundownId: rundownId
		})
		if (!segLineItem) throw new Meteor.Error(404, `Segment line item "${sliId}" in rundown "${rundownId}" not found!`)

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
	export function sliPlaybackStoppedCallback (rundownId: string, sliId: string, stoppedPlayback: Time) {
		check(rundownId, String)
		check(sliId, String)
		check(stoppedPlayback, Number)

		// This method is called when an auto-next event occurs
		let segLineItem = SegmentLineItems.findOne({
			_id: sliId,
			rundownId: rundownId
		})
		if (!segLineItem) throw new Meteor.Error(404, `Segment line item "${sliId}" in rundown "${rundownId}" not found!`)

		let isPlaying: boolean = !!(
			segLineItem.startedPlayback &&
			!segLineItem.stoppedPlayback
		)
		if (isPlaying) {
			logger.info(`Playout reports segmentLineItem "${sliId}" has stopped playback on timestamp ${(new Date(stoppedPlayback)).toISOString()}`)

			reportSegmentLineItemHasStopped(segLineItem, stoppedPlayback)
		}
	}

	export function slPlaybackStartedCallback (rundownId: string, slId: string, startedPlayback: Time) {
		check(rundownId, String)
		check(slId, String)
		check(startedPlayback, Number)

		// This method is called when a segmentLine starts playing (like when an auto-next event occurs, or a manual next)

		let playingSegmentLine = SegmentLines.findOne({
			_id: slId,
			rundownId: rundownId
		})

		if (playingSegmentLine) {
			// make sure we don't run multiple times, even if TSR calls us multiple times

			const isPlaying = (
				playingSegmentLine.startedPlayback &&
				!playingSegmentLine.stoppedPlayback
			)
			if (!isPlaying) {
				logger.info(`Playout reports segmentLine "${slId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

				let rundown = Rundowns.findOne(rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
				if (!rundown.active) throw new Meteor.Error(501, `Rundown "${rundownId}" is not active!`)

				let currentSegmentLine = (rundown.currentSegmentLineId ?
					SegmentLines.findOne(rundown.currentSegmentLineId)
					: null
				)

				if (rundown.currentSegmentLineId === slId) {
					// this is the current segment line, it has just started playback
					if (rundown.previousSegmentLineId) {
						let prevSegLine = SegmentLines.findOne(rundown.previousSegmentLineId)

						if (!prevSegLine) {
							// We couldn't find the previous segment line: this is not a critical issue, but is clearly is a symptom of a larger issue
							logger.error(`Previous segment line "${rundown.previousSegmentLineId}" on rundown "${rundownId}" could not be found.`)
						} else if (!prevSegLine.duration) {
							segmentLineStoppedPlaying(rundownId, prevSegLine, startedPlayback)
						}
					}

					setRundownStartedPlayback(rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played
				} else if (rundown.nextSegmentLineId === slId) {
					// this is the next segment line, clearly an autoNext has taken place
					if (rundown.currentSegmentLineId) {
						// let currentSegmentLine = SegmentLines.findOne(rundown.currentSegmentLineId)

						if (!currentSegmentLine) {
							// We couldn't find the previous segment line: this is not a critical issue, but is clearly is a symptom of a larger issue
							logger.error(`Previous segment line "${rundown.currentSegmentLineId}" on rundown "${rundownId}" could not be found.`)
						} else if (!currentSegmentLine.duration) {
							segmentLineStoppedPlaying(rundownId, currentSegmentLine, startedPlayback)
						}
					}

					setRundownStartedPlayback(rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

					let segmentLinesAfter = rundown.getSegmentLines({
						_rank: {
							$gt: playingSegmentLine._rank,
						},
						_id: { $ne: playingSegmentLine._id }
					})

					let nextSegmentLine: SegmentLine | null = _.first(segmentLinesAfter) || null

					const rundownChange = {
						previousSegmentLineId: rundown.currentSegmentLineId,
						currentSegmentLineId: playingSegmentLine._id,
						holdState: RundownHoldState.NONE,
					}

					Rundowns.update(rundown._id, {
						$set: rundownChange
					})
					rundown = _.extend(rundown, rundownChange) as Rundown

					setNextSegmentLine(rundown, nextSegmentLine)
				} else {
					// a segment line is being played that has not been selected for playback by Core
					// show must go on, so find next segmentLine and update the Rundown, but log an error
					let segmentLinesAfter = rundown.getSegmentLines({
						_rank: {
							$gt: playingSegmentLine._rank,
						},
						_id: { $ne: playingSegmentLine._id }
					})

					let nextSegmentLine: SegmentLine | null = segmentLinesAfter[0] || null

					setRundownStartedPlayback(rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

					const rundownChange = {
						previousSegmentLineId: null,
						currentSegmentLineId: playingSegmentLine._id,
					}

					Rundowns.update(rundown._id, {
						$set: rundownChange
					})
					rundown = _.extend(rundown, rundownChange) as Rundown
					setNextSegmentLine(rundown, nextSegmentLine)

					logger.error(`Segment Line "${playingSegmentLine._id}" has started playback by the playout gateway, but has not been selected for playback!`)
				}

				reportSegmentLineHasStarted(playingSegmentLine, startedPlayback)

				afterTake(rundown, playingSegmentLine, currentSegmentLine || null)
			}
		} else {
			throw new Meteor.Error(404, `Segment line "${slId}" in rundown "${rundownId}" not found!`)
		}
	}
	export function slPlaybackStoppedCallback (rundownId: string, slId: string, stoppedPlayback: Time) {
		check(rundownId, String)
		check(slId, String)
		check(stoppedPlayback, Number)

		// This method is called when a segmentLine stops playing (like when an auto-next event occurs, or a manual next)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		let segmentLine = SegmentLines.findOne({
			_id: slId,
			rundownId: rundownId
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
			throw new Meteor.Error(404, `Segment line "${slId}" in rundown "${rundownId}" not found!`)
		}
	}
	export const segmentLineItemTakeNow = function segmentLineItemTakeNow (rundownId: string, slId: string, sliId: string) {
		check(rundownId, String)
		check(slId, String)
		check(sliId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in an active rundown!`)

		let slItem = SegmentLineItems.findOne({
			_id: sliId,
			rundownId: rundownId
		}) as SegmentLineItem
		if (!slItem) throw new Meteor.Error(404, `Segment Line Item "${sliId}" not found!`)

		let segLine = SegmentLines.findOne({
			_id: slId,
			rundownId: rundownId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		if (rundown.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in a current segment line!`)

		let showStyleBase = rundown.getShowStyleBase()
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
							objectType: TimelineObjType.RUNDOWN
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

		cropInfinitesOnLayer(rundown, segLine, newSegmentLineItem)
		stopInfinitesRunningOnLayer(rundown, segLine, newSegmentLineItem.sourceLayerId)
		updateTimeline(rundown.studioInstallationId)
	}
	export const segmentAdLibLineItemStart = syncFunction(function segmentAdLibLineItemStart (rundownId: string, slId: string, slaiId: string, queue: boolean) {
		check(rundownId, String)
		check(slId, String)
		check(slaiId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in an active rundown!`)
		if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
			throw new Meteor.Error(403, `Segment Line Ad Lib Items can not be used in combination with hold!`)
		}
		let adLibItem = SegmentLineAdLibItems.findOne({
			_id: slaiId,
			rundownId: rundownId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Segment Line Ad Lib Item "${slaiId}" not found!`)
		if (adLibItem.invalid) throw new Meteor.Error(404, `Cannot take invalid Segment Line Ad Lib Item "${slaiId}"!`)

		if (!queue && rundown.currentSegmentLineId !== slId) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in a current segment line!`)

		let orgSlId = slId
		if (queue) {
			// insert a NEW, adlibbed segmentLine after this segmentLine
			slId = adlibQueueInsertSegmentLine (rundown, slId, adLibItem )
		}
		let segLine = SegmentLines.findOne({
			_id: slId,
			rundownId: rundownId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		if (!queue && rundown.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Items can be only placed in a current segment line!`)
		let newSegmentLineItem = convertAdLibToSLineItem(adLibItem, segLine, queue)
		SegmentLineItems.insert(newSegmentLineItem)

		// logger.debug('adLibItemStart', newSegmentLineItem)
		if (queue) {
			// keep infinite sLineItems
			SegmentLineItems.find({ rundownId: rundownId, segmentLineId: orgSlId }).forEach(sli => {
				if (sli.infiniteMode && sli.infiniteMode >= SegmentLineItemLifespan.Infinite) {
					let newSegmentLineItem = convertAdLibToSLineItem(sli, segLine!, queue)
					SegmentLineItems.insert(newSegmentLineItem)
				}
			})

			ServerPlayoutAPI.rundownSetNext(rundown._id, slId)
		} else {
			cropInfinitesOnLayer(rundown, segLine, newSegmentLineItem)
			stopInfinitesRunningOnLayer(rundown, segLine, newSegmentLineItem.sourceLayerId)
			updateTimeline(rundown.studioInstallationId)
		}
	})
	export const rundownBaselineAdLibItemStart = syncFunction(function rundownBaselineAdLibItemStart (rundownId: string, slId: string, robaliId: string, queue: boolean) {
		check(rundownId, String)
		check(slId, String)
		check(robaliId, String)
		logger.debug('rundownBaselineAdLibItemStart')

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(403, `Rundown Baseline Ad Lib Items can be only placed in an active rundown!`)
		if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
			throw new Meteor.Error(403, `Segment Line Ad Lib Items can not be used in combination with hold!`)
		}

		let adLibItem = RundownBaselineAdLibItems.findOne({
			_id: robaliId,
			rundownId: rundownId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Rundown Baseline Ad Lib Item "${robaliId}" not found!`)
		let orgSlId = slId
		if (queue) {
			// insert a NEW, adlibbed segmentLine after this segmentLine
			slId = adlibQueueInsertSegmentLine (rundown, slId, adLibItem )
		}

		let segLine = SegmentLines.findOne({
			_id: slId,
			rundownId: rundownId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		if (!queue && rundown.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Rundown Baseline Ad Lib Items can be only placed in a current segment line!`)

		let newSegmentLineItem = convertAdLibToSLineItem(adLibItem, segLine, queue)
		SegmentLineItems.insert(newSegmentLineItem)
		// logger.debug('adLibItemStart', newSegmentLineItem)

		if (queue) {
			// keep infinite sLineItems
			SegmentLineItems.find({ rundownId: rundownId, segmentLineId: orgSlId }).forEach(sli => {
				console.log(sli.name + ' has life span of ' + sli.infiniteMode)
				if (sli.infiniteMode && sli.infiniteMode >= SegmentLineItemLifespan.Infinite) {
					let newSegmentLineItem = convertAdLibToSLineItem(sli, segLine!, queue)
					SegmentLineItems.insert(newSegmentLineItem)
				}
			})

			ServerPlayoutAPI.rundownSetNext(rundown._id, slId)
		} else {
			cropInfinitesOnLayer(rundown, segLine, newSegmentLineItem)
			stopInfinitesRunningOnLayer(rundown, segLine, newSegmentLineItem.sourceLayerId)
			updateTimeline(rundown.studioInstallationId)
		}
	})
	export function adlibQueueInsertSegmentLine (rundown: Rundown, slId: string, sladli: SegmentLineAdLibItem) {

		// let segmentLines = rundown.getSegmentLines()
		logger.info('adlibQueueInsertSegmentLine')

		let segmentLine = SegmentLines.findOne(slId)
		if (!segmentLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)

		// let nextSegmentLine = fetchAfter(SegmentLines, {
		// 	rundownId: rundown._id
		// }, segmentLine._rank)

		// let newRank = getRank(segmentLine, nextSegmentLine, 0, 1)

		let newSegmentLineId = Random.id()
		SegmentLines.insert({
			_id: newSegmentLineId,
			_rank: 99999, // something high, so it will be placed last
			externalId: '',
			segmentId: segmentLine.segmentId,
			rundownId: rundown._id,
			title: sladli.name,
			dynamicallyInserted: true,
			afterSegmentLine: segmentLine._id,
			typeVariant: 'adlib'
		})

		updateSegmentLines(rundown._id) // place in order

		return newSegmentLineId

	}
	export function segmentAdLibLineItemStop (rundownId: string, slId: string, sliId: string) {
		check(rundownId, String)
		check(slId, String)
		check(sliId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			rundownId: rundownId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		let alCopyItem = SegmentLineItems.findOne({
			_id: sliId,
			rundownId: rundownId
		})
		// To establish playback time, we need to look at the actual Timeline
		let alCopyItemTObj = Timeline.findOne({
			_id: getSliGroupId(sliId)
		})
		let parentOffset = 0
		if (!alCopyItem) throw new Meteor.Error(404, `Segment Line Ad Lib Copy Item "${sliId}" not found!`)
		if (!alCopyItemTObj) throw new Meteor.Error(404, `Segment Line Ad Lib Copy Item "${sliId}" not found in the playout Timeline!`)
		if (!rundown.active) throw new Meteor.Error(403, `Segment Line Ad Lib Copy Items can be only manipulated in an active rundown!`)
		if (rundown.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Ad Lib Copy Items can be only manipulated in a current segment line!`)
		if (!alCopyItem.dynamicallyInserted) throw new Meteor.Error(501, `"${sliId}" does not appear to be a dynamic Segment Line Item!`)
		if (!alCopyItem.adLibSourceId) throw new Meteor.Error(501, `"${sliId}" does not appear to be a Segment Line Ad Lib Copy Item!`)

		// The ad-lib item positioning will be relative to the startedPlayback of the segment line
		if (segLine.startedPlayback) {
			parentOffset = segLine.getLastStartedPlayback() || parentOffset
		}

		let newExpectedDuration = 1 // smallest, non-zerundown duration
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

		updateTimeline(rundown.studioInstallationId)
	}
	export const sourceLayerStickyItemStart = syncFunction(function sourceLayerStickyItemStart (rundownId: string, sourceLayerId: string) {
		check(rundownId, String)
		check(sourceLayerId, String)

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(403, `Segment Line Items can be only manipulated in an active rundown!`)
		if (!rundown.currentSegmentLineId) throw new Meteor.Error(400, `A segment line needs to be active to place a sticky item`)

		let showStyleBase = rundown.getShowStyleBase()

		const sourceLayer = showStyleBase.sourceLayers.find(i => i._id === sourceLayerId)
		if (!sourceLayer) throw new Meteor.Error(404, `Source layer "${sourceLayerId}" not found!`)
		if (!sourceLayer.isSticky) throw new Meteor.Error(400, `Only sticky layers can be restarted. "${sourceLayerId}" is not sticky.`)

		const lastSegmentLineItems = SegmentLineItems.find({
			rundownId: rundown._id,
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
			const currentSegmentLine = SegmentLines.findOne(rundown.currentSegmentLineId)
			if (!currentSegmentLine) throw new Meteor.Error(501, `Current Segment Line "${rundown.currentSegmentLineId}" could not be found.`)

			const lastItem = convertSLineToAdLibItem(lastSegmentLineItems[0])
			const newAdLibSegmentLineItem = convertAdLibToSLineItem(lastItem, currentSegmentLine, false)

			SegmentLineItems.insert(newAdLibSegmentLineItem)

			// logger.debug('adLibItemStart', newSegmentLineItem)

			cropInfinitesOnLayer(rundown, currentSegmentLine, newAdLibSegmentLineItem)
			stopInfinitesRunningOnLayer(rundown, currentSegmentLine, newAdLibSegmentLineItem.sourceLayerId)

			updateTimeline(rundown.studioInstallationId)
		}
	})
	export function sourceLayerOnLineStop (rundownId: string, slId: string, sourceLayerId: string) {
		check(rundownId, String)
		check(slId, String)
		check(sourceLayerId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(403, `Segment Line Items can be only manipulated in an active rundown!`)
		let segLine = SegmentLines.findOne({
			_id: slId,
			rundownId: rundownId
		})
		if (!segLine) throw new Meteor.Error(404, `Segment Line "${slId}" not found!`)
		if (rundown.currentSegmentLineId !== segLine._id) throw new Meteor.Error(403, `Segment Line Items can be only manipulated in a current segment line!`)
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

		updateSourceLayerInfinitesAfterLine(rundown, segLine)

		updateTimeline(rundown.studioInstallationId)
	}
	export const rundownToggleSegmentLineArgument = syncFunction(function rundownToggleSegmentLineArgument (rundownId: string, slId: string, property: string, value: string) {
		check(rundownId, String)
		check(slId, String)

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
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

		refreshSegmentLine(rundown, segmentLine)

		// Only take time to update the timeline if there's a point to do it
		if (rundown.active) {
			// If this SL is rundown's next, check if current SL has autoNext
			if ((rundown.nextSegmentLineId === segmentLine._id) && rundown.currentSegmentLineId) {
				const currentSegmentLine = SegmentLines.findOne(rundown.currentSegmentLineId)
				if (currentSegmentLine && currentSegmentLine.autoNext) {
					updateTimeline(rundown.studioInstallationId)
				}
			// If this is rundown's current SL, update immediately
			} else if (rundown.currentSegmentLineId === segmentLine._id) {
				updateTimeline(rundown.studioInstallationId)
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
	export function updateStudioBaseline (studioId: string) {
		check(studioId, String)

		const activateRundownCount = Rundowns.find({
			studioInstallationId: studioId,
			active: true
		}).count()
		if (activateRundownCount === 0) {
			// This is only run when there is no rundown active in the studio
			updateTimeline(studioId)
		}

		return shouldUpdateStudioBaseline(studioId)
	}
	export function shouldUpdateStudioBaseline (studioId: string) {
		check(studioId, String)

		const studioInstallation = StudioInstallations.findOne(studioId)
		if (!studioInstallation) throw new Meteor.Error(404, `StudioInstallation "${studioId}" not found!`)

		const activateRundownCount = Rundowns.find({
			studioInstallationId: studioInstallation._id,
			active: true
		}).count()
		if (activateRundownCount === 0) {
			const markerId = `${studioInstallation._id}_baseline_version`
			const markerObject = Timeline.findOne(markerId)
			if (!markerObject) return 'noBaseline'

			const versionsContent = markerObject.content.versions || {}

			if (versionsContent.core !== PackageInfo.version) return 'coreVersion'

			if (versionsContent.studioInstallation !== (studioInstallation._rundownVersionHash || 0)) return 'studioInstallation'

			if (versionsContent.blueprintId !== studioInstallation.blueprintId) return 'blueprintId'
			if (studioInstallation.blueprintId) {
				const blueprint = Blueprints.findOne(studioInstallation.blueprintId)
				if (!blueprint) return 'blueprintUnknown'
				if (versionsContent.blueprintVersion !== (blueprint.blueprintVersion || 0)) return 'blueprintVersion'
			}
		}

		return false
	}
}

let methods: Methods = {}
methods[PlayoutAPI.methods.rundownPrepareForBroadcast] = (rundownId: string) => {
	return ServerPlayoutAPI.rundownPrepareForBroadcast(rundownId)
}
methods[PlayoutAPI.methods.rundownResetRundown] = (rundownId: string) => {
	return ServerPlayoutAPI.rundownResetRundown(rundownId)
}
methods[PlayoutAPI.methods.rundownResetAndActivate] = (rundownId: string) => {
	return ServerPlayoutAPI.rundownResetAndActivate(rundownId)
}
methods[PlayoutAPI.methods.rundownActivate] = (rundownId: string, rehearsal: boolean) => {
	return ServerPlayoutAPI.rundownActivate(rundownId, rehearsal)
}
methods[PlayoutAPI.methods.rundownDeactivate] = (rundownId: string) => {
	return ServerPlayoutAPI.rundownDeactivate(rundownId)
}
methods[PlayoutAPI.methods.reloadData] = (rundownId: string) => {
	return ServerPlayoutAPI.reloadData(rundownId)
}
methods[PlayoutAPI.methods.segmentLineItemTakeNow] = (rundownId: string, slId: string, sliId: string) => {
	return ServerPlayoutAPI.segmentLineItemTakeNow(rundownId, slId, sliId)
}
methods[PlayoutAPI.methods.rundownTake] = (rundownId: string) => {
	return ServerPlayoutAPI.rundownTake(rundownId)
}
methods[PlayoutAPI.methods.rundownToggleSegmentLineArgument] = (rundownId: string, slId: string, property: string, value: string) => {
	return ServerPlayoutAPI.rundownToggleSegmentLineArgument(rundownId, slId, property, value)
}
methods[PlayoutAPI.methods.rundownSetNext] = (rundownId: string, slId: string, timeOffset?: number | undefined) => {
	return ServerPlayoutAPI.rundownSetNext(rundownId, slId, true, timeOffset)
}
methods[PlayoutAPI.methods.rundownActivateHold] = (rundownId: string) => {
	return ServerPlayoutAPI.rundownActivateHold(rundownId)
}
methods[PlayoutAPI.methods.rundownStoriesMoved] = (rundownId: string, onAirNextWindowWidth: number | undefined, nextPosition: number | undefined) => {
	return ServerPlayoutAPI.rundownStoriesMoved(rundownId, onAirNextWindowWidth, nextPosition)
}
methods[PlayoutAPI.methods.rundownDisableNextSegmentLineItem] = (rundownId: string, undo?: boolean) => {
	return ServerPlayoutAPI.rundownDisableNextSegmentLineItem(rundownId, undo)
}
methods[PlayoutAPI.methods.segmentLinePlaybackStartedCallback] = (rundownId: string, slId: string, startedPlayback: number) => {
	return ServerPlayoutAPI.slPlaybackStartedCallback(rundownId, slId, startedPlayback)
}
methods[PlayoutAPI.methods.segmentLineItemPlaybackStartedCallback] = (rundownId: string, sliId: string, startedPlayback: number) => {
	return ServerPlayoutAPI.sliPlaybackStartedCallback(rundownId, sliId, startedPlayback)
}
methods[PlayoutAPI.methods.segmentAdLibLineItemStart] = (rundownId: string, slId: string, salliId: string, queue: boolean) => {
	return ServerPlayoutAPI.segmentAdLibLineItemStart(rundownId, slId, salliId, queue)
}
methods[PlayoutAPI.methods.rundownBaselineAdLibItemStart] = (rundownId: string, slId: string, robaliId: string, queue: boolean) => {
	return ServerPlayoutAPI.rundownBaselineAdLibItemStart(rundownId, slId, robaliId, queue)
}
methods[PlayoutAPI.methods.segmentAdLibLineItemStop] = (rundownId: string, slId: string, sliId: string) => {
	return ServerPlayoutAPI.segmentAdLibLineItemStop(rundownId, slId, sliId)
}
methods[PlayoutAPI.methods.sourceLayerOnLineStop] = (rundownId: string, slId: string, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerOnLineStop(rundownId, slId, sourceLayerId)
}
methods[PlayoutAPI.methods.timelineTriggerTimeUpdateCallback] = (timelineObjId: string, time: number) => {
	return ServerPlayoutAPI.timelineTriggerTimeUpdateCallback(timelineObjId, time)
}
methods[PlayoutAPI.methods.sourceLayerStickyItemStart] = (rundownId: string, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerStickyItemStart(rundownId, sourceLayerId)
}
methods[PlayoutAPI.methods.updateStudioBaseline] = (studioId: string) => {
	return ServerPlayoutAPI.updateStudioBaseline(studioId)
}
methods[PlayoutAPI.methods.shouldUpdateStudioBaseline] = (studioId: string) => {
	return ServerPlayoutAPI.shouldUpdateStudioBaseline(studioId)
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

function beforeTake (rundownData: RundownData, currentSegmentLine: SegmentLine | null, nextSegmentLine: SegmentLine) {
	if (currentSegmentLine) {
		const adjacentSL = _.find(rundownData.segmentLines, (sl) => {
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
					rundownData.segmentLineItems.push(overflowedItem) // update the cache
				}
			}
		})
		waitForPromiseAll(ps)
	}
}

function afterTake (
	rundown: Rundown,
	takeSegmentLine: SegmentLine,
	previousSegmentLine: SegmentLine | null,
	timeOffset: number | null = null
) {
	// This function should be called at the end of a "take" event (when the SegmentLines have been updated)

	let forceNowTime: number | undefined = undefined
	if (timeOffset) {
		forceNowTime = getCurrentTime() - timeOffset
	}
	// or after a new segmentLine has started playing
	updateTimeline(rundown.studioInstallationId, forceNowTime)

	// defer these so that the playout gateway has the chance to learn about the changes
	Meteor.setTimeout(() => {
		if (takeSegmentLine.updateStoryStatus) {
			sendStoryStatus(rundown, takeSegmentLine)
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

	const objs: Array<TimelineObjRundown> = items.map(
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

export const updateSourceLayerInfinitesAfterLine: (rundown: Rundown, previousLine?: SegmentLine, runUntilEnd?: boolean) => void
 = syncFunctionIgnore(updateSourceLayerInfinitesAfterLineInner)
export function updateSourceLayerInfinitesAfterLineInner (rundown: Rundown, previousLine?: SegmentLine, runUntilEnd?: boolean): string {
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

	let segmentLinesToProcess = rundown.getSegmentLines()
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

const cropInfinitesOnLayer = syncFunction(function cropInfinitesOnLayer (rundown: Rundown, segmentLine: SegmentLine, newItem: SegmentLineItem) {
	let showStyleBase = rundown.getShowStyleBase()
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

const stopInfinitesRunningOnLayer = syncFunction(function stopInfinitesRunningOnLayer (rundown: Rundown, segLine: SegmentLine, sourceLayer: string) {
	let remainingLines = rundown.getSegmentLines().filter(l => l._rank > segLine._rank)
	for (let line of remainingLines) {
		let continuations = line.getAllSegmentLineItems().filter(i => i.infiniteMode && i.infiniteId && i.infiniteId !== i._id && i.sourceLayerId === sourceLayer)
		if (continuations.length === 0) {
			break
		}

		continuations.forEach(i => SegmentLineItems.remove(i))
	}

	// ensure adlib is extended correctly if infinite
	updateSourceLayerInfinitesAfterLine(rundown, segLine)
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
						objectType: TimelineObjType.RUNDOWN
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
					objectType: TimelineObjType.RUNDOWN
				})
			})
		), newId + '_')
		newSLineItem.content.timelineObjects = objs
	}
	return newSLineItem
}

function setRundownStartedPlayback (rundown: Rundown, startedPlayback: Time) {
	if (!rundown.startedPlayback) { // Set startedPlayback on the rundown if this is the first item to be played
		reportRundownHasStarted(rundown, startedPlayback)
	}
}

function segmentLineStoppedPlaying (rundownId: string, segmentLine: SegmentLine, stoppedPlayingTime: Time) {
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
		// logger.warn(`Segment line "${segmentLine._id}" has never started playback on rundown "${rundownId}".`)
	}
}

function createSegmentLineGroup (segmentLine: SegmentLine, duration: number | string): TimelineObjGroupSegmentLine & TimelineObjRundown {
	let slGrp = literal<TimelineObjGroupSegmentLine & TimelineObjRundown>({
		_id: getSlGroupId(segmentLine),
		id: '',
		siId: '', // added later
		rundownId: segmentLine.rundownId,
		objectType: TimelineObjType.RUNDOWN,
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
	segmentLineGroup: TimelineObjRundown,
	previousSegmentLine?: SegmentLine
): TimelineObjSegmentLineAbstract {
	return literal<TimelineObjSegmentLineAbstract>({
		_id: getSlFirstObjectId(segmentLine),
		id: '',
		siId: '', // added later
		rundownId: segmentLine.rundownId,
		objectType: TimelineObjType.RUNDOWN,
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
	segmentLineItemGroup: TimelineObjRundown,
	firstObjClasses?: string[]
): TimelineObjSegmentLineItemAbstract {
	return literal<TimelineObjSegmentLineItemAbstract>({
		_id: getSliFirstObjectId(segmentLineItem),
		id: '',
		siId: '', // added later
		rundownId: segmentLineItem.rundownId,
		objectType: TimelineObjType.RUNDOWN,
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
	segmentLineGroup?: TimelineObjRundown
): TimelineObjGroup & TimelineObjRundown {
	return literal<TimelineObjGroup & TimelineObjRundown>({
		_id: getSliGroupId(item),
		id: '',
		content: {
			type: TimelineContentTypeOther.GROUP,
			objects: []
		},
		inGroup: segmentLineGroup && segmentLineGroup._id,
		isGroup: true,
		siId: '',
		rundownId: item.rundownId,
		objectType: TimelineObjType.RUNDOWN,
		trigger: item.trigger,
		duration: duration,
		LLayer: item.sourceLayerId,
		metadata: {
			segmentLineItemId: item._id
		}
	})
}

function transformBaselineItemsIntoTimeline (rundown: Rundown, items: RundownBaselineItem[]): Array<TimelineObjRundown> {
	let timelineObjs: Array<TimelineObjRundown> = []
	_.each(items, (item: RundownBaselineItem) => {
		// the baseline items are layed out without any grouping
		_.each(item.objects, (o: TimelineObjGeneric) => {
			// do some transforms maybe?
			timelineObjs.push(extendMandadory<TimelineObjGeneric, TimelineObjRundown>(o, {
				rundownId: rundown._id,
				objectType: TimelineObjType.RUNDOWN
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
	rundown: Rundown,
	items: SegmentLineItem[],
	firstObjClasses: string[],
	segmentLineGroup?: TimelineObjRundown,
	transitionProps?: TransformTransitionProps,
	holdState?: RundownHoldState,
	showHoldExcept?: boolean
): Array<TimelineObjRundown> {
	let timelineObjs: Array<TimelineObjRundown> = []

	const isHold = holdState === RundownHoldState.ACTIVE
	const allowTransition = transitionProps && transitionProps.allowed && !isHold && holdState !== RundownHoldState.COMPLETE
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
						// if (item.isTransition && holdState === RundownHoldState.COMPLETE) {
						// 	o.trigger.value = TriggerType.TIME_ABSOLUTE
						// 	o.trigger.value = 'now'
						// }
					// }

					timelineObjs.push(extendMandadory<TimelineObjectCoreExt, TimelineObjRundown>(o, {
						// @ts-ignore _id
						_id: o.id || o['_id'],
						siId: '', // set later
						inGroup: segmentLineGroup ? segmentLineItemGroup._id : undefined,
						rundownId: rundown._id,
						objectType: TimelineObjType.RUNDOWN
					}))
				})
			}
		}
	})
	return timelineObjs
}

export function getLookeaheadObjects (rundownData: RundownData, studioInstallation: StudioInstallation ): Array<TimelineObjGeneric> {
	const activeRundown = rundownData.rundown

	const currentSegmentLine = activeRundown.currentSegmentLineId ? rundownData.segmentLinesMap[activeRundown.currentSegmentLineId] : undefined

	const timelineObjs: Array<TimelineObjGeneric> = []
	_.each(studioInstallation.mappings || {}, (m, l) => {

		const res = findLookaheadForLLayer(rundownData, l, m.lookahead)
		if (res.length === 0) {
			return
		}

		for (let i = 0; i < res.length; i++) {
			const r = clone(res[i].obj) as TimelineObjGeneric

			let trigger: TimelineTrigger = {
				type: TriggerType.TIME_ABSOLUTE,
				value: 1 // Absolute 0 without a group doesnt work
			}
			if (i !== 0) {
				const prevObj = res[i - 1].obj
				const prevHasDelayFlag = (prevObj.classes || []).indexOf('_lookahead_start_delay') !== -1

				// Start with previous item
				const startOffset = prevHasDelayFlag ? 1000 : 0
				trigger = {
					type: TriggerType.TIME_RELATIVE,
					value: `#${prevObj._id}.start + ${startOffset}`
				}
			}

			r._id = 'lookahead_' + i + '_' + r._id
			r.priority = 0.1
			const finiteDuration = res[i].slId === activeRundown.currentSegmentLineId || (currentSegmentLine && currentSegmentLine.autoNext && res[i].slId === activeRundown.nextSegmentLineId)
			r.duration = finiteDuration ? `#${res[i].obj._id}.start - #.start` : 0
			r.trigger = trigger
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
	rundownData: RundownData,
	layer: string,
	mode: LookaheadMode
): Array<{
	obj: TimelineObjRundown,
	slId: string
}> {
	let activeRundown: Rundown = rundownData.rundown

	if (mode === undefined || mode === LookaheadMode.NONE) {
		return []
	}

	interface SegmentLineInfo {
		id: string
		segmentId: string
		line: SegmentLine
	}
	// find all slis that touch the layer
	const layerItems = _.filter(rundownData.segmentLineItems, (sli: SegmentLineItem) => {
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
			return r ? [{ obj: r as TimelineObjRundown, slId: i.segmentLineId }] : []
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
		const lines = rundownData.segmentLines.map(l => ({ id: l._id, rank: l._rank, segmentId: l.segmentId, line: l }))
		lines.sort((a, b) => {
			if (a.rank < b.rank) {
				return -1
			}
			if (a.rank > b.rank) {
				return 1
			}
			return 0
		})

		const currentIndex = lines.findIndex(l => l.id === activeRundown.currentSegmentLineId)
		let res: SegmentLineInfo[] = []
		if (currentIndex >= 0) {
			res = res.concat(lines.slice(0, currentIndex + 1))
			currentSegmentId = res[res.length - 1].segmentId
			currentPos = currentIndex
		}

		const nextLine = activeRundown.nextSegmentLineId
			? lines.findIndex(l => l.id === activeRundown.nextSegmentLineId)
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

	let findObjectForSegmentLine = (): TimelineObjRundown[] => {
		if (!sliGroup || sliGroup.items.length === 0) {
			return []
		}

		let rawObjs: (TimelineObjRundown | null)[] = []
		sliGroup.items.forEach(i => {
			if (i.content && i.content.timelineObjects) {
				rawObjs = rawObjs.concat(i.content.timelineObjects as TimelineObjRundown[])
			}
		})
		let allObjs: TimelineObjRundown[] = _.compact(rawObjs)

		if (allObjs.length === 0) {
			// Should never happen. suggests something got 'corrupt' during this process
			return []
		}
		if (allObjs.length > 1) {
			if (sliGroup.line) {
				const orderedItems = getOrderedSegmentLineItem(sliGroup.line)

				let allowTransition = false
				if (sliGroupIndex >= 1 && activeRundown.currentSegmentLineId) {
					const prevSliGroup = orderedGroups[sliGroupIndex - 1]
					allowTransition = !prevSliGroup.line.disableOutTransition
				}

				const transObj = orderedItems.find(i => !!i.isTransition)
				const transObj2 = transObj ? sliGroup.items.find(l => l._id === transObj._id) : undefined
				const hasTransition = allowTransition && transObj2 && transObj2.content && transObj2.content.timelineObjects && transObj2.content.timelineObjects.find(o => o != null && o.LLayer === layer)

				const res: TimelineObjRundown[] = []
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
						res.push(obj as TimelineObjRundown)
					}
				})

				return res
			}
		}

		return allObjs
	}

	const res: {obj: TimelineObjRundown, slId: string}[] = []

	const slId = sliGroup.slId
	const objs = findObjectForSegmentLine()
	objs.forEach(o => res.push({ obj: o, slId: slId }))

	// this is the current one, so look ahead to next to find the next thing to preload too
	if (sliGroup && sliGroup.slId === activeRundown.currentSegmentLineId) {
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
export function updateTimelineFromMosData (rundownId: string, changedLines?: Array<string>) {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	let data: UpdateTimelineFromMosDataTimeout = updateTimelineFromMosDataTimeouts[rundownId]
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
		delete updateTimelineFromMosDataTimeouts[rundownId]

		// infinite items only need to be recalculated for those after where the edit was made (including the edited line)
		let prevLine: SegmentLine | undefined
		if (data.changedLines) {
			const firstLine = SegmentLines.findOne({
				rundownId: rundownId,
				_id: { $in: data.changedLines }
			}, { sort: { _rank: 1 } })
			if (firstLine) {
				prevLine = SegmentLines.findOne({
					rundownId: rundownId,
					_rank: { $lt: firstLine._rank }
				}, { sort: { _rank: -1 } })
			}
		}

		updateSourceLayerInfinitesAfterLine(rundown, prevLine, true)

		if (rundown.active) {
			updateTimeline(rundown.studioInstallationId)
		}
	}, 1000)

	updateTimelineFromMosDataTimeouts[rundownId] = data
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
 * Updates the Timeline to reflect the state in the Rundown, Segments, Segmentlines etc...
 * @param studioInstallationId id of the studioInstallation to update
 * @param forceNowToTime if set, instantly forces all "now"-objects to that time (used in autoNext)
 */
export const updateTimeline: (studioInstallationId: string, forceNowToTime?: Time) => void
= syncFunctionIgnore(function updateTimeline (studioInstallationId: string, forceNowToTime?: Time) {
	logger.debug('updateTimeline running...')
	let timelineObjs: Array<TimelineObjGeneric> = []

	let studioInstallation = StudioInstallations.findOne(studioInstallationId) as StudioInstallation
	if (!studioInstallation) throw new Meteor.Error(404, 'studioInstallation "' + studioInstallationId + '" not found!')

	const applyTimelineObjs = (_timelineObjs: TimelineObjGeneric[]) => {
		timelineObjs = timelineObjs.concat(_timelineObjs)
	}

	waitForPromiseAll([
		caught(getTimelineRundown(studioInstallation).then(applyTimelineObjs)),
		caught(getTimelineRecording(studioInstallation).then(applyTimelineObjs))
	])

	processTimelineObjects(studioInstallation, timelineObjs)

	if (forceNowToTime) { // used when autoNexting
		setNowToTimeInObjects(timelineObjs, forceNowToTime)
	}

	const ps: Promise<any>[] = []

	ps.push(makePromise(() => {
		saveIntoDb<TimelineObjGeneric, TimelineObjGeneric>(Timeline, {
			siId: studioInstallation._id,
			statObject: { $ne: true }
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
	}))

	ps.push(makePromise(() => {
		afterUpdateTimeline(studioInstallation, timelineObjs)
	}))
	waitForPromiseAll(ps)

	logger.debug('updateTimeline done!')
})

/**
 * Returns timeline objects related to rundowns in a studio
 */
function getTimelineRundown (studioInstallation: StudioInstallation): Promise<TimelineObjRundown[]> {

	return new Promise((resolve, reject) => {
		try {
			let timelineObjs: Array<TimelineObjGeneric> = []

			const promiseActiveRundown = asyncCollectionFindOne(Rundowns, {
				studioInstallationId: studioInstallation._id,
				active: true
			})
			// let promiseStudioInstallation = asyncCollectionFindOne(StudioInstallations, studioInstallation._id)
			let activeRundown = waitForPromise(promiseActiveRundown)

			if (activeRundown) {

				// remove anything not related to active rundown:
				let promiseClearTimeline: Promise<void> = asyncCollectionRemove(Timeline, {
					siId: studioInstallation._id,
					rundownId: {
						$not: {
							$eq: activeRundown._id
						}
					}
				})
				// Start with fetching stuff from database:
				let promiseBaselineItems: Promise<Array<RundownBaselineItem>> = asyncCollectionFindFetch(RundownBaselineItems, {
					rundownId: activeRundown._id
				})
				let rundownData: RundownData = activeRundown.fetchAllData()

				// Default timelineobjects:
				let baselineItems = waitForPromise(promiseBaselineItems)

				timelineObjs = timelineObjs.concat(buildTimelineObjsForRundown(rundownData, baselineItems))

				// next (on pvw (or on pgm if first))
				timelineObjs = timelineObjs.concat(getLookeaheadObjects(rundownData, studioInstallation))

				// console.log(JSON.stringify(timelineObjs))

				// TODO: Specific implementations, to be refactored into Blueprints:
				setLawoObjectsTriggerValue(timelineObjs, activeRundown.currentSegmentLineId || undefined)
				timelineObjs = validateNoraPreload(timelineObjs)

				waitForPromise(promiseClearTimeline)

				// console.log('full', JSON.stringify(timelineObjs, undefined, 4))

				resolve(
					_.map<TimelineObjGeneric, TimelineObjRundown>(timelineObjs, (timelineObj) => {

						return extendMandadory<TimelineObjGeneric, TimelineObjRundown>(timelineObj, {
							rundownId: activeRundown._id,
							objectType: TimelineObjType.RUNDOWN
						})
					})
				)
			} else {
				let studioBaseline: TimelineObjRundown[] = []

				const blueprint = loadStudioBlueprints(studioInstallation)
				if (blueprint) {
					const baselineObjs = blueprint.getBaseline(new StudioContext(studioInstallation))
					studioBaseline = postProcessStudioBaselineObjects(studioInstallation, baselineObjs)

					const id = `${studioInstallation._id}_baseline_version`
					studioBaseline.push(literal<TimelineObjRundown>({
						_id: id,
						id: id,
						siId: '',
						rundownId: '',
						objectType: TimelineObjType.RUNDOWN,
						trigger: { type: 0, value: 0 },
						duration: 0,
						LLayer: id,
						isAbstract: true,
						content: {
							versions: {
								core: PackageInfo.version,
								blueprintId: studioInstallation.blueprintId,
								blueprintVersion: blueprint.blueprintVersion,
								studioInstallation: studioInstallation._rundownVersionHash,
							}
						}
					}))
				}

				resolve(studioBaseline)
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

			RecordedFiles.find({ // TODO: ask Julian if this is okay, having multiple recordings at the same time?
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

export function buildTimelineObjsForRundown (rundownData: RundownData, baselineItems: RundownBaselineItem[]): TimelineObjRundown[] {
	let timelineObjs: Array<TimelineObjRundown> = []
	let currentSegmentLineGroup: TimelineObjRundown | undefined
	let previousSegmentLineGroup: TimelineObjRundown | undefined

	let currentSegmentLine: SegmentLine | undefined
	let nextSegmentLine: SegmentLine | undefined

	// let currentSegmentLineItems: Array<SegmentLineItem> = []
	let previousSegmentLine: SegmentLine | undefined

	let activeRundown = rundownData.rundown

	timelineObjs.push(literal<TimelineObjRundown>({
		siId: '', // set later
		id: '', // set later
		objectType: TimelineObjType.RUNDOWN,
		rundownId: rundownData.rundown._id,
		_id: activeRundown._id + '_status',
		trigger: {
			type: TriggerType.LOGICAL,
			value: '1'
		},
		LLayer: 'rundown_status',
		isAbstract: true,
		content: {},
		classes: [activeRundown.rehearsal ? 'rundown_rehersal' : 'rundown_active']
	}))

	// Fetch the nextSegmentLine first, because that affects how the currentSegmentLine will be treated
	if (activeRundown.nextSegmentLineId) {
		// We may be at the beginning of a show, and there can be no currentSegmentLine and we are waiting for the user to Take
		nextSegmentLine = rundownData.segmentLinesMap[activeRundown.nextSegmentLineId]
		if (!nextSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRundown.nextSegmentLineId}" not found!`)
	}

	if (activeRundown.currentSegmentLineId) {
		currentSegmentLine = rundownData.segmentLinesMap[activeRundown.currentSegmentLineId]
		if (!currentSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRundown.currentSegmentLineId}" not found!`)

		if (activeRundown.previousSegmentLineId) {
			previousSegmentLine = rundownData.segmentLinesMap[activeRundown.previousSegmentLineId]
			if (!previousSegmentLine) throw new Meteor.Error(404, `SegmentLine "${activeRundown.previousSegmentLineId}" not found!`)
		}
	}

	if (baselineItems) {
		timelineObjs = timelineObjs.concat(transformBaselineItemsIntoTimeline(rundownData.rundown, baselineItems))
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
				let prevObjs: TimelineObjRundown[] = [previousSegmentLineGroup]
				prevObjs = prevObjs.concat(
					transformSegmentLineIntoTimeline(rundownData.rundown, previousSegmentLineItems, groupClasses, previousSegmentLineGroup, undefined, activeRundown.holdState, undefined))

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
				const originalItem = _.find(rundownData.segmentLineItems, (sli => sli._id === item.infiniteId))

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
			timelineObjs = timelineObjs.concat(infiniteGroup, transformSegmentLineIntoTimeline(rundownData.rundown, [item], groupClasses, infiniteGroup, undefined, activeRundown.holdState, showHoldExcept))
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
			transformSegmentLineIntoTimeline(rundownData.rundown, currentNormalItems, groupClasses, currentSegmentLineGroup, transProps, activeRundown.holdState, undefined)
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
				transformSegmentLineIntoTimeline(rundownData.rundown, nextItems, groupClasses, nextSegmentLineItemGroup, transProps)
			)
			timelineObjs.push(createSegmentLineGroupFirstObject(nextSegmentLine, nextSegmentLineItemGroup, currentSegmentLine))
		}
	}

	if (!nextSegmentLine && !currentSegmentLine) {
		// maybe at the end of the show
		logger.info(`No next segmentLine and no current segment line set on rundown "${activeRundown._id}".`)
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
