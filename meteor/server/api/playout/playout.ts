/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { Match } from 'meteor/check'
import { Rundown, RundownHoldState, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { Part, DBPart, PartId } from '../../../lib/collections/Parts'
import { Piece, PieceId } from '../../../lib/collections/Pieces'
import {
	getCurrentTime,
	Time,
	waitForPromise,
	makePromise,
	clone,
	literal,
	normalizeArray,
	unprotectString,
	unprotectObjectArray,
	protectString,
	isStringOrProtectedString,
	getRandomId,
	check,
} from '../../../lib/lib'
import { TimelineObjGeneric, TimelineObjId } from '../../../lib/collections/Timeline'
import { Segment, SegmentId } from '../../../lib/collections/Segments'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { PieceLifespan, PartHoldMode, VTContent, PartEndState } from 'tv-automation-sofie-blueprints-integration'
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
import { getBlueprintOfRundown } from '../blueprints/cache'
import { PartEventContext, RundownContext } from '../blueprints/context'
import { NotesContext } from '../blueprints/context/context'
import { ActionExecutionContext, ActionPartChange } from '../blueprints/context/adlibActions'
import { IngestActions } from '../ingest/actions'
import { updateTimeline } from './timeline'
import {
	resetRundownPlaylist as libResetRundownPlaylist,
	setNextPart as libsetNextPart,
	setNextSegment as libSetNextSegment,
	onPartHasStoppedPlaying,
	// refreshPart,
	getPartBeforeSegment,
	selectNextPart,
	isTooCloseToAutonext,
	getSegmentsAndPartsFromCache,
	getSelectedPartInstancesFromCache,
	getRundownIDsFromCache,
	getRundownsFromCache,
	getStudioFromCache,
	getAllOrderedPartsFromCache,
	getRundownPlaylistFromCache,
	getAllPieceInstancesFromCache,
} from './lib'
import {
	prepareStudioForBroadcast,
	activateRundownPlaylist as libActivateRundownPlaylist,
	deactivateRundownPlaylist as libDeactivateRundownPlaylist,
	deactivateRundownPlaylistInner,
	standDownStudio,
} from './actions'
import { getResolvedPieces, sortPiecesByStart } from './pieces'
import { PackageInfo } from '../../coreSystem'
import { getActiveRundownPlaylistsInStudio } from './studio'
import { rundownPlaylistSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'
import { ServerPlayoutAdLibAPI } from './adlib'
import {
	PieceInstances,
	PieceInstance,
	PieceInstanceId,
	PieceInstancePiece,
} from '../../../lib/collections/PieceInstances'
import { PartInstances, PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { ReloadRundownPlaylistResponse } from '../../../lib/api/userActions'
import {
	initCacheForRundownPlaylist,
	CacheForRundownPlaylist,
	initCacheForStudio,
	initCacheForNoRundownPlaylist,
	CacheForStudio,
} from '../../DatabaseCaches'
import { takeNextPartInner, afterTake } from './take'

/**
 * debounce time in ms before we accept another report of "Part started playing that was not selected by core"
 */
const INCORRECT_PLAYING_PART_DEBOUNCE = 5000

export namespace ServerPlayoutAPI {
	/**
	 * Prepare the rundown for transmission
	 * To be triggered well before the broadcast, since it may take time and cause outputs to flicker
	 */
	export function prepareRundownPlaylistForBroadcast(rundownPlaylistId: RundownPlaylistId) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (playlist.active)
				throw new Meteor.Error(404, `rundownPrepareForBroadcast cannot be run on an active rundown!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			const anyOtherActiveRundowns = getActiveRundownPlaylistsInStudio(cache, playlist.studioId, playlist._id)
			if (anyOtherActiveRundowns.length) {
				// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
				throw new Meteor.Error(
					409,
					'Only one rundown can be active at the same time. Active rundowns: ' +
						_.map(anyOtherActiveRundowns, (rundown) => rundown._id)
				)
			}

			libResetRundownPlaylist(cache, playlist)
			prepareStudioForBroadcast(cache, getStudioFromCache(cache, playlist), true, playlist)

			libActivateRundownPlaylist(cache, playlist, true) // Activate rundownPlaylist (rehearsal)

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	/**
	 * Reset the broadcast, to be used during testing.
	 * The User might have run through the rundown and wants to start over and try again
	 */
	export function resetRundownPlaylist(rundownPlaylistId: RundownPlaylistId): void {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (playlist.active && !playlist.rehearsal)
				throw new Meteor.Error(401, `resetRundown can only be run in rehearsal!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			libResetRundownPlaylist(cache, playlist)

			updateTimeline(cache, playlist.studioId)

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	/**
	 * Activate the rundown, final preparations before going on air
	 * To be triggered by the User a short while before going on air
	 */
	export function resetAndActivateRundownPlaylist(rundownPlaylistId: RundownPlaylistId, rehearsal?: boolean) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (playlist.active && !playlist.rehearsal)
				throw new Meteor.Error(402, `resetAndActivateRundownPlaylist cannot be run when active!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			libResetRundownPlaylist(cache, playlist)
			prepareStudioForBroadcast(cache, getStudioFromCache(cache, playlist), true, playlist)

			libActivateRundownPlaylist(cache, playlist, !!rehearsal) // Activate rundown
			waitForPromise(cache.saveAllToDatabase())
		})
	}
	/**
	 * Activate the rundownPlaylist, decativate any other running rundowns
	 */
	export function forceResetAndActivateRundownPlaylist(rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		check(rehearsal, Boolean)
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			let anyOtherActiveRundowns = getActiveRundownPlaylistsInStudio(cache, playlist.studioId, playlist._id)
			let error: any
			_.each(anyOtherActiveRundowns, (otherRundownPlaylist) => {
				try {
					deactivateRundownPlaylistInner(cache, otherRundownPlaylist)
				} catch (e) {
					error = e
				}
			})
			if (error) {
				// Ok, something went wrong, but check if the active rundowns where deactivated?
				anyOtherActiveRundowns = getActiveRundownPlaylistsInStudio(cache, playlist.studioId, playlist._id)
				if (anyOtherActiveRundowns.length) {
					// No they weren't, we can't continue..
					throw error
				} else {
					// They where deactivated, log the error and continue
					logger.error(error)
				}
			}

			libResetRundownPlaylist(cache, playlist)
			prepareStudioForBroadcast(cache, getStudioFromCache(cache, playlist), true, playlist)

			libActivateRundownPlaylist(cache, playlist, rehearsal)

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	/**
	 * Only activate the rundown, don't reset anything
	 */
	export function activateRundownPlaylist(rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		check(rehearsal, Boolean)
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			prepareStudioForBroadcast(cache, getStudioFromCache(cache, playlist), true, playlist)

			libActivateRundownPlaylist(cache, playlist, rehearsal)
			waitForPromise(cache.saveAllToDatabase())
		})
	}
	/**
	 * Deactivate the rundown
	 */
	export function deactivateRundownPlaylist(rundownPlaylistId: RundownPlaylistId) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			standDownStudio(cache, getStudioFromCache(cache, playlist), true)
			libDeactivateRundownPlaylist(cache, playlist)

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	/**
	 * Trigger a reload of data of the rundown
	 */
	export function reloadRundownPlaylistData(rundownPlaylistId: RundownPlaylistId) {
		// Reload and reset the Rundown
		check(rundownPlaylistId, String)
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_INGEST, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			const rundowns = getRundownsFromCache(cache, playlist)
			const response: ReloadRundownPlaylistResponse = {
				rundownsResponses: rundowns.map((rundown) => {
					return {
						rundownId: rundown._id,
						response: IngestActions.reloadRundown(rundown),
					}
				}),
			}

			waitForPromise(cache.saveAllToDatabase())

			return response
		})
	}
	/**
	 * Take the currently Next:ed Part (start playing it)
	 */
	export function takeNextPart(rundownPlaylistId: RundownPlaylistId): ClientAPI.ClientResponse<void> {
		check(rundownPlaylistId, String)

		return takeNextPartInner(rundownPlaylistId)
	}
	export function setNextPart(
		rundownPlaylistId: RundownPlaylistId,
		nextPartId: PartId | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	): ClientAPI.ClientResponse<void> {
		check(rundownPlaylistId, String)
		if (nextPartId) check(nextPartId, String)

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			setNextPartInner(cache, playlist, nextPartId, setManually, nextTimeOffset)

			waitForPromise(cache.saveAllToDatabase())
			return ClientAPI.responseSuccess(undefined)
		})
	}
	export function setNextPartInner(
		cache: CacheForRundownPlaylist,
		playlist: RundownPlaylist,
		nextPartId: PartId | Part | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	) {
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

		libsetNextPart(cache, playlist, nextPart, setManually, nextTimeOffset)

		// remove old auto-next from timeline, and add new one
		updateTimeline(cache, playlist.studioId)
	}
	export function moveNextPart(
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

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			const res = moveNextPartInner(cache, playlist, horizontalDelta, verticalDelta, setManually)
			waitForPromise(cache.saveAllToDatabase())
			return res
		})
	}
	function moveNextPartInner(
		cache: CacheForRundownPlaylist,
		playlist: RundownPlaylist,
		horizontalDelta: number,
		verticalDelta: number,
		setManually: boolean,
		nextPartId0?: PartId
	): PartId | null {
		if (!playlist.active) throw new Meteor.Error(501, `RundownPlaylist "${playlist._id}" is not active!`)

		if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE)
			throw new Meteor.Error(501, `RundownPlaylist "${playlist._id}" cannot change next during hold!`)

		const { segments, parts } = getSegmentsAndPartsFromCache(cache, playlist) as {
			segments: Segment[]
			parts: Part[]
		}
		const { currentPartInstance, nextPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(
			cache,
			playlist
		)

		let currentNextPart: DBPart
		if (nextPartId0) {
			const nextPart = cache.Parts.findOne(nextPartId0)
			if (!nextPart) throw new Meteor.Error(404, `Part "${nextPartId0}" not found!`)
			currentNextPart = nextPart
		} else {
			const nextPartInstanceTmp = nextPartInstance || currentPartInstance
			if (!nextPartInstanceTmp)
				throw new Meteor.Error(501, `RundownPlaylist "${playlist._id}" has no next and no current part!`)
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
		if (segmentIndex === -1)
			throw new Meteor.Error(404, `Segment "${currentNextSegment._id}" not found in segmentsWithParts!`)
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
				return moveNextPartInner(cache, playlist, horizontalDelta, verticalDelta, setManually, part._id)
			} else {
				// Calling ourselves again at this point would result in an infinite loop
				// There probably isn't any Part available to Next then...
				setNextPartInner(cache, playlist, null, setManually)
				return null
			}
		} else {
			setNextPartInner(cache, playlist, part, setManually)
			return part._id
		}
	}
	export function setNextSegment(
		rundownPlaylistId: RundownPlaylistId,
		nextSegmentId: SegmentId | null
	): ClientAPI.ClientResponse<void> {
		check(rundownPlaylistId, String)
		if (nextSegmentId) check(nextSegmentId, String)

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!playlist.active) throw new Meteor.Error(501, `Rundown Playlist "${rundownPlaylistId}" is not active!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			let nextSegment: Segment | null = null
			if (nextSegmentId) {
				nextSegment = cache.Segments.findOne(nextSegmentId) || null

				if (!nextSegment) throw new Meteor.Error(404, `Segment "${nextSegmentId}" not found!`)
				const acceptableRundownIds = getRundownIDsFromCache(cache, playlist)
				if (acceptableRundownIds.indexOf(nextSegment.rundownId) === -1) {
					throw new Meteor.Error(
						501,
						`Segment "${nextSegmentId}" does not belong to Rundown Playlist "${rundownPlaylistId}"!`
					)
				}
			}

			libSetNextSegment(cache, playlist, nextSegment)

			waitForPromise(cache.saveAllToDatabase())

			return ClientAPI.responseSuccess(undefined)
		})
	}
	export function activateHold(rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)
		logger.debug('rundownActivateHold')

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found!`)
			if (!playlist.active) throw new Meteor.Error(501, `Rundown Playlist "${rundownPlaylistId}" is not active!`)

			if (!playlist.currentPartInstanceId)
				throw new Meteor.Error(400, `Rundown Playlist "${rundownPlaylistId}" no current part!`)
			if (!playlist.nextPartInstanceId)
				throw new Meteor.Error(400, `Rundown Playlist "${rundownPlaylistId}" no next part!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)
			if (!currentPartInstance)
				throw new Meteor.Error(404, `PartInstance "${playlist.currentPartInstanceId}" not found!`)
			if (!nextPartInstance)
				throw new Meteor.Error(404, `PartInstance "${playlist.nextPartInstanceId}" not found!`)

			if (playlist.holdState) {
				throw new Meteor.Error(400, `RundownPlaylist "${rundownPlaylistId}" already doing a hold!`)
			}

			if (
				currentPartInstance.part.holdMode !== PartHoldMode.FROM ||
				nextPartInstance.part.holdMode !== PartHoldMode.TO
			) {
				throw new Meteor.Error(400, `RundownPlaylist "${rundownPlaylistId}" incompatible pair of HoldMode!`)
			}

			cache.RundownPlaylists.update(rundownPlaylistId, { $set: { holdState: RundownHoldState.PENDING } })

			updateTimeline(cache, playlist.studioId)

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	export function deactivateHold(rundownPlaylistId: RundownPlaylistId) {
		check(rundownPlaylistId, String)
		logger.debug('deactivateHold')

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
			if (playlist.holdState !== RundownHoldState.PENDING)
				throw new Meteor.Error(400, `RundownPlaylist "${rundownPlaylistId}" is not pending a hold!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			cache.RundownPlaylists.update(rundownPlaylistId, { $set: { holdState: RundownHoldState.NONE } })

			updateTimeline(cache, playlist.studioId)
			waitForPromise(cache.saveAllToDatabase())
		})
	}
	export function disableNextPiece(rundownPlaylistId: RundownPlaylistId, undo?: boolean) {
		check(rundownPlaylistId, String)

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
			if (!playlist.currentPartInstanceId) throw new Meteor.Error(401, `No current part!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)
			if (!currentPartInstance)
				throw new Meteor.Error(404, `PartInstance "${playlist.currentPartInstanceId}" not found!`)

			const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
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

				const pieceInstances = getAllPieceInstancesFromCache(cache, partInstance)
				const sortedPieces: PieceInstancePiece[] = sortPiecesByStart(pieceInstances.map((p) => p.piece))

				let findLast: boolean = !!undo

				let filteredPieces = _.sortBy(
					_.filter(sortedPieces, (piece: PieceInstancePiece) => {
						let sourceLayer = allowedSourceLayers[piece.sourceLayerId]
						if (sourceLayer && sourceLayer.allowDisable && !piece.virtual && !piece.isTransition)
							return true
						return false
					}),
					(piece: PieceInstancePiece) => {
						let sourceLayer = allowedSourceLayers[piece.sourceLayerId]
						return sourceLayer._rank || -9999
					}
				)
				if (findLast) filteredPieces.reverse()

				let nextPiece: PieceInstancePiece | undefined = _.find(filteredPieces, (piece) => {
					logger.info('piece.enable.start', piece.enable.start)
					return piece.enable.start >= nowInPart && ((!undo && !piece.disabled) || (undo && piece.disabled))
				})
				return nextPiece ? pieceInstances.find((p) => p.piece._id === nextPiece!._id) : undefined
			}

			if (nextPartInstance) {
				// pretend that the next part never has played (even if it has)
				nextPartInstance.part.startedPlayback = false
			}

			let partInstances = [
				currentPartInstance,
				nextPartInstance, // If not found in currently playing part, let's look in the next one:
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
				cache.PieceInstances.update(nextPieceInstance._id, {
					$set: {
						'piece.disabled': !undo,
					},
				})
				// TODO-PartInstance - pending new data flow
				cache.Pieces.update(nextPieceInstance.piece._id, {
					$set: {
						disabled: !undo,
					},
				})

				updateTimeline(cache, playlist.studioId)

				waitForPromise(cache.saveAllToDatabase())
			} else {
				throw new Meteor.Error(500, 'Found no future pieces')
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Piece has started playing
	 */
	export function onPiecePlaybackStarted(
		rundownId: RundownId,
		pieceInstanceId: PieceInstanceId,
		dynamicallyInserted: boolean,
		startedPlayback: Time
	) {
		check(rundownId, String)
		check(pieceInstanceId, String)
		check(startedPlayback, Number)

		const playlistId = getRundown(rundownId).playlistId
		// TODO - confirm this is correct
		return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			// This method is called when an auto-next event occurs
			const pieceInstance = PieceInstances.findOne({
				_id: pieceInstanceId,
				rundownId: rundownId,
			})
			if (dynamicallyInserted && !pieceInstance) return // if it was dynamically inserted, it's okay if we can't find it
			if (!pieceInstance)
				throw new Meteor.Error(404, `PieceInstance "${pieceInstanceId}" in rundown "${rundownId}" not found!`)

			const isPlaying: boolean = !!(pieceInstance.piece.startedPlayback && !pieceInstance.piece.stoppedPlayback)
			if (!isPlaying) {
				logger.info(
					`Playout reports pieceInstance "${pieceInstanceId}" has started playback on timestamp ${new Date(
						startedPlayback
					).toISOString()}`
				)

				reportPieceHasStarted(pieceInstance, startedPlayback)

				// We don't need to bother with an updateTimeline(), as this hasn't changed anything, but lets us accurately add started items when reevaluating
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Piece has stopped playing
	 */
	export function onPiecePlaybackStopped(
		rundownId: RundownId,
		pieceInstanceId: PieceInstanceId,
		dynamicallyInserted: boolean,
		stoppedPlayback: Time
	) {
		check(rundownId, String)
		check(pieceInstanceId, String)
		check(stoppedPlayback, Number)

		const playlistId = getRundown(rundownId).playlistId

		// TODO - confirm this is correct
		return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			// This method is called when an auto-next event occurs
			const pieceInstance = PieceInstances.findOne({
				_id: pieceInstanceId,
				rundownId: rundownId,
			})
			if (dynamicallyInserted && !pieceInstance) return // if it was dynamically inserted, it's okay if we can't find it
			if (!pieceInstance)
				throw new Meteor.Error(404, `PieceInstance "${pieceInstanceId}" in rundown "${rundownId}" not found!`)

			const isPlaying: boolean = !!(pieceInstance.piece.startedPlayback && !pieceInstance.piece.stoppedPlayback)
			if (isPlaying) {
				logger.info(
					`Playout reports pieceInstance "${pieceInstanceId}" has stopped playback on timestamp ${new Date(
						stoppedPlayback
					).toISOString()}`
				)

				reportPieceHasStopped(pieceInstance, stoppedPlayback)
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Part has started playing
	 */
	export function onPartPlaybackStarted(rundownId: RundownId, partInstanceId: PartInstanceId, startedPlayback: Time) {
		check(rundownId, String)
		check(partInstanceId, String)
		check(startedPlayback, Number)

		const playlistId = getRundown(rundownId).playlistId

		return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			// This method is called when a part starts playing (like when an auto-next event occurs, or a manual next)

			const playingPartInstance = PartInstances.findOne({
				_id: partInstanceId,
				rundownId: rundownId,
			})

			if (playingPartInstance) {
				// make sure we don't run multiple times, even if TSR calls us multiple times

				const isPlaying = playingPartInstance.part.startedPlayback && !playingPartInstance.part.stoppedPlayback
				if (!isPlaying) {
					logger.info(
						`Playout reports PartInstance "${partInstanceId}" has started playback on timestamp ${new Date(
							startedPlayback
						).toISOString()}`
					)

					const rundown = Rundowns.findOne(rundownId)
					if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
					let playlist = RundownPlaylists.findOne(rundown.playlistId)
					if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundown.playlistId}" not found!`)
					if (!playlist.active) throw new Meteor.Error(501, `Rundown "${rundownId}" is not active!`)

					const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

					playlist = cache.RundownPlaylists.findOne(playlist._id)
					if (!playlist) throw new Meteor.Error(404, `Rundown Playlist not found in cache!`)

					const { currentPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(
						cache,
						playlist
					)

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

						setRundownStartedPlayback(cache, playlist, rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

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

						setRundownStartedPlayback(cache, playlist, rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

						cache.RundownPlaylists.update(playlist._id, {
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
							getAllOrderedPartsFromCache(cache, playlist)
						)
						libsetNextPart(cache, playlist, nextPart ? nextPart.part : null)
					} else {
						// a part is being played that has not been selected for playback by Core
						// show must go on, so find next part and update the Rundown, but log an error
						const previousReported = playlist.lastIncorrectPartPlaybackReported

						if (previousReported && Date.now() - previousReported > INCORRECT_PLAYING_PART_DEBOUNCE) {
							// first time this has happened for a while, let's try to progress the show:

							setRundownStartedPlayback(cache, playlist, rundown, startedPlayback) // Set startedPlayback on the rundown if this is the first item to be played

							cache.RundownPlaylists.update(playlist._id, {
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
								getAllOrderedPartsFromCache(cache, playlist)
							)
							libsetNextPart(cache, playlist, nextPart ? nextPart.part : null)
						}

						// TODO - should this even change the next?
						logger.error(
							`PartInstance "${playingPartInstance._id}" has started playback by the playout gateway, but has not been selected for playback!`
						)
					}

					// complete the take
					afterTake(cache, rundown.studioId, playingPartInstance)

					waitForPromise(cache.saveAllToDatabase())
				}
			} else {
				throw new Meteor.Error(404, `PartInstance "${partInstanceId}" in rundown "${rundownId}" not found!`)
			}
		})
	}
	/**
	 * Triggered from Playout-gateway when a Part has stopped playing
	 */
	export function onPartPlaybackStopped(rundownId: RundownId, partInstanceId: PartInstanceId, stoppedPlayback: Time) {
		check(rundownId, String)
		check(partInstanceId, String)
		check(stoppedPlayback, Number)

		const playlistId = getRundown(rundownId).playlistId

		return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			// This method is called when a part stops playing (like when an auto-next event occurs, or a manual next)

			const rundown = Rundowns.findOne(rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

			const partInstance = PartInstances.findOne({
				_id: partInstanceId,
				rundownId: rundownId,
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
	export function pieceTakeNow(
		playlistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		check(playlistId, String)
		check(partInstanceId, String)
		check(pieceInstanceIdOrPieceIdToCopy, String)

		return ServerPlayoutAdLibAPI.pieceTakeNow(playlistId, partInstanceId, pieceInstanceIdOrPieceIdToCopy)
	}
	export function segmentAdLibPieceStart(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adLibPieceId: PieceId,
		queue: boolean
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(adLibPieceId, String)

		return ServerPlayoutAdLibAPI.segmentAdLibPieceStart(rundownPlaylistId, partInstanceId, adLibPieceId, queue)
	}
	export function rundownBaselineAdLibPieceStart(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		baselineAdLibPieceId: PieceId,
		queue: boolean
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(baselineAdLibPieceId, String)

		return ServerPlayoutAdLibAPI.rundownBaselineAdLibPieceStart(
			rundownPlaylistId,
			partInstanceId,
			baselineAdLibPieceId,
			queue
		)
	}
	export function sourceLayerStickyPieceStart(rundownPlaylistId: RundownPlaylistId, sourceLayerId: string) {
		check(rundownPlaylistId, String)
		check(sourceLayerId, String)

		return ServerPlayoutAdLibAPI.sourceLayerStickyPieceStart(rundownPlaylistId, sourceLayerId)
	}
	export function executeAction(rundownPlaylistId: RundownPlaylistId, actionId: string, userData: any) {
		check(rundownPlaylistId, String)
		check(actionId, String)
		check(userData, Match.Any)

		return executeActionInner(rundownPlaylistId, (context, cache, rundown) => {
			const blueprint = getBlueprintOfRundown(rundown) // todo: database again
			if (!blueprint.blueprint.executeAction) {
				throw new Meteor.Error(400, 'ShowStyle blueprint does not support executing actions')
			}

			logger.info(`Executing AdlibAction "${actionId}": ${JSON.stringify(userData)}`)

			blueprint.blueprint.executeAction(context, actionId, userData)
		})
	}

	export function executeActionInner(
		rundownPlaylistId: RundownPlaylistId,
		func: (
			context: ActionExecutionContext,
			cache: CacheForRundownPlaylist,
			rundown: Rundown,
			currentPartInstance: PartInstance
		) => void
	) {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			const tmpPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!tmpPlaylist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
			if (!tmpPlaylist.active) throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
			if (!tmpPlaylist.currentPartInstanceId)
				throw new Meteor.Error(400, `A part needs to be active to execute an action`)

			const cache = waitForPromise(initCacheForRundownPlaylist(tmpPlaylist))
			const playlist = cache.RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)

			const studio = cache.Studios.findOne(playlist.studioId)
			if (!studio) throw new Meteor.Error(501, `Current Studio "${playlist.studioId}" could not be found`)

			const currentPartInstance = playlist.currentPartInstanceId
				? cache.PartInstances.findOne(playlist.currentPartInstanceId)
				: undefined
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
			const context = new ActionExecutionContext(cache, notesContext, studio, playlist, rundown)

			// If any action cannot be done due to timings, that needs to be rejected by the context
			func(context, cache, rundown, currentPartInstance)

			// Mark the parts as dirty if needed, so that they get a reimport on reset to undo any changes
			// TODO-INFINITE - rethink how to handle dirty
			// if (context.currentPartState === ActionPartChange.MARK_DIRTY) {
			// 	cache.PartInstances.update(currentPartInstance._id, {
			// 		$set: {
			// 			'part.dirty': true,
			// 		},
			// 	})
			// 	// TODO-PartInstance - pending new data flow
			// 	cache.Parts.update(currentPartInstance.part._id, {
			// 		$set: {
			// 			dirty: true,
			// 		},
			// 	})
			// }
			// if (context.nextPartState === ActionPartChange.MARK_DIRTY) {
			// 	if (!playlist.nextPartInstanceId)
			// 		throw new Meteor.Error(500, `Cannot mark non-existant partInstance as dirty`)
			// 	const nextPartInstance = cache.PartInstances.findOne(playlist.nextPartInstanceId)
			// 	if (!nextPartInstance) throw new Meteor.Error(500, `Cannot mark non-existant partInstance as dirty`)

			// 	if (!nextPartInstance.part.dynamicallyInserted) {
			// 		cache.PartInstances.update(nextPartInstance._id, {
			// 			$set: {
			// 				'part.dirty': true,
			// 			},
			// 		})
			// 		// TODO-PartInstance - pending new data flow
			// 		cache.Parts.update(nextPartInstance.part._id, {
			// 			$set: {
			// 				dirty: true,
			// 			},
			// 		})
			// 	}
			// }

			if (context.currentPartState !== ActionPartChange.NONE || context.nextPartState !== ActionPartChange.NONE) {
				updateTimeline(cache, playlist.studioId)
			}

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	export function sourceLayerOnPartStop(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)
		check(sourceLayerIds, Match.OneOf(String, Array))

		if (_.isString(sourceLayerIds)) sourceLayerIds = [sourceLayerIds]

		if (sourceLayerIds.length === 0) return

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
			if (!playlist.active) throw new Meteor.Error(403, `Pieces can be only manipulated in an active rundown!`)
			if (playlist.currentPartInstanceId !== partInstanceId)
				throw new Meteor.Error(403, `Pieces can be only manipulated in a current part!`)

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			const partInstance = cache.PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const lastStartedPlayback = partInstance.part.getLastStartedPlayback()
			if (!lastStartedPlayback) throw new Meteor.Error(405, `Part "${partInstanceId}" has yet to start playback!`)

			const nextPartInstance = playlist.nextPartInstanceId
				? cache.PartInstances.findOne(playlist.nextPartInstanceId)
				: undefined
			if (!nextPartInstance && playlist.nextPartInstanceId) {
				throw new Meteor.Error(404, `PartInstance "${playlist.nextPartInstanceId}" not found!`)
			}

			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(501, `Rundown "${partInstance.rundownId}" not found!`)

			ServerPlayoutAdLibAPI.innerStopPieces(
				cache,
				partInstance,
				nextPartInstance,
				(pieceInstance) => sourceLayerIds.indexOf(pieceInstance.piece.sourceLayerId) !== -1,
				undefined
			)

			updateTimeline(cache, playlist.studioId)

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	// export function rundownTogglePartArgument(
	// 	rundownPlaylistId: RundownPlaylistId,
	// 	partInstanceId: PartInstanceId,
	// 	property: string,
	// 	value: string
	// ) {
	// 	check(rundownPlaylistId, String)
	// 	check(partInstanceId, String)

	// 	return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
	// 		let playlist = RundownPlaylists.findOne(rundownPlaylistId)
	// 		if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
	// 		if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
	// 			throw new Meteor.Error(403, `Part Arguments can not be toggled when hold is used!`)
	// 		}

	// 		const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

	// 		playlist = cache.RundownPlaylists.findOne(playlist._id)
	// 		if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

	// 		let partInstance = cache.PartInstances.findOne(partInstanceId)
	// 		if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
	// 		const rundown = cache.Rundowns.findOne(partInstance.rundownId)
	// 		if (!rundown) throw new Meteor.Error(501, `Rundown "${partInstance.rundownId}" not found!`)

	// 		const rArguments = partInstance.part.runtimeArguments || {}

	// 		if (rArguments[property] === value) {
	// 			// unset property
	// 			const mUnset: any = {}
	// 			const mUnset1: any = {}
	// 			mUnset['runtimeArguments.' + property] = 1
	// 			mUnset1['part.runtimeArguments.' + property] = 1
	// 			cache.Parts.update(partInstance.part._id, {
	// 				$unset: mUnset,
	// 				$set: {
	// 					dirty: true,
	// 				},
	// 			})
	// 			cache.PartInstances.update(partInstance._id, {
	// 				$unset: mUnset1,
	// 				$set: {
	// 					dirty: true,
	// 				},
	// 			})
	// 			delete rArguments[property]
	// 		} else {
	// 			// set property
	// 			const mSet: any = {}
	// 			const mSet1: any = {}
	// 			mSet['runtimeArguments.' + property] = value
	// 			mSet1['part.runtimeArguments.' + property] = value
	// 			mSet.dirty = true
	// 			cache.Parts.update(partInstance.part._id, { $set: mSet })
	// 			cache.PartInstances.update(partInstance._id, { $set: mSet1 })

	// 			rArguments[property] = value
	// 		}

	// 		waitForPromise(refreshPart(cache, rundown, partInstance.part))

	// 		// Only take time to update the timeline if there's a point to do it
	// 		if (playlist.active) {
	// 			// If this part is rundown's next, check if current part has autoNext
	// 			if (playlist.nextPartInstanceId === partInstance._id && playlist.currentPartInstanceId) {
	// 				const currentPartInstance = cache.PartInstances.findOne(playlist.currentPartInstanceId)
	// 				if (currentPartInstance && currentPartInstance.part.autoNext) {
	// 					updateTimeline(cache, rundown.studioId)
	// 				}
	// 				// If this is rundown's current part, update immediately
	// 			} else if (playlist.currentPartInstanceId === partInstance._id) {
	// 				updateTimeline(cache, rundown.studioId)
	// 			}
	// 		}

	// 		waitForPromise(cache.saveAllToDatabase())
	// 		return ClientAPI.responseSuccess(undefined)
	// 	})
	// }
	/**
	 * Called from Playout-gateway when the trigger-time of a timeline object has updated
	 * ( typically when using the "now"-feature )
	 */
	export function timelineTriggerTimeUpdateCallback(
		cache: CacheForRundownPlaylist,
		activeRundownIds: RundownId[],
		timelineObj: TimelineObjGeneric,
		time: number
	) {
		check(timelineObj, Object)
		check(time, Number)

		if (activeRundownIds && activeRundownIds.length > 0 && timelineObj.metaData && timelineObj.metaData.pieceId) {
			logger.debug('Update PieceInstance: ', timelineObj.metaData.pieceId, new Date(time).toTimeString())
			cache.PieceInstances.update(
				{
					_id: timelineObj.metaData.pieceId,
					rundownId: { $in: activeRundownIds },
				},
				{
					$set: {
						'piece.enable.start': time,
					},
				}
			)

			const pieceInstance = cache.PieceInstances.findOne({
				_id: timelineObj.metaData.pieceId,
				rundownId: { $in: activeRundownIds },
			})
			if (pieceInstance) {
				cache.PieceInstances.update(
					{
						_id: pieceInstance._id,
						rundownId: { $in: activeRundownIds },
					},
					{
						$set: {
							'piece.enable.start': time,
						},
					}
				)
			}
		}
	}
	export function updateStudioBaseline(studioId: StudioId) {
		check(studioId, String)

		// TODO - should there be a studio lock for activate/deactivate/this?
		let cache: CacheForStudio | CacheForRundownPlaylist = waitForPromise(initCacheForStudio(studioId))

		const activeRundowns = getActiveRundownPlaylistsInStudio(cache, studioId)
		if (activeRundowns.length === 0) {
			// This is only run when there is no rundown active in the studio
			const cachePlayout = waitForPromise(initCacheForNoRundownPlaylist(studioId, cache))
			updateTimeline(cachePlayout, studioId)

			const result = shouldUpdateStudioBaselineInner(cache, studioId)
			waitForPromise(cachePlayout.saveAllToDatabase())
			return result
		} else {
			const result = shouldUpdateStudioBaselineInner(cache, studioId)
			waitForPromise(cache.saveAllToDatabase())
			return result
		}
	}
	export function shouldUpdateStudioBaseline(studioId: StudioId) {
		let cache: CacheForStudio | CacheForRundownPlaylist = waitForPromise(initCacheForStudio(studioId))
		const result = shouldUpdateStudioBaselineInner(cache, studioId)
		waitForPromise(cache.saveAllToDatabase())
		return result
	}
	function shouldUpdateStudioBaselineInner(cache: CacheForStudio, studioId: StudioId): string | false {
		check(studioId, String)

		const studio = cache.Studios.findOne(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)

		const activeRundowns = getActiveRundownPlaylistsInStudio(cache, studio._id)

		if (activeRundowns.length === 0) {
			const markerId: TimelineObjId = protectString(`${studio._id}_baseline_version`)
			const markerObject = cache.Timeline.findOne(markerId)
			if (!markerObject) return 'noBaseline'

			const versionsContent = (markerObject.metaData || {}).versions || {}

			if (versionsContent.core !== (PackageInfo.versionExtended || PackageInfo.version)) return 'coreVersion'

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

function setRundownStartedPlayback(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	rundown: Rundown,
	startedPlayback: Time
) {
	if (!rundown.startedPlayback) {
		// Set startedPlayback on the rundown if this is the first item to be played
		reportRundownHasStarted(cache, playlist, rundown, startedPlayback)
	}
}

interface UpdateTimelineFromIngestDataTimeout {
	timeout?: number
	changedSegments: SegmentId[]
}
let updateTimelineFromIngestDataTimeouts: {
	[rundownId: string]: UpdateTimelineFromIngestDataTimeout
} = {}
export function triggerUpdateTimelineAfterIngestData(
	cache: CacheForRundownPlaylist,
	rundownId: RundownId,
	changedSegmentIds: SegmentId[]
) {
	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	let data: UpdateTimelineFromIngestDataTimeout = updateTimelineFromIngestDataTimeouts[unprotectString(rundownId)]
	if (data) {
		if (data.timeout) Meteor.clearTimeout(data.timeout)
		data.changedSegments = data.changedSegments.concat(changedSegmentIds)
	} else {
		data = {
			changedSegments: changedSegmentIds,
		}
	}

	data.timeout = Meteor.setTimeout(() => {
		delete updateTimelineFromIngestDataTimeouts[unprotectString(rundownId)]

		// infinite items only need to be recalculated for those after where the edit was made (including the edited line)
		let prevPart: Part | undefined
		if (data.changedSegments) {
			const firstSegment = cache.Segments.findOne({
				rundownId: rundownId,
				_id: { $in: data.changedSegments },
			})
			if (firstSegment) {
				prevPart = getPartBeforeSegment(rundownId, firstSegment)
			}
		}

		const rundown = cache.Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		const playlist = getRundownPlaylistFromCache(cache, rundown)
		if (!playlist)
			throw new Meteor.Error(501, `Rundown "${rundownId}" not a part of a playlist: "${rundown.playlistId}"`)

		return rundownPlaylistSyncFunction(playlist._id, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			if (playlist.active && playlist.currentPartInstanceId) {
				const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)
				if (
					currentPartInstance &&
					(currentPartInstance.rundownId === rundown._id ||
						(currentPartInstance.part.autoNext &&
							nextPartInstance &&
							nextPartInstance.rundownId === rundownId))
				) {
					updateTimeline(cache, rundown.studioId)
				}
			}
		})
	}, 1000)

	updateTimelineFromIngestDataTimeouts[unprotectString(rundownId)] = data
}

function getRundown(rundownId: RundownId): Rundown {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, 'Rundown ' + rundownId + ' not found')
	return rundown
}
