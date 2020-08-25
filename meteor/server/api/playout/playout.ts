/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { Match } from 'meteor/check'
import { Rundown, RundownHoldState, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { Part, DBPart, PartId } from '../../../lib/collections/Parts'
import { Piece, PieceId } from '../../../lib/collections/Pieces'
import {
	getCurrentTime,
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
	getRandomId,
	check,
} from '../../../lib/lib'
import { TimelineObjGeneric, TimelineObjId } from '../../../lib/collections/Timeline'
import { Segment, SegmentId } from '../../../lib/collections/Segments'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { PieceLifespan, PartHoldMode, VTContent, PartEndState } from 'tv-automation-sofie-blueprints-integration'
import { Studios, StudioId } from '../../../lib/collections/Studios'
import { ClientAPI } from '../../../lib/api/client'
import {
	reportRundownHasStarted,
	reportPartHasStarted,
	reportPieceHasStarted,
	reportPartHasStopped,
	reportPieceHasStopped,
} from '../asRunLog'
import { Blueprints } from '../../../lib/collections/Blueprints'
import {
	RundownPlaylist,
	RundownPlaylists,
	RundownPlaylistPlayoutData,
	RundownPlaylistId,
} from '../../../lib/collections/RundownPlaylists'
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
	refreshPart,
	getPartBeforeSegmentFromCache,
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
import {
	PieceResolved,
	getOrderedPiece,
	getResolvedPieces,
	convertAdLibToPieceInstance,
	convertPieceToAdLibPiece,
	orderPieces,
} from './pieces'
import { PackageInfo } from '../../coreSystem'
import { getActiveRundownPlaylistsInStudio } from './studio'
import { updateSourceLayerInfinitesAfterPart } from './infinites'
import { rundownPlaylistSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'
import { ServerPlayoutAdLibAPI } from './adlib'
import { PieceInstances, PieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { PartInstances, PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { ReloadRundownPlaylistResponse, UserActionAPIMethods } from '../../../lib/api/userActions'
import {
	initCacheForRundownPlaylist,
	CacheForRundownPlaylist,
	initCacheForStudio,
	initCacheForNoRundownPlaylist,
	CacheForStudio,
} from '../../DatabaseCaches'
import { Settings } from '../../../lib/Settings'
import { UserAction } from '../../../client/lib/userAction'

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
			if (playlist.active && !playlist.rehearsal && !Settings.allowRundownResetOnAir)
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
			if (playlist.active && !playlist.rehearsal && !Settings.allowRundownResetOnAir)
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
	export function takeNextPart(
		rundownPlaylistId: RundownPlaylistId,
		existingCache?: CacheForRundownPlaylist
	): ClientAPI.ClientResponse<void> {
		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			return takeNextpartInner(rundownPlaylistId)
		})
	}

	export function takeNextpartInner(rundownPlaylistId: RundownPlaylistId, existingCache?: CacheForRundownPlaylist) {
		let now = getCurrentTime()

		let playlist = RundownPlaylists.findOne(rundownPlaylistId)
		if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
		if (!playlist.active) throw new Meteor.Error(501, `RundownPlaylist "${rundownPlaylistId}" is not active!`)
		if (!playlist.nextPartInstanceId) throw new Meteor.Error(500, 'nextPartInstanceId is not set!')
		const cache = existingCache ?? waitForPromise(initCacheForRundownPlaylist(playlist, undefined, true))

		playlist = cache.RundownPlaylists.findOne(playlist._id)
		if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

		let timeOffset: number | null = playlist.nextTimeOffset || null
		let firstTake = !playlist.startedPlayback

		const { currentPartInstance, nextPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(
			cache,
			playlist
		)
		// const partInstance = nextPartInstance || currentPartInstance
		const partInstance = nextPartInstance // todo: we should always take the next, so it's this one, right?
		if (!partInstance) throw new Meteor.Error(404, `No partInstance could be found!`)
		const currentRundown = partInstance ? cache.Rundowns.findOne(partInstance.rundownId) : undefined
		if (!currentRundown)
			throw new Meteor.Error(
				404,
				`Rundown "${(partInstance && partInstance.rundownId) || ''}" could not be found!`
			)

		let pBlueprint = makePromise(() => getBlueprintOfRundown(currentRundown))

		const currentPart = currentPartInstance
		if (currentPart) {
			const allowTransition = previousPartInstance && !previousPartInstance.part.disableOutTransition
			const start = currentPart.part.getLastStartedPlayback()

			// If there was a transition from the previous Part, then ensure that has finished before another take is permitted
			if (
				allowTransition &&
				currentPart.part.transitionDuration &&
				start &&
				now < start + currentPart.part.transitionDuration
			) {
				return ClientAPI.responseError('Cannot take during a transition')
			}

			if (isTooCloseToAutonext(currentPart, true)) {
				return ClientAPI.responseError('Cannot take shortly before an autoTake')
			}
		}

		if (playlist.holdState === RundownHoldState.COMPLETE) {
			cache.RundownPlaylists.update(playlist._id, {
				$set: {
					holdState: RundownHoldState.NONE,
				},
			})
			// If hold is active, then this take is to clear it
		} else if (playlist.holdState === RundownHoldState.ACTIVE) {
			cache.RundownPlaylists.update(playlist._id, {
				$set: {
					holdState: RundownHoldState.COMPLETE,
				},
			})

			if (playlist.currentPartInstanceId) {
				if (!currentPartInstance) throw new Meteor.Error(404, 'currentPart not found!')

				// Remove the current extension line
				cache.PieceInstances.remove(
					(pieceInstance) =>
						pieceInstance.partInstanceId === currentPartInstance._id &&
						pieceInstance.piece.extendOnHold === true &&
						pieceInstance.piece.dynamicallyInserted === true
				)
				// TODO-PartInstance - pending new data flow
				cache.Pieces.remove(
					(piece) =>
						piece.partId === currentPartInstance.part._id &&
						piece.extendOnHold === true &&
						piece.dynamicallyInserted === true
				)
			}
			if (!playlist.previousPartInstanceId) {
				if (!previousPartInstance) throw new Meteor.Error(404, 'previousPart not found!')

				// Clear the extended mark on the original
				cache.PieceInstances.update(
					(pieceInstance) =>
						pieceInstance.partInstanceId === previousPartInstance._id &&
						pieceInstance.piece.extendOnHold === true &&
						pieceInstance.piece.dynamicallyInserted === false,
					{
						$unset: {
							'piece.infiniteId': 0,
							'piece.infiniteMode': 0,
						},
					}
				)
				// TODO-PartInstance - pending new data flow
				cache.Pieces.update(
					(piece) =>
						piece.partId === previousPartInstance.part._id &&
						piece.extendOnHold === true &&
						piece.dynamicallyInserted === false,
					{
						$unset: {
							infiniteId: 0,
							infiniteMode: 0,
						},
					}
				)
			}

			updateTimeline(cache, playlist.studioId)

			waitForPromise(cache.saveAllToDatabase())

			return ClientAPI.responseSuccess(undefined)
		}

		let takePartInstance = nextPartInstance
		if (!takePartInstance) throw new Meteor.Error(404, 'takePart not found!')
		const takeRundown: Rundown | undefined = cache.Rundowns.findOne(takePartInstance.rundownId)
		if (!takeRundown)
			throw new Meteor.Error(500, `takeRundown: takeRundown not found! ("${takePartInstance.rundownId}")`)

		const { segments, parts: partsInOrder } = getSegmentsAndPartsFromCache(cache, playlist)
		// let takeSegment = rundownData.segmentsMap[takePart.segmentId]
		const nextPart = selectNextPart(playlist, takePartInstance, partsInOrder)

		// beforeTake(rundown, previousPart || null, takePart)
		beforeTake(cache, partsInOrder, previousPartInstance || null, takePartInstance)

		const { blueprint } = waitForPromise(pBlueprint)
		if (blueprint.onPreTake) {
			try {
				waitForPromise(
					Promise.resolve(
						blueprint.onPreTake(new PartEventContext(takeRundown, undefined, takePartInstance))
					).catch(logger.error)
				)
			} catch (e) {
				logger.error(e)
			}
		}
		// TODO - the state could change after this sampling point. This should be handled properly
		let previousPartEndState: PartEndState | undefined = undefined
		if (blueprint.getEndStateForPart && previousPartInstance) {
			const time = getCurrentTime()
			const resolvedPieces = getResolvedPieces(cache, previousPartInstance)

			const context = new RundownContext(takeRundown, undefined)
			previousPartEndState = blueprint.getEndStateForPart(
				context,
				playlist.previousPersistentState,
				previousPartInstance.part.previousPartEndState,
				unprotectObjectArray(resolvedPieces),
				time
			)
			logger.info(`Calculated end state in ${getCurrentTime() - time}ms`)
		}
		const m: Partial<RundownPlaylist> = {
			previousPartInstanceId: playlist.currentPartInstanceId,
			currentPartInstanceId: takePartInstance._id,
			holdState:
				!playlist.holdState || playlist.holdState === RundownHoldState.COMPLETE
					? RundownHoldState.NONE
					: playlist.holdState + 1,
		}

		cache.RundownPlaylists.update(playlist._id, {
			$set: m,
		})

		let partInstanceM: any = {
			$set: {
				isTaken: true,
				'part.taken': true,
			},
			$unset: {} as { string: 0 | 1 },
			$push: {
				'part.timings.take': now,
				'part.timings.playOffset': timeOffset || 0,
			},
		}
		let partM = {
			$set: {
				taken: true,
			} as Partial<Part>,
			$unset: {} as { [key in keyof Part]: 0 | 1 },
			$push: {
				'timings.take': now,
				'timings.playOffset': timeOffset || 0,
			},
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

		cache.PartInstances.update(takePartInstance._id, partInstanceM)
		// TODO-PartInstance - pending new data flow
		cache.Parts.update(takePartInstance.part._id, partM)

		if (m.previousPartInstanceId) {
			cache.PartInstances.update(m.previousPartInstanceId, {
				$push: {
					'part.timings.takeOut': now,
				},
			})
			// TODO-PartInstance - pending new data flow
			if (currentPartInstance) {
				cache.Parts.update(currentPartInstance.part._id, {
					$push: {
						'timings.takeOut': now,
					},
				})
			}
		}
		playlist = _.extend(playlist, m) as RundownPlaylist

		// Once everything is synced, we can choose the next part
		libsetNextPart(cache, playlist, nextPart ? nextPart.part : null)

		// update playoutData
		// const newSelectedPartInstances = playlist.getSelectedPartInstances()
		// rundownData = {
		// 	...rundownData,
		// 	...newSelectedPartInstances
		// }
		// rundownData = getAllOrderedPartsFromCache(cache, playlist) // this is not needed anymore

		// Setup the parts for the HOLD we are starting
		if (playlist.previousPartInstanceId && m.holdState === RundownHoldState.ACTIVE) {
			const holdFromPartInstance = currentPartInstance
			if (!holdFromPartInstance) throw new Meteor.Error(404, 'previousPart not found!')
			const holdToPartInstance = nextPartInstance
			if (!holdToPartInstance) throw new Meteor.Error(404, 'currentPart not found!')

			// Make a copy of any item which is flagged as an 'infinite' extension
			const itemsToCopy = cache.PieceInstances.findFetch({ partInstanceId: holdFromPartInstance._id }).filter(
				(i) => i.piece.extendOnHold
			)
			itemsToCopy.forEach((instance) => {
				// TODO-PartInstance - temporary mutate existing piece, pending new data flow
				const rawPiece = cache.Pieces.findOne((p) => p._id === instance.piece._id)
				if (rawPiece) {
					rawPiece.infiniteId = rawPiece._id
					rawPiece.infiniteMode = PieceLifespan.OutOnNextPart
					cache.Pieces.update(rawPiece._id, {
						$set: {
							infiniteMode: PieceLifespan.OutOnNextPart,
							infiniteId: rawPiece._id,
						},
					})
				}

				// mark current one as infinite
				instance.piece.infiniteId = instance.piece._id
				instance.piece.infiniteMode = PieceLifespan.OutOnNextPart
				cache.PieceInstances.update(instance._id, {
					$set: {
						'piece.infiniteMode': PieceLifespan.OutOnNextPart,
						'piece.infiniteId': instance.piece._id,
					},
				})

				// TODO-PartInstance - temporary piece extension, pending new data flow
				const newPieceTmp: Piece = clone(instance.piece)
				newPieceTmp.partId = holdToPartInstance.part._id
				newPieceTmp.enable = { start: 0 }
				const contentTmp = newPieceTmp.content as VTContent
				if (contentTmp.fileName && contentTmp.sourceDuration && instance.piece.startedPlayback) {
					contentTmp.seek = Math.min(
						contentTmp.sourceDuration,
						getCurrentTime() - instance.piece.startedPlayback
					)
				}
				newPieceTmp.dynamicallyInserted = true
				newPieceTmp._id = protectString<PieceId>(instance.piece._id + '_hold')

				// This gets deleted once the nextpart is activated, so it doesnt linger for long
				cache.Pieces.upsert(newPieceTmp._id, newPieceTmp)
				// rundownData.pieces.push(newPieceTmp) // update the local collection

				// make the extension
				const newInstance = literal<PieceInstance>({
					_id: protectString<PieceInstanceId>(instance._id + '_hold'),
					rundownId: instance.rundownId,
					partInstanceId: holdToPartInstance._id,
					piece: {
						...clone(instance.piece),
						_id: newPieceTmp._id,
						partId: holdToPartInstance.part._id,
						enable: { start: 0 },
						dynamicallyInserted: true,
					},
				})
				const content = newInstance.piece.content as VTContent | undefined
				if (content && content.fileName && content.sourceDuration && instance.piece.startedPlayback) {
					content.seek = Math.min(content.sourceDuration, getCurrentTime() - instance.piece.startedPlayback)
				}

				// This gets deleted once the nextpart is activated, so it doesnt linger for long
				cache.PieceInstances.upsert(newInstance._id, newInstance)
				// rundownData.selectedInstancePieces.push(newInstance) // update the local collection
			})
		}
		afterTake(cache, playlist, takePartInstance, timeOffset) // todo

		// Last:
		const takeDoneTime = getCurrentTime()
		cache.defer(() => {
			// todo: should this be changed back to Meteor.defer, at least for the blueprint stuff?
			if (takePartInstance) {
				cache.PartInstances.update(takePartInstance._id, {
					$push: {
						'part.timings.takeDone': takeDoneTime,
					},
				})
				cache.Parts.update(takePartInstance.part._id, {
					$push: {
						'timings.takeDone': takeDoneTime,
					},
				})
				// let bp = getBlueprintOfRundown(rundown)
				if (firstTake) {
					if (blueprint.onRundownFirstTake) {
						waitForPromise(
							Promise.resolve(
								blueprint.onRundownFirstTake(
									new PartEventContext(takeRundown, undefined, takePartInstance)
								)
							).catch(logger.error)
						)
					}
				}

				if (blueprint.onPostTake) {
					waitForPromise(
						Promise.resolve(
							blueprint.onPostTake(new PartEventContext(takeRundown, undefined, takePartInstance))
						).catch(logger.error)
					)
				}
			}
		})
		waitForPromise(cache.saveAllToDatabase())

		return ClientAPI.responseSuccess(undefined)
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
				const orderedPieces: Array<PieceResolved> = orderPieces(
					pieceInstances.map((p) => p.piece),
					partInstance.part._id,
					partInstance.part.getLastStartedPlayback()
				)

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
					return piece.resolvedStart >= nowInPart && ((!undo && !piece.disabled) || (undo && piece.disabled))
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

					// Load the latest data and complete the take
					const rundownPlaylist = cache.RundownPlaylists.findOne(rundown.playlistId)
					if (!rundownPlaylist)
						throw new Meteor.Error(
							404,
							`RundownPlaylist "${rundown.playlistId}", parent of rundown "${rundown._id}" not found!`
						)

					afterTake(cache, rundownPlaylist, playingPartInstance)

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
		rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
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
			if (context.currentPartState === ActionPartChange.MARK_DIRTY) {
				cache.PartInstances.update(currentPartInstance._id, {
					$set: {
						'part.dirty': true,
					},
				})
				// TODO-PartInstance - pending new data flow
				cache.Parts.update(currentPartInstance.part._id, {
					$set: {
						dirty: true,
					},
				})
			}
			if (context.nextPartState === ActionPartChange.MARK_DIRTY) {
				if (!playlist.nextPartInstanceId)
					throw new Meteor.Error(500, `Cannot mark non-existant partInstance as dirty`)
				const nextPartInstance = cache.PartInstances.findOne(playlist.nextPartInstanceId)
				if (!nextPartInstance) throw new Meteor.Error(500, `Cannot mark non-existant partInstance as dirty`)

				if (!nextPartInstance.part.dynamicallyInserted) {
					cache.PartInstances.update(nextPartInstance._id, {
						$set: {
							'part.dirty': true,
						},
					})
					// TODO-PartInstance - pending new data flow
					cache.Parts.update(nextPartInstance.part._id, {
						$set: {
							dirty: true,
						},
					})
				}
			}

			if (context.currentPartState !== ActionPartChange.NONE || context.nextPartState !== ActionPartChange.NONE) {
				updateSourceLayerInfinitesAfterPart(cache, rundown, currentPartInstance.part)
			}

			if (context.takeAfterExecute) {
				return ServerPlayoutAPI.takeNextpartInner(rundownPlaylistId, cache)
			} else {
				if (
					context.currentPartState !== ActionPartChange.NONE ||
					context.nextPartState !== ActionPartChange.NONE
				) {
					updateTimeline(cache, playlist.studioId)
				}

				waitForPromise(cache.saveAllToDatabase())
			}
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

			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(501, `Rundown "${partInstance.rundownId}" not found!`)

			ServerPlayoutAdLibAPI.innerStopPieces(
				cache,
				partInstance,
				(pieceInstance) => sourceLayerIds.indexOf(pieceInstance.piece.sourceLayerId) !== -1,
				undefined
			)

			updateSourceLayerInfinitesAfterPart(cache, rundown, partInstance.part)

			updateTimeline(cache, playlist.studioId)

			waitForPromise(cache.saveAllToDatabase())
		})
	}
	export function rundownTogglePartArgument(
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		property: string,
		value: string
	) {
		check(rundownPlaylistId, String)
		check(partInstanceId, String)

		return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
			let playlist = RundownPlaylists.findOne(rundownPlaylistId)
			if (!playlist) throw new Meteor.Error(404, `Rundown "${rundownPlaylistId}" not found!`)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw new Meteor.Error(403, `Part Arguments can not be toggled when hold is used!`)
			}

			const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

			playlist = cache.RundownPlaylists.findOne(playlist._id)
			if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found in cache!`)

			let partInstance = cache.PartInstances.findOne(partInstanceId)
			if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)
			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Meteor.Error(501, `Rundown "${partInstance.rundownId}" not found!`)

			const rArguments = partInstance.part.runtimeArguments || {}

			if (rArguments[property] === value) {
				// unset property
				const mUnset: any = {}
				const mUnset1: any = {}
				mUnset['runtimeArguments.' + property] = 1
				mUnset1['part.runtimeArguments.' + property] = 1
				cache.Parts.update(partInstance.part._id, {
					$unset: mUnset,
					$set: {
						dirty: true,
					},
				})
				cache.PartInstances.update(partInstance._id, {
					$unset: mUnset1,
					$set: {
						dirty: true,
					},
				})
				delete rArguments[property]
			} else {
				// set property
				const mSet: any = {}
				const mSet1: any = {}
				mSet['runtimeArguments.' + property] = value
				mSet1['part.runtimeArguments.' + property] = value
				mSet.dirty = true
				cache.Parts.update(partInstance.part._id, { $set: mSet })
				cache.PartInstances.update(partInstance._id, { $set: mSet1 })

				rArguments[property] = value
			}

			waitForPromise(refreshPart(cache, rundown, partInstance.part))

			// Only take time to update the timeline if there's a point to do it
			if (playlist.active) {
				// If this part is rundown's next, check if current part has autoNext
				if (playlist.nextPartInstanceId === partInstance._id && playlist.currentPartInstanceId) {
					const currentPartInstance = cache.PartInstances.findOne(playlist.currentPartInstanceId)
					if (currentPartInstance && currentPartInstance.part.autoNext) {
						updateTimeline(cache, rundown.studioId)
					}
					// If this is rundown's current part, update immediately
				} else if (playlist.currentPartInstanceId === partInstance._id) {
					updateTimeline(cache, rundown.studioId)
				}
			}

			waitForPromise(cache.saveAllToDatabase())
			return ClientAPI.responseSuccess(undefined)
		})
	}
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
				// TODO-PartInstance - pending new data flow
				cache.Pieces.update(
					{
						_id: pieceInstance.piece._id,
						rundownId: { $in: activeRundownIds },
					},
					{
						$set: {
							'enable.start': time,
						},
					}
				)
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

function beforeTake(
	cache: CacheForRundownPlaylist,
	partsInOrder: Part[],
	currentPartInstance: PartInstance | null,
	nextPartInstance: PartInstance
) {
	// TODO-PartInstance - is this going to work? It needs some work to handle part data changes
	if (currentPartInstance) {
		const adjacentPart = _.find(partsInOrder, (part) => {
			return part.segmentId === currentPartInstance.segmentId && part._rank > currentPartInstance.part._rank
		})
		if (!adjacentPart || adjacentPart._id !== nextPartInstance.part._id) {
			// adjacent Part isn't the next part, do not overflow
			return
		}
		const currentPieces = cache.PieceInstances.findFetch({ partInstanceId: currentPartInstance._id })
		currentPieces.forEach((instance) => {
			if (
				instance.piece.overflows &&
				typeof instance.piece.enable.duration === 'number' &&
				instance.piece.enable.duration > 0 &&
				instance.piece.playoutDuration === undefined &&
				instance.piece.userDuration === undefined
			) {
				// Subtract the amount played from the duration
				const remainingDuration = Math.max(
					0,
					instance.piece.enable.duration -
						((instance.piece.startedPlayback ||
							currentPartInstance.part.getLastStartedPlayback() ||
							getCurrentTime()) -
							getCurrentTime())
				)

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
						},
					})

					cache.PieceInstances.insert(overflowedItem)

					// TODO-PartInstance - pending new data flow
					cache.Pieces.insert(overflowedItem.piece)
				}
			}
		})
	}
}

function afterTake(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	takePartInstance: PartInstance,
	timeOffset: number | null = null
) {
	// This function should be called at the end of a "take" event (when the Parts have been updated)

	let forceNowTime: number | undefined = undefined
	if (timeOffset) {
		forceNowTime = getCurrentTime() - timeOffset
	}
	// or after a new part has started playing
	updateTimeline(cache, playlist.studioId, forceNowTime)

	// defer these so that the playout gateway has the chance to learn about the changes
	Meteor.setTimeout(() => {
		// todo
		if (takePartInstance.part.shouldNotifyCurrentPlayingPart) {
			const currentRundown = Rundowns.findOne(takePartInstance.rundownId)
			if (!currentRundown)
				throw new Meteor.Error(
					404,
					`Rundown "${takePartInstance.rundownId}" of partInstance "${takePartInstance._id}" not found`
				)
			IngestActions.notifyCurrentPlayingPart(currentRundown, takePartInstance.part)
		}
	}, 40)
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
	playlistId: RundownPlaylistId
	changedSegments: SegmentId[]
}
const updateTimelineFromIngestDataTimeouts = new Map<RundownId, UpdateTimelineFromIngestDataTimeout>()
export function triggerUpdateTimelineAfterIngestData(
	rundownId: RundownId,
	playlistId: RundownPlaylistId,
	changedSegmentIds: SegmentId[]
) {
	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	const data: UpdateTimelineFromIngestDataTimeout = updateTimelineFromIngestDataTimeouts.get(rundownId) ?? {
		changedSegments: [],
		playlistId,
	}

	if (data.timeout) Meteor.clearTimeout(data.timeout)
	data.changedSegments = data.changedSegments.concat(changedSegmentIds)
	data.playlistId = playlistId

	data.timeout = Meteor.setTimeout(() => {
		if (updateTimelineFromIngestDataTimeouts.delete(rundownId)) {
			return rundownPlaylistSyncFunction(data.playlistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
				const playlist = RundownPlaylists.findOne(data.playlistId)
				if (!playlist) {
					throw new Meteor.Error(404, `RundownPlaylist "${data.playlistId}" not found!`)
				}

				const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

				// infinite items only need to be recalculated for those after where the edit was made (including the edited line)
				let prevPart: Part | undefined
				if (data.changedSegments) {
					const firstSegment = cache.Segments.findOne({
						rundownId: rundownId,
						_id: { $in: data.changedSegments },
					})
					if (firstSegment) {
						prevPart = getPartBeforeSegmentFromCache(cache, rundownId, firstSegment)
					}
				}

				const rundown = cache.Rundowns.findOne(rundownId)
				if (!rundown) {
					throw new Meteor.Error(
						404,
						`Rundown "${rundownId}" not found in RundownPlaylist "${data.playlistId}"!`
					)
				}

				// TODO - test the input data for this
				updateSourceLayerInfinitesAfterPart(cache, rundown, prevPart, true)

				if (playlist.active && playlist.currentPartInstanceId) {
					// If the playlist is active, then updateTimeline as lookahead could have been affected
					updateTimeline(cache, rundown.studioId)
				}

				waitForPromise(cache.saveAllToDatabase())
			})
		}
	}, 1000)

	updateTimelineFromIngestDataTimeouts.set(rundownId, data)
}

function getRundown(rundownId: RundownId): Rundown {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, 'Rundown ' + rundownId + ' not found')
	return rundown
}
