
/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import { Rundowns, Rundown, RundownHoldState, RundownData, DBRundown } from '../../lib/collections/Rundowns'
import { Part, Parts, DBPart } from '../../lib/collections/Parts'
import { Piece, Pieces } from '../../lib/collections/Pieces'
import { AdLibPieces, AdLibPiece } from '../../lib/collections/AdLibPieces'
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
	TimelineObjPartAbstract,
	TimelineObjPieceAbstract,
	TimelineObjGroup,
	TimelineObjGroupPart,
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
	getPartGroupId,
	getPartFirstObjectId,
	getPieceGroupId,
	getPieceFirstObjectId,
	IConfigItem,
	LookaheadMode,
	SourceLayerType,
	PieceLifespan,
	PartHoldMode,
	TimelineObjHoldMode,
	TimelineObjectCoreExt,
	VTContent
} from 'tv-automation-sofie-blueprints-integration'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { Studios, Studio } from '../../lib/collections/Studios'
import { PlayoutAPI } from '../../lib/api/playout'
import { syncFunction, syncFunctionIgnore } from '../codeControl'
import { getResolvedSegment, ISourceLayerExtended } from '../../lib/Rundown'
let clone = require('fast-clone')
import { Resolver } from 'superfly-timeline'
import { transformTimeline } from '../../lib/timeline'
import { ClientAPI } from '../../lib/api/client'
import { setMeteorMethods, Methods } from '../methods'
import { updateParts } from './rundown'
import { RecordedFiles } from '../../lib/collections/RecordedFiles'
import { generateRecordingTimelineObjs } from './testTools'
import {
	reportRundownHasStarted,
	reportPartHasStarted,
	reportPieceHasStarted,
	reportPartHasStopped,
	reportPieceHasStopped
} from './asRunLog'
import { Blueprints } from '../../lib/collections/Blueprints'
import { getBlueprintOfRundown, loadStudioBlueprints } from './blueprints/cache'
import { RundownContext, StudioContext, PartEventContext } from './blueprints/context'
import { postProcessStudioBaselineObjects } from './blueprints/postProcess'
import { IngestActions } from './ingest/actions';
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
		const anyOtherActiveRundowns = areThereActiveROsInStudio(rundown.studioId, rundown._id)
		if (anyOtherActiveRundowns.length) {
			// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
			throw new Meteor.Error(409, 'Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
		}

		resetRundown(rundown)
		prepareStudioForBroadcast(rundown.getStudio())

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

		updateTimeline(rundown.studioId)

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
			IngestActions.reloadRundown(rundown)
		)
	}
	function resetRundown (rundown: Rundown) {
		logger.info('resetRundown ' + rundown._id)
		// Remove all dunamically inserted items (adlibs etc)
		Pieces.remove({
			rundownId: rundown._id,
			dynamicallyInserted: true
		})

		Parts.remove({
			rundownId: rundown._id,
			dynamicallyInserted: true
		})

		Parts.update({
			rundownId: rundown._id
		}, {
			$unset: {
				duration: 1,
				startedPlayback: 1,
				timings: 1,
				runtimeArguments: 1
			}
		}, {multi: true})

		const dirtyParts = Parts.find({
			rundownId: rundown._id,
			dirty: true
		}).fetch()
		dirtyParts.forEach(part => {
			refreshPart(rundown, part)
			Parts.update(part._id, {$unset: {
				dirty: 1
			}})
		})

		// Reset all pieces that were modified for holds
		Pieces.update({
			rundownId: rundown._id,
			extendOnHold: true,
			infiniteId: { $exists: true },
		}, {
			$unset: {
				infiniteId: 0,
				infiniteMode: 0,
			}
		}, {multi: true})

		// Reset any pieces that were modified by inserted adlibs
		Pieces.update({
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

		Pieces.update({
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
		let parts = rundown.getParts()

		Rundowns.update(rundown._id, {
			$set: {
				previousPartId: null,
				currentPartId: null,
				updateStoryStatus: null,
				holdState: RundownHoldState.NONE,
			}, $unset: {
				startedPlayback: 1
			}
		})

		if (rundown.active) {
			// put the first on queue:
			setNextPart(rundown, _.first(parts) || null)
		} else {
			setNextPart(rundown, null)
		}
	}
	function prepareStudioForBroadcast (studio: Studio) {
		logger.info('prepareStudioForBroadcast ' + studio._id)

		const ssrcBgs: Array<IConfigItem> = _.compact([
			studio.config.find((o) => o._id === 'atemSSrcBackground'),
			studio.config.find((o) => o._id === 'atemSSrcBackground2')
		])
		if (ssrcBgs.length > 1) logger.info(ssrcBgs[0].value + ' and ' + ssrcBgs[1].value + ' will be loaded to atems')
		if (ssrcBgs.length > 0) logger.info(ssrcBgs[0].value + ' will be loaded to atems')

		let playoutDevices = PeripheralDevices.find({
			studioId: studio._id,
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
	export function areThereActiveROsInStudio (studioId: string, excludeRundownId: string): Rundown[] {
		let anyOtherActiveRundowns = Rundowns.find({
			studioId: studioId,
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

		let studio = rundown.getStudio()

		const anyOtherActiveRundowns = areThereActiveROsInStudio(studio._id, rundown._id)

		if (anyOtherActiveRundowns.length) {
			// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
			throw new Meteor.Error(409, 'Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
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

		if (!rundown.nextPartId) {
			let parts = rundown.getParts()
			let firstPart = _.first(parts)
			if (firstPart) {
				setNextPart(rundown, firstPart)
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

		let previousPart = (rundown.currentPartId ?
			Parts.findOne(rundown.currentPartId)
			: null
		)

		if (previousPart) partStoppedPlaying(rundown._id, previousPart, getCurrentTime())

		Rundowns.update(rundown._id, {
			$set: {
				active: false,
				previousPartId: null,
				currentPartId: null,
				holdState: RundownHoldState.NONE,
			}
		})
		setNextPart(rundown, null)
		if (rundown.currentPartId) {
			Parts.update(rundown.currentPartId, {
				$push: {
					'timings.takeOut': getCurrentTime()
				}
			})
		}

		// clean up all runtime baseline items
		RundownBaselineItems.remove({
			rundownId: rundown._id
		})

		RundownBaselineAdLibPieces.remove({
			rundownId: rundown._id
		})

		updateTimeline(rundown.studioId)

		sendStoryStatus(rundown, null)
		IngestActions.sendPartStatus()

		Meteor.defer(() => {
			let bp = getBlueprintOfRundown(rundown)
			if (bp.onRundownDeActivate) {
				Promise.resolve(bp.onRundownDeActivate(new RundownContext(rundown)))
				.catch(logger.error)
			}
		})
	}
	function resetPart (part: DBPart): Promise<void> {
		let ps: Array<Promise<any>> = []

		let isDirty = part.dirty || false

		ps.push(asyncCollectionUpdate(Parts, {
			rundownId: part.rundownId,
			_id: part._id
		}, {
			$unset: {
				duration: 1,
				startedPlayback: 1,
				runtimeArguments: 1,
				dirty: 1
			}
		}))
		ps.push(asyncCollectionUpdate(Pieces, {
			rundownId: part.rundownId,
			partId: part._id
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
		// Remove all pieces that have been dynamically created (such as adLib items)
		ps.push(asyncCollectionRemove(Pieces, {
			rundownId: part.rundownId,
			partId: part._id,
			dynamicallyInserted: true
		}))

		// Reset any pieces that were modified by inserted adlibs
		ps.push(asyncCollectionUpdate(Pieces, {
			rundownId: part.rundownId,
			partId: part._id,
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
				const rundown = Rundowns.findOne(part.rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${part.rundownId}" not found!`)

				Promise.all(ps)
				.then(() => {
					refreshPart(rundown, part)
					resolve()
				}).catch((e) => reject())
			})
		} else {
			const rundown = Rundowns.findOne(part.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${part.rundownId}" not found!`)
			const prevLine = getPreviousPart(rundown, part)

			return Promise.all(ps)
			.then(() => {
				updateSourceLayerInfinitesAfterLine(rundown, prevLine)
				// do nothing
			})
		}
	}
	function getPreviousPart (dbRundown: DBRundown, dbPart: DBPart) {
		return Parts.findOne({
			rundownId: dbRundown._id,
			_rank: { $lt: dbPart._rank }
		}, { sort: { _rank: -1 } })
	}
	function refreshPart (dbRundown: DBRundown, dbPart: DBPart) {
		const rundown = new Rundown(dbRundown)
		// TODO reimplement
		const story = {} // rundown.fetchCache(CachePrefix.INGEST_PART + dbPart._id)
		const part = new Part(dbPart)
		// updateStory(rundown, part, story)

		// const segment = part.getSegment()
		// if (segment) {
		// 	// this could be run after the segment, if we were capable of limiting that
		// 	runPostProcessBlueprint(rundown, segment)
		// }

		const prevLine = getPreviousPart(dbRundown, part)
		updateSourceLayerInfinitesAfterLine(rundown, prevLine)
	}
	function setNextPart (
		rundown: Rundown,
		nextPart: DBPart | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	) {
		let ps: Array<Promise<any>> = []
		if (nextPart) {

			if (nextPart.rundownId !== rundown._id) throw new Meteor.Error(409, `Part "${nextPart._id}" not part of rundown "${rundown._id}"`)
			if (nextPart._id === rundown.currentPartId) {
				throw new Meteor.Error(402, 'Not allowed to Next the currently playing Part')
			}
			if (nextPart.invalid) {
				throw new Meteor.Error(400, 'Part is marked as invalid, cannot set as next.')
			}

			ps.push(resetPart(nextPart))

			ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
				$set: {
					nextPartId: nextPart._id,
					nextPartManual: !!setManually,
					nextTimeOffset: nextTimeOffset || null
				}
			}))
			ps.push(asyncCollectionUpdate(Parts, nextPart._id, {
				$push: {
					'timings.next': getCurrentTime()
				}
			}))
		} else {
			ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
				$set: {
					nextPartId: null,
					nextPartManual: !!setManually
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
		if (!rundown.nextPartId) throw new Meteor.Error(500, 'nextPartId is not set!')

		let timeOffset: number | null = rundown.nextTimeOffset || null

		let firstTake = !rundown.startedPlayback
		let rundownData = rundown.fetchAllData()

		const currentSL = rundown.currentPartId ? rundownData.partsMap[rundown.currentPartId] : undefined
		if (currentSL && currentSL.transitionDuration) {
			const prevSL = rundown.previousPartId ? rundownData.partsMap[rundown.previousPartId] : undefined
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

			if (rundown.currentPartId) {
				const currentPart = rundownData.partsMap[rundown.currentPartId]
				if (!currentPart) throw new Meteor.Error(404, 'currentPart not found!')

				// Remove the current extension line
				Pieces.remove({
					partId: currentPart._id,
					extendOnHold: true,
					dynamicallyInserted: true
				})
			}
			if (rundown.previousPartId) {
				const previousPart = rundownData.partsMap[rundown.previousPartId]
				if (!previousPart) throw new Meteor.Error(404, 'previousPart not found!')

				// Clear the extended mark on the original
				Pieces.update({
					partId: previousPart._id,
					extendOnHold: true,
					dynamicallyInserted: false
				}, {
					$unset: {
						infiniteId: 0,
						infiniteMode: 0,
					}
				}, {multi: true})
			}

			updateTimeline(rundown.studioId)
			return ClientAPI.responseSuccess()
		}
		let pBlueprint = makePromise(() => getBlueprintOfRundown(rundown))

		let previousPart = (rundown.currentPartId ?
			rundownData.partsMap[rundown.currentPartId]
			: null
		)
		let takePart = rundownData.partsMap[rundown.nextPartId]
		if (!takePart) throw new Meteor.Error(404, 'takePart not found!')
		// let takeSegment = rundownData.segmentsMap[takePart.segmentId]
		let partAfter = fetchAfter(rundownData.parts, {
			rundownId: rundown._id,
			invalid: { $ne: true }
		}, takePart._rank)

		let nextPart: DBPart | null = partAfter || null

		// beforeTake(rundown, previousPart || null, takePart)
		beforeTake(rundownData, previousPart || null, takePart)

		let blueprint = waitForPromise(pBlueprint)
		if (blueprint.onPreTake) {
			try {
				waitForPromise(
					Promise.resolve(blueprint.onPreTake(new PartEventContext(rundown, undefined, takePart)))
					.catch(logger.error)
				)
			} catch (e) {
				logger.error(e)
			}
		}

		let ps: Array<Promise<any>> = []
		let m = {
			previousPartId: rundown.currentPartId,
			currentPartId: takePart._id,
			holdState: !rundown.holdState || rundown.holdState === RundownHoldState.COMPLETE ? RundownHoldState.NONE : rundown.holdState + 1,
		}
		ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
			$set: m
		}))
		ps.push(asyncCollectionUpdate(Parts, takePart._id, {
			$push: {
				'timings.take': now,
				'timings.playOffset': timeOffset || 0
			}
		}))
		if (m.previousPartId) {
			ps.push(asyncCollectionUpdate(Parts, m.previousPartId, {
				$push: {
					'timings.takeOut': now,
				}
			}))
		}
		rundown = _.extend(rundown, m) as Rundown

		setNextPart(rundown, nextPart)
		waitForPromiseAll(ps)

		ps = []

		// Setup the items for the HOLD we are starting
		if (m.previousPartId && m.holdState === RundownHoldState.ACTIVE) {
			let previousPart = rundownData.partsMap[m.previousPartId]
			if (!previousPart) throw new Meteor.Error(404, 'previousPart not found!')

			// Make a copy of any item which is flagged as an 'infinite' extension
			const itemsToCopy = previousPart.getAllPieces().filter(i => i.extendOnHold)
			itemsToCopy.forEach(piece => {
				// mark current one as infinite
				piece.infiniteId = piece._id
				piece.infiniteMode = PieceLifespan.OutOnNextPart
				ps.push(asyncCollectionUpdate(Pieces, piece._id, {
					$set: {
						infiniteMode: PieceLifespan.OutOnNextPart,
						infiniteId: piece._id,
					}
				}))

				// make the extension
				const newPiece = clone(piece) as Piece
				newPiece.partId = m.currentPartId
				newPiece.expectedDuration = 0
				const content = newPiece.content as VTContent
				if (content.fileName && content.sourceDuration && piece.startedPlayback) {
					content.seek = Math.min(content.sourceDuration, getCurrentTime() - piece.startedPlayback)
				}
				newPiece.dynamicallyInserted = true
				newPiece._id = piece._id + '_hold'

				// This gets deleted once the nextpart is activated, so it doesnt linger for long
				ps.push(asyncCollectionUpsert(Pieces, newPiece._id, newPiece))
				rundownData.pieces.push(newPiece) // update the local collection

			})
		}
		waitForPromiseAll(ps)
		afterTake(rundown, takePart, previousPart || null, timeOffset)

		// last:
		Parts.update(takePart._id, {
			$push: {
				'timings.takeDone': getCurrentTime()
			}
		})

		Meteor.defer(() => {
			// let bp = getBlueprintOfRundown(rundown)
			if (firstTake) {
				if (blueprint.onRundownFirstTake) {
					Promise.resolve(blueprint.onRundownFirstTake(new PartEventContext(rundown, undefined, takePart)))
					.catch(logger.error)
				}
			}

			if (blueprint.onPostTake) {
				Promise.resolve(blueprint.onPostTake(new PartEventContext(rundown, undefined, takePart)))
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

		let nextPart: Part | null = null
		if (nextSlId) {
			nextPart = Parts.findOne(nextSlId) || null
			if (!nextPart) throw new Meteor.Error(404, `Part "${nextSlId}" not found!`)
		}

		setNextPart(rundown, nextPart, setManually, nextTimeOffset)

		// remove old auto-next from timeline, and add new one
		updateTimeline(rundown.studioId)

		return ClientAPI.responseSuccess()
	}
	export function rundownMoveNext (
		rundownId: string,
		horisontalDelta: number,
		verticalDelta: number,
		setManually: boolean,
		currentNextPieceId?: string
	): string {
		check(rundownId, String)
		check(horisontalDelta, Number)
		check(verticalDelta, Number)

		if (!horisontalDelta && !verticalDelta) throw new Meteor.Error(402, `rundownMoveNext: invalid delta: (${horisontalDelta}, ${verticalDelta})`)

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(501, `Rundown "${rundownId}" is not active!`)

		if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) throw new Meteor.Error(501, `Rundown "${rundownId}" cannot change next during hold!`)

		let currentNextPiece: Part
		if (currentNextPieceId) {
			currentNextPiece = Parts.findOne(currentNextPieceId) as Part
		} else {
			if (!rundown.nextPartId) throw new Meteor.Error(501, `Rundown "${rundownId}" has no next part!`)
			currentNextPiece = Parts.findOne(rundown.nextPartId) as Part
		}

		if (!currentNextPiece) throw new Meteor.Error(404, `Part "${rundown.nextPartId}" not found!`)

		let currentNextSegment = Segments.findOne(currentNextPiece.segmentId) as Segment
		if (!currentNextSegment) throw new Meteor.Error(404, `Segment "${currentNextPiece.segmentId}" not found!`)

		let parts = rundown.getParts()
		let segments = rundown.getSegments()

		let partIndex: number = -1
		_.find(parts, (part, i) => {
			if (part._id === currentNextPiece._id) {
				partIndex = i
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
		if (partIndex === -1) throw new Meteor.Error(404, `Part not found in list of parts!`)
		if (segmentIndex === -1) throw new Meteor.Error(404, `Segment not found in list of segments!`)

		if (verticalDelta !== 0) {
			segmentIndex += verticalDelta

			let segment = segments[segmentIndex]

			if (!segment) throw new Meteor.Error(404, `No Segment found!`)

			let partsInSegment = segment.getParts()
			let part = _.first(partsInSegment) as Part
			if (!part) throw new Meteor.Error(404, `No Parts in segment "${segment._id}"!`)

			partIndex = -1
			_.find(parts, (part, i) => {
				if (part._id === part._id) {
					partIndex = i
					return true
				}
			})
			if (partIndex === -1) throw new Meteor.Error(404, `Part (from segment) not found in list of parts!`)
		}

		partIndex += horisontalDelta

		partIndex = Math.max(0, Math.min(parts.length - 1, partIndex))

		let part = parts[partIndex]
		if (!part) throw new Meteor.Error(501, `Part index ${partIndex} not found in list of parts!`)

		if ((part._id === rundown.currentPartId && !currentNextPieceId) || part.invalid) {
			// Whoops, we're not allowed to next to that.
			// Skip it, then (ie run the whole thing again)
			return ServerPlayoutAPI.rundownMoveNext (rundownId, horisontalDelta, verticalDelta, setManually, part._id)
		} else {
			ServerPlayoutAPI.rundownSetNext(rundown._id, part._id, setManually)
			return part._id
		}

	}
	export function rundownActivateHold (rundownId: string) {
		check(rundownId, String)
		logger.debug('rundownActivateHold')

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		if (!rundown.currentPartId) throw new Meteor.Error(400, `Rundown "${rundownId}" no current part!`)
		if (!rundown.nextPartId) throw new Meteor.Error(400, `Rundown "${rundownId}" no next part!`)

		let currentPart = Parts.findOne({_id: rundown.currentPartId})
		if (!currentPart) throw new Meteor.Error(404, `Part "${rundown.currentPartId}" not found!`)
		let nextPart = Parts.findOne({_id: rundown.nextPartId})
		if (!nextPart) throw new Meteor.Error(404, `Part "${rundown.nextPartId}" not found!`)

		if (currentPart.holdMode !== PartHoldMode.FROM || nextPart.holdMode !== PartHoldMode.TO) {
			throw new Meteor.Error(400, `Rundown "${rundownId}" incompatible pair of HoldMode!`)
		}

		if (rundown.holdState) {
			throw new Meteor.Error(400, `Rundown "${rundownId}" already doing a hold!`)
		}

		Rundowns.update(rundownId, { $set: { holdState: RundownHoldState.PENDING } })

		updateTimeline(rundown.studioId)

		return ClientAPI.responseSuccess()
	}
	export function rundownStoriesMoved (rundownId: string, onAirNextWindowWidth: number | undefined, nextPosition: number | undefined) {
		check(rundownId, String)
		check(onAirNextWindowWidth, Match.Maybe(Number))
		check(nextPosition, Match.Maybe(Number))

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		if (rundown.nextPartId) {
			let currentPart: Part | undefined = undefined
			let nextPart: Part | undefined = undefined
			if (rundown.currentPartId) {
				currentPart = Parts.findOne(rundown.currentPartId)
			}
			if (rundown.nextPartId) {
				nextPart = Parts.findOne(rundown.nextPartId)
			}
			if (currentPart && onAirNextWindowWidth === 2) { // the next line was next to onAir line
				const newNextLine = rundown.getParts({
					_rank: {
						$gt: currentPart._rank
					}
				}, {
					limit: 1
				})[0]
				setNextPart(rundown, newNextLine || null)
			} else if (!currentPart && nextPart && onAirNextWindowWidth === undefined && nextPosition !== undefined) {
				const newNextLine = rundown.getParts({}, {
					limit: nextPosition
				})[0]
				setNextPart(rundown, newNextLine || null)

			}
		}
	}
	export function rundownDisableNextPiece (rundownId: string, undo?: boolean) {
		check(rundownId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.currentPartId) throw new Meteor.Error(401, `No current part!`)

		let studio = rundown.getStudio()

		let showStyleBase = rundown.getShowStyleBase()

		let currentPart = Parts.findOne(rundown.currentPartId)
		if (!currentPart) throw new Meteor.Error(404, `Part "${rundown.currentPartId}" not found!`)

		let nextPart = (rundown.nextPartId ? Parts.findOne(rundown.nextPartId) : undefined)

		let currentSement = Segments.findOne(currentPart.segmentId)
		if (!currentSement) throw new Meteor.Error(404, `Segment "${currentPart.segmentId}" not found!`)

		let o = getResolvedSegment(showStyleBase, rundown, currentSement)

		// @ts-ignore stringify
		// logger.info(o)
		// logger.info(JSON.stringify(o, '', 2))

		let allowedSourceLayers: {[layerId: string]: ISourceLayerExtended} = {}
		_.each(o.segmentExtended.sourceLayers, (sourceLayer: ISourceLayerExtended) => {
			if (sourceLayer.allowDisable) allowedSourceLayers[sourceLayer._id] = sourceLayer
		})

		// logger.info('allowedSourceLayers', allowedSourceLayers)

		// logger.info('nowInPart', nowInPart)
		// logger.info('filteredPieces', filteredPieces)
		let getNextPiece = (part: Part, undo?: boolean) => {
			// Find next piece to disable

			let nowInPart = 0
			if (
				part.startedPlayback &&
				part.timings &&
				part.timings.startedPlayback
			) {
				let lastStartedPlayback = _.last(part.timings.startedPlayback)

				if (lastStartedPlayback) {
					nowInPart = getCurrentTime() - lastStartedPlayback
				}
			}

			let pieces: Array<PieceResolved> = getOrderedPiece(part)

			let findLast: boolean = !!undo

			let filteredPieces = _.sortBy(
				_.filter(pieces, (piece: PieceResolved) => {
					let sourceLayer = allowedSourceLayers[piece.sourceLayerId]
					if (sourceLayer && sourceLayer.allowDisable && !piece.virtual) return true
					return false
				}),
				(piece: PieceResolved) => {
					let sourceLayer = allowedSourceLayers[piece.sourceLayerId]
					return sourceLayer._rank || -9999
				}
			)
			if (findLast) filteredPieces.reverse()

			let nextPiece: PieceResolved | undefined = _.find(filteredPieces, (piece) => {
				logger.info('piece.resolvedStart', piece.resolvedStart)
				return (
					piece.resolvedStart >= nowInPart &&
					(
						(
							!undo &&
							!piece.disabled
						) || (
							undo &&
							piece.disabled
						)
					)
				)
			})
			return nextPiece
		}

		if (nextPart) {
			// pretend that the next part never has played (even if it has)
			nextPart.startedPlayback = false
		}

		let sls = [
			currentPart,
			nextPart // If not found in currently playing part, let's look in the next one:
		]
		if (undo) sls.reverse()

		let nextPiece: PieceResolved | undefined

		_.each(sls, (part) => {
			if (part && !nextPiece) {
				nextPiece = getNextPiece(part, undo)
			}
		})

		if (nextPiece) {
			logger.info((undo ? 'Disabling' : 'Enabling') + ' next piece ' + nextPiece._id)
			Pieces.update(nextPiece._id, {$set: {
				disabled: !undo
			}})
			updateTimeline(studio._id)

			return ClientAPI.responseSuccess()
		} else {
			return ClientAPI.responseError('Found no future pieces')
		}
	}

	export function piecePlaybackStartedCallback (rundownId: string, pieceId: string, startedPlayback: Time) {
		check(rundownId, String)
		check(pieceId, String)
		check(startedPlayback, Number)

		// This method is called when an auto-next event occurs
		let segLineItem = Pieces.findOne({
			_id: pieceId,
			rundownId: rundownId
		})
		if (!segLineItem) throw new Meteor.Error(404, `Piece "${pieceId}" in rundown "${rundownId}" not found!`)

		let isPlaying: boolean = !!(
			segLineItem.startedPlayback &&
			!segLineItem.stoppedPlayback
		)
		if (!isPlaying) {
			logger.info(`Playout reports piece "${pieceId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

			reportPieceHasStarted(segLineItem, startedPlayback)

			// We don't need to bother with an updateTimeline(), as this hasn't changed anything, but lets us accurately add started items when reevaluating
		}
	}
	export function piecePlaybackStoppedCallback (rundownId: string, pieceId: string, stoppedPlayback: Time) {
		check(rundownId, String)
		check(pieceId, String)
		check(stoppedPlayback, Number)

		// This method is called when an auto-next event occurs
		let segLineItem = Pieces.findOne({
			_id: pieceId,
			rundownId: rundownId
		})
		if (!segLineItem) throw new Meteor.Error(404, `Piece "${pieceId}" in rundown "${rundownId}" not found!`)

		let isPlaying: boolean = !!(
			segLineItem.startedPlayback &&
			!segLineItem.stoppedPlayback
		)
		if (isPlaying) {
			logger.info(`Playout reports piece "${pieceId}" has stopped playback on timestamp ${(new Date(stoppedPlayback)).toISOString()}`)

			reportPieceHasStopped(segLineItem, stoppedPlayback)
		}
	}

	export function partPlaybackStartedCallback (rundownId: string, partId: string, startedPlayback: Time) {
		check(rundownId, String)
		check(partId, String)
		check(startedPlayback, Number)

		// This method is called when a part starts playing (like when an auto-next event occurs, or a manual next)

		let playingPart = Parts.findOne({
			_id: partId,
			rundownId: rundownId
		})

		if (playingPart) {
			// make sure we don't run multiple times, even if TSR calls us multiple times

			const isPlaying = (
				playingPart.startedPlayback &&
				!playingPart.stoppedPlayback
			)
			if (!isPlaying) {
				logger.info(`Playout reports part "${partId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

				let rundown = Rundowns.findOne(rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
				if (!rundown.active) throw new Meteor.Error(501, `Rundown "${rundownId}" is not active!`)

				let currentPart = (rundown.currentPartId ?
					Parts.findOne(rundown.currentPartId)
					: null
				)

				if (rundown.currentPartId === partId) {
					// this is the current part, it has just started playback
					if (rundown.previousPartId) {
						let prevSegLine = Parts.findOne(rundown.previousPartId)

						if (!prevSegLine) {
							// We couldn't find the previous part: this is not a critical issue, but is clearly is a symptom of a larger issue
							logger.error(`Previous part "${rundown.previousPartId}" on rundown "${rundownId}" could not be found.`)
						} else if (!prevSegLine.duration) {
							partStoppedPlaying(rundownId, prevSegLine, startedPlayback)
						}
					}

					setRundownStartedPlayback(rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played
				} else if (rundown.nextPartId === partId) {
					// this is the next part, clearly an autoNext has taken place
					if (rundown.currentPartId) {
						// let currentPart = Parts.findOne(rundown.currentPartId)

						if (!currentPart) {
							// We couldn't find the previous part: this is not a critical issue, but is clearly is a symptom of a larger issue
							logger.error(`Previous part "${rundown.currentPartId}" on rundown "${rundownId}" could not be found.`)
						} else if (!currentPart.duration) {
							partStoppedPlaying(rundownId, currentPart, startedPlayback)
						}
					}

					setRundownStartedPlayback(rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

					let partsAfter = rundown.getParts({
						_rank: {
							$gt: playingPart._rank,
						},
						_id: { $ne: playingPart._id }
					})

					let nextPart: Part | null = _.first(partsAfter) || null

					const rundownChange = {
						previousPartId: rundown.currentPartId,
						currentPartId: playingPart._id,
						holdState: RundownHoldState.NONE,
					}

					Rundowns.update(rundown._id, {
						$set: rundownChange
					})
					rundown = _.extend(rundown, rundownChange) as Rundown

					setNextPart(rundown, nextPart)
				} else {
					// a part is being played that has not been selected for playback by Core
					// show must go on, so find next part and update the Rundown, but log an error
					let partsAfter = rundown.getParts({
						_rank: {
							$gt: playingPart._rank,
						},
						_id: { $ne: playingPart._id }
					})

					let nextPart: Part | null = partsAfter[0] || null

					setRundownStartedPlayback(rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

					const rundownChange = {
						previousPartId: null,
						currentPartId: playingPart._id,
					}

					Rundowns.update(rundown._id, {
						$set: rundownChange
					})
					rundown = _.extend(rundown, rundownChange) as Rundown
					setNextPart(rundown, nextPart)

					logger.error(`Part "${playingPart._id}" has started playback by the playout gateway, but has not been selected for playback!`)
				}

				reportPartHasStarted(playingPart, startedPlayback)

				afterTake(rundown, playingPart, currentPart || null)
			}
		} else {
			throw new Meteor.Error(404, `Part "${partId}" in rundown "${rundownId}" not found!`)
		}
	}
	export function partPlaybackStoppedCallback (rundownId: string, partId: string, stoppedPlayback: Time) {
		check(rundownId, String)
		check(partId, String)
		check(stoppedPlayback, Number)

		// This method is called when a part stops playing (like when an auto-next event occurs, or a manual next)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		let part = Parts.findOne({
			_id: partId,
			rundownId: rundownId
		})

		if (part) {
			// make sure we don't run multiple times, even if TSR calls us multiple times

			const isPlaying = (
				part.startedPlayback &&
				!part.stoppedPlayback
			)
			if (isPlaying) {
				logger.info(`Playout reports part "${partId}" has stopped playback on timestamp ${(new Date(stoppedPlayback)).toISOString()}`)

				reportPartHasStopped(part, stoppedPlayback)
			}
		} else {
			throw new Meteor.Error(404, `Part "${partId}" in rundown "${rundownId}" not found!`)
		}
	}
	export const pieceTakeNow = function pieceTakeNow (rundownId: string, partId: string, pieceId: string) {
		check(rundownId, String)
		check(partId, String)
		check(pieceId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(403, `Part Ad Lib Items can be only placed in an active rundown!`)

		let piece = Pieces.findOne({
			_id: pieceId,
			rundownId: rundownId
		}) as Piece
		if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" not found!`)

		let part = Parts.findOne({
			_id: partId,
			rundownId: rundownId
		})
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
		if (rundown.currentPartId !== part._id) throw new Meteor.Error(403, `Part Ad Lib Items can be only placed in a current part!`)

		let showStyleBase = rundown.getShowStyleBase()
		const sourceL = showStyleBase.sourceLayers.find(i => i._id === piece.sourceLayerId)
		if (sourceL && sourceL.type !== SourceLayerType.GRAPHICS) throw new Meteor.Error(403, `Piece "${pieceId}" is not a GRAPHICS item!`)

		let newPiece = convertAdLibToSLineItem(piece, part, false)
		if (newPiece.content && newPiece.content.timelineObjects) {
			newPiece.content.timelineObjects = prefixAllObjectIds(
				_.compact(
					_.map(newPiece.content.timelineObjects, (obj) => {
						return extendMandadory<TimelineObjectCoreExt, TimelineObjGeneric>(obj, {
							// @ts-ignore _id
							_id: obj.id || obj._id,
							siId: '', // set later
							objectType: TimelineObjType.RUNDOWN
						})
					})
				),
				newPiece._id
			)
		}

		// disable the original piece if from the same SL
		if (piece.partId === part._id) {
			const pieces = getResolvedPieces(part)
			const resPiece = pieces.find(item => item._id === piece._id)

			if (piece.startedPlayback && piece.startedPlayback <= getCurrentTime()) {
				if (resPiece && resPiece.duration !== undefined && (piece.infiniteMode || piece.startedPlayback + resPiece.duration >= getCurrentTime())) {
					// logger.debug(`Piece "${piece._id}" is currently live and cannot be used as an ad-lib`)
					throw new Meteor.Error(409, `Piece "${piece._id}" is currently live and cannot be used as an ad-lib`)
				}
			}

			Pieces.update(piece._id, {$set: {
				disabled: true,
				hidden: true
			}})
		}
		Pieces.insert(newPiece)

		cropInfinitesOnLayer(rundown, part, newPiece)
		stopInfinitesRunningOnLayer(rundown, part, newPiece.sourceLayerId)
		updateTimeline(rundown.studioId)
	}
	export const segmentAdLibLineItemStart = syncFunction(function segmentAdLibLineItemStart (rundownId: string, partId: string, slaiId: string, queue: boolean) {
		check(rundownId, String)
		check(partId, String)
		check(slaiId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(403, `Part Ad Lib Items can be only placed in an active rundown!`)
		if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
			throw new Meteor.Error(403, `Part Ad Lib Items can not be used in combination with hold!`)
		}
		let adLibItem = AdLibPieces.findOne({
			_id: slaiId,
			rundownId: rundownId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Part Ad Lib Item "${slaiId}" not found!`)
		if (adLibItem.invalid) throw new Meteor.Error(404, `Cannot take invalid Part Ad Lib Item "${slaiId}"!`)

		if (!queue && rundown.currentPartId !== partId) throw new Meteor.Error(403, `Part Ad Lib Items can be only placed in a current part!`)

		let orgSlId = partId
		if (queue) {
			// insert a NEW, adlibbed part after this part
			partId = adlibQueueInsertPart (rundown, partId, adLibItem )
		}
		let part = Parts.findOne({
			_id: partId,
			rundownId: rundownId
		})
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
		if (!queue && rundown.currentPartId !== part._id) throw new Meteor.Error(403, `Part Ad Lib Items can be only placed in a current part!`)
		let newPiece = convertAdLibToSLineItem(adLibItem, part, queue)
		Pieces.insert(newPiece)

		// logger.debug('adLibItemStart', newPiece)
		if (queue) {
			// keep infinite sLineItems
			Pieces.find({ rundownId: rundownId, partId: orgSlId }).forEach(piece => {
				if (piece.infiniteMode && piece.infiniteMode >= PieceLifespan.Infinite) {
					let newPiece = convertAdLibToSLineItem(piece, part!, queue)
					Pieces.insert(newPiece)
				}
			})

			ServerPlayoutAPI.rundownSetNext(rundown._id, partId)
		} else {
			cropInfinitesOnLayer(rundown, part, newPiece)
			stopInfinitesRunningOnLayer(rundown, part, newPiece.sourceLayerId)
			updateTimeline(rundown.studioId)
		}
	})
	export const rundownBaselineAdLibPieceStart = syncFunction(function rundownBaselineAdLibPieceStart (rundownId: string, partId: string, robaliId: string, queue: boolean) {
		check(rundownId, String)
		check(partId, String)
		check(robaliId, String)
		logger.debug('rundownBaselineAdLibPieceStart')

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(403, `Rundown Baseline Ad Lib Items can be only placed in an active rundown!`)
		if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
			throw new Meteor.Error(403, `Part Ad Lib Items can not be used in combination with hold!`)
		}

		let adLibItem = RundownBaselineAdLibPieces.findOne({
			_id: robaliId,
			rundownId: rundownId
		})
		if (!adLibItem) throw new Meteor.Error(404, `Rundown Baseline Ad Lib Item "${robaliId}" not found!`)
		let orgSlId = partId
		if (queue) {
			// insert a NEW, adlibbed part after this part
			partId = adlibQueueInsertPart (rundown, partId, adLibItem )
		}

		let part = Parts.findOne({
			_id: partId,
			rundownId: rundownId
		})
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
		if (!queue && rundown.currentPartId !== part._id) throw new Meteor.Error(403, `Rundown Baseline Ad Lib Items can be only placed in a current part!`)

		let newPiece = convertAdLibToSLineItem(adLibItem, part, queue)
		Pieces.insert(newPiece)
		// logger.debug('adLibItemStart', newPiece)

		if (queue) {
			// keep infinite sLineItems
			Pieces.find({ rundownId: rundownId, partId: orgSlId }).forEach(piece => {
				console.log(piece.name + ' has life span of ' + piece.infiniteMode)
				if (piece.infiniteMode && piece.infiniteMode >= PieceLifespan.Infinite) {
					let newPiece = convertAdLibToSLineItem(piece, part!, queue)
					Pieces.insert(newPiece)
				}
			})

			ServerPlayoutAPI.rundownSetNext(rundown._id, partId)
		} else {
			cropInfinitesOnLayer(rundown, part, newPiece)
			stopInfinitesRunningOnLayer(rundown, part, newPiece.sourceLayerId)
			updateTimeline(rundown.studioId)
		}
	})
	export function adlibQueueInsertPart (rundown: Rundown, partId: string, sladli: AdLibPiece) {

		// let parts = rundown.getParts()
		logger.info('adlibQueueInsertPart')

		let part = Parts.findOne(partId)
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

		// let nextPart = fetchAfter(Parts, {
		// 	rundownId: rundown._id
		// }, part._rank)

		// let newRank = getRank(part, nextPart, 0, 1)

		let newPartId = Random.id()
		Parts.insert({
			_id: newPartId,
			_rank: 99999, // something high, so it will be placed last
			externalId: '',
			segmentId: part.segmentId,
			rundownId: rundown._id,
			title: sladli.name,
			dynamicallyInserted: true,
			afterPart: part._id,
			typeVariant: 'adlib'
		})

		updateParts(rundown._id) // place in order

		return newPartId

	}
	export function segmentAdLibLineItemStop (rundownId: string, partId: string, pieceId: string) {
		check(rundownId, String)
		check(partId, String)
		check(pieceId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		let part = Parts.findOne({
			_id: partId,
			rundownId: rundownId
		})
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
		let alCopyItem = Pieces.findOne({
			_id: pieceId,
			rundownId: rundownId
		})
		// To establish playback time, we need to look at the actual Timeline
		let alCopyItemTObj = Timeline.findOne({
			_id: getPieceGroupId(pieceId)
		})
		let parentOffset = 0
		if (!alCopyItem) throw new Meteor.Error(404, `Part Ad Lib Copy Item "${pieceId}" not found!`)
		if (!alCopyItemTObj) throw new Meteor.Error(404, `Part Ad Lib Copy Item "${pieceId}" not found in the playout Timeline!`)
		if (!rundown.active) throw new Meteor.Error(403, `Part Ad Lib Copy Items can be only manipulated in an active rundown!`)
		if (rundown.currentPartId !== part._id) throw new Meteor.Error(403, `Part Ad Lib Copy Items can be only manipulated in a current part!`)
		if (!alCopyItem.dynamicallyInserted) throw new Meteor.Error(501, `"${pieceId}" does not appear to be a dynamic Piece!`)
		if (!alCopyItem.adLibSourceId) throw new Meteor.Error(501, `"${pieceId}" does not appear to be a Part Ad Lib Copy Item!`)

		// The ad-lib item positioning will be relative to the startedPlayback of the part
		if (part.startedPlayback) {
			parentOffset = part.getLastStartedPlayback() || parentOffset
		}

		let newExpectedDuration = 1 // smallest, non-zerundown duration
		if (alCopyItemTObj.trigger.type === TriggerType.TIME_ABSOLUTE && _.isNumber(alCopyItemTObj.trigger.value)) {
			const actualStartTime = parentOffset + alCopyItemTObj.trigger.value
			newExpectedDuration = getCurrentTime() - actualStartTime
		} else {
			logger.warn(`"${pieceId}" timeline object is not positioned absolutely or is still set to play now, assuming it's about to be played.`)
		}

		Pieces.update({
			_id: pieceId
		}, {
			$set: {
				duration: newExpectedDuration
			}
		})

		updateTimeline(rundown.studioId)
	}
	export const sourceLayerStickyItemStart = syncFunction(function sourceLayerStickyItemStart (rundownId: string, sourceLayerId: string) {
		check(rundownId, String)
		check(sourceLayerId, String)

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
		if (!rundown.currentPartId) throw new Meteor.Error(400, `A part needs to be active to place a sticky item`)

		let showStyleBase = rundown.getShowStyleBase()

		const sourceLayer = showStyleBase.sourceLayers.find(i => i._id === sourceLayerId)
		if (!sourceLayer) throw new Meteor.Error(404, `Source layer "${sourceLayerId}" not found!`)
		if (!sourceLayer.isSticky) throw new Meteor.Error(400, `Only sticky layers can be restarted. "${sourceLayerId}" is not sticky.`)

		const lastPieces = Pieces.find({
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

		if (lastPieces.length > 0) {
			const currentPart = Parts.findOne(rundown.currentPartId)
			if (!currentPart) throw new Meteor.Error(501, `Current Part "${rundown.currentPartId}" could not be found.`)

			const lastItem = convertSLineToAdLibItem(lastPieces[0])
			const newAdLibPiece = convertAdLibToSLineItem(lastItem, currentPart, false)

			Pieces.insert(newAdLibPiece)

			// logger.debug('adLibItemStart', newPiece)

			cropInfinitesOnLayer(rundown, currentPart, newAdLibPiece)
			stopInfinitesRunningOnLayer(rundown, currentPart, newAdLibPiece.sourceLayerId)

			updateTimeline(rundown.studioId)
		}
	})
	export function sourceLayerOnLineStop (rundownId: string, partId: string, sourceLayerId: string) {
		check(rundownId, String)
		check(partId, String)
		check(sourceLayerId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (!rundown.active) throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
		let part = Parts.findOne({
			_id: partId,
			rundownId: rundownId
		})
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
		if (rundown.currentPartId !== part._id) throw new Meteor.Error(403, `Pieces can be only manipulated in a current part!`)
		if (!part.getLastStartedPlayback()) throw new Meteor.Error(405, `Part "${partId}" has yet to start playback!`)

		const now = getCurrentTime()
		const relativeNow = now - (part.getLastStartedPlayback() || 0)
		const orderedItems = getResolvedPieces(part)

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

				if (i.infiniteId && i.infiniteId !== i._id && part) {
					let segLineStarted = part.getLastStartedPlayback()
					if (segLineStarted) {
						newExpectedDuration = now - segLineStarted
					}
				} else if (i.startedPlayback && (i.trigger.value < relativeNow) && (((i.trigger.value as number) + (i.duration || 0) > relativeNow) || i.duration === 0)) {
					newExpectedDuration = now - i.startedPlayback
				}

				if (newExpectedDuration !== undefined) {
					console.log(`Cropping item "${i._id}" at ${newExpectedDuration}`)

					Pieces.update({
						_id: i._id
					}, {
						$set: {
							durationOverride: newExpectedDuration
						}
					})
				}
			}
		})

		updateSourceLayerInfinitesAfterLine(rundown, part)

		updateTimeline(rundown.studioId)
	}
	export const rundownTogglePartArgument = syncFunction(function rundownTogglePartArgument (rundownId: string, partId: string, property: string, value: string) {
		check(rundownId, String)
		check(partId, String)

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (rundown.holdState === RundownHoldState.ACTIVE || rundown.holdState === RundownHoldState.PENDING) {
			throw new Meteor.Error(403, `Part Arguments can not be toggled when hold is used!`)
		}

		let part = Parts.findOne(partId)
		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

		const rArguments = part.runtimeArguments || {}

		if (rArguments[property] === value) {
			// unset property
			const mUnset: any = {}
			mUnset['runtimeArguments.' + property] = 1
			Parts.update(part._id, {$unset: mUnset, $set: {
				dirty: true
			}})
		} else {
			// set property
			const mSet: any = {}
			mSet['runtimeArguments.' + property] = value
			mSet.dirty = true
			Parts.update(part._id, {$set: mSet})
		}

		part = Parts.findOne(partId)

		if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

		refreshPart(rundown, part)

		// Only take time to update the timeline if there's a point to do it
		if (rundown.active) {
			// If this part is rundown's next, check if current part has autoNext
			if ((rundown.nextPartId === part._id) && rundown.currentPartId) {
				const currentPart = Parts.findOne(rundown.currentPartId)
				if (currentPart && currentPart.autoNext) {
					updateTimeline(rundown.studioId)
				}
			// If this is rundown's current SL, update immediately
			} else if (rundown.currentPartId === part._id) {
				updateTimeline(rundown.studioId)
			}
		}
		return ClientAPI.responseSuccess()
	})
	export function timelineTriggerTimeUpdateCallback (timelineObjId: string, time: number) {
		check(timelineObjId, String)
		check(time, Number)

		let tObj = Timeline.findOne(timelineObjId)
		if (!tObj) throw new Meteor.Error(404, `Timeline obj "${timelineObjId}" not found!`)

		if (tObj.metadata && tObj.metadata.pieceId) {
			logger.debug('Update piece: ', tObj.metadata.pieceId, (new Date(time)).toTimeString())
			Pieces.update({
				_id: tObj.metadata.pieceId
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
			studioId: studioId,
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

		const studio = Studios.findOne(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)

		const activateRundownCount = Rundowns.find({
			studioId: studio._id,
			active: true
		}).count()
		if (activateRundownCount === 0) {
			const markerId = `${studio._id}_baseline_version`
			const markerObject = Timeline.findOne(markerId)
			if (!markerObject) return 'noBaseline'

			const versionsContent = markerObject.content.versions || {}

			if (versionsContent.core !== PackageInfo.version) return 'coreVersion'

			if (versionsContent.studio !== (studio._rundownVersionHash || 0)) return 'studio'

			if (versionsContent.blueprintId !== studio.blueprintId) return 'blueprintId'
			if (studio.blueprintId) {
				const blueprint = Blueprints.findOne(studio.blueprintId)
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
methods[PlayoutAPI.methods.pieceTakeNow] = (rundownId: string, partId: string, pieceId: string) => {
	return ServerPlayoutAPI.pieceTakeNow(rundownId, partId, pieceId)
}
methods[PlayoutAPI.methods.rundownTake] = (rundownId: string) => {
	return ServerPlayoutAPI.rundownTake(rundownId)
}
methods[PlayoutAPI.methods.rundownTogglePartArgument] = (rundownId: string, partId: string, property: string, value: string) => {
	return ServerPlayoutAPI.rundownTogglePartArgument(rundownId, partId, property, value)
}
methods[PlayoutAPI.methods.rundownSetNext] = (rundownId: string, partId: string, timeOffset?: number | undefined) => {
	return ServerPlayoutAPI.rundownSetNext(rundownId, partId, true, timeOffset)
}
methods[PlayoutAPI.methods.rundownActivateHold] = (rundownId: string) => {
	return ServerPlayoutAPI.rundownActivateHold(rundownId)
}
methods[PlayoutAPI.methods.rundownStoriesMoved] = (rundownId: string, onAirNextWindowWidth: number | undefined, nextPosition: number | undefined) => {
	return ServerPlayoutAPI.rundownStoriesMoved(rundownId, onAirNextWindowWidth, nextPosition)
}
methods[PlayoutAPI.methods.rundownDisableNextPiece] = (rundownId: string, undo?: boolean) => {
	return ServerPlayoutAPI.rundownDisableNextPiece(rundownId, undo)
}
methods[PlayoutAPI.methods.partPlaybackStartedCallback] = (rundownId: string, partId: string, startedPlayback: number) => {
	return ServerPlayoutAPI.partPlaybackStartedCallback(rundownId, partId, startedPlayback)
}
methods[PlayoutAPI.methods.piecePlaybackStartedCallback] = (rundownId: string, pieceId: string, startedPlayback: number) => {
	return ServerPlayoutAPI.piecePlaybackStartedCallback(rundownId, pieceId, startedPlayback)
}
methods[PlayoutAPI.methods.segmentAdLibLineItemStart] = (rundownId: string, partId: string, salliId: string, queue: boolean) => {
	return ServerPlayoutAPI.segmentAdLibLineItemStart(rundownId, partId, salliId, queue)
}
methods[PlayoutAPI.methods.rundownBaselineAdLibPieceStart] = (rundownId: string, partId: string, robaliId: string, queue: boolean) => {
	return ServerPlayoutAPI.rundownBaselineAdLibPieceStart(rundownId, partId, robaliId, queue)
}
methods[PlayoutAPI.methods.segmentAdLibLineItemStop] = (rundownId: string, partId: string, pieceId: string) => {
	return ServerPlayoutAPI.segmentAdLibLineItemStop(rundownId, partId, pieceId)
}
methods[PlayoutAPI.methods.sourceLayerOnLineStop] = (rundownId: string, partId: string, sourceLayerId: string) => {
	return ServerPlayoutAPI.sourceLayerOnLineStop(rundownId, partId, sourceLayerId)
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

function beforeTake (rundownData: RundownData, currentPart: Part | null, nextPart: Part) {
	if (currentPart) {
		const adjacentSL = _.find(rundownData.parts, (part) => {
			return (
				part.segmentId === currentPart.segmentId &&
				part._rank > currentPart._rank
			)
		})
		if (!adjacentSL || adjacentSL._id !== nextPart._id) {
			// adjacent Part isn't the next part, do not overflow
			return
		}
		let ps: Array<Promise<any>> = []
		const currentSLIs = currentPart.getAllPieces()
		currentSLIs.forEach((item) => {
			if (item.overflows && typeof item.expectedDuration === 'number' && item.expectedDuration > 0 && item.duration === undefined && item.durationOverride === undefined) {
				// Clone an overflowing piece
				let overflowedItem = _.extend({
					_id: Random.id(),
					partId: nextPart._id,
					trigger: {
						type: TriggerType.TIME_ABSOLUTE,
						value: 0
					},
					dynamicallyInserted: true,
					continuesRefId: item._id,

					// Subtract the amount played from the expected duration
					expectedDuration: Math.max(0, item.expectedDuration - ((item.startedPlayback || currentPart.getLastStartedPlayback() || getCurrentTime()) - getCurrentTime()))
				}, _.omit(clone(item) as Piece, 'startedPlayback', 'duration', 'overflows'))

				if (overflowedItem.expectedDuration > 0) {
					ps.push(asyncCollectionInsert(Pieces, overflowedItem))
					rundownData.pieces.push(overflowedItem) // update the cache
				}
			}
		})
		waitForPromiseAll(ps)
	}
}

function afterTake (
	rundown: Rundown,
	takePart: Part,
	previousPart: Part | null,
	timeOffset: number | null = null
) {
	// This function should be called at the end of a "take" event (when the Parts have been updated)

	let forceNowTime: number | undefined = undefined
	if (timeOffset) {
		forceNowTime = getCurrentTime() - timeOffset
	}
	// or after a new part has started playing
	updateTimeline(rundown.studioId, forceNowTime)

	// defer these so that the playout gateway has the chance to learn about the changes
	Meteor.setTimeout(() => {
		if (takePart.updateStoryStatus) {
			sendStoryStatus(rundown, takePart)
		}
	}, 40)
}

function getResolvedPieces (line: Part): Piece[] {
	const items = line.getAllPieces()

	const itemMap: { [key: string]: Piece } = {}
	items.forEach(i => itemMap[i._id] = i)

	const objs = items.map(i => clone(createPieceGroup(i, i.durationOverride || i.duration || i.expectedDuration || 0)))
	objs.forEach(o => {
		if (o.trigger.type === TriggerType.TIME_ABSOLUTE && (o.trigger.value === 0 || o.trigger.value === 'now')) {
			o.trigger.value = 1
		}
	})
	const events = Resolver.getTimelineInWindow(transformTimeline(objs))

	let eventMap = events.resolved.map(e => {
		const id = ((e as any || {}).metadata || {}).pieceId
		return {
			start: e.resolved.startTime || 0,
			end: e.resolved.endTime || 0,
			id: id,
			item: itemMap[id]
		}
	})
	events.unresolved.forEach(e => {
		const id = ((e as any || {}).metadata || {}).pieceId
		eventMap.push({
			start: 0,
			end: 0,
			id: id,
			item: itemMap[id]
		})
	})
	if (events.unresolved.length > 0) {
		logger.warn('got ' + events.unresolved.length + ' unresolved items for piece #' + line._id)
	}
	if (items.length !== eventMap.length) {
		logger.warn('got ' + eventMap.length + ' ordered items. expected ' + items.length + '. for piece #' + line._id)
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
	}) as Piece)

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
interface PieceResolved extends Piece {
	/** Resolved start time of the piece */
	resolvedStart: number
	/** Whether the piece was successfully resolved */
	resolved: boolean
}
function getOrderedPiece (line: Part): Array<PieceResolved> {
	const items = line.getAllPieces()

	const itemMap: { [key: string]: Piece } = {}
	items.forEach(i => itemMap[i._id] = i)

	const objs: Array<TimelineObjRundown> = items.map(
		i => clone(createPieceGroup(i, i.durationOverride || i.duration || i.expectedDuration || 0))
	)
	objs.forEach(o => {
		if (o.trigger.type === TriggerType.TIME_ABSOLUTE && (o.trigger.value === 0 || o.trigger.value === 'now')) {
			o.trigger.value = 100
		}
	})
	const tlResolved = Resolver.getTimelineInWindow(transformTimeline(objs))

	let resolvedItems: Array<PieceResolved> = []
	_.each(tlResolved.resolved, e => {
		const id = ((e as any || {}).metadata || {}).pieceId
		let item = _.clone(itemMap[id]) as PieceResolved
		item.resolvedStart = e.resolved.startTime || 0
		item.resolved = true
		resolvedItems.push(item)
	})
	_.each(tlResolved.unresolved, e => {
		const id = ((e as any || {}).metadata || {}).pieceId

		let item = _.clone(itemMap[id]) as PieceResolved
		item.resolvedStart = 0
		item.resolved = false

		resolvedItems.push(item)
	})
	if (tlResolved.unresolved.length > 0) {
		 logger.warn('got ' + tlResolved.unresolved.length + ' unresolved items for piece #' + line._id)
	}
	if (items.length !== resolvedItems.length) {
		logger.warn('got ' + resolvedItems.length + ' ordered items. expected ' + items.length + '. for piece #' + line._id)
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

export const updateSourceLayerInfinitesAfterLine: (rundown: Rundown, previousLine?: Part, runUntilEnd?: boolean) => void
 = syncFunctionIgnore(updateSourceLayerInfinitesAfterLineInner)
export function updateSourceLayerInfinitesAfterLineInner (rundown: Rundown, previousLine?: Part, runUntilEnd?: boolean): string {
	let activeInfiniteItems: { [layer: string]: Piece } = {}
	let activeInfiniteItemsSegmentId: { [layer: string]: string } = {}

	if (previousLine === undefined) {
		// If running from start (no previousLine), then always run to the end
		runUntilEnd = true
	}

	if (previousLine) {
		let ps: Array<Promise<any>> = []
		// figure out the baseline to set
		let prevItems = getOrderedPiece(previousLine)
		_.each(prevItems, item => {
			if (!item.infiniteMode || item.duration || item.durationOverride || item.expectedDuration) {
				delete activeInfiniteItems[item.sourceLayerId]
				delete activeInfiniteItemsSegmentId[item.sourceLayerId]
			} else {
				if (!item.infiniteId) {
					// ensure infinite id is set
					item.infiniteId = item._id
					ps.push(
						asyncCollectionUpdate(Pieces, item._id, {
							$set: { infiniteId: item.infiniteId }
						})
					)
					logger.debug(`updateSourceLayerInfinitesAfterLine: marked "${item._id}" as start of infinite`)
				}
				if (item.infiniteMode !== PieceLifespan.OutOnNextPart) {
					activeInfiniteItems[item.sourceLayerId] = item
					activeInfiniteItemsSegmentId[item.sourceLayerId] = previousLine.segmentId
				}
			}
		})
		waitForPromiseAll(ps)
	}

	let partsToProcess = rundown.getParts()
	if (previousLine) {
		partsToProcess = partsToProcess.filter(l => l._rank > previousLine._rank)
	}

	// Prepare pieces:
	let psPopulateCache: Array<Promise<any>> = []
	const currentItemsCache: {[partId: string]: PieceResolved[]} = {}
	_.each(partsToProcess, (part) => {
		psPopulateCache.push(new Promise((resolve, reject) => {
			try {
				let currentItems = getOrderedPiece(part)

				currentItemsCache[part._id] = currentItems
				resolve()
			} catch (e) {
				reject(e)
			}
		}))
	})
	waitForPromiseAll(psPopulateCache)

	let ps: Array<Promise<any>> = []
	for (let part of partsToProcess) {
		// Drop any that relate only to previous segments
		for (let k in activeInfiniteItemsSegmentId) {
			let s = activeInfiniteItemsSegmentId[k]
			let i = activeInfiniteItems[k]
			if (!i.infiniteMode || i.infiniteMode === PieceLifespan.OutOnNextSegment && s !== part.segmentId) {
				delete activeInfiniteItems[k]
				delete activeInfiniteItemsSegmentId[k]
			}
		}

		// ensure any currently defined infinites are still wanted
		// let currentItems = getOrderedPiece(part)
		let currentItems = currentItemsCache[part._id]
		if (!currentItems) throw new Meteor.Error(500, `currentItemsCache didn't contain "${part._id}", which it should have`)

		let currentInfinites = currentItems.filter(i => i.infiniteId && i.infiniteId !== i._id)
		let removedInfinites: string[] = []

		for (let piece of currentInfinites) {
			const active = activeInfiniteItems[piece.sourceLayerId]
			if (!active || active.infiniteId !== piece.infiniteId) {
				// Previous item no longer enforces the existence of this one
				ps.push(asyncCollectionRemove(Pieces, piece._id))

				removedInfinites.push(piece._id)
				logger.debug(`updateSourceLayerInfinitesAfterLine: removed old infinite "${piece._id}" from "${piece.partId}"`)
			}
		}

		// stop if not running to the end and there is/was nothing active
		const midInfinites = currentInfinites.filter(i => !i.expectedDuration && i.infiniteMode)
		if (!runUntilEnd && Object.keys(activeInfiniteItemsSegmentId).length === 0 && midInfinites.length === 0) {
			// TODO - this guard is useless, as all shows have klokke and logo as infinites throughout...
			// This should instead do a check after each iteration to check if anything changed (even fields such as name on the piece)
			// If nothing changed, then it is safe to assume that it doesnt need to go further
			return part._id
		}

		// figure out what infinites are to be extended
		currentItems = currentItems.filter(i => removedInfinites.indexOf(i._id) < 0)
		let oldInfiniteContinuation: string[] = []
		let newInfiniteContinations: Piece[] = []
		for (let k in activeInfiniteItems) {
			let newItem: Piece = activeInfiniteItems[k]

			let existingItem: PieceResolved | undefined = undefined
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

					const lastExistingItem = _.last(existingItems) as PieceResolved
					const firstExistingItem = _.first(existingItems) as PieceResolved
					// if we matched with an infinite, then make sure that infinite is kept going
					if (lastExistingItem.infiniteMode && lastExistingItem.infiniteMode !== PieceLifespan.OutOnNextPart) {
						activeInfiniteItems[k] = existingItems[0]
						activeInfiniteItemsSegmentId[k] = part.segmentId
					}

					// If something starts at the beginning, then dont bother adding this infinite.
					// Otherwise we should add the infinite but set it to end at the start of the first item
					if (firstExistingItem.trigger.type === TriggerType.TIME_ABSOLUTE && firstExistingItem.trigger.value === 0) {
						// skip the infinite, as it will never show
						allowInsert = false
					}
				}
			}
			newItem.partId = part._id
			newItem.continuesRefId = newItem._id
			newItem.trigger = {
				type: TriggerType.TIME_ABSOLUTE,
				value: 0
			}
			newItem._id = newItem.infiniteId + '_' + part._id
			newItem.startedPlayback = undefined
			newItem.stoppedPlayback = undefined
			newItem.timings = undefined

			if (existingItems && existingItems.length) {
				newItem.expectedDuration = `#${getPieceGroupId(existingItems[0])}.start - #.start`
				newItem.infiniteMode = PieceLifespan.Normal // it is no longer infinite, and the ui needs this to draw properly
			}

			if (existingItem) { // Some properties need to be persisted
				newItem.durationOverride = existingItem.durationOverride
				newItem.startedPlayback = existingItem.startedPlayback
				newItem.stoppedPlayback = existingItem.stoppedPlayback
				newItem.timings = existingItem.timings
			}

			let itemToInsert: Piece | null = (allowInsert ? newItem : null)
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
				ps.push(asyncCollectionUpdate(Pieces, itemToInsert._id, itemToInsert))// note; not a $set, because we want to replace the object
				logger.debug(`updateSourceLayerInfinitesAfterLine: updated infinite continuation "${itemToInsert._id}"`)
			} else {
				if (existingItem) {
					ps.push(asyncCollectionRemove(Pieces, existingItem._id))
				}
				if (itemToInsert) {
					ps.push(asyncCollectionInsert(Pieces, itemToInsert))
					logger.debug(`updateSourceLayerInfinitesAfterLine: inserted infinite continuation "${itemToInsert._id}"`)
				}
			}
		}

		// find any new infinites exposed by this
		currentItems = currentItems.filter(i => oldInfiniteContinuation.indexOf(i._id) < 0)
		for (let piece of newInfiniteContinations.concat(currentItems)) {
			if (
				!piece.infiniteMode ||
				piece.duration ||
				piece.durationOverride ||
				piece.expectedDuration
			) {
				delete activeInfiniteItems[piece.sourceLayerId]
				delete activeInfiniteItemsSegmentId[piece.sourceLayerId]
			} else if (piece.infiniteMode !== PieceLifespan.OutOnNextPart) {
				if (!piece.infiniteId) {
					// ensure infinite id is set
					piece.infiniteId = piece._id
					ps.push(asyncCollectionUpdate(Pieces, piece._id, { $set: {
						infiniteId: piece.infiniteId }
					}))
					logger.debug(`updateSourceLayerInfinitesAfterLine: marked "${piece._id}" as start of infinite`)
				}

				activeInfiniteItems[piece.sourceLayerId] = piece
				activeInfiniteItemsSegmentId[piece.sourceLayerId] = part.segmentId
			}
		}
	}

	waitForPromiseAll(ps)
	return ''
}

const cropInfinitesOnLayer = syncFunction(function cropInfinitesOnLayer (rundown: Rundown, part: Part, newItem: Piece) {
	let showStyleBase = rundown.getShowStyleBase()
	const sourceLayerLookup = normalizeArray(showStyleBase.sourceLayers, '_id')
	const newItemExclusivityGroup = sourceLayerLookup[newItem.sourceLayerId].exclusiveGroup

	const items = part.getAllPieces().filter(i =>
		(i.sourceLayerId === newItem.sourceLayerId
			|| (newItemExclusivityGroup && sourceLayerLookup[i.sourceLayerId] && sourceLayerLookup[i.sourceLayerId].exclusiveGroup === newItemExclusivityGroup)
		) && i._id !== newItem._id && i.infiniteMode
	)

	let ps: Array<Promise<any>> = []
	for (const i of items) {
		ps.push(asyncCollectionUpdate(Pieces, i._id, { $set: {
			expectedDuration: `#${getPieceGroupId(newItem)}.start + ${newItem.adlibPreroll || 0} - #.start`,
			originalExpectedDuration: i.originalExpectedDuration !== undefined ? i.originalExpectedDuration : i.expectedDuration,
			infiniteMode: PieceLifespan.Normal,
			originalInfiniteMode: i.originalInfiniteMode !== undefined ? i.originalInfiniteMode : i.infiniteMode
		}}))
	}
	waitForPromiseAll(ps)
})

const stopInfinitesRunningOnLayer = syncFunction(function stopInfinitesRunningOnLayer (rundown: Rundown, part: Part, sourceLayer: string) {
	let remainingLines = rundown.getParts().filter(l => l._rank > part._rank)
	for (let line of remainingLines) {
		let continuations = line.getAllPieces().filter(i => i.infiniteMode && i.infiniteId && i.infiniteId !== i._id && i.sourceLayerId === sourceLayer)
		if (continuations.length === 0) {
			break
		}

		continuations.forEach(i => Pieces.remove(i))
	}

	// ensure adlib is extended correctly if infinite
	updateSourceLayerInfinitesAfterLine(rundown, part)
})

function convertSLineToAdLibItem (piece: Piece): AdLibPiece {
	// const oldId = piece._id
	const newId = Random.id()
	const newAdLibItem = literal<AdLibPiece>(_.extend(
		piece,
		{
			_id: newId,
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: 'now'
			},
			dynamicallyInserted: true,
			infiniteMode: piece.originalInfiniteMode !== undefined ? piece.originalInfiniteMode : piece.infiniteMode,
			expectedDuration: piece.originalExpectedDuration !== undefined ? piece.originalExpectedDuration : piece.expectedDuration || 0 // set duration to infinite if not set by AdLibItem
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

function convertAdLibToSLineItem (adLibItem: AdLibPiece | Piece, part: Part, queue: boolean): Piece {
	// const oldId = adLibItem._id
	const newId = Random.id()
	const newSLineItem = literal<Piece>(_.extend(
		_.clone(adLibItem),
		{
			_id: newId,
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: ( queue ? 0 : 'now')
			},
			partId: part._id,
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

function partStoppedPlaying (rundownId: string, part: Part, stoppedPlayingTime: Time) {
	const lastStartedPlayback = part.getLastStartedPlayback()
	if (part.startedPlayback && lastStartedPlayback && lastStartedPlayback > 0) {
		Parts.update(part._id, {
			$set: {
				duration: stoppedPlayingTime - lastStartedPlayback
			}
		})
		part.duration = stoppedPlayingTime - lastStartedPlayback
		pushOntoPath(part, 'timings.stoppedPlayback', stoppedPlayingTime)
	} else {
		// logger.warn(`Part "${part._id}" has never started playback on rundown "${rundownId}".`)
	}
}

function createPartGroup (part: Part, duration: number | string): TimelineObjGroupPart & TimelineObjRundown {
	let partGrp = literal<TimelineObjGroupPart & TimelineObjRundown>({
		_id: getPartGroupId(part),
		id: '',
		siId: '', // added later
		rundownId: part.rundownId,
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
		isPartGroup: true,
		// partId: part._id
	})

	return partGrp
}
function createPartGroupFirstObject (
	part: Part,
	partGroup: TimelineObjRundown,
	previousPart?: Part
): TimelineObjPartAbstract {
	return literal<TimelineObjPartAbstract>({
		_id: getPartFirstObjectId(part),
		id: '',
		siId: '', // added later
		rundownId: part.rundownId,
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
		inGroup: partGroup._id,
		partId: part._id,
		classes: (part.classes || []).concat(previousPart ? previousPart.classesForNext || [] : [])
	})
}
function createPieceGroupFirstObject (
	piece: Piece,
	pieceGroup: TimelineObjRundown,
	firstObjClasses?: string[]
): TimelineObjPieceAbstract {
	return literal<TimelineObjPieceAbstract>({
		_id: getPieceFirstObjectId(piece),
		id: '',
		siId: '', // added later
		rundownId: piece.rundownId,
		objectType: TimelineObjType.RUNDOWN,
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		duration: 0,
		LLayer: piece.sourceLayerId + '_firstobject',
		isAbstract: true,
		content: {
			type: TimelineContentTypeOther.NOTHING,
		},
		classes: firstObjClasses,
		inGroup: pieceGroup._id,
		pieceId: piece._id,
	})
}

function createPieceGroup (
	item: Piece,
	duration: number | string,
	partGroup?: TimelineObjRundown
): TimelineObjGroup & TimelineObjRundown {
	return literal<TimelineObjGroup & TimelineObjRundown>({
		_id: getPieceGroupId(item),
		id: '',
		content: {
			type: TimelineContentTypeOther.GROUP,
			objects: []
		},
		inGroup: partGroup && partGroup._id,
		isGroup: true,
		siId: '',
		rundownId: item.rundownId,
		objectType: TimelineObjType.RUNDOWN,
		trigger: item.trigger,
		duration: duration,
		LLayer: item.sourceLayerId,
		metadata: {
			pieceId: item._id
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

function transformPartIntoTimeline (
	rundown: Rundown,
	items: Piece[],
	firstObjClasses: string[],
	partGroup?: TimelineObjRundown,
	transitionProps?: TransformTransitionProps,
	holdState?: RundownHoldState,
	showHoldExcept?: boolean
): Array<TimelineObjRundown> {
	let timelineObjs: Array<TimelineObjRundown> = []

	const isHold = holdState === RundownHoldState.ACTIVE
	const allowTransition = transitionProps && transitionProps.allowed && !isHold && holdState !== RundownHoldState.COMPLETE
	const transition: Piece | undefined = allowTransition ? clone(items.find(i => !!i.isTransition)) : undefined
	const transitionPieceDelay = transitionProps ? Math.max(0, (transitionProps.preroll || 0) - (transitionProps.transitionPreroll || 0)) : 0
	const transitionContentsDelay = transitionProps ? (transitionProps.transitionPreroll || 0) - (transitionProps.preroll || 0) : 0

	_.each(clone(items), (item: Piece) => {
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
					item.trigger.value = `#${getPieceGroupId(transition)}.start ${transitionContentsDelayStr}`
				} else if (item.isTransition && transitionPieceDelay) {
					item.trigger.type = TriggerType.TIME_ABSOLUTE
					item.trigger.value = Math.max(0, transitionPieceDelay)
				}
			}

			// create a piece group for the items and then place all of them there
			const pieceGroup = createPieceGroup(item, item.durationOverride || item.duration || item.expectedDuration || 0, partGroup)
			timelineObjs.push(pieceGroup)

			if (!item.virtual) {
				timelineObjs.push(createPieceGroupFirstObject(item, pieceGroup, firstObjClasses))

				_.each(tos, (o: TimelineObjectCoreExt) => {
					if (o.holdMode) {
						if (isHold && !showHoldExcept && o.holdMode === TimelineObjHoldMode.EXCEPT) {
							return
						}
						if (!isHold && o.holdMode === TimelineObjHoldMode.ONLY) {
							return
						}
					}
					// if (partGroup) {
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
						inGroup: partGroup ? pieceGroup._id : undefined,
						rundownId: rundown._id,
						objectType: TimelineObjType.RUNDOWN
					}))
				})
			}
		}
	})
	return timelineObjs
}

export function getLookeaheadObjects (rundownData: RundownData, studio: Studio ): Array<TimelineObjGeneric> {
	const activeRundown = rundownData.rundown

	const currentPart = activeRundown.currentPartId ? rundownData.partsMap[activeRundown.currentPartId] : undefined

	const timelineObjs: Array<TimelineObjGeneric> = []
	_.each(studio.mappings || {}, (m, l) => {

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
			const finiteDuration = res[i].partId === activeRundown.currentPartId || (currentPart && currentPart.autoNext && res[i].partId === activeRundown.nextPartId)
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
	partId: string
}> {
	let activeRundown: Rundown = rundownData.rundown

	if (mode === undefined || mode === LookaheadMode.NONE) {
		return []
	}

	interface PartInfo {
		id: string
		segmentId: string
		line: Part
	}
	// find all slis that touch the layer
	const layerItems = _.filter(rundownData.pieces, (piece: Piece) => {
		return !!(
			piece.content &&
			piece.content.timelineObjects &&
			_.find(piece.content.timelineObjects, (o) => (o && o.LLayer === layer))
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
			return r ? [{ obj: r as TimelineObjRundown, partId: i.partId }] : []
		}

		return []
	}

	// have slis grouped by part, so we can look based on rank to choose the correct one
	const grouped: {[partId: string]: Piece[]} = {}
	layerItems.forEach(i => {
		if (!grouped[i.partId]) {
			grouped[i.partId] = []
		}

		grouped[i.partId].push(i)
	})

	let partsInfo: PartInfo[] | undefined
	let currentPos = 0
	let currentSegmentId: string | undefined

	if (!partsInfo) {
		// calculate ordered list of parts, which can be cached for other llayers
		const lines = rundownData.parts.map(l => ({ id: l._id, rank: l._rank, segmentId: l.segmentId, line: l }))
		lines.sort((a, b) => {
			if (a.rank < b.rank) {
				return -1
			}
			if (a.rank > b.rank) {
				return 1
			}
			return 0
		})

		const currentIndex = lines.findIndex(l => l.id === activeRundown.currentPartId)
		let res: PartInfo[] = []
		if (currentIndex >= 0) {
			res = res.concat(lines.slice(0, currentIndex + 1))
			currentSegmentId = res[res.length - 1].segmentId
			currentPos = currentIndex
		}

		const nextLine = activeRundown.nextPartId
			? lines.findIndex(l => l.id === activeRundown.nextPartId)
			: (currentIndex >= 0 ? currentIndex + 1 : -1)

		if (nextLine >= 0) {
			res = res.concat(...lines.slice(nextLine))
		}

		partsInfo = res.map(l => ({ id: l.id, segmentId: l.segmentId, line: l.line }))
	}

	if (partsInfo.length === 0) {
		return []
	}

	interface GroupedPieces {
		partId: string
		segmentId: string
		items: Piece[]
		line: Part
	}

	const orderedGroups: GroupedPieces[] = partsInfo.map(i => ({
		partId: i.id,
		segmentId: i.segmentId,
		line: i.line,
		items: grouped[i.id] || []
	}))

	// Start by taking the value from the current (if any), or search forwards
	let pieceGroup: GroupedPieces | undefined
	let pieceGroupIndex: number = -1
	for (let i = currentPos; i < orderedGroups.length; i++) {
		const v = orderedGroups[i]
		if (v.items.length > 0) {
			pieceGroup = v
			pieceGroupIndex = i
			break
		}
	}
	// If set to retain, then look backwards
	if (mode === LookaheadMode.RETAIN) {
		for (let i = currentPos - 1; i >= 0; i--) {
			const v = orderedGroups[i]

			// abort if we have a piece potential match is for another segment
			if (pieceGroup && v.segmentId !== currentSegmentId) {
				break
			}

			if (v.items.length > 0) {
				pieceGroup = v
				pieceGroupIndex = i
				break
			}
		}
	}

	if (!pieceGroup) {
		return []
	}

	let findObjectForPart = (): TimelineObjRundown[] => {
		if (!pieceGroup || pieceGroup.items.length === 0) {
			return []
		}

		let rawObjs: (TimelineObjRundown | null)[] = []
		pieceGroup.items.forEach(i => {
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
			if (pieceGroup.line) {
				const orderedItems = getOrderedPiece(pieceGroup.line)

				let allowTransition = false
				if (pieceGroupIndex >= 1 && activeRundown.currentPartId) {
					const prevPieceGroup = orderedGroups[pieceGroupIndex - 1]
					allowTransition = !prevPieceGroup.line.disableOutTransition
				}

				const transObj = orderedItems.find(i => !!i.isTransition)
				const transObj2 = transObj ? pieceGroup.items.find(l => l._id === transObj._id) : undefined
				const hasTransition = allowTransition && transObj2 && transObj2.content && transObj2.content.timelineObjects && transObj2.content.timelineObjects.find(o => o != null && o.LLayer === layer)

				const res: TimelineObjRundown[] = []
				orderedItems.forEach(i => {
					if (!pieceGroup || (!allowTransition && i.isTransition)) {
						return
					}

					const item = pieceGroup.items.find(l => l._id === i._id)
					if (!item || !item.content || !item.content.timelineObjects) {
						return
					}

					// If there is a transition and this item is abs0, it is assumed to be the primary piece and so does not need lookahead
					if (hasTransition && !i.isTransition && item.trigger.type === TriggerType.TIME_ABSOLUTE && item.trigger.value === 0) {
						return
					}

					// Note: This is assuming that there is only one use of a layer in each piece.
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

	const res: {obj: TimelineObjRundown, partId: string}[] = []

	const partId = pieceGroup.partId
	const objs = findObjectForPart()
	objs.forEach(o => res.push({ obj: o, partId: partId }))

	// this is the current one, so look ahead to next to find the next thing to preload too
	if (pieceGroup && pieceGroup.partId === activeRundown.currentPartId) {
		pieceGroup = undefined
		for (let i = currentPos + 1; i < orderedGroups.length; i++) {
			const v = orderedGroups[i]
			if (v.items.length > 0) {
				pieceGroup = v
				pieceGroupIndex = i
				break
			}
		}

		if (pieceGroup) {
			const partId2 = pieceGroup.partId
			const objs2 = findObjectForPart()
			objs2.forEach(o => res.push({ obj: o, partId: partId2 }))
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
		let prevLine: Part | undefined
		if (data.changedLines) {
			const firstLine = Parts.findOne({
				rundownId: rundownId,
				_id: { $in: data.changedLines }
			}, { sort: { _rank: 1 } })
			if (firstLine) {
				prevLine = Parts.findOne({
					rundownId: rundownId,
					_rank: { $lt: firstLine._rank }
				}, { sort: { _rank: -1 } })
			}
		}

		updateSourceLayerInfinitesAfterLine(rundown, prevLine, true)

		if (rundown.active) {
			updateTimeline(rundown.studioId)
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
 * Updates the Timeline to reflect the state in the Rundown, Segments, Parts etc...
 * @param studioId id of the studio to update
 * @param forceNowToTime if set, instantly forces all "now"-objects to that time (used in autoNext)
 */
export const updateTimeline: (studioId: string, forceNowToTime?: Time) => void
= syncFunctionIgnore(function updateTimeline (studioId: string, forceNowToTime?: Time) {
	logger.debug('updateTimeline running...')
	let timelineObjs: Array<TimelineObjGeneric> = []

	let studio = Studios.findOne(studioId) as Studio
	if (!studio) throw new Meteor.Error(404, 'studio "' + studioId + '" not found!')

	const applyTimelineObjs = (_timelineObjs: TimelineObjGeneric[]) => {
		timelineObjs = timelineObjs.concat(_timelineObjs)
	}

	waitForPromiseAll([
		caught(getTimelineRundown(studio).then(applyTimelineObjs)),
		caught(getTimelineRecording(studio).then(applyTimelineObjs))
	])

	processTimelineObjects(studio, timelineObjs)

	if (forceNowToTime) { // used when autoNexting
		setNowToTimeInObjects(timelineObjs, forceNowToTime)
	}

	const ps: Promise<any>[] = []

	ps.push(makePromise(() => {
		saveIntoDb<TimelineObjGeneric, TimelineObjGeneric>(Timeline, {
			siId: studio._id,
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
		afterUpdateTimeline(studio, timelineObjs)
	}))
	waitForPromiseAll(ps)

	logger.debug('updateTimeline done!')
})

/**
 * Returns timeline objects related to rundowns in a studio
 */
function getTimelineRundown (studio: Studio): Promise<TimelineObjRundown[]> {

	return new Promise((resolve, reject) => {
		try {
			let timelineObjs: Array<TimelineObjGeneric> = []

			const promiseActiveRundown = asyncCollectionFindOne(Rundowns, {
				studioId: studio._id,
				active: true
			})
			// let promiseStudio = asyncCollectionFindOne(Studios, studio._id)
			let activeRundown = waitForPromise(promiseActiveRundown)

			if (activeRundown) {

				// remove anything not related to active rundown:
				let promiseClearTimeline: Promise<void> = asyncCollectionRemove(Timeline, {
					siId: studio._id,
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
				timelineObjs = timelineObjs.concat(getLookeaheadObjects(rundownData, studio))

				// console.log(JSON.stringify(timelineObjs))

				// TODO: Specific implementations, to be refactored into Blueprints:
				setLawoObjectsTriggerValue(timelineObjs, activeRundown.currentPartId || undefined)
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

				const blueprint = loadStudioBlueprints(studio)
				if (blueprint) {
					const baselineObjs = blueprint.getBaseline(new StudioContext(studio))
					studioBaseline = postProcessStudioBaselineObjects(studio, baselineObjs)

					const id = `${studio._id}_baseline_version`
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
								blueprintId: studio.blueprintId,
								blueprintVersion: blueprint.blueprintVersion,
								studio: studio._rundownVersionHash,
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
function getTimelineRecording (studio: Studio, forceNowToTime?: Time): Promise<TimelineObjRecording[]> {

	return new Promise((resolve, reject) => {
		try {
			let recordingTimelineObjs: TimelineObjRecording[] = []

			RecordedFiles.find({ // TODO: ask Julian if this is okay, having multiple recordings at the same time?
				studioId: studio._id,
				stoppedAt: {$exists: false}
			}, {
				sort: {
					startedAt: 1 // TODO - is order correct?
				}
			}).forEach((activeRecording) => {
				recordingTimelineObjs = recordingTimelineObjs.concat(
					generateRecordingTimelineObjs(studio, activeRecording)
				)
			})

			resolve(recordingTimelineObjs)
		} catch (e) {
			reject(e)
		}
	})
	// Timeline.remove({
	// 	siId: studioId,
	// 	recordingObject: true
	// })
}

export function buildTimelineObjsForRundown (rundownData: RundownData, baselineItems: RundownBaselineItem[]): TimelineObjRundown[] {
	let timelineObjs: Array<TimelineObjRundown> = []
	let currentPartGroup: TimelineObjRundown | undefined
	let previousPartGroup: TimelineObjRundown | undefined

	let currentPart: Part | undefined
	let nextPart: Part | undefined

	// let currentPieces: Array<Piece> = []
	let previousPart: Part | undefined

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

	// Fetch the nextPart first, because that affects how the currentPart will be treated
	if (activeRundown.nextPartId) {
		// We may be at the beginning of a show, and there can be no currentPart and we are waiting for the user to Take
		nextPart = rundownData.partsMap[activeRundown.nextPartId]
		if (!nextPart) throw new Meteor.Error(404, `Part "${activeRundown.nextPartId}" not found!`)
	}

	if (activeRundown.currentPartId) {
		currentPart = rundownData.partsMap[activeRundown.currentPartId]
		if (!currentPart) throw new Meteor.Error(404, `Part "${activeRundown.currentPartId}" not found!`)

		if (activeRundown.previousPartId) {
			previousPart = rundownData.partsMap[activeRundown.previousPartId]
			if (!previousPart) throw new Meteor.Error(404, `Part "${activeRundown.previousPartId}" not found!`)
		}
	}

	if (baselineItems) {
		timelineObjs = timelineObjs.concat(transformBaselineItemsIntoTimeline(rundownData.rundown, baselineItems))
	}

	// Currently playing:
	if (currentPart) {

		const currentPieces = currentPart.getAllPieces()
		const currentInfiniteItems = currentPieces.filter(l => (l.infiniteMode && l.infiniteId && l.infiniteId !== l._id))
		const currentNormalItems = currentPieces.filter(l => !(l.infiniteMode && l.infiniteId && l.infiniteId !== l._id))

		let allowTransition = false

		if (previousPart) {
			allowTransition = !previousPart.disableOutTransition

			if (previousPart.getLastStartedPlayback()) {
				const prevSlOverlapDuration = calcSlKeepaliveDuration(previousPart, currentPart, true)
				previousPartGroup = createPartGroup(previousPart, `#${getPartGroupId(currentPart)}.start + ${prevSlOverlapDuration} - #.start`)
				previousPartGroup.priority = -1
				previousPartGroup.trigger = literal<TimelineTypes.TimelineTrigger>({
					type: TriggerType.TIME_ABSOLUTE,
					value: previousPart.getLastStartedPlayback() || 0
				})

				// If a Piece is infinite, and continued in the new Part, then we want to add the Piece only there to avoid id collisions
				const skipIds = currentInfiniteItems.map(l => l.infiniteId || '')
				const previousPieces = previousPart.getAllPieces().filter(l => !l.infiniteId || skipIds.indexOf(l.infiniteId) < 0)

				const groupClasses: string[] = ['previous_part']
				let prevObjs: TimelineObjRundown[] = [previousPartGroup]
				prevObjs = prevObjs.concat(
					transformPartIntoTimeline(rundownData.rundown, previousPieces, groupClasses, previousPartGroup, undefined, activeRundown.holdState, undefined))

				prevObjs = prefixAllObjectIds(prevObjs, 'previous_')

				// If autonext with an overlap, keep the previous line alive for the specified overlap
				if (previousPart.autoNext && previousPart.autoNextOverlap) {
					previousPartGroup.duration = `#${getPartGroupId(currentPart)}.start + ${previousPart.autoNextOverlap || 0} - #.start`
				}

				timelineObjs = timelineObjs.concat(prevObjs)
			}
		}

		// fetch items
		// fetch the timelineobjs in items
		const isFollowed = nextPart && currentPart.autoNext
		const currentSLDuration = !isFollowed ? 0 : calcSlTargetDuration(previousPart, currentPart)
		currentPartGroup = createPartGroup(currentPart, currentSLDuration)
		if (currentPart.startedPlayback && currentPart.getLastStartedPlayback()) { // If we are recalculating the currentLine, then ensure it doesnt think it is starting now
			currentPartGroup.trigger = literal<TimelineTypes.TimelineTrigger>({
				type: TriggerType.TIME_ABSOLUTE,
				value: currentPart.getLastStartedPlayback() || 0
			})
		}

		// any continued infinite lines need to skip the group, as they need a different start trigger
		for (let item of currentInfiniteItems) {
			const infiniteGroup = createPartGroup(currentPart, item.expectedDuration || 0)
			infiniteGroup._id = getPartGroupId(item._id) + '_infinite'
			infiniteGroup.priority = 1

			const groupClasses: string[] = ['current_part']
			// If the previousPart also contains another segment of this infinite piece, then we label our new one as such
			if (previousPart && previousPart.getAllPieces().filter(i => i.infiniteId && i.infiniteId === item.infiniteId)) {
				groupClasses.push('continues_infinite')
			}

			if (item.infiniteId) {
				const originalItem = _.find(rundownData.pieces, (piece => piece._id === item.infiniteId))

				// If we are a continuation, set the same start point to ensure that anything timed is correct
				if (originalItem && originalItem.startedPlayback) {
					infiniteGroup.trigger = literal<TimelineTypes.TimelineTrigger>({
						type: TriggerType.TIME_ABSOLUTE,
						value: originalItem.startedPlayback
					})

					// If an absolute time has been set by a hotkey, then update the duration to be correct
					const partStartedPlayback = currentPart.getLastStartedPlayback()
					if (item.durationOverride && partStartedPlayback) {
						const originalEndTime = partStartedPlayback + item.durationOverride
						infiniteGroup.duration = originalEndTime - originalItem.startedPlayback
					}
				}
			}

			// Still show objects flagged as 'HoldMode.EXCEPT' if this is a infinite continuation as they belong to the previous too
			const showHoldExcept = item.infiniteId !== item._id
			timelineObjs = timelineObjs.concat(infiniteGroup, transformPartIntoTimeline(rundownData.rundown, [item], groupClasses, infiniteGroup, undefined, activeRundown.holdState, showHoldExcept))
		}

		const groupClasses: string[] = ['current_part']
		const transProps: TransformTransitionProps = {
			allowed: allowTransition,
			preroll: currentPart.prerollDuration,
			transitionPreroll: currentPart.transitionPrerollDuration,
			transitionKeepalive: currentPart.transitionKeepaliveDuration
		}
		timelineObjs = timelineObjs.concat(
			currentPartGroup,
			transformPartIntoTimeline(rundownData.rundown, currentNormalItems, groupClasses, currentPartGroup, transProps, activeRundown.holdState, undefined)
		)

		timelineObjs.push(createPartGroupFirstObject(currentPart, currentPartGroup, previousPart))

		// only add the next objects into the timeline if the next segment is autoNext
		if (nextPart && currentPart.autoNext) {
			// console.log('This part will autonext')
			let nextPieceGroup = createPartGroup(nextPart, 0)
			if (currentPartGroup) {
				const overlapDuration = calcSlOverlapDuration(currentPart, nextPart)

				nextPieceGroup.trigger = literal<TimelineTypes.TimelineTrigger>({
					type: TriggerType.TIME_RELATIVE,
					value: `#${currentPartGroup._id}.end - ${overlapDuration}`
				})
				if (typeof currentPartGroup.duration === 'number') {
					currentPartGroup.duration += currentPart.autoNextOverlap || 0
				}
			}

			let toSkipIds = currentPieces.filter(i => i.infiniteId).map(i => i.infiniteId)

			let nextItems = nextPart.getAllPieces()
			nextItems = nextItems.filter(i => !i.infiniteId || toSkipIds.indexOf(i.infiniteId) === -1)

			const groupClasses: string[] = ['next_part']
			const transProps: TransformTransitionProps = {
				allowed: currentPart && !currentPart.disableOutTransition,
				preroll: nextPart.prerollDuration,
				transitionPreroll: nextPart.transitionPrerollDuration,
				transitionKeepalive: nextPart.transitionKeepaliveDuration
			}
			timelineObjs = timelineObjs.concat(
				nextPieceGroup,
				transformPartIntoTimeline(rundownData.rundown, nextItems, groupClasses, nextPieceGroup, transProps)
			)
			timelineObjs.push(createPartGroupFirstObject(nextPart, nextPieceGroup, currentPart))
		}
	}

	if (!nextPart && !currentPart) {
		// maybe at the end of the show
		logger.info(`No next part and no current part set on rundown "${activeRundown._id}".`)
	}

	return timelineObjs
}

function calcSlKeepaliveDuration (fromSl: Part, toSl: Part, relativeToFrom: boolean): number {
	const allowTransition: boolean = !fromSl.disableOutTransition
	if (!allowTransition) {
		return fromSl.autoNextOverlap || 0
	}

	if (relativeToFrom) { // TODO remove
		if (toSl.transitionKeepaliveDuration === undefined || toSl.transitionKeepaliveDuration === null) {
			return (toSl.prerollDuration || 0)
		}

		const transPieceDelay = Math.max(0, (toSl.prerollDuration || 0) - (toSl.transitionPrerollDuration || 0))
		return transPieceDelay + (toSl.transitionKeepaliveDuration || 0)
	}

	// if (toSl.transitionKeepaliveDuration === undefined || toSl.transitionKeepaliveDuration === null) {
	// 	return (fromSl.autoNextOverlap || 0)
	// }

	return 0
}
function calcSlTargetDuration (prevSl: Part | undefined, currentSl: Part): number {
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
function calcSlOverlapDuration (fromSl: Part, toSl: Part): number {
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
 * @param studio
 * @param timelineObjs Array of timeline objects
 */
function processTimelineObjects (studio: Studio, timelineObjs: Array<TimelineObjGeneric>): void {
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
		o.siId = studio._id

		fixObjectChildren(o)
	})
}

/**
 * To be called after an update to the timeline has been made, will add/update the "statObj" - an object
 * containing the hash of the timeline, used to determine if the timeline should be updated in the gateways
 * @param studioId id of the studio to update
 */
export function afterUpdateTimeline (studio: Studio, timelineObjs?: Array<TimelineObjGeneric>) {

	// logger.info('afterUpdateTimeline')
	if (!timelineObjs) {
		timelineObjs = Timeline.find({
			siId: studio._id,
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
	let magicId = studio._id + '_statObj'
	let statObj: TimelineObjStat = {
		_id: magicId,
		id: '',
		siId: studio._id,
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

function setLawoObjectsTriggerValue (timelineObjs: Array<TimelineObjGeneric>, currentPartId: string | undefined) {

	_.each(timelineObjs, (obj) => {
		if (obj.content.type === TimelineContentTypeLawo.SOURCE ) {
			let lawoObj = obj as TimelineObjLawo & TimelineObjGeneric

			_.each(lawoObj.content.attributes, (val, key) => {
				// set triggerValue to the current playing segment, thus triggering commands to be sent when nexting:
				lawoObj.content.attributes[key].triggerValue = currentPartId || ''
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
