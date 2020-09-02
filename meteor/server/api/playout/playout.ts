/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { Rundown, RundownHoldState, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { Part, DBPart, PartId } from '../../../lib/collections/Parts'
import { Piece, PieceId } from '../../../lib/collections/Pieces'
import {
	getCurrentTime,
	Time,
	waitForPromise,
	normalizeArray,
	unprotectString,
	protectString,
	isStringOrProtectedString,
	getRandomId,
} from '../../../lib/lib'
import { TimelineObjGeneric, TimelineObjId } from '../../../lib/collections/Timeline'
import { Segment, SegmentId } from '../../../lib/collections/Segments'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { PartHoldMode } from 'tv-automation-sofie-blueprints-integration'
import { StudioId } from '../../../lib/collections/Studios'
import { ClientAPI } from '../../../lib/api/client'
import {
	reportRundownHasStarted,
	reportPartHasStarted,
	reportPieceHasStarted,
	reportPartHasStopped,
	reportPieceHasStopped,
} from '../asRunLog'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { NotesContext } from '../blueprints/context/context'
import { ActionExecutionContext, ActionPartChange } from '../blueprints/context/adlibActions'
import { IngestActions } from '../ingest/actions'
import { updateTimeline } from './timeline'
import {
	resetRundownPlaylist as libResetRundownPlaylist,
	setNextPart as libsetNextPart,
	setNextSegment as libSetNextSegment,
	onPartHasStoppedPlaying,
	selectNextPart,
	getSegmentsAndPartsFromCache,
	getSelectedPartInstancesFromCache,
	getRundownsFromCache,
	getAllOrderedPartsFromCache,
	getAllPieceInstancesFromCache,
	checkAccessAndGetPlaylist,
} from './lib'
import {
	prepareStudioForBroadcast,
	activateRundownPlaylist as libActivateRundownPlaylist,
	deactivateRundownPlaylist as libDeactivateRundownPlaylist,
	deactivateRundownPlaylistInner,
	standDownStudio,
} from './actions'
import { sortPieceInstancesByStart } from './pieces'
import { PackageInfo } from '../../coreSystem'
import { getActiveRundownPlaylistsInStudio, getActiveRundownPlaylistsInStudio2 } from './studio'
import { rundownPlaylistSyncFunction, RundownSyncFunctionPriority, studioSyncFunction } from '../ingest/rundownInput'
import { ServerPlayoutAdLibAPI } from './adlib'
import { PieceInstances, PieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { PartInstances, PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { ReloadRundownPlaylistResponse } from '../../../lib/api/userActions'
import { MethodContext } from '../../../lib/api/methods'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../../security/lib/securityVerify'
import { StudioContentWriteAccess } from '../../security/studio'
import { CacheForPlayout, CacheForPlayoutPreInit, CacheForStudio2 } from '../../DatabaseCaches'
import { takeNextPartInner, afterTake, takeNextPartInnerSync } from './take'
import { syncPlayheadInfinitesForNextPartInstance } from './infinites'
import { check, Match } from '../../../lib/check'
import { Settings } from '../../../lib/Settings'
import { ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { syncFunction } from '../../codeControl'
import { PeripheralDevice } from '../../../lib/collections/PeripheralDevices'

/**
 * debounce time in ms before we accept another report of "Part started playing that was not selected by core"
 */
const INCORRECT_PLAYING_PART_DEBOUNCE = 5000

export function rundownPlaylistPlayoutSyncFunction<T>(
	context: MethodContext | null,
	rundownPlaylistId: RundownPlaylistId,
	preInitFcn: null | ((cache: CacheForPlayoutPreInit) => void),
	fcn: (cache: CacheForPlayout) => T
): T {
	let tmpPlaylist: RundownPlaylist
	if (context) {
		tmpPlaylist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	} else {
		const pl = RundownPlaylists.findOne(rundownPlaylistId)
		if (!pl) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
		tmpPlaylist = pl
	}

	return syncFunction(() => {
		return syncFunction(
			() => {
				const cache = waitForPromise(CacheForPlayout.create(tmpPlaylist))

				if (preInitFcn) {
					preInitFcn(cache)
				}

				waitForPromise(cache.initContent())

				const res = fcn(cache)

				waitForPromise(cache.saveAllToDatabase())

				return res
			},
			`rundown_playlist_${rundownPlaylistId}`,
			undefined,
			RundownSyncFunctionPriority.USER_PLAYOUT
		)()
	}, `studio_${tmpPlaylist.studioId}`)()
}

export namespace ServerPlayoutAPI {
	/**
	 * Prepare the rundown for transmission
	 * To be triggered well before the broadcast, since it may take time and cause outputs to flicker
	 */
	export function prepareRundownPlaylistForBroadcast(context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (playlist.active)
					throw new Meteor.Error(404, `rundownPrepareForBroadcast cannot be run on an active rundown!`)

				const anyOtherActiveRundowns = getActiveRundownPlaylistsInStudio(null, playlist.studioId, playlist._id)
				if (anyOtherActiveRundowns.length) {
					// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
					throw new Meteor.Error(
						409,
						'Only one rundown can be active at the same time. Active rundowns: ' +
							_.map(anyOtherActiveRundowns, (rundown) => rundown._id)
					)
				}
			},
			(cache) => {
				const playlist = cache.Playlist.doc

				libResetRundownPlaylist(cache)
				prepareStudioForBroadcast(true, playlist)

				libActivateRundownPlaylist(cache, true) // Activate rundownPlaylist (rehearsal)
			}
		)
	}
	/**
	 * Reset the broadcast, to be used during testing.
	 * The User might have run through the rundown and wants to start over and try again
	 */
	export function resetRundownPlaylist(context: MethodContext, rundownPlaylistId: RundownPlaylistId): void {
		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (playlist.active && !playlist.rehearsal && !Settings.allowRundownResetOnAir)
					throw new Meteor.Error(401, `resetRundown can only be run in rehearsal!`)
			},
			(cache) => {
				const playlist = cache.Playlist.doc
				libResetRundownPlaylist(cache)

				updateTimeline(cache, playlist.studioId)
			}
		)
	}
	/**
	 * Activate the rundown, final preparations before going on air
	 * To be triggered by the User a short while before going on air
	 */
	export function resetAndActivateRundownPlaylist(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal?: boolean
	) {
		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (playlist.active && !playlist.rehearsal && !Settings.allowRundownResetOnAir)
					throw new Meteor.Error(402, `resetAndActivateRundownPlaylist cannot be run when active!`)
			},
			(cache) => {
				const playlist = cache.Playlist.doc
				libResetRundownPlaylist(cache)
				prepareStudioForBroadcast(true, playlist)

				libActivateRundownPlaylist(cache, !!rehearsal) // Activate rundown
			}
		)
	}
	/**
	 * Activate the rundownPlaylist, decativate any other running rundowns
	 */
	export function forceResetAndActivateRundownPlaylist(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	) {
		check(rehearsal, Boolean)
		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc

				let anyOtherActiveRundowns = getActiveRundownPlaylistsInStudio(null, playlist.studioId, playlist._id)
				let error: any
				_.each(anyOtherActiveRundowns, (otherRundownPlaylist) => {
					try {
						// TODO - syncFunction
						deactivateRundownPlaylistInner(cache, otherRundownPlaylist)
					} catch (e) {
						error = e
					}
				})
				if (error) {
					// Ok, something went wrong, but check if the active rundowns where deactivated?
					anyOtherActiveRundowns = getActiveRundownPlaylistsInStudio(null, playlist.studioId, playlist._id)
					if (anyOtherActiveRundowns.length) {
						// No they weren't, we can't continue..
						throw error
					} else {
						// They where deactivated, log the error and continue
						logger.error(error)
					}
				}
			},
			(cache) => {
				const playlist = cache.Playlist.doc
				libResetRundownPlaylist(cache)
				prepareStudioForBroadcast(true, playlist)

				libActivateRundownPlaylist(cache, rehearsal)
			}
		)
	}
	/**
	 * Only activate the rundown, don't reset anything
	 */
	export function activateRundownPlaylist(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	) {
		check(rehearsal, Boolean)
		return rundownPlaylistPlayoutSyncFunction(context, rundownPlaylistId, null, (cache) => {
			const playlist = cache.Playlist.doc

			prepareStudioForBroadcast(true, playlist)

			libActivateRundownPlaylist(cache, rehearsal)
		})
	}
	/**
	 * Deactivate the rundown
	 */
	export function deactivateRundownPlaylist(context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
		return rundownPlaylistPlayoutSyncFunction(context, rundownPlaylistId, null, (cache) => {
			standDownStudio(cache, cache.Studio.doc, true)
			libDeactivateRundownPlaylist(cache)
		})
	}
	/**
	 * Trigger a reload of data of the rundown
	 */
	export function reloadRundownPlaylistData(context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
		// Reload and reset the Rundown
		check(rundownPlaylistId, String)
		return rundownPlaylistPlayoutSyncFunction(context, rundownPlaylistId, null, (cache) => {
			const rundowns = getRundownsFromCache(cache)
			const response: ReloadRundownPlaylistResponse = {
				rundownsResponses: rundowns.map((rundown) => {
					return {
						rundownId: rundown._id,
						response: IngestActions.reloadRundown(rundown),
					}
				}),
			}

			return response
		})
	}
	/**
	 * Take the currently Next:ed Part (start playing it)
	 */
	export function takeNextPart(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId
	): ClientAPI.ClientResponse<void> {
		check(rundownPlaylistId, String)

		return takeNextPartInner(context, rundownPlaylistId)
	}

	export function setNextPart(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		nextPartId: PartId | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	): ClientAPI.ClientResponse<void> {
		check(rundownPlaylistId, String)
		if (nextPartId) check(nextPartId, String)

		return rundownPlaylistPlayoutSyncFunction(context, rundownPlaylistId, null, (cache) => {
			//TODO-CACHE - preinit step?
			setNextPartInner(cache, nextPartId, setManually, nextTimeOffset)

			return ClientAPI.responseSuccess(undefined)
		})
	}

	export function setNextPartInner(
		cache: CacheForPlayout,
		nextPartId: PartId | Part | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	) {
		const playlist = cache.Playlist.doc

		if (!playlist.active) throw new Meteor.Error(501, `Rundown Playlist "${playlist._id}" is not active!`)
		if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE)
			throw new Meteor.Error(501, `Rundown "${playlist._id}" cannot change next during hold!`)

		let nextPart: Part | null = null
		if (nextPartId) {
			if (isStringOrProtectedString(nextPartId)) {
				nextPart = cache.Parts.findOne(nextPartId) || null
			} else if (_.isObject(nextPartId)) {
				nextPart = nextPartId
			}
			if (!nextPart) throw new Meteor.Error(404, `Part "${nextPartId}" not found!`)
		}

		libsetNextPart(cache, nextPart, setManually, nextTimeOffset)

		// update lookahead and the next part when we have an auto-next
		updateTimeline(cache, playlist.studioId)
	}
	export function moveNextPart(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		horizontalDelta: number,
		verticalDelta: number,
		setManually: boolean
	): PartId | null {
		check(rundownPlaylistId, String)
		check(horizontalDelta, Number)
		check(verticalDelta, Number)

		if (!horizontalDelta && !verticalDelta)
			throw new Meteor.Error(402, `rundownMoveNext: invalid delta: (${horizontalDelta}, ${verticalDelta})`)

		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist.active) throw new Meteor.Error(501, `RundownPlaylist "${playlist._id}" is not active!`)

				if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE)
					throw new Meteor.Error(501, `RundownPlaylist "${playlist._id}" cannot change next during hold!`)
			},
			(cache) => {
				const playlist = cache.Playlist.doc
				const { segments, parts } = getSegmentsAndPartsFromCache(cache)

				const res = moveNextPartInner(cache, segments, parts, horizontalDelta, verticalDelta, setManually)
				return res
			}
		)
	}
	function moveNextPartInner(
		cache: CacheForPlayout,
		segments: Segment[],
		parts: Part[],
		horizontalDelta: number,
		verticalDelta: number,
		setManually: boolean,
		nextPartId0?: PartId
	): PartId | null {
		const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)

		let currentNextPart: DBPart
		if (nextPartId0) {
			const nextPart = cache.Parts.findOne(nextPartId0)
			if (!nextPart) throw new Meteor.Error(404, `Part "${nextPartId0}" not found!`)
			currentNextPart = nextPart
		} else {
			const nextPartInstanceTmp = nextPartInstance || currentPartInstance
			if (!nextPartInstanceTmp)
				throw new Meteor.Error(
					501,
					`RundownPlaylist "${cache.Playlist.doc._id}" has no next and no current part!`
				)

			const nextPart = cache.Parts.findOne(nextPartInstanceTmp.part._id)
			if (!nextPart)
				throw new Meteor.Error(404, `Part "${nextPartInstanceTmp.part._id}" no longer exists in the rundown!`)
			currentNextPart = nextPartInstanceTmp.part
		}

		const currentNextSegment = segments.find((s) => s._id === currentNextPart.segmentId) as Segment
		if (!currentNextSegment) throw new Meteor.Error(404, `Segment "${currentNextPart.segmentId}" not found!`)

		const partsInSegments: { [segmentId: string]: Part[] } = {}
		_.each(segments, (segment) => {
			let partsInSegment = _.filter(parts, (p) => p.segmentId === segment._id)
			if (partsInSegment.length) {
				partsInSegments[unprotectString(segment._id)] = partsInSegment
				parts.push(...partsInSegment)
			}
		})

		let partIndex = parts.findIndex((part) => part._id === currentNextPart._id)
		let segmentIndex = segments.findIndex((s) => s._id === currentNextSegment._id)

		if (partIndex === -1) throw new Meteor.Error(404, `Part not found in list of parts!`)
		if (segmentIndex === -1)
			throw new Meteor.Error(404, `Segment "${currentNextSegment._id}" not found in segmentsWithParts!`)
		if (verticalDelta !== 0) {
			segmentIndex += verticalDelta

			const segment = segments[segmentIndex]
			if (!segment) throw new Meteor.Error(404, `No Segment found!`)

			const part = _.first(partsInSegments[unprotectString(segment._id)])
			if (!part) throw new Meteor.Error(404, `No Parts in segment "${segment._id}"!`)

			partIndex = parts.findIndex((p) => p._id === part._id)
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
				return moveNextPartInner(cache, segments, parts, horizontalDelta, verticalDelta, setManually, part._id)
			} else {
				// Calling ourselves again at this point would result in an infinite loop
				// There probably isn't any Part available to Next then...
				setNextPartInner(cache, null, setManually)
				return null
			}
		} else {
			setNextPartInner(cache, part, setManually)
			return part._id
		}
	}
	export function setNextSegment(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		nextSegmentId: SegmentId | null
	): ClientAPI.ClientResponse<void> {
		check(rundownPlaylistId, String)
		if (nextSegmentId) check(nextSegmentId, String)

		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist.active)
					throw new Meteor.Error(501, `Rundown Playlist "${rundownPlaylistId}" is not active!`)
			},
			(cache) => {
				const playlist = cache.Playlist.doc
				const nextSegment = nextSegmentId ? cache.Segments.findOne(nextSegmentId) || null : null

				libSetNextSegment(cache, nextSegment)

				// Update any future lookaheads
				updateTimeline(cache, playlist.studioId)

				return ClientAPI.responseSuccess(undefined)
			}
		)
	}
	export function activateHold(context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)
		logger.debug('rundownActivateHold')

		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist.active)
					throw new Meteor.Error(501, `Rundown Playlist "${rundownPlaylistId}" is not active!`)

				if (!playlist.currentPartInstanceId)
					throw new Meteor.Error(400, `Rundown Playlist "${rundownPlaylistId}" no current part!`)
				if (!playlist.nextPartInstanceId)
					throw new Meteor.Error(400, `Rundown Playlist "${rundownPlaylistId}" no next part!`)

				if (playlist.holdState) {
					throw new Meteor.Error(400, `RundownPlaylist "${rundownPlaylistId}" already doing a hold!`)
				}
			},
			(cache) => {
				const playlist = cache.Playlist.doc
				const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
				if (!currentPartInstance)
					throw new Meteor.Error(404, `PartInstance "${playlist.currentPartInstanceId}" not found!`)
				if (!nextPartInstance)
					throw new Meteor.Error(404, `PartInstance "${playlist.nextPartInstanceId}" not found!`)

				if (
					currentPartInstance.part.holdMode !== PartHoldMode.FROM ||
					nextPartInstance.part.holdMode !== PartHoldMode.TO
				) {
					throw new Meteor.Error(400, `RundownPlaylist "${rundownPlaylistId}" incompatible pair of HoldMode!`)
				}

				cache.Playlist.update({ $set: { holdState: RundownHoldState.PENDING } })

				updateTimeline(cache, playlist.studioId)
			}
		)
	}
	export function deactivateHold(context: MethodContext, rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)
		logger.debug('deactivateHold')

		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc

				if (playlist.holdState !== RundownHoldState.PENDING)
					throw new Meteor.Error(400, `RundownPlaylist "${rundownPlaylistId}" is not pending a hold!`)
			},
			(cache) => {
				const playlist = cache.Playlist.doc

				cache.Playlist.update({ $set: { holdState: RundownHoldState.NONE } })

				updateTimeline(cache, playlist.studioId)
			}
		)
	}
	export function disableNextPiece(context: MethodContext, rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		check(rundownPlaylistId, String)

		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist.currentPartInstanceId) throw new Meteor.Error(401, `No current part!`)
			},
			(cache) => {
				const playlist = cache.Playlist.doc

				const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
				if (!currentPartInstance)
					throw new Meteor.Error(404, `PartInstance "${playlist.currentPartInstanceId}" not found!`)

				const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${currentPartInstance.rundownId}" not found!`)
				const showStyleBase = waitForPromise(cache.activationCache.getShowStyleBase(rundown))

				// @ts-ignore stringify
				// logger.info(o)
				// logger.info(JSON.stringify(o, '', 2))

				const allowedSourceLayers = normalizeArray(showStyleBase.sourceLayers, '_id')

				// logger.info('nowInPart', nowInPart)
				// logger.info('filteredPieces', filteredPieces)
				let getNextPiece = (partInstance: PartInstance, undo: boolean, ignoreStartedPlayback: boolean) => {
					// Find next piece to disable

					let nowInPart = 0
					if (
						!ignoreStartedPlayback &&
						partInstance.part.startedPlayback &&
						partInstance.part.timings &&
						partInstance.part.timings.startedPlayback
					) {
						let lastStartedPlayback = _.last(partInstance.part.timings.startedPlayback)

						if (lastStartedPlayback) {
							nowInPart = getCurrentTime() - lastStartedPlayback
						}
					}

					const pieceInstances = getAllPieceInstancesFromCache(cache, partInstance)
					const sortedPieces: PieceInstance[] = sortPieceInstancesByStart(pieceInstances, nowInPart)

					let findLast: boolean = !!undo

					let filteredPieces = _.sortBy(
						_.filter(sortedPieces, (piece: PieceInstance) => {
							let sourceLayer = allowedSourceLayers[piece.piece.sourceLayerId]
							if (
								sourceLayer &&
								sourceLayer.allowDisable &&
								!piece.piece.virtual &&
								!piece.piece.isTransition
							)
								return true
							return false
						}),
						(piece: PieceInstance) => {
							let sourceLayer = allowedSourceLayers[piece.piece.sourceLayerId]
							return sourceLayer._rank || -9999
						}
					)
					if (findLast) filteredPieces.reverse()

					return filteredPieces.find((piece) => {
						return (
							piece.piece.enable.start >= nowInPart &&
							((!undo && !piece.disabled) || (undo && piece.disabled))
						)
					})
				}

				if (nextPartInstance) {
					// pretend that the next part never has played (even if it has)
					nextPartInstance.part.startedPlayback = false
				}

				const partInstances: Array<[PartInstance | undefined, boolean]> = [
					[currentPartInstance, false],
					[nextPartInstance, true], // If not found in currently playing part, let's look in the next one:
				]
				if (undo) partInstances.reverse()

				let nextPieceInstance: PieceInstance | undefined

				for (const [partInstance, ignoreStartedPlayback] of partInstances) {
					if (partInstance) {
						nextPieceInstance = getNextPiece(partInstance, !!undo, ignoreStartedPlayback)
						break
					}
				}

				if (nextPieceInstance) {
					logger.info((undo ? 'Disabling' : 'Enabling') + ' next PieceInstance ' + nextPieceInstance._id)
					cache.PieceInstances.update(nextPieceInstance._id, {
						$set: {
							disabled: !undo,
						},
					})

					updateTimeline(cache, playlist.studioId)
				} else {
					throw new Meteor.Error(500, 'Found no future pieces')
				}
			}
		)
	}
	/**
	 * Triggered from Playout-gateway when a Piece has started playing
	 */
	export function onPiecePlaybackStarted(
		_context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		pieceInstanceId: PieceInstanceId,
		dynamicallyInserted: boolean,
		startedPlayback: Time
	) {
		check(rundownPlaylistId, String)
		check(pieceInstanceId, String)
		check(startedPlayback, Number)

		triggerWriteAccessBecauseNoCheckNecessary() // tmp

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.CALLBACK_PLAYOUT, () => {
			const rundowns = Rundowns.find({ playlistId: rundownPlaylistId }).fetch()
			// This method is called when an auto-next event occurs

			const pieceInstance = PieceInstances.findOne({
				_id: pieceInstanceId,
				rundownId: { $in: rundowns.map((r) => r._id) },
			})
			if (dynamicallyInserted && !pieceInstance) return // if it was dynamically inserted, it's okay if we can't find it
			if (!pieceInstance)
				throw new Meteor.Error(
					404,
					`PieceInstance "${pieceInstanceId}" in RundownPlaylist "${rundownPlaylistId}" not found!`
				)

			const isPlaying: boolean = !!(pieceInstance.piece.startedPlayback && !pieceInstance.piece.stoppedPlayback)
			if (!isPlaying) {
				logger.info(
					`Playout reports pieceInstance "${pieceInstanceId}" has started playback on timestamp ${new Date(
						startedPlayback
					).toISOString()}`
				)

				reportPieceHasStarted(rundownPlaylistId, pieceInstance, startedPlayback)

				// We don't need to bother with an updateTimeline(), as this hasn't changed anything, but lets us accurately add started items when reevaluating
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Piece has stopped playing
	 */
	export function onPiecePlaybackStopped(
		_context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		pieceInstanceId: PieceInstanceId,
		dynamicallyInserted: boolean,
		stoppedPlayback: Time
	) {
		check(rundownPlaylistId, String)
		check(pieceInstanceId, String)
		check(stoppedPlayback, Number)

		triggerWriteAccessBecauseNoCheckNecessary() // tmp

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.CALLBACK_PLAYOUT, () => {
			const rundowns = Rundowns.find({ playlistId: rundownPlaylistId }).fetch()

			// This method is called when an auto-next event occurs
			const pieceInstance = PieceInstances.findOne({
				_id: pieceInstanceId,
				rundownId: { $in: rundowns.map((r) => r._id) },
			})
			if (dynamicallyInserted && !pieceInstance) return // if it was dynamically inserted, it's okay if we can't find it
			if (!pieceInstance)
				throw new Meteor.Error(
					404,
					`PieceInstance "${pieceInstanceId}" in RundownPlaylist "${rundownPlaylistId}" not found!`
				)

			const isPlaying: boolean = !!(pieceInstance.piece.startedPlayback && !pieceInstance.piece.stoppedPlayback)
			if (isPlaying) {
				logger.info(
					`Playout reports pieceInstance "${pieceInstanceId}" has stopped playback on timestamp ${new Date(
						stoppedPlayback
					).toISOString()}`
				)

				reportPieceHasStopped(rundownPlaylistId, pieceInstance, stoppedPlayback)
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Part has started playing
	 */
	export function onPartPlaybackStarted(
		peripheralDevice: PeripheralDevice,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		startedPlayback: Time
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(startedPlayback, Number)

		return rundownPlaylistPlayoutSyncFunction(
			null,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (playlist.studioId !== peripheralDevice.studioId)
					throw new Meteor.Error(
						403,
						`PeripheralDevice "${peripheralDevice._id}" cannot execute callbacks for RundownPlaylist "${rundownPlaylistId}" !`
					)

				if (!playlist.active)
					throw new Meteor.Error(501, `Rundown Playlist "${rundownPlaylistId}" is not active!`)
			},
			(cache) => {
				const playingPartInstance = cache.PartInstances.findOne(partInstanceId)
				if (!playingPartInstance)
					throw new Meteor.Error(
						404,
						`PartInstance "${partInstanceId}" in RundownPlayst "${rundownPlaylistId}" not found!`
					)

				// make sure we don't run multiple times, even if TSR calls us multiple times
				const isPlaying = playingPartInstance.part.startedPlayback && !playingPartInstance.part.stoppedPlayback
				if (!isPlaying) {
					logger.info(
						`Playout reports PartInstance "${partInstanceId}" has started playback on timestamp ${new Date(
							startedPlayback
						).toISOString()}`
					)

					const playlist = cache.Playlist.doc

					const rundown = cache.Rundowns.findOne(playingPartInstance.rundownId)
					if (!rundown) throw new Meteor.Error(404, `Rundown "${playingPartInstance.rundownId}" not found!`)

					const { currentPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(cache)

					if (playlist.currentPartInstanceId === partInstanceId) {
						// this is the current part, it has just started playback
						if (playlist.previousPartInstanceId) {
							if (!previousPartInstance) {
								// We couldn't find the previous part: this is not a critical issue, but is clearly is a symptom of a larger issue
								logger.error(
									`Previous PartInstance "${playlist.previousPartInstanceId}" on RundownPlaylist "${playlist._id}" could not be found.`
								)
							} else if (!previousPartInstance.part.duration) {
								onPartHasStoppedPlaying(cache, previousPartInstance, startedPlayback)
							}
						}

						setRundownStartedPlayback(cache, rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

						reportPartHasStarted(cache, playingPartInstance, startedPlayback)
					} else if (playlist.nextPartInstanceId === partInstanceId) {
						// this is the next part, clearly an autoNext has taken place
						if (playlist.currentPartInstanceId) {
							if (!currentPartInstance) {
								// We couldn't find the previous part: this is not a critical issue, but is clearly is a symptom of a larger issue
								logger.error(
									`Previous PartInstance "${playlist.currentPartInstanceId}" on RundownPlaylist "${playlist._id}" could not be found.`
								)
							} else if (!currentPartInstance.part.duration) {
								onPartHasStoppedPlaying(cache, currentPartInstance, startedPlayback)
							}
						}

						setRundownStartedPlayback(cache, rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

						cache.Playlist.update({
							$set: {
								previousPartInstanceId: playlist.currentPartInstanceId,
								currentPartInstanceId: playingPartInstance._id,
								holdState: RundownHoldState.NONE,
							},
						})

						reportPartHasStarted(cache, playingPartInstance, startedPlayback)

						const nextPart = selectNextPart(
							playlist,
							playingPartInstance,
							getAllOrderedPartsFromCache(cache)
						)
						libsetNextPart(cache, nextPart ? nextPart.part : null)
					} else {
						// a part is being played that has not been selected for playback by Core
						// show must go on, so find next part and update the Rundown, but log an error
						const previousReported = playlist.lastIncorrectPartPlaybackReported

						if (previousReported && Date.now() - previousReported > INCORRECT_PLAYING_PART_DEBOUNCE) {
							// first time this has happened for a while, let's try to progress the show:

							setRundownStartedPlayback(cache, rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

							cache.Playlist.update({
								$set: {
									previousPartInstanceId: null,
									currentPartInstanceId: playingPartInstance._id,
									lastIncorrectPartPlaybackReported: Date.now(), // save the time to prevent the system to go in a loop
								},
							})

							reportPartHasStarted(cache, playingPartInstance, startedPlayback)

							const nextPart = selectNextPart(
								playlist,
								playingPartInstance,
								getAllOrderedPartsFromCache(cache)
							)
							libsetNextPart(cache, nextPart?.part ?? null)
						}

						// TODO - should this even change the next?
						logger.error(
							`PartInstance "${playingPartInstance._id}" has started playback by the playout gateway, but has not been selected for playback!`
						)
					}

					// complete the take
					afterTake(cache, playingPartInstance)
				}
			}
		)
	}
	/**
	 * Triggered from Playout-gateway when a Part has stopped playing
	 */
	export function onPartPlaybackStopped(
		_context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		stoppedPlayback: Time
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(stoppedPlayback, Number)

		triggerWriteAccessBecauseNoCheckNecessary() // tmp

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.CALLBACK_PLAYOUT, () => {
			// This method is called when a part stops playing (like when an auto-next event occurs, or a manual next)
			const rundowns = Rundowns.find({ playlistId: rundownPlaylistId }).fetch()

			const partInstance = PartInstances.findOne({
				_id: partInstanceId,
				rundownId: { $in: rundowns.map((r) => r._id) },
			})

			if (partInstance) {
				// make sure we don't run multiple times, even if TSR calls us multiple times

				const isPlaying = partInstance.part.startedPlayback && !partInstance.part.stoppedPlayback
				if (isPlaying) {
					logger.info(
						`Playout reports PartInstance "${partInstanceId}" has stopped playback on timestamp ${new Date(
							stoppedPlayback
						).toISOString()}`
					)

					reportPartHasStopped(rundownPlaylistId, partInstance, stoppedPlayback)
				}
			} else {
				throw new Meteor.Error(
					404,
					`PartInstance "${partInstanceId}" in RundownPlayst "${rundownPlaylistId}" not found!`
				)
			}
		})
	}
	/**
	 * Make a copy of a piece and start playing it now
	 */
	export function pieceTakeNow(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(pieceInstanceIdOrPieceIdToCopy, String)

		return ServerPlayoutAdLibAPI.pieceTakeNow(
			context,
			rundownPlaylistId,
			partInstanceId,
			pieceInstanceIdOrPieceIdToCopy
		)
	}
	export function segmentAdLibPieceStart(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adLibPieceId: PieceId,
		queue: boolean
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(adLibPieceId, String)

		return ServerPlayoutAdLibAPI.segmentAdLibPieceStart(
			context,
			rundownPlaylistId,
			partInstanceId,
			adLibPieceId,
			queue
		)
	}
	export function rundownBaselineAdLibPieceStart(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		baselineAdLibPieceId: PieceId,
		queue: boolean
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(baselineAdLibPieceId, String)

		return ServerPlayoutAdLibAPI.rundownBaselineAdLibPieceStart(
			context,
			rundownPlaylistId,
			partInstanceId,
			baselineAdLibPieceId,
			queue
		)
	}
	export function sourceLayerStickyPieceStart(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	) {
		check(rundownPlaylistId, String)
		check(sourceLayerId, String)

		return ServerPlayoutAdLibAPI.sourceLayerStickyPieceStart(context, rundownPlaylistId, sourceLayerId)
	}
	export function executeAction(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		actionId: string,
		userData: any
	) {
		check(rundownPlaylistId, String)
		check(actionId, String)
		check(userData, Match.Any)

		return executeActionInner(context, rundownPlaylistId, (actionContext, cache, rundown) => {
			const showStyleBase = waitForPromise(cache.activationCache.getShowStyleBase(rundown))
			const blueprint = loadShowStyleBlueprint(showStyleBase)
			if (!blueprint.blueprint.executeAction) {
				throw new Meteor.Error(
					400,
					`ShowStyle blueprint "${blueprint.blueprintId}" does not support executing actions`
				)
			}

			logger.info(`Executing AdlibAction "${actionId}": ${JSON.stringify(userData)}`)

			blueprint.blueprint.executeAction(actionContext, actionId, userData)
		})
	}

	export function executeActionInner(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		func: (
			context: ActionExecutionContext,
			cache: CacheForPlayout,
			rundown: Rundown,
			currentPartInstance: PartInstance
		) => void
	) {
		const now = getCurrentTime()

		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc

				if (!playlist.active)
					throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
				if (!playlist.currentPartInstanceId)
					throw new Meteor.Error(400, `A part needs to be active to execute an action`)
			},
			(cache) => {
				const playlist = cache.Playlist.doc

				const studio = cache.Studio.doc

				const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
				if (!currentPartInstance)
					throw new Meteor.Error(
						501,
						`Current PartInstance "${playlist.currentPartInstanceId}" could not be found.`
					)

				const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
				if (!rundown)
					throw new Meteor.Error(501, `Current Rundown "${currentPartInstance.rundownId}" could not be found`)

				const notesContext = new NotesContext(
					`${rundown.name}(${playlist.name})`,
					`playlist=${playlist._id},rundown=${rundown._id},currentPartInstance=${
						currentPartInstance._id
					},execution=${getRandomId()}`,
					false
				)
				const actionContext = new ActionExecutionContext(cache, notesContext, studio, playlist, rundown)

				// If any action cannot be done due to timings, that needs to be rejected by the context
				func(actionContext, cache, rundown, currentPartInstance)

				if (
					actionContext.currentPartState !== ActionPartChange.NONE ||
					actionContext.nextPartState !== ActionPartChange.NONE
				) {
					syncPlayheadInfinitesForNextPartInstance(cache)
				}

				if (actionContext.takeAfterExecute) {
					return ServerPlayoutAPI.callTakeWithCache(cache, now)
				} else {
					if (
						actionContext.currentPartState !== ActionPartChange.NONE ||
						actionContext.nextPartState !== ActionPartChange.NONE
					) {
						updateTimeline(cache, playlist.studioId)
					}
				}
			}
		)
	}
	/**
	 * This exists for the purpose of mocking this call for testing.
	 */
	export function callTakeWithCache(cache: CacheForPlayout, now: number) {
		return takeNextPartInnerSync(cache, now)
	}
	export function sourceLayerOnPartStop(
		context: MethodContext,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(sourceLayerIds, Match.OneOf(String, Array))

		if (_.isString(sourceLayerIds)) sourceLayerIds = [sourceLayerIds]

		if (sourceLayerIds.length === 0) return

		return rundownPlaylistPlayoutSyncFunction(
			context,
			rundownPlaylistId,
			(cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist.active)
					throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
				if (playlist.currentPartInstanceId !== partInstanceId)
					throw new Meteor.Error(403, `Pieces can be only manipulated in a current part!`)
			},
			(cache) => {
				const playlist = cache.Playlist.doc

				const partInstance = cache.PartInstances.findOne(partInstanceId)
				if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
				const lastStartedPlayback = partInstance.part.getLastStartedPlayback()
				if (!lastStartedPlayback)
					throw new Meteor.Error(405, `Part "${partInstanceId}" has yet to start playback!`)

				const rundown = cache.Rundowns.findOne(partInstance.rundownId)
				if (!rundown) throw new Meteor.Error(501, `Rundown "${partInstance.rundownId}" not found!`)

				const showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
				if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${rundown.showStyleBaseId}" not found!`)

				ServerPlayoutAdLibAPI.innerStopPieces(
					cache,
					showStyleBase,
					partInstance,
					(pieceInstance) => sourceLayerIds.indexOf(pieceInstance.piece.sourceLayerId) !== -1,
					undefined
				)

				syncPlayheadInfinitesForNextPartInstance(cache)

				updateTimeline(cache, playlist.studioId)
			}
		)
	}

	export function updateStudioBaseline(context: MethodContext, studioId: StudioId) {
		StudioContentWriteAccess.baseline(context, studioId)

		check(studioId, String)

		return studioSyncFunction(studioId, (cache) => {
			const activeRundowns = getActiveRundownPlaylistsInStudio2(cache)

			if (activeRundowns.length === 0) {
				updateStudioTimeline(cache)
				return shouldUpdateStudioBaselineInner(cache)
			} else {
				// TODO - could this do a cache.discard() instead? as nothing will have changed
				return shouldUpdateStudioBaselineInner(cache)
			}
		})
	}

	export function shouldUpdateStudioBaseline(context: MethodContext, studioId: StudioId) {
		StudioContentWriteAccess.baseline(context, studioId)
		return studioSyncFunction(studioId, (cache) => {
			// TODO - could this do a cache.discard() instead? as nothing will have changed
			return shouldUpdateStudioBaselineInner(cache)
		})
	}
	function shouldUpdateStudioBaselineInner(cache: CacheForStudio2): string | false {
		const studio = cache.Studio.doc

		const activeRundowns = getActiveRundownPlaylistsInStudio2(cache)

		if (activeRundowns.length === 0) {
			const markerId: TimelineObjId = protectString(`${studio._id}_baseline_version`)
			const markerObject = cache.Timeline.findOne(markerId)
			if (!markerObject) return 'noBaseline'

			const versionsContent = (markerObject.metaData || {}).versions || {}

			if (versionsContent.core !== (PackageInfo.versionExtended || PackageInfo.version)) return 'coreVersion'

			if (versionsContent.studio !== (studio._rundownVersionHash || 0)) return 'studio'

			if (versionsContent.blueprintId !== studio.blueprintId) return 'blueprintId'
			if (studio.blueprintId) {
				const blueprint = Blueprints.findOne(studio.blueprintId, { fields: { _id: 1, blueprintVersion: 1 } })
				if (!blueprint) return 'blueprintUnknown'
				if (versionsContent.blueprintVersion !== (blueprint.blueprintVersion || 0)) return 'blueprintVersion'
			}
		}

		return false
	}
}

function setRundownStartedPlayback(cache: CacheForPlayout, rundown: Rundown, startedPlayback: Time) {
	if (!rundown.startedPlayback) {
		// Set startedPlayback on the rundown if this is the first item to be played
		reportRundownHasStarted(cache, rundown, startedPlayback)
	}
}

interface UpdateTimelineFromIngestDataTimeout {
	timeout?: number
}
const updateTimelineFromIngestDataTimeouts = new Map<RundownPlaylistId, UpdateTimelineFromIngestDataTimeout>()
export function triggerUpdateTimelineAfterIngestData(playlistId: RundownPlaylistId) {
	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	const data = updateTimelineFromIngestDataTimeouts.get(playlistId) ?? {}
	if (data.timeout) Meteor.clearTimeout(data.timeout)

	data.timeout = Meteor.setTimeout(() => {
		if (updateTimelineFromIngestDataTimeouts.delete(playlistId)) {
			return rundownPlaylistPlayoutSyncFunction(null, playlistId, null, (cache) => {
				const playlist = cache.Playlist.doc
				//TODO-CACHE - pre init check?

				if (playlist.active && playlist.currentPartInstanceId) {
					// If the playlist is active, then updateTimeline as lookahead could have been affected
					updateTimeline(cache, playlist.studioId)
				}
			})
		}
	}, 1000)

	updateTimelineFromIngestDataTimeouts.set(playlistId, data)
}
