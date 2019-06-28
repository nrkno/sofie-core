
/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Rundowns, Rundown, RundownHoldState, RundownData } from '../../../lib/collections/Rundowns'
import { Part, Parts, DBPart } from '../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { getCurrentTime,
	Time,
	fetchAfter,
	asyncCollectionUpdate,
	waitForPromiseAll,
	asyncCollectionInsert,
	asyncCollectionUpsert,
	waitForPromise,
	makePromise,
	clone,
	literal} from '../../../lib/lib'
import { Timeline, getTimelineId, TimelineObjGeneric } from '../../../lib/collections/Timeline'
import { Segments, Segment } from '../../../lib/collections/Segments'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../../logging'
import {
	PieceLifespan,
	PartHoldMode,
	VTContent,
	PartEndState
} from 'tv-automation-sofie-blueprints-integration'
import { Studios } from '../../../lib/collections/Studios'
import { getResolvedSegment, ISourceLayerExtended } from '../../../lib/Rundown'
import { ClientAPI } from '../../../lib/api/client'
import {
	reportRundownHasStarted,
	reportPartHasStarted,
	reportPieceHasStarted,
	reportPartHasStopped,
	reportPieceHasStopped
} from '../asRunLog'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { getBlueprintOfRundown } from '../blueprints/cache'
import { PartEventContext, PartContext, RundownContext } from '../blueprints/context'
import { IngestActions } from '../ingest/actions'
import { updateTimeline } from './timeline'
import {
	resetRundown as libResetRundown,
	setNextPart as libSetNextPart,
	onPartHasStoppedPlaying,
	refreshPart,
	getPreviousPartForSegment
} from './lib'
import {
	prepareStudioForBroadcast,
	activateRundown as libActivateRundown,
	deactivateRundown as libDeactivateRundown
} from './actions'
import { PieceResolved, getOrderedPiece, getResolvedPieces, convertAdLibToPiece, convertPieceToAdLibPiece, resolveActivePieces } from './pieces'
import { PackageInfo } from '../../coreSystem'
import { areThereActiveRundownsInStudio } from './studio'
import { updateSourceLayerInfinitesAfterPart, cropInfinitesOnLayer, stopInfinitesRunningOnLayer } from './infinites'
import { rundownSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'
import { ServerPlayoutAdLibAPI } from './adlib'
import { transformTimeline } from '../../../lib/timeline'
import * as SuperTimeline from 'superfly-timeline'

export namespace ServerPlayoutAPI {
	/**
	 * Prepare the rundown for transmission
	 * To be triggered well before the broadcast, since it may take time and cause outputs to flicker
	 */
	export function prepareRundownForBroadcast (rundownId: string) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (rundown.active) throw new Meteor.Error(404, `rundownPrepareForBroadcast cannot be run on an active rundown!`)

			const anyOtherActiveRundowns = areThereActiveRundownsInStudio(rundown.studioId, rundown._id)
			if (anyOtherActiveRundowns.length) {
				// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
				throw new Meteor.Error(409, 'Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
			}

			libResetRundown(rundown)
			prepareStudioForBroadcast(rundown.getStudio())

			return libActivateRundown(rundown, true) // Activate rundown (rehearsal)
		})
	}
	/**
	 * Reset the broadcast, to be used during testing.
	 * The User might have run through the rundown and wants to start over and try again
	 */
	export function resetRundown (rundownId: string) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(401, `rundownResetBroadcast can only be run in rehearsal!`)

			libResetRundown(rundown)

			updateTimeline(rundown.studioId)

			return { success: 200 }
		})
	}
	/**
	 * Activate the rundown, final preparations before going on air
	 * To be triggered by the User a short while before going on air
	 */
	export function resetAndActivateRundown (rundownId: string, rehearsal?: boolean) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(402, `rundownResetAndActivate cannot be run when active!`)

			libResetRundown(rundown)

			return libActivateRundown(rundown, !!rehearsal) // Activate rundown
		})
	}
	/**
	 * Only activate the rundown, don't reset anything
	 */
	export function activateRundown (rundownId: string, rehearsal: boolean) {
		check(rehearsal, Boolean)
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

			return libActivateRundown(rundown, rehearsal)
		})
	}
	/**
	 * Deactivate the rundown
	 */
	export function deactivateRundown (rundownId: string) {
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

			return libDeactivateRundown(rundown)
		})
	}
	/**
	 * Trigger a reload of data of the rundown
	 */
	export function reloadData (rundownId: string) {
		// Reload and reset the Rundown
		check(rundownId, String)
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

			return ClientAPI.responseSuccess(
				IngestActions.reloadRundown(rundown)
			)
		})
	}
	/**
	 * Take the currently Next:ed Part (start playing it)
	 */
	export function takeNextPart (rundownId: string): ClientAPI.ClientResponse {
		let now = getCurrentTime()

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			let rundown = Rundowns.findOne(rundownId) as Rundown
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.active) throw new Meteor.Error(501, `Rundown "${rundownId}" is not active!`)
			if (!rundown.nextPartId) throw new Meteor.Error(500, 'nextPartId is not set!')

			let timeOffset: number | null = rundown.nextTimeOffset || null

			let firstTake = !rundown.startedPlayback
			let rundownData = rundown.fetchAllData()

			const currentPart = rundown.currentPartId ? rundownData.partsMap[rundown.currentPartId] : undefined
			if (currentPart && currentPart.transitionDuration) {
				const prevPart = rundown.previousPartId ? rundownData.partsMap[rundown.previousPartId] : undefined
				const allowTransition = prevPart && !prevPart.disableOutTransition

				// If there was a transition from the previous Part, then ensure that has finished before another take is permitted
				if (allowTransition) {
					const start = currentPart.getLastStartedPlayback()
					if (start && now < start + currentPart.transitionDuration) {
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
					}, { multi: true })
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

			const { blueprint } = waitForPromise(pBlueprint)
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

			// TODO - the state could change after this sampling point. This should be handled properly
			let previousPartEndState: PartEndState | undefined = undefined
			if (blueprint.getEndStateForPart && previousPart) {
				const time = getCurrentTime()
				// const activePieces = resolveActivePieces(previousPart, time)
				const resolvedPieces = getResolvedPieces(previousPart)

				const context = new RundownContext(rundown)
				previousPartEndState = blueprint.getEndStateForPart(context, previousPart.previousPartEndState, resolvedPieces, time)
				logger.info(`Calculated end state in ${getCurrentTime() - time}ms`)
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

			let partM = {
				$push: {
					'timings.take': now,
					'timings.playOffset': timeOffset || 0
				}
			}
			if (previousPartEndState) {
				partM['$set'] = literal<Partial<Part>>({
					previousPartEndState: previousPartEndState
				})
			} else {
				partM['$unset'] = {
					previousPartEndState: 1
				}
			}
			ps.push(asyncCollectionUpdate(Parts, takePart._id, partM))
			if (m.previousPartId) {
				ps.push(asyncCollectionUpdate(Parts, m.previousPartId, {
					$push: {
						'timings.takeOut': now,
					}
				}))
			}
			rundown = _.extend(rundown, m) as Rundown

			libSetNextPart(rundown, nextPart)
			waitForPromiseAll(ps)

			ps = []

			// Setup the parts for the HOLD we are starting
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
					newPiece.enable = { start: 0 }
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
			afterTake(rundown, takePart, timeOffset)

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
		})
	}
	export function setNextPart (
		rundownId: string,
		nextPartId: string | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	): ClientAPI.ClientResponse {
		check(rundownId, String)
		if (nextPartId) check(nextPartId, String)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

			setNextPartInner(rundown, nextPartId, setManually, nextTimeOffset)

			return ClientAPI.responseSuccess()
		})
	}
	export function setNextPartInner (
		rundown: Rundown,
		nextPartId: string | DBPart | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	) {
		if (!rundown.active) throw new Meteor.Error(501, `Rundown "${rundown._id}" is not active!`)

		if (rundown.holdState && rundown.holdState !== RundownHoldState.COMPLETE) throw new Meteor.Error(501, `Rundown "${rundown._id}" cannot change next during hold!`)

		let nextPart: DBPart | null = null
		if (nextPartId) {
			if (_.isString(nextPartId)) {
				nextPart = Parts.findOne(nextPartId) || null
			} else if (_.isObject(nextPartId)) {
				nextPart = nextPartId
			}
			if (!nextPart) throw new Meteor.Error(404, `Part "${nextPartId}" not found!`)
		}

		libSetNextPart(rundown, nextPart, setManually, nextTimeOffset)

		// remove old auto-next from timeline, and add new one
		updateTimeline(rundown.studioId)
	}
	export function moveNextPart (
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

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
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
				return moveNextPart(rundownId, horisontalDelta, verticalDelta, setManually, part._id)
			} else {
				setNextPartInner(rundown, part, setManually)
				return part._id
			}
		})
	}
	export function activateHold (rundownId: string) {
		check(rundownId, String)
		logger.debug('rundownActivateHold')

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

			if (!rundown.currentPartId) throw new Meteor.Error(400, `Rundown "${rundownId}" no current part!`)
			if (!rundown.nextPartId) throw new Meteor.Error(400, `Rundown "${rundownId}" no next part!`)

			const currentPart = Parts.findOne({ _id: rundown.currentPartId })
			if (!currentPart) throw new Meteor.Error(404, `Part "${rundown.currentPartId}" not found!`)
			const nextPart = Parts.findOne({ _id: rundown.nextPartId })
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
		})
	}
	export function disableNextPiece (rundownId: string, undo?: boolean) {
		check(rundownId, String)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.currentPartId) throw new Meteor.Error(401, `No current part!`)

			const studio = rundown.getStudio()
			const showStyleBase = rundown.getShowStyleBase()

			const currentPart = Parts.findOne(rundown.currentPartId)
			if (!currentPart) throw new Meteor.Error(404, `Part "${rundown.currentPartId}" not found!`)

			const nextPart = (rundown.nextPartId ? Parts.findOne(rundown.nextPartId) : undefined)

			const currentSement = Segments.findOne(currentPart.segmentId)
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
		})
	}
	/**
	 * Triggered from Playout-gateway when a Piece has started playing
	 */
	export function onPiecePlaybackStarted (rundownId: string, pieceId: string, startedPlayback: Time) {
		check(rundownId, String)
		check(pieceId, String)
		check(startedPlayback, Number)

		// TODO - confirm this is correct
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			// This method is called when an auto-next event occurs
			const piece = Pieces.findOne({
				_id: pieceId,
				rundownId: rundownId
			})
			if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" in rundown "${rundownId}" not found!`)

			const isPlaying: boolean = !!(
				piece.startedPlayback &&
				!piece.stoppedPlayback
			)
			if (!isPlaying) {
				logger.info(`Playout reports piece "${pieceId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

				reportPieceHasStarted(piece, startedPlayback)

				// We don't need to bother with an updateTimeline(), as this hasn't changed anything, but lets us accurately add started items when reevaluating
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Piece has stopped playing
	 */
	export function onPiecePlaybackStopped (rundownId: string, pieceId: string, stoppedPlayback: Time) {
		check(rundownId, String)
		check(pieceId, String)
		check(stoppedPlayback, Number)

		// TODO - confirm this is correct
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			// This method is called when an auto-next event occurs
			const piece = Pieces.findOne({
				_id: pieceId,
				rundownId: rundownId
			})
			if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" in rundown "${rundownId}" not found!`)

			const isPlaying: boolean = !!(
				piece.startedPlayback &&
				!piece.stoppedPlayback
			)
			if (isPlaying) {
				logger.info(`Playout reports piece "${pieceId}" has stopped playback on timestamp ${(new Date(stoppedPlayback)).toISOString()}`)

				reportPieceHasStopped(piece, stoppedPlayback)
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Part has started playing
	 */
	export function onPartPlaybackStarted (rundownId: string, partId: string, startedPlayback: Time) {
		check(rundownId, String)
		check(partId, String)
		check(startedPlayback, Number)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			// This method is called when a part starts playing (like when an auto-next event occurs, or a manual next)

			const playingPart = Parts.findOne({
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

					const currentPart = (rundown.currentPartId ?
						Parts.findOne(rundown.currentPartId)
						: null
					)

					if (rundown.currentPartId === partId) {
						// this is the current part, it has just started playback
						if (rundown.previousPartId) {
							const prevPart = Parts.findOne(rundown.previousPartId)

							if (!prevPart) {
								// We couldn't find the previous part: this is not a critical issue, but is clearly is a symptom of a larger issue
								logger.error(`Previous part "${rundown.previousPartId}" on rundown "${rundownId}" could not be found.`)
							} else if (!prevPart.duration) {
								onPartHasStoppedPlaying(prevPart, startedPlayback)
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
								onPartHasStoppedPlaying(currentPart, startedPlayback)
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

						libSetNextPart(rundown, nextPart)
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
						libSetNextPart(rundown, nextPart)

						logger.error(`Part "${playingPart._id}" has started playback by the playout gateway, but has not been selected for playback!`)
					}

					reportPartHasStarted(playingPart, startedPlayback)

					afterTake(rundown, playingPart)
				}
			} else {
				throw new Meteor.Error(404, `Part "${partId}" in rundown "${rundownId}" not found!`)
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Part has stopped playing
	 */
	export function onPartPlaybackStopped (rundownId: string, partId: string, stoppedPlayback: Time) {
		check(rundownId, String)
		check(partId, String)
		check(stoppedPlayback, Number)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			// This method is called when a part stops playing (like when an auto-next event occurs, or a manual next)

			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

			const part = Parts.findOne({
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
		})
	}
	/**
	 * Make a copy of a piece and start playing it now
	 */
	export function pieceTakeNow (rundownId: string, partId: string, pieceId: string) {
		check(rundownId, String)
		check(partId, String)
		check(pieceId, String)

		return ServerPlayoutAdLibAPI.pieceTakeNow(rundownId, partId, pieceId)
	}
	export function segmentAdLibPieceStart (rundownId: string, partId: string, adLibPieceId: string, queue: boolean) {
		check(rundownId, String)
		check(partId, String)
		check(adLibPieceId, String)

		return ServerPlayoutAdLibAPI.segmentAdLibPieceStart(rundownId, partId, adLibPieceId, queue)
	}
	export function rundownBaselineAdLibPieceStart (rundownId: string, partId: string, baselineAdLibPieceId: string, queue: boolean) {
		check(rundownId, String)
		check(partId, String)
		check(baselineAdLibPieceId, String)

		return ServerPlayoutAdLibAPI.rundownBaselineAdLibPieceStart(rundownId, partId, baselineAdLibPieceId, queue)
	}
	export function stopAdLibPiece (rundownId: string, partId: string, pieceId: string) {
		check(rundownId, String)
		check(partId, String)
		check(pieceId, String)

		return ServerPlayoutAdLibAPI.stopAdLibPiece(rundownId, partId, pieceId)
	}
	export function sourceLayerStickyPieceStart (rundownId: string, sourceLayerId: string) {
		check(rundownId, String)
		check(sourceLayerId, String)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
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

				const lastPiece = convertPieceToAdLibPiece(lastPieces[0])
				const newAdLibPiece = convertAdLibToPiece(lastPiece, currentPart, false)

				Pieces.insert(newAdLibPiece)

				// logger.debug('adLibItemStart', newPiece)

				cropInfinitesOnLayer(rundown, currentPart, newAdLibPiece)
				stopInfinitesRunningOnLayer(rundown, currentPart, newAdLibPiece.sourceLayerId)

				updateTimeline(rundown.studioId)
			}
		})
	}
	export function sourceLayerOnPartStop (rundownId: string, partId: string, sourceLayerId: string) {
		check(rundownId, String)
		check(partId, String)
		check(sourceLayerId, String)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			if (!rundown.active) throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
			const part = Parts.findOne({
				_id: partId,
				rundownId: rundownId
			})
			if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)
			if (rundown.currentPartId !== part._id) throw new Meteor.Error(403, `Pieces can be only manipulated in a current part!`)
			if (!part.getLastStartedPlayback()) throw new Meteor.Error(405, `Part "${partId}" has yet to start playback!`)

			const now = getCurrentTime()
			const relativeNow = now - (part.getLastStartedPlayback() || 0)
			const orderedPieces = getResolvedPieces(part)

			orderedPieces.forEach((piece) => {
				if (piece.sourceLayerId === sourceLayerId) {
					if (!piece.userDuration) {
						let newExpectedDuration: number | undefined = undefined

						if (piece.infiniteId && piece.infiniteId !== piece._id && part) {
							const partStarted = part.getLastStartedPlayback()
							if (partStarted) {
								newExpectedDuration = now - partStarted
							}
						} else if (
							piece.startedPlayback && // currently playing
							_.isNumber(piece.enable.start) &&
							(piece.enable.start || 0) < relativeNow && // is relative, and has started
							!piece.stoppedPlayback // and not yet stopped
						) {
							newExpectedDuration = now - piece.startedPlayback
						}

						if (newExpectedDuration !== undefined) {
							console.log(`Cropping piece "${piece._id}" at ${newExpectedDuration}`)

							Pieces.update({
								_id: piece._id
							}, {
								$set: {
									userDuration: {
										duration: newExpectedDuration
									}
								}
							})
						}
					}
				}
			})

			updateSourceLayerInfinitesAfterPart(rundown, part)

			updateTimeline(rundown.studioId)
		})
	}
	export function rundownTogglePartArgument (rundownId: string, partId: string, property: string, value: string) {
		check(rundownId, String)
		check(partId, String)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
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
				Parts.update(part._id, { $set: mSet })
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
				// If this is rundown's current part, update immediately
				} else if (rundown.currentPartId === part._id) {
					updateTimeline(rundown.studioId)
				}
			}
			return ClientAPI.responseSuccess()
		})
	}
	/**
	 * Called from Playout-gateway when the trigger-time of a timeline object has updated
	 * ( typically when using the "now"-feature )
	 */
	export function timelineTriggerTimeUpdateCallback (studioId: string, timelineObj: TimelineObjGeneric, time: number) {
		check(timelineObj, Object)
		check(time, Number)

		// TODO - this is a destructive action... It needs to either backup the original, or only run on dynamically inserted
		if (timelineObj.metadata && timelineObj.metadata.pieceId) {
			logger.debug('Update piece: ', timelineObj.metadata.pieceId, (new Date(time)).toTimeString())
			Pieces.update({
				_id: timelineObj.metadata.pieceId
			}, {
				$set: {
					'enable.start': time
				}
			})
		}
	}
	export function updateStudioBaseline (studioId: string) {
		check(studioId, String)

		// TODO - should there be a studio lock for activate/deactivate/this?

		const activeRundowns = areThereActiveRundownsInStudio(studioId)
		if (activeRundowns.length === 0) {
			// This is only run when there is no rundown active in the studio
			updateTimeline(studioId)
		}

		return shouldUpdateStudioBaseline(studioId)
	}
	export function shouldUpdateStudioBaseline (studioId: string) {
		check(studioId, String)

		const studio = Studios.findOne(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)

		const activeRundowns = areThereActiveRundownsInStudio(studio._id)

		if (activeRundowns.length === 0) {
			const markerId = `${studio._id}_baseline_version`
			const markerObject = Timeline.findOne(markerId)
			if (!markerObject) return 'noBaseline'

			const versionsContent = (markerObject.metadata || {}).versions || {}

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

function beforeTake (rundownData: RundownData, currentPart: Part | null, nextPart: Part) {
	if (currentPart) {
		const adjacentPart = _.find(rundownData.parts, (part) => {
			return (
				part.segmentId === currentPart.segmentId &&
				part._rank > currentPart._rank
			)
		})
		if (!adjacentPart || adjacentPart._id !== nextPart._id) {
			// adjacent Part isn't the next part, do not overflow
			return
		}
		let ps: Array<Promise<any>> = []
		const currentPieces = currentPart.getAllPieces()
		currentPieces.forEach((piece) => {
			if (piece.overflows && typeof piece.enable.duration === 'number' && piece.enable.duration > 0 && piece.playoutDuration === undefined && piece.userDuration === undefined) {
				// Subtract the amount played from the duration
				const remainingDuration = Math.max(0, piece.enable.duration - ((piece.startedPlayback || currentPart.getLastStartedPlayback() || getCurrentTime()) - getCurrentTime()))

				if (remainingDuration > 0) {
					// Clone an overflowing piece
					let overflowedItem = literal<Piece>({
						..._.omit(piece, 'startedPlayback', 'duration', 'overflows'),
						_id: Random.id(),
						partId: nextPart._id,
						enable: {
							start: 0,
							duration: remainingDuration,
						},
						dynamicallyInserted: true,
						continuesRefId: piece._id,
					})

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
			IngestActions.notifyCurrentPlayingPart(rundown, takePart)

		}
	}, 40)
}

function setRundownStartedPlayback (rundown: Rundown, startedPlayback: Time) {
	if (!rundown.startedPlayback) { // Set startedPlayback on the rundown if this is the first item to be played
		reportRundownHasStarted(rundown, startedPlayback)
	}
}

interface UpdateTimelineFromIngestDataTimeout {
	timeout?: number
	changedSegments: string[]
}
let updateTimelineFromIngestDataTimeouts: {
	[id: string]: UpdateTimelineFromIngestDataTimeout
} = {}
export function triggerUpdateTimelineAfterIngestData (rundownId: string, changedSegments: Array<string>) {
	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	let data: UpdateTimelineFromIngestDataTimeout = updateTimelineFromIngestDataTimeouts[rundownId]
	if (data) {
		if (data.timeout) Meteor.clearTimeout(data.timeout)
		data.changedSegments = data.changedSegments.concat(changedSegments)
	} else {
		data = {
			changedSegments: changedSegments
		}
	}

	data.timeout = Meteor.setTimeout(() => {
		delete updateTimelineFromIngestDataTimeouts[rundownId]

		// infinite items only need to be recalculated for those after where the edit was made (including the edited line)
		let prevPart: Part | undefined
		if (data.changedSegments) {
			const firstSegment = Segments.findOne({
				rundownId: rundownId,
				_id: { $in: data.changedSegments }
			})
			if (firstSegment) {
				prevPart = getPreviousPartForSegment(rundownId, firstSegment)
			}
		}

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		// TODO - test the input data for this
		updateSourceLayerInfinitesAfterPart(rundown, prevPart, true)

		if (rundown.active) {
			updateTimeline(rundown.studioId)
		}
	}, 1000)

	updateTimelineFromIngestDataTimeouts[rundownId] = data
}
