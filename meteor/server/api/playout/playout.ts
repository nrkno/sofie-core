
/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Rundowns, Rundown, RundownHoldState } from '../../../lib/collections/Rundowns'
import { Part, Parts, DBPart } from '../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
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
	normalizeArray} from '../../../lib/lib'
import { Timeline, TimelineObjGeneric } from '../../../lib/collections/Timeline'
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
import { RundownPlaylist, RundownPlaylists, RundownPlaylistPlayoutData } from '../../../lib/collections/RundownPlaylists'
import { getBlueprintOfRundown } from '../blueprints/cache'
import { PartEventContext, RundownContext } from '../blueprints/context'
import { IngestActions } from '../ingest/actions'
import { updateTimeline } from './timeline'
import {
	resetRundownPlaylist as libResetRundownPlaylist,
	setNextPart as libSetNextPart,
	onPartHasStoppedPlaying,
	refreshPart,
	getPartBeforeSegment,
	selectNextPart
} from './lib'
import {
	prepareStudioForBroadcast,
	activateRundownPlaylist as libActivateRundownPlaylist,
	deactivateRundownPlaylist as libDeactivateRundownPlaylist,
	deactivateRundownPlaylistInner
} from './actions'
import { PieceResolved, getOrderedPiece, getResolvedPieces, convertAdLibToPieceInstance, convertPieceToAdLibPiece } from './pieces'
import { PackageInfo } from '../../coreSystem'
import { areThereActiveRundownPlaylistsInStudio } from './studio'
import { updateSourceLayerInfinitesAfterPart, cropInfinitesOnLayer, stopInfinitesRunningOnLayer } from './infinites'
import { rundownSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'
import { ServerPlayoutAdLibAPI } from './adlib'
import { PieceInstances, PieceInstance } from '../../../lib/collections/PieceInstances'
import { PartInstances, PartInstance } from '../../../lib/collections/PartInstances'

/**
 * debounce time in ms before we accept another report of "Part started playing that was not selected by core"
 */
const INCORRECT_PLAYING_PART_DEBOUNCE = 5000
/**
 * time in ms before an autotake when we don't accept takes
 */
const AUTOTAKE_DEBOUNCE = 1000

export namespace ServerPlayoutAPI {
	/**
	 * Prepare the rundown for transmission
	 * To be triggered well before the broadcast, since it may take time and cause outputs to flicker
	 */
	export function prepareRundownForBroadcast (rundownPlaylistId: string) {
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (playlist.active) throw new Meteor.Error(404, `rundownPrepareForBroadcast cannot be run on an active rundown!`)

			const anyOtherActiveRundowns = areThereActiveRundownPlaylistsInStudio(playlist.studioId, playlist._id)
			if (anyOtherActiveRundowns.length) {
				// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
				throw new Meteor.Error(409, 'Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
			}

			libResetRundownPlaylist(playlist)
			prepareStudioForBroadcast(playlist.getStudio())

			return libActivateRundownPlaylist(playlist, true) // Activate rundown (rehearsal)
		})
	}
	/**
	 * Reset the broadcast, to be used during testing.
	 * The User might have run through the rundown and wants to start over and try again
	 */
	export function resetRundown (rundownPlaylistId: string) {
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (playlist.active && !playlist.rehearsal) throw new Meteor.Error(401, `rundownResetBroadcast can only be run in rehearsal!`)

			libResetRundownPlaylist(playlist)

			updateTimeline(playlist.studioId)

			return { success: 200 }
		})
	}
	/**
	 * Activate the rundown, final preparations before going on air
	 * To be triggered by the User a short while before going on air
	 */
	export function resetAndActivateRundown (rundownPlaylistId: string, rehearsal?: boolean) {
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (playlist.active && !playlist.rehearsal) throw new Meteor.Error(402, `rundownResetAndActivate cannot be run when active!`)

			libResetRundownPlaylist(playlist)

			return libActivateRundownPlaylist(playlist, !!rehearsal) // Activate rundown
		})
	}
	/**
	 * Activate the rundownPlaylist, decativate any other running rundowns
	 */
	export function forceResetAndActivateRundownPlaylist (rundownPlaylistId: string, rehearsal: boolean) {
		check(rehearsal, Boolean)
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)

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

			return libActivateRundownPlaylist(playlist, rehearsal)
		})
	}
	/**
	 * Only activate the rundown, don't reset anything
	 */
	export function activateRundown (rundownPlaylistId: string, rehearsal: boolean) {
		check(rehearsal, Boolean)
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)

			return libActivateRundownPlaylist(playlist, rehearsal)
		})
	}
	/**
	 * Deactivate the rundown
	 */
	export function deactivateRundown (rundownPlaylistId: string) {
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)

			return libDeactivateRundownPlaylist(playlist)
		})
	}
	/**
	 * Trigger a reload of data of the rundown
	 */
	export function reloadData (rundownPlaylistId: string) {
		// Reload and reset the Rundown
		check(rundownPlaylistId, String)
		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			const rundowns = Rundowns.find({
				playlistId: playlist._id
			}).fetch()

			const all = rundowns.map(r => IngestActions.reloadRundown(r))

			const response = all.join(', ')

			return ClientAPI.responseSuccess(
				response
			)
		})
	}
	/**
	 * Take the currently Next:ed Part (start playing it)
	 */
	export function takeNextPart (rundownPlaylistId: string): ClientAPI.ClientResponse {
		let now = getCurrentTime()

		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
			if (!playlist.active) throw new Meteor.Error(501, `RundownPlaylist "${rundownPlaylistId}" is not active!`)
			if (!playlist.nextPartInstanceId) throw new Meteor.Error(500, 'nextPartInstanceId is not set!')

			let timeOffset: number | null = playlist.nextTimeOffset || null

			let firstTake = !playlist.startedPlayback
			let rundownData = playlist.fetchAllPlayoutData()

			const partInstance = rundownData.currentPartInstance || rundownData.nextPartInstance
			const currentRundown = partInstance ? rundownData.rundownsMap[partInstance.rundownId] : undefined
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

				const offset = currentPart.part.getLastPlayOffset()
				if (start && offset && currentPart.part.expectedDuration) {
					// date.now - start = playback duration, duration + offset gives position in part
					const playbackDuration = Date.now() - start! + offset!

					// If there is an auto next planned
					if (currentPart.part.autoNext && Math.abs(currentPart.part.expectedDuration - playbackDuration) < AUTOTAKE_DEBOUNCE) {
						return ClientAPI.responseError('Cannot take shortly before an autoTake')
					}
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
				return ClientAPI.responseSuccess()
			}

			let previousPartInstance = rundownData.currentPartInstance || null
			let takePartInstance = rundownData.nextPartInstance
			if (!takePartInstance) throw new Meteor.Error(404, 'takePart not found!')
			const takeRundown: Rundown | undefined = rundownData.rundownsMap[takePartInstance.rundownId]
			if (!takeRundown) throw new Meteor.Error(500, `takeRundown: takeRundown not found! ("${takePartInstance.rundownId}")`)
			// let takeSegment = rundownData.segmentsMap[takePart.segmentId]
			const nextPart = selectNextPart(takePartInstance, rundownData.parts)

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

				const context = new RundownContext(takeRundown)
				previousPartEndState = blueprint.getEndStateForPart(context, playlist.previousPersistentState, previousPartInstance.part.previousPartEndState, resolvedPieces, time)
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
				},
				$push: {
					'part.timings.take': now,
					'part.timings.playOffset': timeOffset || 0
				}
			}
			let partM = {
				$push: {
					'timings.take': now,
					'timings.playOffset': timeOffset || 0
				}
			}
			if (previousPartEndState) {
				partInstanceM['$set']['part.previousPartEndState'] = previousPartEndState
				partM['$set'] = literal<Partial<Part>>({
					previousPartEndState: previousPartEndState
				})
			} else {
				partInstanceM['$unset'] = {
					'part.previousPartEndState': 1
				}
				partM['$unset'] = {
					previousPartEndState: 1
				}
			}
			ps.push(asyncCollectionUpdate(PartInstances, takePartInstance._id, partInstanceM))
			// TODO-PartInstance - pending new data flow
			ps.push(asyncCollectionUpdate(Parts, takePartInstance.part._id, partM))

			if (m.previousPartInstanceId) {
				ps.push(asyncCollectionUpdate(Parts, m.previousPartInstanceId, {
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

			libSetNextPart(playlist, nextPart ? nextPart.part : null)
			waitForPromiseAll(ps)
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
					newPieceTmp._id = instance.piece._id + '_hold'

					// This gets deleted once the nextpart is activated, so it doesnt linger for long
					ps.push(asyncCollectionUpsert(Pieces, newPieceTmp._id, newPieceTmp))
					rundownData.pieces.push(newPieceTmp) // update the local collection

					// make the extension
					const newInstance = literal<PieceInstance>({
						_id: instance._id + '_hold',
						rundownId: instance.rundownId,
						partInstanceId: currentPartInstance._id,
						piece: {
							...clone(instance.piece),
							_id: instance.piece._id + '_hold',
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

			return ClientAPI.responseSuccess()
		})
	}
	export function setNextPart (
		rundownPlaylistId: string,
		nextPartId: string | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	): ClientAPI.ClientResponse {
		check(rundownPlaylistId, String)
		if (nextPartId) check(nextPartId, String)

		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)

			setNextPartInner(playlist, nextPartId, setManually, nextTimeOffset)

			return ClientAPI.responseSuccess()
		})
	}
	export function setNextPartInner (
		playlist: RundownPlaylist,
		nextPartId: string | DBPart | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	) {
		if (!playlist.active) throw new Meteor.Error(501, `Rundown Playlist "${playlist._id}" is not active!`)

		if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) throw new Meteor.Error(501, `Rundown "${playlist._id}" cannot change next during hold!`)

		let nextPart: DBPart | null = null
		if (nextPartId) {
			if (_.isString(nextPartId)) {
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
	export function moveNextPart (
		rundownPlaylistId: string,
		horizontalDelta: number,
		verticalDelta: number,
		setManually: boolean
	): string | null {
		check(rundownPlaylistId, String)
		check(horizontalDelta, Number)
		check(verticalDelta, Number)

		if (!horizontalDelta && !verticalDelta) throw new Meteor.Error(402, `rundownMoveNext: invalid delta: (${horizontalDelta}, ${verticalDelta})`)

		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			return moveNextPartInner(
				rundownPlaylistId,
				horizontalDelta,
				verticalDelta,
				setManually
			)
		})
	}
	function moveNextPartInner (
		rundownPlaylistId: string,
		horizontalDelta: number,
		verticalDelta: number,
		setManually: boolean,
		nextPartId0?: string
	): string | null {

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
				partsInSegments[segment._id] = partsInSegment
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

			const part = _.first(partsInSegments[segment._id]) as Part
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
	export function activateHold (rundownPlaylistId: string) {
		check(rundownPlaylistId, String)
		logger.debug('rundownActivateHold')

		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)

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

			return ClientAPI.responseSuccess()
		})
	}
	export function deactivateHold (rundownPlaylistId: string) {
		check(rundownPlaylistId, String)
		logger.debug('deactivateHold')

		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)

			if (playlist.holdState !== RundownHoldState.PENDING) throw new Meteor.Error(400, `RundownPlaylist "${rundownPlaylistId}" is not pending a hold!`)

			Rundowns.update(rundownPlaylistId, { $set: { holdState: RundownHoldState.NONE } })

			updateTimeline(playlist.studioId)

			return ClientAPI.responseSuccess()
		})
	}
	export function disableNextPiece (rundownPlaylistId: string, undo?: boolean) {
		check(rundownPlaylistId, String)

		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
			if (!playlist.currentPartInstanceId) throw new Meteor.Error(401, `No current part!`)

			const studio = playlist.getStudio()

			const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
			if (!currentPartInstance) throw new Meteor.Error(404, `PartInstance "${playlist.currentPartInstanceId}" not found!`)

			const rundown = Rundowns.findOne(currentPartInstance.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${currentPartInstance.rundownId}" not found!`)
			const showStyleBase = rundown.getShowStyleBase()

			// @ts-ignore stringify
			// logger.info(o)
			// logger.info(JSON.stringify(o, '', 2))

			const allowedSourceLayers = normalizeArray(showStyleBase.sourceLayers)

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

				let pieces: Array<PieceResolved> = getOrderedPiece(partInstance)

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
	export function onPiecePlaybackStarted (rundownId: string, pieceInstanceId: string, startedPlayback: Time) {
		check(rundownId, String)
		check(pieceInstanceId, String)
		check(startedPlayback, Number)

		// TODO - confirm this is correct
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			// This method is called when an auto-next event occurs
			const pieceInstance = PieceInstances.findOne({
				_id: pieceInstanceId,
				rundownId: rundownId
			})
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
	export function onPiecePlaybackStopped (rundownId: string, pieceInstanceId: string, stoppedPlayback: Time) {
		check(rundownId, String)
		check(pieceInstanceId, String)
		check(stoppedPlayback, Number)

		// TODO - confirm this is correct
		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
			// This method is called when an auto-next event occurs
			const pieceInstance = PieceInstances.findOne({
				_id: pieceInstanceId,
				rundownId: rundownId
			})
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
	export function onPartPlaybackStarted (rundownId: string, partInstanceId: string, startedPlayback: Time) {
		check(rundownId, String)
		check(partInstanceId, String)
		check(startedPlayback, Number)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
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

						const nextPart = selectNextPart(playingPartInstance, playlist.getParts())
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

							const nextPart = selectNextPart(playingPartInstance, playlist.getParts())
							libSetNextPart(playlist, nextPart ? nextPart.part : null)
						}

						// TODO - should this even change the next?
						logger.error(`PartInstance "${playingPartInstance._id}" has started playback by the playout gateway, but has not been selected for playback!`)
					}

					reportPartHasStarted(playingPartInstance, startedPlayback)

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
	export function onPartPlaybackStopped (rundownId: string, partInstanceId: string, stoppedPlayback: Time) {
		check(rundownId, String)
		check(partInstanceId, String)
		check(stoppedPlayback, Number)

		return rundownSyncFunction(rundownId, RundownSyncFunctionPriority.Playout, () => {
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
	export function pieceTakeNow (rundownId: string, partInstanceId: string, pieceInstanceIdOrPieceIdToCopy: string) {
		check(rundownId, String)
		check(partInstanceId, String)
		check(pieceInstanceIdOrPieceIdToCopy, String)

		return ServerPlayoutAdLibAPI.pieceTakeNow(rundownId, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
	}
	export function segmentAdLibPieceStart (rundownPlaylistId: string, partInstanceId: string, adLibPieceId: string, queue: boolean) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(adLibPieceId, String)

		return ServerPlayoutAdLibAPI.segmentAdLibPieceStart(rundownPlaylistId, partInstanceId, adLibPieceId, queue)
	}
	export function rundownBaselineAdLibPieceStart (rundownPlaylistId: string, partInstanceId: string, baselineAdLibPieceId: string, queue: boolean) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(baselineAdLibPieceId, String)

		return ServerPlayoutAdLibAPI.rundownBaselineAdLibPieceStart(rundownPlaylistId, partInstanceId, baselineAdLibPieceId, queue)
	}
	export function stopAdLibPiece (rundownPlaylistId: string, partInstanceId: string, pieceInstanceId: string) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(pieceInstanceId, String)

		return ServerPlayoutAdLibAPI.stopAdLibPiece(rundownPlaylistId, partInstanceId, pieceInstanceId)
	}
	export function sourceLayerStickyPieceStart (rundownPlaylistId: string, sourceLayerId: string) {
		check(rundownPlaylistId, String)
		check(sourceLayerId, String)

		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
			if (!playlist.active) throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
			if (!playlist.currentPartInstanceId) throw new Meteor.Error(400, `A part needs to be active to place a sticky item`)

			const currentPartInstance = PartInstances.findOne(playlist.currentPartInstanceId)
			if (!currentPartInstance) throw new Meteor.Error(501, `Current PartInstance "${playlist.currentPartInstanceId}" could not be found.`)

			const rundown = Rundowns.findOne(currentPartInstance.rundownId)
			if (!rundown) throw new Meteor.Error(501, `Current Rundown "${currentPartInstance.rundownId}" could not be found`)

			let showStyleBase = rundown.getShowStyleBase()

			const sourceLayer = showStyleBase.sourceLayers.find(i => i._id === sourceLayerId)
			if (!sourceLayer) throw new Meteor.Error(404, `Source layer "${sourceLayerId}" not found!`)
			if (!sourceLayer.isSticky) throw new Meteor.Error(400, `Only sticky layers can be restarted. "${sourceLayerId}" is not sticky.`)

			// TODO-ASAP use PieceInstance? and consider other rundowns
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
				const lastPiece = convertPieceToAdLibPiece(lastPieces[0])
				const newAdLibPieceInstance = convertAdLibToPieceInstance(lastPiece, currentPartInstance, false)

				PieceInstances.insert(newAdLibPieceInstance)
				// TODO-PartInstance - pending new data flow
				Pieces.insert(newAdLibPieceInstance.piece)

				// logger.debug('adLibItemStart', newPiece)

				cropInfinitesOnLayer(rundown, currentPartInstance, newAdLibPieceInstance)
				stopInfinitesRunningOnLayer(playlist, rundown, currentPartInstance, newAdLibPieceInstance.piece.sourceLayerId)

				updateTimeline(playlist.studioId)
			}
		})
	}
	export function sourceLayerOnPartStop (rundownPlaylistId: string, partInstanceId: string, sourceLayerId: string) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(sourceLayerId, String)

		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
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

			// TODO-ASAP - can this be changed to a custom instance??
			orderedPieces.forEach((pieceInstance) => {
				if (pieceInstance.piece.sourceLayerId === sourceLayerId) {
					if (!pieceInstance.piece.userDuration) {
						let newExpectedDuration: number | undefined = undefined

						if (pieceInstance.piece.infiniteId && pieceInstance.piece.infiniteId !== pieceInstance.piece._id) {
							newExpectedDuration = now - lastStartedPlayback
						} else if (
							pieceInstance.piece.startedPlayback && // currently playing
							_.isNumber(pieceInstance.piece.enable.start) &&
							(pieceInstance.piece.enable.start || 0) < relativeNow && // is relative, and has started
							!pieceInstance.piece.stoppedPlayback // and not yet stopped
						) {
							newExpectedDuration = now - pieceInstance.piece.startedPlayback
						}

						if (newExpectedDuration !== undefined) {
							console.log(`Cropping PieceInstance "${pieceInstance._id}" at ${newExpectedDuration}`)

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
	export function rundownTogglePartArgument (rundownPlaylistId: string, partInstanceId: string, property: string, value: string) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)

		return rundownSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.Playout, () => {
			const playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
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
				Parts.update(partInstance.part._id, {$unset: mUnset1, $set: {
					dirty: true
				}})
				PartInstances.update(partInstance._id, {$unset: mUnset, $set: {
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
			return ClientAPI.responseSuccess()
		})
	}
	/**
	 * Called from Playout-gateway when the trigger-time of a timeline object has updated
	 * ( typically when using the "now"-feature )
	 */
	export function timelineTriggerTimeUpdateCallback (activeRundownIds: string[], timelineObj: TimelineObjGeneric, time: number) {
		check(timelineObj, Object)
		check(time, Number)

		// TODO - this is a destructive action... It needs to either backup the original, or only run on dynamically inserted
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

			// TODO-PartInstance - pending new data flow
			const pieceInstance = PieceInstances.findOne({
				_id: timelineObj.metadata.pieceId,
				rundownId: { $in: activeRundownIds }
			})
			if (pieceInstance) {
				Pieces.update({
					_id: pieceInstance.piece._id,
					rundownId: { $in: activeRundownIds }
				}, {
					$set: {
						'enable.start': time
					}
				})
			}
		}
	}
	export function updateStudioBaseline (studioId: string) {
		check(studioId, String)

		// TODO - should there be a studio lock for activate/deactivate/this?

		const activeRundowns = areThereActiveRundownPlaylistsInStudio(studioId)
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

		const activeRundowns = areThereActiveRundownPlaylistsInStudio(studio._id)

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
						_id: Random.id(),
						rundownId: instance.rundownId,
						partInstanceId: nextPartInstance._id,
						piece: {
							..._.omit(instance.piece, 'startedPlayback', 'duration', 'overflows'),
							_id: Random.id(),
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
			const currentRundown = playoutData.rundownsMap[takePartInstance.rundownId]
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
	changedSegments: string[]
}
let updateTimelineFromIngestDataTimeouts: {
	[id: string]: UpdateTimelineFromIngestDataTimeout
} = {}
export function triggerUpdateTimelineAfterIngestData (rundownId: string, changedSegmentIds: Array<string>) {
	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	let data: UpdateTimelineFromIngestDataTimeout = updateTimelineFromIngestDataTimeouts[rundownId]
	if (data) {
		if (data.timeout) Meteor.clearTimeout(data.timeout)
		data.changedSegments = data.changedSegments.concat(changedSegmentIds)
	} else {
		data = {
			changedSegments: changedSegmentIds
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
				prevPart = getPartBeforeSegment(rundownId, firstSegment)
			}
		}

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		const playlist = rundown.getRundownPlaylist()
		if (!playlist) throw new Meteor.Error(501, `Rundown "${rundownId}" not a part of a playlist: "${rundown.playlistId}"`)

		// TODO - test the input data for this
		updateSourceLayerInfinitesAfterPart(rundown, prevPart, true)

		return rundownSyncFunction(playlist._id, RundownSyncFunctionPriority.Playout, () => {
			if (playlist.active && playlist.currentPartInstanceId) {
				const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
				if (currentPartInstance && (currentPartInstance.rundownId === rundown._id || (currentPartInstance.part.autoNext && nextPartInstance && nextPartInstance.rundownId === rundownId))) {
					updateTimeline(rundown.studioId)
				}
			}
		})
	}, 1000)

	updateTimelineFromIngestDataTimeouts[rundownId] = data
}
