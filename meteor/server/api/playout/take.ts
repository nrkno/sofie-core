import { RundownPlaylist, RundownPlaylistActivationId } from '../../../lib/collections/RundownPlaylists'
import { ClientAPI } from '../../../lib/api/client'
import {
	getCurrentTime,
	waitForPromise,
	unprotectObjectArray,
	protectString,
	literal,
	clone,
	getRandomId,
} from '../../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { CacheForPlayout } from '../../cache/DatabaseCaches'
import {
	setNextPart as libsetNextPart,
	getSelectedPartInstancesFromCache,
	isTooCloseToAutonext,
	selectNextPart,
	getAllOrderedPartsFromPlayoutCache,
	getAllPieceInstancesFromCache,
	LOW_PRIO_DEFER_TIME,
} from './lib'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { RundownHoldState, Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { updateTimeline } from './timeline'
import { logger } from '../../logging'
import { PartEndState, ShowStyleBlueprintManifest, VTContent } from '@sofie-automation/blueprints-integration'
import { getResolvedPieces } from './pieces'
import { PieceInstance, PieceInstanceId, PieceInstanceInfiniteId } from '../../../lib/collections/PieceInstances'
import { PartEventContext, RundownContext } from '../blueprints/context/context'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { IngestActions } from '../ingest/actions'
import { reportPartHasStarted } from '../asRunLog'
import { profiler } from '../profiler'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { ServerPlayoutAdLibAPI } from './adlib'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { isAnySyncFunctionsRunning } from '../../codeControl'
import { ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'

/**
 * This *must* be run within a rundownPlaylistSyncFunction.
 * It is exposed to prevent nested sync functions where take is called as part of another action.
 */
export function takeNextPartInnerSync(cache: CacheForPlayout, now: number) {
	const span = profiler.startSpan('takeNextPartInner')

	const playlist = cache.Playlist.doc
	if (!playlist.activationId) throw new Meteor.Error(501, `RundownPlaylist "${playlist._id}" is not active!`)
	if (!playlist.nextPartInstanceId) throw new Meteor.Error(500, 'nextPartInstanceId is not set!')

	let timeOffset: number | null = playlist.nextTimeOffset || null
	let firstTake = !playlist.startedPlayback

	const { currentPartInstance, nextPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(cache)
	// const partInstance = nextPartInstance || currentPartInstance
	const partInstance = nextPartInstance // todo: we should always take the next, so it's this one, right?
	if (!partInstance) throw new Meteor.Error(404, `No partInstance could be found!`)
	const currentRundown = partInstance ? cache.Rundowns.findOne(partInstance.rundownId) : undefined
	if (!currentRundown)
		throw new Meteor.Error(404, `Rundown "${(partInstance && partInstance.rundownId) || ''}" could not be found!`)

	const pShowStyle = cache.activationCache.getShowStyleCompound(currentRundown)
	const pBlueprint = pShowStyle.then((showStyle) => loadShowStyleBlueprint(showStyle))

	if (currentPartInstance) {
		const allowTransition = previousPartInstance && !previousPartInstance.part.disableOutTransition
		const start = currentPartInstance.timings?.startedPlayback

		// If there was a transition from the previous Part, then ensure that has finished before another take is permitted
		if (
			allowTransition &&
			currentPartInstance.part.transitionDuration &&
			start &&
			now < start + currentPartInstance.part.transitionDuration
		) {
			return ClientAPI.responseError('Cannot take during a transition')
		}

		if (isTooCloseToAutonext(currentPartInstance, true)) {
			return ClientAPI.responseError('Cannot take shortly before an autoTake')
		}
	}

	if (playlist.holdState === RundownHoldState.COMPLETE) {
		cache.Playlist.update({
			$set: {
				holdState: RundownHoldState.NONE,
			},
		})
		// If hold is active, then this take is to clear it
	} else if (playlist.holdState === RundownHoldState.ACTIVE) {
		completeHold(cache, waitForPromise(pShowStyle), currentPartInstance)

		return ClientAPI.responseSuccess(undefined)
	}

	const takePartInstance = nextPartInstance
	if (!takePartInstance) throw new Meteor.Error(404, 'takePart not found!')
	const takeRundown: Rundown | undefined = cache.Rundowns.findOne(takePartInstance.rundownId)
	if (!takeRundown)
		throw new Meteor.Error(500, `takeRundown: takeRundown not found! ("${takePartInstance.rundownId}")`)

	const partsInOrder = getAllOrderedPartsFromPlayoutCache(cache)
	const nextPart = selectNextPart(playlist, takePartInstance, partsInOrder)

	// beforeTake(rundown, previousPart || null, takePart)

	const showStyle = waitForPromise(pShowStyle)
	const { blueprint, blueprintId } = waitForPromise(pBlueprint)
	if (blueprint.onPreTake) {
		const span = profiler.startSpan('blueprint.onPreTake')
		try {
			waitForPromise(
				Promise.resolve(
					blueprint.onPreTake(
						new PartEventContext('onPreTake', cache.Studio.doc, takeRundown, showStyle, takePartInstance)
					)
				).catch(logger.error)
			)
			if (span) span.end()
		} catch (e) {
			if (span) span.end()
			logger.error(e)
		}
	}

	updatePartInstanceOnTake(cache, pShowStyle, blueprint, takeRundown, takePartInstance, currentPartInstance)

	const m: Partial<RundownPlaylist> = {
		previousPartInstanceId: playlist.currentPartInstanceId,
		currentPartInstanceId: takePartInstance._id,
		holdState:
			!playlist.holdState || playlist.holdState === RundownHoldState.COMPLETE
				? RundownHoldState.NONE
				: playlist.holdState + 1,
	}

	cache.Playlist.update({
		$set: m,
	})

	cache.PartInstances.update(takePartInstance._id, {
		$set: {
			isTaken: true,
			'timings.take': now,
			'timings.playOffset': timeOffset || 0,
		},
	})

	if (m.previousPartInstanceId) {
		cache.PartInstances.update(m.previousPartInstanceId, {
			$set: {
				'timings.takeOut': now,
			},
		})
	}

	// Once everything is synced, we can choose the next part
	libsetNextPart(cache, nextPart?.part ?? null)

	const updatedPlaylist = cache.Playlist.doc

	// Setup the parts for the HOLD we are starting
	if (updatedPlaylist.previousPartInstanceId && m.holdState === RundownHoldState.ACTIVE) {
		startHold(cache, playlist.activationId, currentPartInstance, nextPartInstance)
	}
	afterTake(cache, takePartInstance, timeOffset)

	// Last:
	const takeDoneTime = getCurrentTime()
	cache.defer(() => {
		// todo: should this be changed back to Meteor.defer, at least for the blueprint stuff?
		if (takePartInstance) {
			cache.PartInstances.update(takePartInstance._id, {
				$set: {
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
							blueprint.onRundownFirstTake(
								new PartEventContext(
									'onRundownFirstTake',
									cache.Studio.doc,
									takeRundown,
									showStyle,
									takePartInstance
								)
							)
						).catch(logger.error)
					)
					if (span) span.end()
				}
			}

			if (blueprint.onPostTake) {
				const span = profiler.startSpan('blueprint.onPostTake')
				waitForPromise(
					Promise.resolve(
						blueprint.onPostTake(
							new PartEventContext(
								'onPostTake',
								cache.Studio.doc,
								takeRundown,
								showStyle,
								takePartInstance
							)
						)
					).catch(logger.error)
				)
				if (span) span.end()
			}
		}
	})

	if (span) span.end()
	return ClientAPI.responseSuccess(undefined)
}

export function updatePartInstanceOnTake(
	cache: CacheForPlayout,
	pShowStyle: Promise<ShowStyleCompound>,
	blueprint: ShowStyleBlueprintManifest,
	takeRundown: Rundown,
	takePartInstance: PartInstance,
	currentPartInstance: PartInstance | undefined
): void {
	// TODO - the state could change after this sampling point. This should be handled properly
	let previousPartEndState: PartEndState | undefined = undefined
	if (blueprint.getEndStateForPart && currentPartInstance) {
		const time = getCurrentTime()
		const showStyle = waitForPromise(pShowStyle)
		if (showStyle) {
			const resolvedPieces = getResolvedPieces(cache, showStyle, currentPartInstance)

			const span = profiler.startSpan('blueprint.getEndStateForPart')
			const context = new RundownContext(
				{
					name: `${cache.Playlist.doc.name}`,
					identifier: `playlist=${cache.Playlist.doc._id},currentPartInstance=${
						currentPartInstance._id
					},execution=${getRandomId()}`,
				},
				cache.Studio.doc,
				takeRundown,
				showStyle
			)
			previousPartEndState = blueprint.getEndStateForPart(
				context,
				cache.Playlist.doc.previousPersistentState,
				currentPartInstance.previousPartEndState,
				unprotectObjectArray(resolvedPieces),
				time
			)
			if (span) span.end()
			logger.info(`Calculated end state in ${getCurrentTime() - time}ms`)
		}
	}

	let partInstanceM: any = {
		$set: {
			isTaken: true,
			// set transition properties to what will be used to generate timeline later:
			allowedToUseTransition: currentPartInstance && !currentPartInstance.part.disableOutTransition,
		},
	}
	if (previousPartEndState) {
		partInstanceM.$set.previousPartEndState = previousPartEndState
	}

	cache.PartInstances.update(takePartInstance._id, partInstanceM)
}

export function afterTake(cache: CacheForPlayout, takePartInstance: PartInstance, timeOffset: number | null = null) {
	const span = profiler.startSpan('afterTake')
	// This function should be called at the end of a "take" event (when the Parts have been updated)

	let forceNowTime: number | undefined = undefined
	if (timeOffset) {
		forceNowTime = getCurrentTime() - timeOffset
	}
	// or after a new part has started playing
	updateTimeline(cache, forceNowTime)

	cache.deferAfterSave(() => {
		Meteor.setTimeout(() => {
			// This is low-prio, defer so that it's executed well after publications has been updated,
			// so that the playout gateway has haf the chance to learn about the timeline changes

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
		}, LOW_PRIO_DEFER_TIME)
	})

	triggerGarbageCollection()
	if (span) span.end()
}

/**
 * A Hold starts by extending the "extendOnHold"-able pieces in the previous Part.
 */
function startHold(
	cache: CacheForPlayout,
	activationId: RundownPlaylistActivationId,
	holdFromPartInstance: PartInstance | undefined,
	holdToPartInstance: PartInstance | undefined
) {
	if (!holdFromPartInstance) throw new Meteor.Error(404, 'previousPart not found!')
	if (!holdToPartInstance) throw new Meteor.Error(404, 'currentPart not found!')
	const span = profiler.startSpan('startHold')

	// Make a copy of any item which is flagged as an 'infinite' extension
	const itemsToCopy = getAllPieceInstancesFromCache(cache, holdFromPartInstance).filter((pi) => pi.piece.extendOnHold)
	itemsToCopy.forEach((instance) => {
		if (!instance.infinite) {
			const infiniteInstanceId: PieceInstanceInfiniteId = getRandomId()
			// mark current one as infinite
			cache.PieceInstances.update(instance._id, {
				$set: {
					infinite: {
						infiniteInstanceId: infiniteInstanceId,
						infinitePieceId: instance.piece._id,
						fromPreviousPart: false,
					},
				},
			})

			// make the extension
			const newInstance = literal<PieceInstance>({
				_id: protectString<PieceInstanceId>(instance._id + '_hold'),
				playlistActivationId: activationId,
				rundownId: instance.rundownId,
				partInstanceId: holdToPartInstance._id,
				dynamicallyInserted: getCurrentTime(),
				piece: {
					...clone(instance.piece),
					enable: { start: 0 },
					extendOnHold: false,
				},
				infinite: {
					infiniteInstanceId: infiniteInstanceId,
					infinitePieceId: instance.piece._id,
					fromPreviousPart: true,
					fromHold: true,
				},
				// Preserve the timings from the playing instance
				startedPlayback: instance.startedPlayback,
				stoppedPlayback: instance.stoppedPlayback,
			})
			const content = newInstance.piece.content as VTContent | undefined
			if (content && content.fileName && content.sourceDuration && instance.startedPlayback) {
				content.seek = Math.min(content.sourceDuration, getCurrentTime() - instance.startedPlayback)
			}

			// This gets deleted once the nextpart is activated, so it doesnt linger for long
			cache.PieceInstances.upsert(newInstance._id, newInstance)
		}
	})
	if (span) span.end()
}

function completeHold(
	cache: CacheForPlayout,
	showStyleBase: ShowStyleBase,
	currentPartInstance: PartInstance | undefined
) {
	cache.Playlist.update({
		$set: {
			holdState: RundownHoldState.COMPLETE,
		},
	})

	if (cache.Playlist.doc.currentPartInstanceId) {
		if (!currentPartInstance) throw new Meteor.Error(404, 'currentPart not found!')

		// Clear the current extension line
		ServerPlayoutAdLibAPI.innerStopPieces(
			cache,
			showStyleBase,
			currentPartInstance,
			(p) => !!p.infinite?.fromHold,
			undefined
		)
	}

	updateTimeline(cache)
}

export function triggerGarbageCollection() {
	Meteor.setTimeout(() => {
		// Trigger a manual garbage collection:
		if (global.gc) {
			// This is only avaialble of the flag --expose_gc
			// This can be done in prod by: node --expose_gc main.js
			// or when running Meteor in development, set set SERVER_NODE_OPTIONS=--expose_gc

			if (!isAnySyncFunctionsRunning()) {
				// by passing true, we're triggering the "full" collection
				// @ts-ignore (typings not avaiable)
				global.gc(true)
			}
		}
	}, 500)
}
