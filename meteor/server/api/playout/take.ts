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
} from './lib'
import { getBlueprintOfRundown } from '../blueprints/cache'
import { RundownHoldState, Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { updateTimeline } from './timeline'
import { logger } from '../../logging'
import { PartEndState, PieceLifespan, VTContent } from 'tv-automation-sofie-blueprints-integration'
import { getResolvedPieces } from './pieces'
import { Part } from '../../../lib/collections/Parts'
import * as _ from 'underscore'
import { Piece, PieceId } from '../../../lib/collections/Pieces'
import { PieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { PartEventContext, RundownContext } from '../blueprints/context/context'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { IngestActions } from '../ingest/actions'
import { StudioId } from '../../../lib/collections/Studios'

export function takeNextPartInner(rundownPlaylistId: RundownPlaylistId): ClientAPI.ClientResponse<void> {
	let now = getCurrentTime()

	return rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.USER_PLAYOUT, () => {
		let playlist = RundownPlaylists.findOne(rundownPlaylistId)
		if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${rundownPlaylistId}" not found!`)
		if (!playlist.active) throw new Meteor.Error(501, `RundownPlaylist "${rundownPlaylistId}" is not active!`)
		if (!playlist.nextPartInstanceId) throw new Meteor.Error(500, 'nextPartInstanceId is not set!')
		const cache = waitForPromise(initCacheForRundownPlaylist(playlist, undefined, true))

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
			completeHold(cache, playlist, currentPartInstance, previousPartInstance)

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
	})
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

				// TODO - won't this need some help seeking if a clip?

				if (remainingDuration > 0) {
					// Clone an overflowing piece
					let overflowedItem = literal<PieceInstance>({
						_id: getRandomId(),
						rundownId: instance.rundownId,
						partInstanceId: nextPartInstance._id,
						piece: {
							...omit(instance.piece, 'startedPlayback', 'userDuration', 'overflows'),
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

export function afterTake(
	cache: CacheForRundownPlaylist,
	studioId: StudioId,
	takePartInstance: PartInstance,
	timeOffset: number | null = null
) {
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
}

function startHold(
	cache: CacheForRundownPlaylist,
	holdFromPartInstance: PartInstance | undefined,
	holdToPartInstance: PartInstance | undefined
) {
	if (!holdFromPartInstance) throw new Meteor.Error(404, 'previousPart not found!')
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
			contentTmp.seek = Math.min(contentTmp.sourceDuration, getCurrentTime() - instance.piece.startedPlayback)
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

function completeHold(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	currentPartInstance: PartInstance | undefined,
	previousPartInstance: PartInstance | undefined
) {
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
}
