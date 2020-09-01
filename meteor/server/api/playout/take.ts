import { RundownPlaylistId, RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { ClientAPI } from '../../../lib/api/client'
import {
	getCurrentTime,
	waitForPromise,
	makePromise,
	unprotectObjectArray,
	protectString,
	literal,
	clone,
	getRandomId,
	omit,
	asyncCollectionFindOne,
} from '../../../lib/lib'
import { rundownPlaylistSyncFunction, RundownSyncFunctionPriority } from '../ingest/rundownInput'
import { Meteor } from 'meteor/meteor'
import { initCacheForRundownPlaylist, CacheForRundownPlaylist } from '../../DatabaseCaches'
import {
	setNextPart as libsetNextPart,
	getSelectedPartInstancesFromCache,
	isTooCloseToAutonext,
	getSegmentsAndPartsFromCache,
	selectNextPart,
	checkAccessAndGetPlaylist,
	triggerGarbageCollection,
} from './lib'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { RundownHoldState, Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { updateTimeline } from './timeline'
import { logger } from '../../logging'
import { PartEndState, PieceLifespan, VTContent } from 'tv-automation-sofie-blueprints-integration'
import { getResolvedPieces } from './pieces'
import { Part } from '../../../lib/collections/Parts'
import * as _ from 'underscore'
import { Piece, PieceId } from '../../../lib/collections/Pieces'
import { PieceInstance, PieceInstanceId, PieceInstancePiece } from '../../../lib/collections/PieceInstances'
import { PartEventContext, RundownContext } from '../blueprints/context/context'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { IngestActions } from '../ingest/actions'
import { StudioId } from '../../../lib/collections/Studios'
import { ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { reportPartHasStarted } from '../asRunLog'
import { MethodContext } from '../../../lib/api/methods'
import { profiler } from '../profiler'

export function takeNextPartInner(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	existingCache?: CacheForRundownPlaylist
): ClientAPI.ClientResponse<void> {
	let now = getCurrentTime()

	return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
		return takeNextPartInnerSync(context, rundownPlaylistId, now, existingCache)
	})
}

/**
 * This *must* be run within a rundownPlaylistSyncFunction.
 * It is exposed to prevent nested sync functions where take is called as part of another action.
 */
export function takeNextPartInnerSync(
	context: MethodContext,
	rundownPlaylistId: RundownPlaylistId,
	now: number,
	existingCache?: CacheForRundownPlaylist
) {
	const span = profiler.startSpan('takeNextPartInner')
	const dbPlaylist = checkAccessAndGetPlaylist(context, rundownPlaylistId)
	if (!dbPlaylist.active) throw new Meteor.Error(501, `RundownPlaylist "${rundownPlaylistId}" is not active!`)
	if (!dbPlaylist.nextPartInstanceId) throw new Meteor.Error(500, 'nextPartInstanceId is not set!')
	const cache = existingCache ?? waitForPromise(initCacheForRundownPlaylist(dbPlaylist, undefined, true))

	let playlist = cache.RundownPlaylists.findOne(dbPlaylist._id)
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
		throw new Meteor.Error(404, `Rundown "${(partInstance && partInstance.rundownId) || ''}" could not be found!`)

	let pShowStyle = cache.activationCache.getShowStyleBase(currentRundown)
	let pBlueprint = pShowStyle.then((showStyle) => loadShowStyleBlueprint(showStyle))

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
		completeHold(cache, playlist, currentPartInstance)

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
	copyOverflowingPieces(cache, partsInOrder, previousPartInstance || null, takePartInstance)

	const { blueprint } = waitForPromise(pBlueprint)
	if (blueprint.onPreTake) {
		const span = profiler.startSpan('blueprint.onPreTake')
		try {
			waitForPromise(
				Promise.resolve(blueprint.onPreTake(new PartEventContext(takeRundown, cache, takePartInstance))).catch(
					logger.error
				)
			)
			if (span) span.end()
		} catch (e) {
			if (span) span.end()
			logger.error(e)
		}
	}
	// TODO - the state could change after this sampling point. This should be handled properly
	let previousPartEndState: PartEndState | undefined = undefined
	if (blueprint.getEndStateForPart && previousPartInstance) {
		const time = getCurrentTime()
		const showStyle = waitForPromise(pShowStyle)
		if (showStyle) {
			const resolvedPieces = getResolvedPieces(cache, showStyle, previousPartInstance)

			const span = profiler.startSpan('blueprint.getEndStateForPart')
			const context = new RundownContext(takeRundown, cache, undefined)
			previousPartEndState = blueprint.getEndStateForPart(
				context,
				playlist.previousPersistentState,
				previousPartInstance.previousPartEndState,
				unprotectObjectArray(resolvedPieces),
				time
			)
			if (span) span.end()
			logger.info(`Calculated end state in ${getCurrentTime() - time}ms`)
		}
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
		partInstanceM.$set.previousPartEndState = previousPartEndState
	} else {
		partInstanceM.$unset.previousPartEndState = 1
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
		startHold(cache, currentPartInstance, nextPartInstance)
	}
	afterTake(cache, playlist.studioId, takePartInstance, timeOffset)

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

			// Simulate playout, if no gateway
			if (takePartInstance) {
				const playoutDevices = waitForPromise(cache.activationCache.getPeripheralDevices()).filter(
					(d) => d.studioId === takeRundown.studioId && d.type === PeripheralDeviceAPI.DeviceType.PLAYOUT
				)
				if (playoutDevices.length === 0) {
					logger.info(
						`No Playout gateway attached to studio, reporting PartInstance "${
							takePartInstance._id
						}" to have started playback on timestamp ${new Date(takeDoneTime).toISOString()}`
					)
					reportPartHasStarted(cache, takePartInstance, takeDoneTime)
				}
			}

			// let bp = getBlueprintOfRundown(rundown)
			if (firstTake) {
				if (blueprint.onRundownFirstTake) {
					const span = profiler.startSpan('blueprint.onRundownFirstTake')
					waitForPromise(
						Promise.resolve(
							blueprint.onRundownFirstTake(new PartEventContext(takeRundown, cache, takePartInstance))
						).catch(logger.error)
					)
					if (span) span.end()
				}
			}

			if (blueprint.onPostTake) {
				const span = profiler.startSpan('blueprint.onPostTake')
				waitForPromise(
					Promise.resolve(
						blueprint.onPostTake(new PartEventContext(takeRundown, cache, takePartInstance))
					).catch(logger.error)
				)
				if (span) span.end()
			}
		}
	})
	waitForPromise(cache.saveAllToDatabase())

	if (span) span.end()
	return ClientAPI.responseSuccess(undefined)
}

function copyOverflowingPieces(
	cache: CacheForRundownPlaylist,
	partsInOrder: Part[],
	currentPartInstance: PartInstance | null,
	nextPartInstance: PartInstance
) {
	// TODO-PartInstance - is this going to work? It needs some work to handle part data changes
	if (currentPartInstance) {
		const adjacentPart = partsInOrder.find((part) => {
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
				instance.userDuration === undefined
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

				// TODO - won't this need some help seeking if a clip?

				if (remainingDuration > 0) {
					// Clone an overflowing piece
					let overflowedItem = literal<PieceInstance>({
						_id: getRandomId(),
						rundownId: instance.rundownId,
						partInstanceId: nextPartInstance._id,
						dynamicallyInserted: getCurrentTime(),
						piece: {
							...omit(instance.piece, 'startedPlayback', 'overflows'),
							_id: getRandomId(),
							startPartId: nextPartInstance.part._id,
							enable: {
								start: 0,
								duration: remainingDuration,
							},
							continuesRefId: instance.piece._id,
						},
					})

					cache.PieceInstances.insert(overflowedItem)
				}
			}
		})
	}
}

export function afterTake(
	cache: CacheForRundownPlaylist,
	studioId: StudioId,
	takePartInstance: PartInstance,
	timeOffset: number | null = null
) {
	const span = profiler.startSpan('afterTake')
	// This function should be called at the end of a "take" event (when the Parts have been updated)

	let forceNowTime: number | undefined = undefined
	if (timeOffset) {
		forceNowTime = getCurrentTime() - timeOffset
	}
	// or after a new part has started playing
	updateTimeline(cache, studioId, forceNowTime)

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

	triggerGarbageCollection()
	if (span) span.end()
}

function startHold(
	cache: CacheForRundownPlaylist,
	holdFromPartInstance: PartInstance | undefined,
	holdToPartInstance: PartInstance | undefined
) {
	if (!holdFromPartInstance) throw new Meteor.Error(404, 'previousPart not found!')
	if (!holdToPartInstance) throw new Meteor.Error(404, 'currentPart not found!')
	const span = profiler.startSpan('startHold')

	// Make a copy of any item which is flagged as an 'infinite' extension
	const itemsToCopy = cache.PieceInstances.findFetch({ partInstanceId: holdFromPartInstance._id }).filter(
		(i) => i.piece.extendOnHold
	)
	itemsToCopy.forEach((instance) => {
		// mark current one as infinite
		instance.infinite = {
			infinitePieceId: instance.piece._id,
			fromHold: true,
		}
		cache.PieceInstances.update(instance._id, {
			$set: {
				infinite: {
					infinitePieceId: instance.piece._id,
					fromHold: true,
				},
			},
		})

		// make the extension
		const newInstance = literal<PieceInstance>({
			_id: protectString<PieceInstanceId>(instance._id + '_hold'),
			rundownId: instance.rundownId,
			partInstanceId: holdToPartInstance._id,
			dynamicallyInserted: getCurrentTime(),
			piece: {
				...clone(instance.piece),
				_id: protectString<PieceId>(instance.piece._id + '_hold'),
				startPartId: holdToPartInstance.part._id,
				enable: { start: 0 },
			},
			infinite: {
				infinitePieceId: instance.piece._id,
				fromHold: true,
			},
		})
		const content = newInstance.piece.content as VTContent | undefined
		if (content && content.fileName && content.sourceDuration && instance.piece.startedPlayback) {
			content.seek = Math.min(content.sourceDuration, getCurrentTime() - instance.piece.startedPlayback)
		}

		// This gets deleted once the nextpart is activated, so it doesnt linger for long
		cache.PieceInstances.upsert(newInstance._id, newInstance)
	})
	if (span) span.end()
}

function completeHold(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	currentPartInstance: PartInstance | undefined
) {
	cache.RundownPlaylists.update(playlist._id, {
		$set: {
			holdState: RundownHoldState.COMPLETE,
		},
	})

	if (playlist.currentPartInstanceId) {
		if (!currentPartInstance) throw new Meteor.Error(404, 'currentPart not found!')

		// Clear the current extension line
		const extendedPieceInstances = cache.PieceInstances.findFetch({
			partInstanceId: currentPartInstance._id,
			'piece.extendOnHold': true,
			infinite: { $exists: true },
		})

		for (const pieceInstance of extendedPieceInstances) {
			if (pieceInstance.infinite && pieceInstance.piece.startPartId !== currentPartInstance.part._id) {
				// This is a continuation, so give it an end
				cache.PieceInstances.update(pieceInstance._id, {
					$set: {
						userDuration: {
							end: getCurrentTime(),
						},
					},
				})
			}
		}
	}

	updateTimeline(cache, playlist.studioId)
}
