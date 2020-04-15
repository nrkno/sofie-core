
/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { check, Match } from '../../../lib/check'
import { Rundowns, Rundown, RundownHoldState, RundownId } from '../../../lib/collections/Rundowns'
import { Part, Parts, DBPart, PartId } from '../../../lib/collections/Parts'
import { Piece, Pieces, PieceId } from '../../../lib/collections/Pieces'
import { getCurrentTime,
	Time,
	fetchNext,
	asyncCollectionUpdate,
	waitForPromiseAll,
	asyncCollectionInsert,
	asyncCollectionUpsert,
	waitForPromise,
	makePromise,
	clone,
	literal,
	asyncCollectionRemove,
	normalizeArray,
	unprotectString,
	unprotectObjectArray,
	protectString,
	isStringOrProtectedString,
	getRandomId} from '../../../lib/lib'
import { Timeline, TimelineObjGeneric, TimelineObjId } from '../../../lib/collections/Timeline'
import { Segments, Segment, SegmentId } from '../../../lib/collections/Segments'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../../logging'
import {
	PieceLifespan,
	PartHoldMode,
	VTContent,
	PartEndState
} from 'tv-automation-sofie-blueprints-integration'
import { Studios, StudioId } from '../../../lib/collections/Studios'
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
import { RundownPlaylist, RundownPlaylists, RundownPlaylistPlayoutData, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { getBlueprintOfRundown } from '../blueprints/cache'
import { PartEventContext, RundownContext } from '../blueprints/context'
import { IngestActions } from '../ingest/actions'
import { updateTimeline } from './timeline'
import {
	resetRundownPlaylist as libResetRundownPlaylist,
	setNextPart as libSetNextPart,
	setNextSegment as libSetNextSegment,
	onPartHasStoppedPlaying,
	refreshPart,
	getPartBeforeSegment,
	selectNextPart,
	isTooCloseToAutonext
} from './lib'
import {
	prepareStudioForBroadcast,
	activateRundownPlaylist as libActivateRundownPlaylist,
	deactivateRundownPlaylist as libDeactivateRundownPlaylist,
	deactivateRundownPlaylistInner,
	standDownStudio
} from './actions'
import { PieceResolved, getOrderedPiece, getResolvedPieces, convertAdLibToPieceInstance, convertPieceToAdLibPiece, orderPieces } from './pieces'
import { PackageInfo } from '../../coreSystem'
import { areThereActiveRundownPlaylistsInStudio } from './studio'
import { updateSourceLayerInfinitesAfterPart, cropInfinitesOnLayer, stopInfinitesRunningOnLayer } from './infinites'
import { rundownPlaylistSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'
import { ServerPlayoutAdLibAPI } from './adlib'
import { PieceInstances, PieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { PartInstances, PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { ReloadRundownPlaylistResponse } from '../../../lib/api/userActions'
import { MethodContext } from '../../../lib/api/methods'
import { RundownPlaylistContentWriteAccess } from '../../security/rundownPlaylist'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/lib/securityVerify'
import { StudioContentWriteAccess } from '../../security/studio'

/**
 * debounce time in ms before we accept another report of "Part started playing that was not selected by core"
 */
const INCORRECT_PLAYING_PART_DEBOUNCE = 5000

export namespace ServerPlayoutAPI {
	/**
	 * Prepare the rundown for transmission
	 * To be triggered well before the broadcast, since it may take time and cause outputs to flicker
	 */
	export function prepareRundownPlaylistForBroadcast (context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			if (playlist.active) throw new Meteor.Error(404, `rundownPrepareForBroadcast cannot be run on an active rundown!`)

			const anyOtherActiveRundowns = areThereActiveRundownPlaylistsInStudio(playlist.studioId, playlist._id)
			if (anyOtherActiveRundowns.length) {
				// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
				throw new Meteor.Error(409, 'Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
			}

			libResetRundownPlaylist(playlist)
			prepareStudioForBroadcast(playlist.getStudio(), true, playlist)

			return libActivateRundownPlaylist(playlist, true) // Activate rundownPlaylist (rehearsal)
		})
	}
	/**
	 * Reset the broadcast, to be used during testing.
	 * The User might have run through the rundown and wants to start over and try again
	 */
	export function resetRundownPlaylist (context: MethodContext, rundownPlaylistId: RundownPlaylistId): void {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			if (playlist.active && !playlist.rehearsal) throw new Meteor.Error(401, `resetRundown can only be run in rehearsal!`)

			libResetRundownPlaylist(playlist)

			updateTimeline(playlist.studioId)
		})
	}
	/**
	 * Activate the rundown, final preparations before going on air
	 * To be triggered by the User a short while before going on air
	 */
	export function resetAndActivateRundownPlaylist (context: MethodContext, rundownPlaylistId: RundownPlaylistId, rehearsal?: boolean) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			if (playlist.active && !playlist.rehearsal) throw new Meteor.Error(402, `resetAndActivateRundownPlaylist cannot be run when active!`)

			libResetRundownPlaylist(playlist)
			prepareStudioForBroadcast(playlist.getStudio(), true, playlist)

			return libActivateRundownPlaylist(playlist, !!rehearsal) // Activate rundown
		})
	}
	/**
	 * Activate the rundownPlaylist, decativate any other running rundowns
	 */
	export function forceResetAndActivateRundownPlaylist (context: MethodContext, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		check(rehearsal, Boolean)
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

			let anyOtherActiveRundowns = areThereActiveRundownPlaylistsInStudio(playlist.studioId, playlist._id)
			let error: any
			_.each(anyOtherActiveRundowns, (otherRundownPlaylist) => {
				try {
					deactivateRundownPlaylistInner(otherRundownPlaylist)
				} catch (e) {
					error = e
				}
			})
			if (error) {
				// Ok, something went wrong, but check if the active rundowns where deactivated?
				anyOtherActiveRundowns = areThereActiveRundownPlaylistsInStudio(playlist.studioId, playlist._id)
				if (anyOtherActiveRundowns.length) {
					// No they weren't, we can't continue..
					throw error
				} else {
					// They where deactivated, log the error and continue
					logger.error(error)
				}
			}

			libResetRundownPlaylist(playlist)
			prepareStudioForBroadcast(playlist.getStudio(), true, playlist)

			return libActivateRundownPlaylist(playlist, rehearsal)
		})
	}
	/**
	 * Only activate the rundown, don't reset anything
	 */
	export function activateRundownPlaylist (context: MethodContext, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		check(rehearsal, Boolean)
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

			prepareStudioForBroadcast(playlist.getStudio(), true, playlist)

			return libActivateRundownPlaylist(playlist, rehearsal)
		})
	}
	/**
	 * Deactivate the rundown
	 */
	export function deactivateRundownPlaylist (context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

			standDownStudio(playlist.getStudio(), true)

			return libDeactivateRundownPlaylist(playlist)
		})
	}
	/**
	 * Trigger a reload of data of the rundown
	 */
	export function reloadRundownPlaylistData (context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
		// Reload and reset the Rundown
		check(rundownPlaylistId, String)
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_INGEST, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			const rundowns = playlist.getRundowns()

			const response: ReloadRundownPlaylistResponse = {
				rundownsResponses: rundowns.map(rundown => {
					return {
						rundownId: rundown._id,
						response: IngestActions.reloadRundown(rundown)
					}
				})
			}
			return response
		})
	}
	/**
	 * Take the currently Next:ed Part (start playing it)
	 */
	export function takeNextPart (context: MethodContext, rundownPlaylistId: RundownPlaylistId): ClientAPI.ClientResponse<void> {
		let now = getCurrentTime()

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			if (!playlist.active) throw new Meteor.Error(501, `RundownPlaylist "${rundownPlaylistId}" is not active!`)
			if (!playlist.nextPartInstanceId) throw new Meteor.Error(500, 'nextPartInstanceId is not set!')

			let timeOffset: number | null = playlist.nextTimeOffset || null

			let firstTake = !playlist.startedPlayback
			let rundownData = playlist.fetchAllPlayoutData()

			const partInstance = rundownData.currentPartInstance || rundownData.nextPartInstance
			const currentRundown = partInstance ? rundownData.rundownsMap[unprotectString(partInstance.rundownId)] : undefined
			if (!currentRundown) throw new Meteor.Error(404, `Rundown "${partInstance && partInstance.rundownId || ''}" could not be found!`)

			let pBlueprint = makePromise(() => getBlueprintOfRundown(currentRundown))

			const currentPart = rundownData.currentPartInstance
			if (currentPart) {
				const prevPart = rundownData.previousPartInstance
				const allowTransition = prevPart && !prevPart.part.disableOutTransition
				const start = currentPart.part.getLastStartedPlayback()

				// If there was a transition from the previous Part, then ensure that has finished before another take is permitted
				if (allowTransition && currentPart.part.transitionDuration && start && now < start + currentPart.part.transitionDuration) {
					return ClientAPI.responseError('Cannot take during a transition')
				}

				if (isTooCloseToAutonext(currentPart, true)) {
					return ClientAPI.responseError('Cannot take shortly before an autoTake')
				}
			}

			if (playlist.holdState === RundownHoldState.COMPLETE) {
				RundownPlaylists.update(playlist._id, {
					$set: {
						holdState: RundownHoldState.NONE
					}
				})
			// If hold is active, then this take is to clear it
			} else if (playlist.holdState === RundownHoldState.ACTIVE) {
				const ps: Promise<any>[] = []
				ps.push(asyncCollectionUpdate(RundownPlaylists, playlist._id, {
					$set: {
						holdState: RundownHoldState.COMPLETE
					}
				}))

				if (playlist.currentPartInstanceId) {
					const currentPartInstance = rundownData.currentPartInstance
					if (!currentPartInstance) throw new Meteor.Error(404, 'currentPart not found!')

					// Remove the current extension line
					ps.push(asyncCollectionRemove(PieceInstances, {
						partInstanceId: currentPartInstance._id,
						'piece.extendOnHold': true,
						'piece.dynamicallyInserted': true
					}))
					// TODO-PartInstance - pending new data flow
					ps.push(asyncCollectionRemove(Pieces, {
						partId: currentPartInstance.part._id,
						extendOnHold: true,
						dynamicallyInserted: true
					}))
				}
				if (!playlist.previousPartInstanceId) {
					const previousPartInstance = rundownData.previousPartInstance
					if (!previousPartInstance) throw new Meteor.Error(404, 'previousPart not found!')

					// Clear the extended mark on the original
					ps.push(asyncCollectionUpdate(PieceInstances, {
						partInstanceId: previousPartInstance._id,
						'piece.extendOnHold': true,
						'piece.dynamicallyInserted': false
					}, {
						$unset: {
							'piece.infiniteId': 0,
							'piece.infiniteMode': 0,
						}
					}, { multi: true }))
					// TODO-PartInstance - pending new data flow
					ps.push(asyncCollectionUpdate(Pieces, {
						partId: previousPartInstance.part._id,
						extendOnHold: true,
						dynamicallyInserted: false
					}, {
						$unset: {
							infiniteId: 0,
							infiniteMode: 0,
						}
					}, { multi: true }))
				}
				waitForPromiseAll(ps)

				updateTimeline(playlist.studioId)
				return ClientAPI.responseSuccess(undefined)
			}

			let previousPartInstance = rundownData.currentPartInstance || null
			let takePartInstance = rundownData.nextPartInstance
			if (!takePartInstance) throw new Meteor.Error(404, 'takePart not found!')
			const takeRundown: Rundown | undefined = rundownData.rundownsMap[unprotectString(takePartInstance.rundownId)]
			if (!takeRundown) throw new Meteor.Error(500, `takeRundown: takeRundown not found! ("${takePartInstance.rundownId}")`)
			// let takeSegment = rundownData.segmentsMap[takePart.segmentId]
			const nextPart = selectNextPart(playlist, takePartInstance, rundownData.parts)

			// beforeTake(rundown, previousPart || null, takePart)
			beforeTake(rundownData, previousPartInstance || null, takePartInstance)

			const { blueprint } = waitForPromise(pBlueprint)
			if (blueprint.onPreTake) {
				try {
					waitForPromise(
						Promise.resolve(blueprint.onPreTake(new PartEventContext(takeRundown, undefined, takePartInstance)))
						.catch(logger.error)
					)
				} catch (e) {
					logger.error(e)
				}
			}
			// TODO - the state could change after this sampling point. This should be handled properly
			let previousPartEndState: PartEndState | undefined = undefined
			if (blueprint.getEndStateForPart && previousPartInstance) {
				const time = getCurrentTime()
				const resolvedPieces = getResolvedPieces(previousPartInstance)

				const context = new RundownContext(takeRundown, undefined)
				previousPartEndState = blueprint.getEndStateForPart(context, playlist.previousPersistentState, previousPartInstance.part.previousPartEndState, unprotectObjectArray(resolvedPieces), time)
				logger.info(`Calculated end state in ${getCurrentTime() - time}ms`)
			}
			let ps: Array<Promise<any>> = []
			let m: Partial<RundownPlaylist> = {
				previousPartInstanceId: playlist.currentPartInstanceId,
				currentPartInstanceId: takePartInstance._id,
				holdState: !playlist.holdState || playlist.holdState === RundownHoldState.COMPLETE ? RundownHoldState.NONE : playlist.holdState + 1,
			}
			ps.push(asyncCollectionUpdate(RundownPlaylists, playlist._id, {
				$set: m
			}))

			let partInstanceM: any = {
				$set: {
					isTaken: true,
					'part.taken': true
				},
				$unset: {} as { string: 0 | 1 },
				$push: {
					'part.timings.take': now,
					'part.timings.playOffset': timeOffset || 0
				}
			}
			let partM = {
				$set: {
					taken: true
				} as Partial<Part>,
				$unset: {} as { [key in keyof Part]: 0 | 1 },
				$push: {
					'timings.take': now,
					'timings.playOffset': timeOffset || 0
				}
			}
			if (previousPartEndState) {
				partInstanceM.$set['part.previousPartEndState'] = previousPartEndState
				partM.$set.previousPartEndState = previousPartEndState
			} else {
				partInstanceM.$unset['part.previousPartEndState'] = 1
				partM.$unset.previousPartEndState = 1
			}
			if (Object.keys(partM.$set).length === 0) delete partM.$set
			if (Object.keys(partM.$unset).length === 0) delete partM.$unset
			if (Object.keys(partInstanceM.$set).length === 0) delete partInstanceM.$set
			if (Object.keys(partInstanceM.$unset).length === 0) delete partInstanceM.$unset

			ps.push(asyncCollectionUpdate(PartInstances, takePartInstance._id, partInstanceM))
			// TODO-PartInstance - pending new data flow
			ps.push(asyncCollectionUpdate(Parts, takePartInstance.part._id, partM))

			if (m.previousPartInstanceId) {
				ps.push(asyncCollectionUpdate(PartInstances, m.previousPartInstanceId, {
					$push: {
						'part.timings.takeOut': now,
					}
				}))
				// TODO-PartInstance - pending new data flow
				if (rundownData.currentPartInstance) {
					ps.push(asyncCollectionUpdate(Parts, rundownData.currentPartInstance.part._id, {
						$push: {
							'timings.takeOut': now,
						}
					}))
				}
			}
			playlist = _.extend(playlist, m) as RundownPlaylist
			// rundownData = {
			// 	...rundownData,
			// 	previousPartInstance: rundownData.currentPartInstance,
			// 	currentPartInstance: rundownData.nextPartInstance,
			// 	nextPartInstance: undefined
			// }

			waitForPromiseAll(ps)
			// Once everything is synced, we can choose the next part
			libSetNextPart(playlist, nextPart ? nextPart.part : null)
			ps = []

			// update playoutData
			// const newSelectedPartInstances = playlist.getSelectedPartInstances()
			// rundownData = {
			// 	...rundownData,
			// 	...newSelectedPartInstances
			// }
			rundownData = playlist.fetchAllPlayoutData()

			// Setup the parts for the HOLD we are starting
			if (playlist.previousPartInstanceId && m.holdState === RundownHoldState.ACTIVE) {
				const previousPartInstance = rundownData.previousPartInstance
				if (!previousPartInstance) throw new Meteor.Error(404, 'previousPart not found!')
				const currentPartInstance = rundownData.currentPartInstance
				if (!currentPartInstance) throw new Meteor.Error(404, 'currentPart not found!')

				// Make a copy of any item which is flagged as an 'infinite' extension
				const itemsToCopy = previousPartInstance.getAllPieceInstances().filter(i => i.piece.extendOnHold)
				itemsToCopy.forEach(instance => {
					// TODO-PartInstance - temporary mutate existing piece, pending new data flow
					const rawPiece = rundownData.pieces.find(p => p._id === instance.piece._id)
					if (rawPiece) {
						rawPiece.infiniteId = rawPiece._id
						rawPiece.infiniteMode = PieceLifespan.OutOnNextPart
						ps.push(asyncCollectionUpdate(Pieces, rawPiece._id, {
							$set: {
								infiniteMode: PieceLifespan.OutOnNextPart,
								infiniteId: rawPiece._id,
							}
						}))
					}

					// mark current one as infinite
					instance.piece.infiniteId = instance.piece._id
					instance.piece.infiniteMode = PieceLifespan.OutOnNextPart
					ps.push(asyncCollectionUpdate(PieceInstances, instance._id, {
						$set: {
							'piece.infiniteMode': PieceLifespan.OutOnNextPart,
							'piece.infiniteId': instance.piece._id,
						}
					}))

					// TODO-PartInstance - temporary piece extension, pending new data flow
					const newPieceTmp: Piece = clone(instance.piece)
					newPieceTmp.partId = currentPartInstance.part._id
					newPieceTmp.enable = { start: 0 }
					const contentTmp = newPieceTmp.content as VTContent
					if (contentTmp.fileName && contentTmp.sourceDuration && instance.piece.startedPlayback) {
						contentTmp.seek = Math.min(contentTmp.sourceDuration, getCurrentTime() - instance.piece.startedPlayback)
					}
					newPieceTmp.dynamicallyInserted = true
					newPieceTmp._id = protectString<PieceId>(instance.piece._id + '_hold')

					// This gets deleted once the nextpart is activated, so it doesnt linger for long
					ps.push(asyncCollectionUpsert(Pieces, newPieceTmp._id, newPieceTmp))
					rundownData.pieces.push(newPieceTmp) // update the local collection

					// make the extension
					const newInstance = literal<PieceInstance>({
						_id: protectString<PieceInstanceId>(instance._id + '_hold'),
						rundownId: instance.rundownId,
						partInstanceId: currentPartInstance._id,
						piece: {
							...clone(instance.piece),
							_id: newPieceTmp._id,
							partId: currentPartInstance.part._id,
							enable: { start: 0 },
							dynamicallyInserted: true
						}
					})
					const content = newInstance.piece.content as VTContent | undefined
					if (content && content.fileName && content.sourceDuration && instance.piece.startedPlayback) {
						content.seek = Math.min(content.sourceDuration, getCurrentTime() - instance.piece.startedPlayback)
					}

					// This gets deleted once the nextpart is activated, so it doesnt linger for long
					ps.push(asyncCollectionUpsert(PieceInstances, newInstance._id, newInstance))
					rundownData.selectedInstancePieces.push(newInstance) // update the local collection

				})
			}
			waitForPromiseAll(ps)
			afterTake(rundownData, takePartInstance, timeOffset)

			// Last:
			const takeDoneTime = getCurrentTime()
			Meteor.defer(() => {
				if (takePartInstance) {
					PartInstances.update(takePartInstance._id, {
						$push: {
							'part.timings.takeDone': takeDoneTime
						}
					})
					Parts.update(takePartInstance.part._id, {
						$push: {
							'timings.takeDone': takeDoneTime
						}
					})
					// let bp = getBlueprintOfRundown(rundown)
					if (firstTake) {
						if (blueprint.onRundownFirstTake) {
							waitForPromise(
								Promise.resolve(blueprint.onRundownFirstTake(new PartEventContext(takeRundown, undefined, takePartInstance)))
								.catch(logger.error)
							)
						}
					}

					if (blueprint.onPostTake) {
						waitForPromise(
							Promise.resolve(blueprint.onPostTake(new PartEventContext(takeRundown, undefined, takePartInstance)))
							.catch(logger.error)
						)
					}
				}
			})

			return ClientAPI.responseSuccess(undefined)
		})
	}
	export function setNextPart (
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		nextPartId: PartId | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	): ClientAPI.ClientResponse<void> {
		check(rundownPlaylistId, String)
		if (nextPartId) check(nextPartId, String)

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

			setNextPartInner(playlist, nextPartId, setManually, nextTimeOffset)

			return ClientAPI.responseSuccess(undefined)
		})
	}
	export function moveNextPart (
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		horizontalDelta: number,
		verticalDelta: number,
		setManually: boolean
	): PartId | null {
		check(rundownPlaylistId, String)
		check(horizontalDelta, Number)
		check(verticalDelta, Number)

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			if (!horizontalDelta && !verticalDelta) throw new Meteor.Error(402, `rundownMoveNext: invalid delta: (${horizontalDelta}, ${verticalDelta})`)
			return moveNextPartInner(
				playlist._id,
				horizontalDelta,
				verticalDelta,
				setManually
			)
		})
	}
	function moveNextPartInner (
		rundownPlaylistId: RundownPlaylistId,
		horizontalDelta: number,
		verticalDelta: number,
		setManually: boolean,
		nextPartId0?: PartId
	): PartId | null {

		const playlist = RundownPlaylists.findOne(rundownPlaylistId)
		if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
		if (!playlist.active) throw new Meteor.Error(501, `RundownPlaylist "${rundownPlaylistId}" is not active!`)

		if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) throw new Meteor.Error(501, `RundownPlaylist "${rundownPlaylistId}" cannot change next during hold!`)

		const pSegmentsAndParts = playlist.getSegmentsAndParts()
		const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()

		let currentNextPart: Part
		if (nextPartId0) {
			const nextPart = Parts.findOne(nextPartId0)
			if (!nextPart) throw new Meteor.Error(404, `Part "${nextPartId0}" not found!`)
			currentNextPart = nextPart
		} else {
			const nextPartInstanceTmp = nextPartInstance || currentPartInstance
			if (!nextPartInstanceTmp) throw new Meteor.Error(501, `RundownPlaylist "${rundownPlaylistId}" has no next and no current part!`)
			currentNextPart = nextPartInstanceTmp.part
		}

		const { segments, parts } = waitForPromise(pSegmentsAndParts)

		const currentNextSegment = segments.find(s => s._id === currentNextPart.segmentId) as Segment
		if (!currentNextSegment) throw new Meteor.Error(404, `Segment "${currentNextPart.segmentId}" not found!`)

		const partsInSegments: {[segmentId: string]: Part[]} = {}
		_.each(segments, segment => {
			let partsInSegment = _.filter(parts, p => p.segmentId === segment._id)
			if (partsInSegment.length) {
				partsInSegments[unprotectString(segment._id)] = partsInSegment
				parts.push(...partsInSegment)
			}
		})

		let partIndex: number = -1
		_.find(parts, (part, i) => {
			if (part._id === currentNextPart._id) {
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
		if (segmentIndex === -1) throw new Meteor.Error(404, `Segment "${currentNextSegment._id}" not found in segmentsWithParts!`)
		if (verticalDelta !== 0) {
			segmentIndex += verticalDelta

			const segment = segments[segmentIndex]
			if (!segment) throw new Meteor.Error(404, `No Segment found!`)

			const part = _.first(partsInSegments[unprotectString(segment._id)])
			if (!part) throw new Meteor.Error(404, `No Parts in segment "${segment._id}"!`)

			partIndex = -1
			_.find(parts, (p, i) => {
				if (p._id === part._id) {
					partIndex = i
					return true
				}
			})
			if (partIndex === -1) throw new Meteor.Error(404, `Part (from segment) not found in list of parts!`)
		}
		partIndex += horizontalDelta

		partIndex = Math.max(0, Math.min(parts.length - 1, partIndex))

		let part = parts[partIndex]
		if (!part) throw new Meteor.Error(501, `Part index ${partIndex} not found in list of parts!`)

		if ((currentPartInstance && part._id === currentPartInstance.part._id && !nextPartId0) || !part.isPlayable()) {
			// Whoops, we're not allowed to next to that.
			// Skip it, then (ie run the whole thing again)
			if (part._id !== nextPartId0) {
				return moveNextPartInner(rundownPlaylistId, horizontalDelta, verticalDelta, setManually, part._id)
			} else {
				// Calling ourselves again at this point would result in an infinite loop
				// There probably isn't any Part available to Next then...
				setNextPartInner(playlist, null, setManually)
				return null
			}
		} else {
			setNextPartInner(playlist, part, setManually)
			return part._id
		}
	}
	export function setNextSegment (
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		nextSegmentId: SegmentId | null
	): ClientAPI.ClientResponse<void> {
		check(rundownPlaylistId, String)
		if (nextSegmentId) check(nextSegmentId, String)

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			if (!playlist.active) throw new Meteor.Error(501, `Rundown Playlist "${rundownPlaylistId}" is not active!`)

			let nextSegment: Segment | null = null
			if (nextSegmentId) {
				nextSegment = Segments.findOne(nextSegmentId) || null

				if (!nextSegment) throw new Meteor.Error(404, `Segment "${nextSegmentId}" not found!`)
				const acceptableRundownIds = playlist.getRundownIDs()
				if (acceptableRundownIds.indexOf(nextSegment.rundownId) === -1) {
					throw new Meteor.Error(501, `Segment "${nextSegmentId}" does not belong to Rundown Playlist "${rundownPlaylistId}"!`)
				}
			}

			libSetNextSegment(playlist, nextSegment)

			return ClientAPI.responseSuccess(undefined)
		})
	}
	export function activateHold (context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)
		logger.debug('rundownActivateHold')

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			if (!playlist.active) throw new Meteor.Error(501, `Rundown Playlist "${rundownPlaylistId}" is not active!`)

			if (!playlist.currentPartInstanceId) throw new Meteor.Error(400, `Rundown Playlist "${rundownPlaylistId}" no current part!`)
			if (!playlist.nextPartInstanceId) throw new Meteor.Error(400, `Rundown Playlist "${rundownPlaylistId}" no next part!`)

			const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
			if (!currentPartInstance) throw new Meteor.Error(404, `PartInstance "${playlist.currentPartInstanceId}" not found!`)
			if (!nextPartInstance) throw new Meteor.Error(404, `PartInstance "${playlist.nextPartInstanceId}" not found!`)

			if (playlist.holdState) {
				throw new Meteor.Error(400, `RundownPlaylist "${rundownPlaylistId}" already doing a hold!`)
			}

			if (currentPartInstance.part.holdMode !== PartHoldMode.FROM || nextPartInstance.part.holdMode !== PartHoldMode.TO) {
				throw new Meteor.Error(400, `RundownPlaylist "${rundownPlaylistId}" incompatible pair of HoldMode!`)
			}

			RundownPlaylists.update(rundownPlaylistId, { $set: { holdState: RundownHoldState.PENDING } })

			updateTimeline(playlist.studioId)
		})
	}
	export function deactivateHold (context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)
		logger.debug('deactivateHold')

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

			if (playlist.holdState !== RundownHoldState.PENDING) throw new Meteor.Error(400, `RundownPlaylist "${rundownPlaylistId}" is not pending a hold!`)

			Rundowns.update(rundownPlaylistId, { $set: { holdState: RundownHoldState.NONE } })

			updateTimeline(playlist.studioId)
		})
	}
	export function disableNextPiece (context: MethodContext, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		check(rundownPlaylistId, String)

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			if (!playlist.currentPartInstanceId) throw new Meteor.Error(401, `No current part!`)

			const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
			if (!currentPartInstance) throw new Meteor.Error(404, `PartInstance "${playlist.currentPartInstanceId}" not found!`)

			const rundown = Rundowns.findOne(currentPartInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${currentPartInstance.rundownId}" not found!`)
			const showStyleBase = rundown.getShowStyleBase()

			// @ts-ignore stringify
			// logger.info(o)
			// logger.info(JSON.stringify(o, '', 2))

			const allowedSourceLayers = normalizeArray(showStyleBase.sourceLayers, '_id')

			// logger.info('nowInPart', nowInPart)
			// logger.info('filteredPieces', filteredPieces)
			let getNextPiece = (partInstance: PartInstance, undo?: boolean) => {
				// Find next piece to disable

				let nowInPart = 0
				if (
					partInstance.part.startedPlayback &&
					partInstance.part.timings &&
					partInstance.part.timings.startedPlayback
				) {
					let lastStartedPlayback = _.last(partInstance.part.timings.startedPlayback)

					if (lastStartedPlayback) {
						nowInPart = getCurrentTime() - lastStartedPlayback
					}
				}

				const pieceInstances = partInstance.getAllPieceInstances()
				const orderedPieces: Array<PieceResolved> = orderPieces(pieceInstances.map(p => p.piece), partInstance.part._id, partInstance.part.getLastStartedPlayback())

				let findLast: boolean = !!undo

				let filteredPieces = _.sortBy(
					_.filter(orderedPieces, (piece: PieceResolved) => {
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
				return nextPiece ? pieceInstances.find(p => p.piece._id === nextPiece!._id) : undefined
			}

			if (nextPartInstance) {
				// pretend that the next part never has played (even if it has)
				nextPartInstance.part.startedPlayback = false
			}

			let partInstances = [
				currentPartInstance,
				nextPartInstance // If not found in currently playing part, let's look in the next one:
			]
			if (undo) partInstances.reverse()

			let nextPieceInstance: PieceInstance | undefined

			_.each(partInstances, (partInstance) => {
				if (partInstance && !nextPieceInstance) {
					nextPieceInstance = getNextPiece(partInstance, undo)
				}
			})

			if (nextPieceInstance) {
				logger.info((undo ? 'Disabling' : 'Enabling') + ' next PieceInstance ' + nextPieceInstance._id)
				PieceInstances.update(nextPieceInstance._id, {$set: {
					'piece.disabled': !undo
				}})
				// TODO-PartInstance - pending new data flow
				Pieces.update(nextPieceInstance.piece._id, {$set: {
					disabled: !undo
				}})

				updateTimeline(playlist.studioId)
			} else {
				throw new Meteor.Error(500, 'Found no future pieces')
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Piece has started playing
	 */
	export function onPiecePlaybackStarted (_context: MethodContext, rundownId: RundownId, pieceInstanceId: PieceInstanceId, dynamicallyInserted: boolean, startedPlayback: Time) {
		check(rundownId, String)
		check(pieceInstanceId, String)
		check(startedPlayback, Number)

		triggerWriteAccessBecauseNoCheckNecessary() // tmp

		const playlistId = getRundown(rundownId).playlistId
		// TODO - confirm this is correct
		return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			// This method is called when an auto-next event occurs

			const pieceInstance = PieceInstances.findOne({
				_id: pieceInstanceId,
				rundownId: rundownId
			})
			if (dynamicallyInserted && !pieceInstance) return// if it was dynamically inserted, it's okay if we can't find it
			if (!pieceInstance) throw new Meteor.Error(404, `PieceInstance "${pieceInstanceId}" in rundown "${rundownId}" not found!`)

			const isPlaying: boolean = !!(
				pieceInstance.piece.startedPlayback &&
				!pieceInstance.piece.stoppedPlayback
			)
			if (!isPlaying) {
				logger.info(`Playout reports pieceInstance "${pieceInstanceId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

				reportPieceHasStarted(pieceInstance, startedPlayback)

				// We don't need to bother with an updateTimeline(), as this hasn't changed anything, but lets us accurately add started items when reevaluating
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Piece has stopped playing
	 */
	export function onPiecePlaybackStopped (_context: MethodContext, rundownId: RundownId, pieceInstanceId: PieceInstanceId, dynamicallyInserted: boolean, stoppedPlayback: Time) {
		check(rundownId, String)
		check(pieceInstanceId, String)
		check(stoppedPlayback, Number)

		triggerWriteAccessBecauseNoCheckNecessary() // tmp

		const playlistId = getRundown(rundownId).playlistId

		// TODO - confirm this is correct
		return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			// This method is called when an auto-next event occurs
			const pieceInstance = PieceInstances.findOne({
				_id: pieceInstanceId,
				rundownId: rundownId
			})
			if (dynamicallyInserted && !pieceInstance) return// if it was dynamically inserted, it's okay if we can't find it
			if (!pieceInstance) throw new Meteor.Error(404, `PieceInstance "${pieceInstanceId}" in rundown "${rundownId}" not found!`)

			const isPlaying: boolean = !!(
				pieceInstance.piece.startedPlayback &&
				!pieceInstance.piece.stoppedPlayback
			)
			if (isPlaying) {
				logger.info(`Playout reports pieceInstance "${pieceInstanceId}" has stopped playback on timestamp ${(new Date(stoppedPlayback)).toISOString()}`)

				reportPieceHasStopped(pieceInstance, stoppedPlayback)
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Part has started playing
	 */
	export function onPartPlaybackStarted (_context: MethodContext, rundownId: RundownId, partInstanceId: PartInstanceId, startedPlayback: Time) {
		check(rundownId, String)
		check(partInstanceId, String)
		check(startedPlayback, Number)

		triggerWriteAccessBecauseNoCheckNecessary() // tmp

		const playlistId = getRundown(rundownId).playlistId

		return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			// This method is called when a part starts playing (like when an auto-next event occurs, or a manual next)

			const playingPartInstance = PartInstances.findOne({
				_id: partInstanceId,
				rundownId: rundownId
			})

			if (playingPartInstance) {
				// make sure we don't run multiple times, even if TSR calls us multiple times

				const isPlaying = (
					playingPartInstance.part.startedPlayback &&
					!playingPartInstance.part.stoppedPlayback
				)
				if (!isPlaying) {
					logger.info(`Playout reports PartInstance "${partInstanceId}" has started playback on timestamp ${(new Date(startedPlayback)).toISOString()}`)

					const rundown = Rundowns.findOne(rundownId)
					if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
					let playlist = rundown.getRundownPlaylist()
					if (!playlist.active) throw new Meteor.Error(501, `Rundown "${rundownId}" is not active!`)

					const { currentPartInstance, previousPartInstance } = playlist.getSelectedPartInstances()

					if (playlist.currentPartInstanceId === partInstanceId) {
						// this is the current part, it has just started playback
						if (playlist.previousPartInstanceId) {
							if (!previousPartInstance) {
								// We couldn't find the previous part: this is not a critical issue, but is clearly is a symptom of a larger issue
								logger.error(`Previous PartInstance "${playlist.previousPartInstanceId}" on RundownPlaylist "${playlist._id}" could not be found.`)
							} else if (!previousPartInstance.part.duration) {
								onPartHasStoppedPlaying(previousPartInstance, startedPlayback)
							}
						}

						setRundownStartedPlayback(playlist, rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

						reportPartHasStarted(playingPartInstance, startedPlayback)

					} else if (playlist.nextPartInstanceId === partInstanceId) {
						// this is the next part, clearly an autoNext has taken place
						if (playlist.currentPartInstanceId) {
							if (!currentPartInstance) {
								// We couldn't find the previous part: this is not a critical issue, but is clearly is a symptom of a larger issue
								logger.error(`Previous PartInstance "${playlist.currentPartInstanceId}" on RundownPlaylist "${playlist._id}" could not be found.`)
							} else if (!currentPartInstance.part.duration) {
								onPartHasStoppedPlaying(currentPartInstance, startedPlayback)
							}
						}

						setRundownStartedPlayback(playlist, rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played
						const playlistChange = literal<Partial<RundownPlaylist>>({
							previousPartInstanceId: playlist.currentPartInstanceId,
							currentPartInstanceId: playingPartInstance._id,
							holdState: RundownHoldState.NONE,
						})

						RundownPlaylists.update(playlist._id, {
							$set: playlistChange
						})
						playlist = _.extend(playlist, playlistChange) as RundownPlaylist

						reportPartHasStarted(playingPartInstance, startedPlayback)

						const nextPart = selectNextPart(playlist, playingPartInstance, playlist.getAllOrderedParts())
						libSetNextPart(playlist, nextPart ? nextPart.part : null)
					} else {
						// a part is being played that has not been selected for playback by Core
						// show must go on, so find next part and update the Rundown, but log an error
						const previousReported = playlist.lastIncorrectPartPlaybackReported

						if (previousReported && Date.now() - previousReported > INCORRECT_PLAYING_PART_DEBOUNCE) {
							// first time this has happened for a while, let's try to progress the show:

							setRundownStartedPlayback(playlist, rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

							const playlistChange = literal<Partial<RundownPlaylist>>({
								previousPartInstanceId: null,
								currentPartInstanceId: playingPartInstance._id,
								lastIncorrectPartPlaybackReported: Date.now() // save the time to prevent the system to go in a loop
							})

							RundownPlaylists.update(playlist._id, {
								$set: playlistChange
							})
							playlist = _.extend(playlist, playlistChange)

							reportPartHasStarted(playingPartInstance, startedPlayback)

							const nextPart = selectNextPart(playlist, playingPartInstance, playlist.getAllOrderedParts())
							libSetNextPart(playlist, nextPart ? nextPart.part : null)
						}

						// TODO-ASAP - should this even change the next?
						logger.error(`PartInstance "${playingPartInstance._id}" has started playback by the playout gateway, but has not been selected for playback!`)
					}

					// Load the latest data and complete the take
					const rundownPlaylist = RundownPlaylists.findOne(rundown.playlistId)
					if (!rundownPlaylist) throw new Meteor.Error(404, `RundownPlaylist "${rundown.playlistId}", parent of rundown "${rundown._id}" not found!`)

					afterTake(rundownPlaylist.fetchAllPlayoutData(), playingPartInstance)
				}
			} else {
				throw new Meteor.Error(404, `PartInstance "${partInstanceId}" in rundown "${rundownId}" not found!`)
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Part has stopped playing
	 */
	export function onPartPlaybackStopped (_context: MethodContext, rundownId: RundownId, partInstanceId: PartInstanceId, stoppedPlayback: Time) {
		check(rundownId, String)
		check(partInstanceId, String)
		check(stoppedPlayback, Number)

		triggerWriteAccessBecauseNoCheckNecessary() // tmp

		const playlistId = getRundown(rundownId).playlistId

		return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			// This method is called when a part stops playing (like when an auto-next event occurs, or a manual next)

			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

			const partInstance = PartInstances.findOne({
				_id: partInstanceId,
				rundownId: rundownId
			})

			if (partInstance) {
				// make sure we don't run multiple times, even if TSR calls us multiple times

				const isPlaying = (
					partInstance.part.startedPlayback &&
					!partInstance.part.stoppedPlayback
				)
				if (isPlaying) {
					logger.info(`Playout reports PartInstance "${partInstanceId}" has stopped playback on timestamp ${(new Date(stoppedPlayback)).toISOString()}`)

					reportPartHasStopped(partInstance, stoppedPlayback)
				}
			} else {
				throw new Meteor.Error(404, `PartInstance "${partInstanceId}" in rundown "${rundownId}" not found!`)
			}
		})
	}
	/**
	 * Make a copy of a piece and start playing it now
	 */
	export function pieceTakeNow (context: MethodContext, rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(pieceInstanceIdOrPieceIdToCopy, String)

		const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

		return ServerPlayoutAdLibAPI.pieceTakeNow(playlist, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
	}
	export function segmentAdLibPieceStart (context: MethodContext, rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, adLibPieceId: PieceId, queue: boolean) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(adLibPieceId, String)

		const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

		return ServerPlayoutAdLibAPI.segmentAdLibPieceStart(playlist, partInstanceId, adLibPieceId, queue)
	}
	export function rundownBaselineAdLibPieceStart (context: MethodContext, rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, baselineAdLibPieceId: PieceId, queue: boolean) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(baselineAdLibPieceId, String)

		const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

		return ServerPlayoutAdLibAPI.rundownBaselineAdLibPieceStart(playlist, partInstanceId, baselineAdLibPieceId, queue)
	}
	export function sourceLayerStickyPieceStart (context: MethodContext, rundownPlaylistId: RundownPlaylistId, sourceLayerId: string) {
		check(rundownPlaylistId, String)
		check(sourceLayerId, String)

		const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)

		return ServerPlayoutAdLibAPI.sourceLayerStickyPieceStart(playlist, sourceLayerId)
	}
	export function sourceLayerOnPartStop (context: MethodContext, rundownPlaylistId: RundownPlaylistId, partInstanceId: PartInstanceId, sourceLayerIds: string[]) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(sourceLayerIds, Match.OneOf(String, Array))

		if (_.isString(sourceLayerIds)) sourceLayerIds = [sourceLayerIds]


		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			if (!playlist.active) throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
			if (playlist.currentPartInstanceId !== partInstanceId) throw new Meteor.Error(403, `Pieces can be only manipulated in a current part!`)

			const partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const lastStartedPlayback = partInstance.part.getLastStartedPlayback()
			if (!lastStartedPlayback) throw new Meteor.Error(405, `Part "${partInstanceId}" has yet to start playback!`)

			const rundown = Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(501, `Rundown "${partInstance.rundownId}" not found!`)

			const now = getCurrentTime()
			const relativeNow = now - lastStartedPlayback
			const orderedPieces = getResolvedPieces(partInstance)

			orderedPieces.forEach((pieceInstance) => {
				if (sourceLayerIds.indexOf(pieceInstance.piece.sourceLayerId) !== -1) {
					if (!pieceInstance.piece.userDuration) {
						let newExpectedDuration: number | undefined = undefined

						if (pieceInstance.piece.infiniteId && pieceInstance.piece.infiniteId !== pieceInstance.piece._id) {
							newExpectedDuration = now - lastStartedPlayback
						} else if (
							pieceInstance.piece.startedPlayback && // currently playing
							(pieceInstance.resolvedStart || 0) < relativeNow && // is relative, and has started
							!pieceInstance.piece.stoppedPlayback // and not yet stopped
						) {
							newExpectedDuration = now - pieceInstance.piece.startedPlayback
						}

						if (newExpectedDuration !== undefined) {
							console.log(`Cropping PieceInstance "${pieceInstance._id}" to ${newExpectedDuration}`)

							PieceInstances.update({
								_id: pieceInstance._id
							}, {
								$set: {
									'piece.userDuration': {
										duration: newExpectedDuration
									}
								}
							})

							// TODO-PartInstance - pending new data flow
							Pieces.update({
								_id: pieceInstance.piece._id
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

			updateSourceLayerInfinitesAfterPart(rundown, partInstance.part)

			updateTimeline(playlist.studioId)
		})
	}
	export function rundownTogglePartArgument (
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		property: string,
		value: string
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const playlist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part Arguments can not be toggled when hold is used!`)
			}

			let partInstance = PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const rundown = Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(501, `Rundown "${partInstance.rundownId}" not found!`)

			const rArguments = partInstance.part.runtimeArguments || {}

			if (rArguments[property] === value) {
				// unset property
				const mUnset: any = {}
				const mUnset1: any = {}
				mUnset['runtimeArguments.' + property] = 1
				mUnset1['part.runtimeArguments.' + property] = 1
				Parts.update(partInstance.part._id, {$unset: mUnset, $set: {
					dirty: true
				}})
				PartInstances.update(partInstance._id, {$unset: mUnset1, $set: {
					dirty: true
				}})
				delete rArguments[property]
			} else {
				// set property
				const mSet: any = {}
				const mSet1: any = {}
				mSet['runtimeArguments.' + property] = value
				mSet1['part.runtimeArguments.' + property] = value
				mSet.dirty = true
				Parts.update(partInstance.part._id, { $set: mSet })
				PartInstances.update(partInstance._id, { $set: mSet1 })

				rArguments[property] = value
			}

			refreshPart(rundown, partInstance.part)

			// Only take time to update the timeline if there's a point to do it
			if (playlist.active) {
				// If this part is rundown's next, check if current part has autoNext
				if ((playlist.nextPartInstanceId === partInstance._id) && playlist.currentPartInstanceId) {
					const currentPartInstance = PartInstances.findOne(playlist.currentPartInstanceId)
					if (currentPartInstance && currentPartInstance.part.autoNext) {
						updateTimeline(rundown.studioId)
					}
				// If this is rundown's current part, update immediately
				} else if (playlist.currentPartInstanceId === partInstance._id) {
					updateTimeline(rundown.studioId)
				}
			}
			return ClientAPI.responseSuccess(undefined)
		})
	}
	/**
	 * Called from Playout-gateway when the trigger-time of a timeline object has updated
	 * ( typically when using the "now"-feature )
	 */
	export function timelineTriggerTimeUpdateCallback (_context: MethodContext, activeRundownIds: RundownId[], timelineObj: TimelineObjGeneric, time: number) {
		check(timelineObj, Object)
		check(time, Number)

		triggerWriteAccessBecauseNoCheckNecessary() // tmp

		if (activeRundownIds && activeRundownIds.length > 0 && timelineObj.metadata && timelineObj.metadata.pieceId) {
			logger.debug('Update PieceInstance: ', timelineObj.metadata.pieceId, (new Date(time)).toTimeString())
			PieceInstances.update({
				_id: timelineObj.metadata.pieceId,
				rundownId: { $in: activeRundownIds }
			}, {
				$set: {
					'piece.enable.start': time
				}
			})

			const pieceInstance = PieceInstances.findOne({
				_id: timelineObj.metadata.pieceId,
				rundownId: { $in: activeRundownIds }
			})
			if (pieceInstance) {
				// TODO-PartInstance - pending new data flow
				Pieces.update({
					_id: pieceInstance.piece._id,
					rundownId: { $in: activeRundownIds }
				}, {
					$set: {
						'enable.start': time
					}
				})
				PieceInstances.update({
					_id: pieceInstance._id,
					rundownId: { $in: activeRundownIds }
				}, {
					$set: {
						'piece.enable.start': time
					}
				})
			}
		}
	}
	export function updateStudioBaseline (context: MethodContext, studioId: StudioId) {
		check(studioId, String)

		// TODO - should there be a studio lock for activate/deactivate/this?
		StudioContentWriteAccess.baseline(context, studioId)

		const activeRundowns = areThereActiveRundownPlaylistsInStudio(studioId)
		if (activeRundowns.length === 0) {
			// This is only run when there is no rundown active in the studio
			updateTimeline(studioId)
		}

		return shouldUpdateStudioBaseline(context, studioId)
	}
	export function shouldUpdateStudioBaseline (context: MethodContext, studioId: StudioId): string | false {
		check(studioId, String)

		StudioContentWriteAccess.baseline(context, studioId)

		const studio = Studios.findOne(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)

		const activeRundowns = areThereActiveRundownPlaylistsInStudio(studio._id)

		if (activeRundowns.length === 0) {
			const markerId: TimelineObjId = protectString(`${studio._id}_baseline_version`)
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
function checkAccessAndGetPlaylist (context: MethodContext, playlistId: RundownPlaylistId): RundownPlaylist {
	const access = RundownPlaylistContentWriteAccess.playout(context, playlistId)
	const playlist = access.playlist
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${playlistId}" not found!`)
	return playlist
}

export function setNextPartInner (
	playlist: RundownPlaylist,
	nextPartId: PartId | DBPart | null,
	setManually?: boolean,
	nextTimeOffset?: number | undefined
) {
	if (!playlist.active) throw new Meteor.Error(501, `Rundown Playlist "${playlist._id}" is not active!`)

	if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) throw new Meteor.Error(501, `Rundown "${playlist._id}" cannot change next during hold!`)

	let nextPart: DBPart | null = null
	if (nextPartId) {
		if (isStringOrProtectedString(nextPartId)) {
			nextPart = Parts.findOne(nextPartId) || null
		} else if (_.isObject(nextPartId)) {
			nextPart = nextPartId
		}
		if (!nextPart) throw new Meteor.Error(404, `Part "${nextPartId}" not found!`)
	}

	libSetNextPart(playlist, nextPart, setManually, nextTimeOffset)

	// remove old auto-next from timeline, and add new one
	updateTimeline(playlist.studioId)
}

function beforeTake (playoutData: RundownPlaylistPlayoutData, currentPartInstance: PartInstance | null, nextPartInstance: PartInstance) {
	// TODO-PartInstance - is this going to work? It needs some work to handle part data changes
	if (currentPartInstance) {
		const adjacentPart = _.find(playoutData.parts, (part) => {
			return (
				part.segmentId === currentPartInstance.segmentId &&
				part._rank > currentPartInstance.part._rank
			)
		})
		if (!adjacentPart || adjacentPart._id !== nextPartInstance.part._id) {
			// adjacent Part isn't the next part, do not overflow
			return
		}
		let ps: Array<Promise<any>> = []
		const currentPieces = currentPartInstance.getAllPieceInstances()
		currentPieces.forEach((instance) => {
			if (instance.piece.overflows && typeof instance.piece.enable.duration === 'number' && instance.piece.enable.duration > 0 && instance.piece.playoutDuration === undefined && instance.piece.userDuration === undefined) {
				// Subtract the amount played from the duration
				const remainingDuration = Math.max(0, instance.piece.enable.duration - ((instance.piece.startedPlayback || currentPartInstance.part.getLastStartedPlayback() || getCurrentTime()) - getCurrentTime()))

				if (remainingDuration > 0) {
					// Clone an overflowing piece
					let overflowedItem = literal<PieceInstance>({
						_id: getRandomId(),
						rundownId: instance.rundownId,
						partInstanceId: nextPartInstance._id,
						piece: {
							..._.omit(instance.piece, 'startedPlayback', 'duration', 'overflows'),
							_id: getRandomId(),
							partId: nextPartInstance.part._id,
							enable: {
								start: 0,
								duration: remainingDuration,
							},
							dynamicallyInserted: true,
							continuesRefId: instance.piece._id,
						}
					})

					ps.push(asyncCollectionInsert(PieceInstances, overflowedItem))
					playoutData.selectedInstancePieces.push(overflowedItem) // update the cache

					// TODO-PartInstance - pending new data flow
					ps.push(asyncCollectionInsert(Pieces, overflowedItem.piece))
					playoutData.pieces.push(overflowedItem.piece) // update the cache
				}
			}
		})
		waitForPromiseAll(ps)
	}
}

function afterTake (
	playoutData: RundownPlaylistPlayoutData,
	takePartInstance: PartInstance,
	timeOffset: number | null = null
) {
	// This function should be called at the end of a "take" event (when the Parts have been updated)

	let forceNowTime: number | undefined = undefined
	if (timeOffset) {
		forceNowTime = getCurrentTime() - timeOffset
	}
	// or after a new part has started playing
	updateTimeline(playoutData.rundownPlaylist.studioId, forceNowTime, playoutData)

	// defer these so that the playout gateway has the chance to learn about the changes
	Meteor.setTimeout(() => {
		if (takePartInstance.part.shouldNotifyCurrentPlayingPart) {
			const currentRundown = playoutData.rundownsMap[unprotectString(takePartInstance.rundownId)]
			IngestActions.notifyCurrentPlayingPart(currentRundown, takePartInstance.part)
		}
	}, 40)
}

function setRundownStartedPlayback (playlist: RundownPlaylist, rundown: Rundown, startedPlayback: Time) {
	if (!rundown.startedPlayback) { // Set startedPlayback on the rundown if this is the first item to be played
		reportRundownHasStarted(playlist, rundown, startedPlayback)
	}
}

interface UpdateTimelineFromIngestDataTimeout {
	timeout?: number
	changedSegments: SegmentId[]
}
let updateTimelineFromIngestDataTimeouts: {
	[rundownId: string]: UpdateTimelineFromIngestDataTimeout
} = {}
export function triggerUpdateTimelineAfterIngestData (rundownId: RundownId, changedSegmentIds: SegmentId[]) {
	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	let data: UpdateTimelineFromIngestDataTimeout = updateTimelineFromIngestDataTimeouts[unprotectString(rundownId)]
	if (data) {
		if (data.timeout) Meteor.clearTimeout(data.timeout)
		data.changedSegments = data.changedSegments.concat(changedSegmentIds)
	} else {
		data = {
			changedSegments: changedSegmentIds
		}
	}

	data.timeout = Meteor.setTimeout(() => {
		delete updateTimelineFromIngestDataTimeouts[unprotectString(rundownId)]

		// infinite items only need to be recalculated for those after where the edit was made (including the edited line)
		let prevPart: Part | undefined
		if (data.changedSegments) {
			const firstSegment = Segments.findOne({
				rundownId: rundownId,
				_id: { $in: data.changedSegments }
			})
			if (firstSegment) {
				prevPart = getPartBeforeSegment(rundownId, firstSegment)
			}
		}

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		const playlist = rundown.getRundownPlaylist()
		if (!playlist) throw new Meteor.Error(501, `Rundown "${rundownId}" not a part of a playlist: "${rundown.playlistId}"`)

		// TODO - test the input data for this
		updateSourceLayerInfinitesAfterPart(rundown, prevPart, true)

		return rundownPlaylistSyncFunction(playlist._id, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			if (playlist.active && playlist.currentPartInstanceId) {
				const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
				if (currentPartInstance && (currentPartInstance.rundownId === rundown._id || (currentPartInstance.part.autoNext && nextPartInstance && nextPartInstance.rundownId === rundownId))) {
					updateTimeline(rundown.studioId)
				}
			}
		})
	}, 1000)

	updateTimelineFromIngestDataTimeouts[unprotectString(rundownId)] = data
}

function getRundown (rundownId: RundownId): Rundown {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, 'Rundown ' + rundownId + ' not found')
	return rundown
}
