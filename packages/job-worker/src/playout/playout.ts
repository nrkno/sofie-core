import { PartId, PartInstanceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBRundownPlaylist, RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { isStringOrProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	ActivateHoldProps,
	ActivateRundownPlaylistProps,
	DeactivateHoldProps,
	DeactivateRundownPlaylistProps,
	MoveNextPartProps,
	PrepareRundownForBroadcastProps,
	ResetRundownPlaylistProps,
	SetNextPartProps,
	StopPiecesOnSourceLayersProps,
	ExecuteActionProps,
	ExecuteActionResult,
	TakeNextPartProps,
	DisableNextPieceProps,
	SetNextSegmentProps,
	OnTimelineTriggerTimeProps,
	UpdateTimelineAfterIngestProps,
	OnPlayoutPlaybackChangedProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { logger } from '../logging'
import _ = require('underscore')
import { JobContext } from '../jobs'
import { innerStopPieces } from './adlib'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache, getSelectedPartInstancesFromCache } from './cache'
import { runJobWithPlayoutCache, runJobWithPlaylistLock, runWithPlaylistCache } from './lock'
import { syncPlayheadInfinitesForNextPartInstance } from './infinites'
import {
	onPartHasStoppedPlaying,
	resetRundownPlaylist as libResetRundownPlaylist,
	selectNextPart,
	setNextPart as libSetNextPart,
	setNextSegment as libSetNextSegment,
	updateExpectedDurationWithPrerollForPartInstance,
} from './lib'
import { saveTimeline, updateStudioTimeline, updateTimeline } from './timeline/generate'
import { sortPartsInSortedSegments } from '@sofie-automation/corelib/dist/playout/playlist'
import { IBlueprintPieceType, PartHoldMode, Time } from '@sofie-automation/blueprints-integration'
import { getActiveRundownPlaylistsInStudioFromDb } from '../studio/lib'
import {
	activateRundownPlaylist as libActivateRundownPlaylist,
	deactivateRundownPlaylist as libDeactivateRundownPlaylist,
	deactivateRundownPlaylistInner,
	prepareStudioForBroadcast,
	standDownStudio,
} from './actions'
import { ReadonlyDeep } from 'type-fest'
import { WrappedShowStyleBlueprint } from '../blueprints/cache'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getCurrentTime, getSystemVersion } from '../lib'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { ExpectedPackageDBBase, ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import {
	applyToArray,
	assertNever,
	getRandomId,
	normalizeArrayToMap,
	stringifyError,
} from '@sofie-automation/corelib/dist/lib'
import { ActionExecutionContext, ActionPartChange } from '../blueprints/context/adlibActions'
import {
	afterTake,
	clearNextSegmentId,
	resetPreviousSegment,
	takeNextPartInnerSync,
	updatePartInstanceOnTake,
} from './take'
import {
	reportPartInstanceHasStarted,
	reportPartInstanceHasStopped,
	reportPieceHasStarted,
	reportPieceHasStopped,
} from '../blueprints/events'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { sortPieceInstancesByStart } from './pieces'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { runJobWithStudioCache } from '../studio/lock'
import { shouldUpdateStudioBaselineInner as libShouldUpdateStudioBaselineInner } from '@sofie-automation/corelib/dist/studio/baseline'
import { CacheForStudio } from '../studio/cache'
import { DbCacheWriteCollection } from '../cache/CacheCollection'
import { PieceTimelineMetadata } from '@sofie-automation/corelib/dist/playout/pieces'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { deserializeTimelineBlob } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { INCORRECT_PLAYING_PART_DEBOUNCE, RESET_IGNORE_ERRORS } from './constants'
import { PlayoutChangedType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'

let MINIMUM_TAKE_SPAN = 1000
export function setMinimumTakeSpan(span: number): void {
	// Used in tests
	MINIMUM_TAKE_SPAN = span
}

async function checkNoOtherPlaylistsActive(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>
): Promise<void> {
	const anyOtherActiveRundownPlaylists = await getActiveRundownPlaylistsInStudioFromDb(
		context,
		playlist.studioId,
		playlist._id
	)
	if (anyOtherActiveRundownPlaylists.length) {
		// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
		throw UserError.create(UserErrorMessage.RundownAlreadyActiveNames, {
			names: anyOtherActiveRundownPlaylists.map((pl) => pl.name).join(', '),
		})
	}
}

/**
 * Prepare the rundown for transmission
 * To be triggered well before the broadcast, since it may take time and cause outputs to flicker
 */
export async function prepareRundownPlaylistForBroadcast(
	context: JobContext,
	data: PrepareRundownForBroadcastProps
): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'prepareRundownPlaylistForBroadcast',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (playlist.activationId) throw UserError.create(UserErrorMessage.RundownAlreadyActive)

			await checkNoOtherPlaylistsActive(context, playlist)
		},
		async (cache) => {
			await libResetRundownPlaylist(context, cache)
			await prepareStudioForBroadcast(context, cache, true)

			await libActivateRundownPlaylist(context, cache, true) // Activate rundownPlaylist (rehearsal)
		}
	)
}
/**
 * Reset the rundown.
 * The User might have run through the rundown and wants to start over and try again.
 * Optionally activate the rundown at the end.
 */
export async function resetRundownPlaylist(context: JobContext, data: ResetRundownPlaylistProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'resetRundownPlaylist',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (playlist.activationId && !playlist.rehearsal && !context.studio.settings.allowRundownResetOnAir) {
				throw UserError.create(UserErrorMessage.RundownResetWhileActive)
			}

			if (data.activate) {
				if (data.forceActivate) {
					const anyOtherActivePlaylists = await getActiveRundownPlaylistsInStudioFromDb(
						context,
						playlist.studioId,
						playlist._id
					)
					if (anyOtherActivePlaylists.length > 0) {
						const errors: any[] = []
						// Try deactivating everything in parallel, although there should only ever be one active
						await Promise.allSettled(
							anyOtherActivePlaylists.map(async (otherRundownPlaylist) =>
								runJobWithPlayoutCache(
									context,
									// 'forceResetAndActivateRundownPlaylist',
									{ playlistId: otherRundownPlaylist._id },
									null,
									async (otherCache) => {
										await deactivateRundownPlaylistInner(context, otherCache)
									}
								).catch((e) => errors.push(e))
							)
						)
						if (errors.length > 0) {
							// Ok, something went wrong, but check if the active rundowns where deactivated?
							await checkNoOtherPlaylistsActive(context, playlist)
						}
					}
				} else {
					// Check if any other playlists are active, as we will be activating this one
					await checkNoOtherPlaylistsActive(context, playlist)
				}
			}
		},
		async (cache) => {
			await libResetRundownPlaylist(context, cache)

			if (data.activate) {
				// Do the activation
				await prepareStudioForBroadcast(context, cache, true)
				await libActivateRundownPlaylist(context, cache, data.activate !== 'active') // Activate rundown
			} else if (cache.Playlist.doc.activationId) {
				// Only update the timeline if this is the active playlist
				await updateTimeline(context, cache)
			}
		}
	)
}

/**
 * Only activate the rundown, don't reset anything
 */
export async function activateRundownPlaylist(context: JobContext, data: ActivateRundownPlaylistProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'activateRundownPlaylist',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			await checkNoOtherPlaylistsActive(context, playlist)
		},
		async (cache) => {
			// This will be false if already activated (like when going from rehearsal to broadcast)
			const okToDestroyStuff = !cache.Playlist.doc.activationId
			await prepareStudioForBroadcast(context, cache, okToDestroyStuff)

			await libActivateRundownPlaylist(context, cache, data.rehearsal)
		}
	)
}
/**
 * Deactivate the rundown
 */
export async function deactivateRundownPlaylist(
	context: JobContext,
	data: DeactivateRundownPlaylistProps
): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'deactivateRundownPlaylist',
		data,
		null,
		async (cache) => {
			await standDownStudio(context, cache, true)

			await libDeactivateRundownPlaylist(context, cache)
		}
	)
}
/**
 * Take the currently Next:ed Part (start playing it)
 */
export async function takeNextPart(context: JobContext, data: TakeNextPartProps): Promise<void> {
	const now = getCurrentTime()

	return runJobWithPlayoutCache(
		context,
		// 'takeNextPartInner',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (!playlist.nextPartInstanceId && playlist.holdState !== RundownHoldState.ACTIVE)
				throw UserError.create(UserErrorMessage.TakeNoNextPart)

			if (playlist.currentPartInstanceId !== data.fromPartInstanceId)
				throw UserError.create(UserErrorMessage.TakeFromIncorrectPart)
		},
		async (cache) => {
			const playlist = cache.Playlist.doc

			if (playlist.currentPartInstanceId) {
				const currentPartInstance = cache.PartInstances.findOne(playlist.currentPartInstanceId)
				if (currentPartInstance && currentPartInstance.timings) {
					const lastStartedPlayback = currentPartInstance.timings.startedPlayback || 0
					const lastTake = currentPartInstance.timings.take || 0
					const lastChange = Math.max(lastTake, lastStartedPlayback)
					if (now - lastChange < MINIMUM_TAKE_SPAN) {
						logger.debug(
							`Time since last take is shorter than ${MINIMUM_TAKE_SPAN} for ${
								currentPartInstance._id
							}: ${getCurrentTime() - lastStartedPlayback}`
						)
						logger.debug(
							`lastStartedPlayback: ${lastStartedPlayback}, getCurrentTime(): ${getCurrentTime()}`
						)
						throw UserError.create(UserErrorMessage.TakeRateLimit, { duration: MINIMUM_TAKE_SPAN })
					}
				} else {
					// Don't throw an error here. It's bad, but it's more important to be able to continue with the take.
					logger.error(
						`PartInstance "${playlist.currentPartInstanceId}", set as currentPart in "${playlist._id}", not found!`
					)
				}
			}

			return takeNextPartInnerSync(context, cache, now)
		}
	)
}

export async function setNextPart(context: JobContext, data: SetNextPartProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'setNextPart',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}
		},
		async (cache) => {
			let nextPart: DBPart | undefined
			if (data.nextPartId) {
				// Ensure the part is playable and found
				nextPart = cache.Parts.findOne(data.nextPartId)
				if (!nextPart) throw UserError.create(UserErrorMessage.PartNotFound)
				if (!isPartPlayable(nextPart)) throw UserError.create(UserErrorMessage.PartNotPlayable)
			}

			await setNextPartInner(
				context,
				cache,
				nextPart ?? null,
				data.setManually,
				data.nextTimeOffset,
				data.clearNextSegment
			)
		}
	)
}

export async function setNextPartInner(
	context: JobContext,
	cache: CacheForPlayout,
	nextPartId: PartId | DBPart | null,
	setManually?: boolean,
	nextTimeOffset?: number | undefined,
	clearNextSegment?: boolean
): Promise<void> {
	const playlist = cache.Playlist.doc
	if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		throw UserError.create(UserErrorMessage.DuringHold)
	}

	let nextPart: DBPart | null = null
	if (nextPartId) {
		if (isStringOrProtectedString(nextPartId)) {
			nextPart = cache.Parts.findOne(nextPartId) || null
		} else if (_.isObject(nextPartId)) {
			nextPart = nextPartId
		}
		if (!nextPart) throw UserError.create(UserErrorMessage.PartNotFound)
	}

	// If we're setting the next point to somewhere other than the current segment, and in the queued segment, clear the queued segment
	const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
	if (
		currentPartInstance &&
		nextPart &&
		currentPartInstance.segmentId !== nextPart.segmentId &&
		playlist.nextSegmentId === nextPart.segmentId
	) {
		clearNextSegment = true
	}

	if (clearNextSegment) {
		libSetNextSegment(context, cache, null)
	}

	await libSetNextPart(context, cache, nextPart ? { part: nextPart } : null, setManually, nextTimeOffset)

	// update lookahead and the next part when we have an auto-next
	await updateTimeline(context, cache)
}
export async function moveNextPart(context: JobContext, data: MoveNextPartProps): Promise<PartId | null> {
	return runJobWithPlayoutCache(
		context,
		// 'moveNextPart',
		data,
		async (cache) => {
			if (!data.partDelta && !data.segmentDelta)
				throw new Error(`rundownMoveNext: invalid delta: (${data.partDelta}, ${data.segmentDelta})`)

			const playlist = cache.Playlist.doc

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}

			if (!playlist.nextPartInstanceId && !playlist.currentPartInstanceId) {
				throw UserError.create(UserErrorMessage.NoCurrentOrNextPart)
			}
		},
		async (cache) => {
			return moveNextPartInner(context, cache, data.partDelta, data.segmentDelta)
		}
	)
}
export async function moveNextPartInner(
	context: JobContext,
	cache: CacheForPlayout,
	partDelta: number,
	segmentDelta: number
): Promise<PartId | null> {
	const playlist = cache.Playlist.doc

	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)

	const refPartInstance = nextPartInstance ?? currentPartInstance
	const refPart = refPartInstance?.part
	if (!refPart || !refPartInstance)
		throw new Error(`RundownPlaylist "${playlist._id}" has no next and no current part!`)

	const { segments: rawSegments, parts: rawParts } = getOrderedSegmentsAndPartsFromPlayoutCache(cache)

	if (segmentDelta) {
		// Ignores horizontalDelta

		const considerSegments = rawSegments.filter((s) => s._id === refPart.segmentId || !s.isHidden)
		const refSegmentIndex = considerSegments.findIndex((s) => s._id === refPart.segmentId)
		if (refSegmentIndex === -1) throw new Error(`Segment "${refPart.segmentId}" not found!`)

		const targetSegmentIndex = refSegmentIndex + segmentDelta
		const targetSegment = considerSegments[targetSegmentIndex]
		if (!targetSegment) throw new Error(`No Segment found!`)

		// find the allowable segment ids
		const allowedSegments =
			segmentDelta > 0
				? considerSegments.slice(targetSegmentIndex)
				: considerSegments.slice(0, targetSegmentIndex + 1).reverse()
		// const allowedSegmentIds = new Set(allowedSegments.map((s) => s._id))

		const playablePartsBySegment = _.groupBy(
			rawParts.filter((p) => isPartPlayable(p)),
			(p) => unprotectString(p.segmentId)
		)

		// Iterate through segments and find the first part
		let selectedPart: DBPart | undefined
		for (const segment of allowedSegments) {
			const parts = playablePartsBySegment[unprotectString(segment._id)] || []
			// Cant go to the current part (yet)
			const filteredParts = parts.filter((p) => p._id !== currentPartInstance?.part._id)
			if (filteredParts.length > 0) {
				selectedPart = filteredParts[0]
				break
			}
		}

		// TODO - looping playlists

		if (selectedPart) {
			// Switch to that part
			await setNextPartInner(context, cache, selectedPart, true)
			return selectedPart._id
		} else {
			// Nothing looked valid so do nothing
			// Note: we should try and a smaller delta if it is not -1/1
			logger.info(`moveNextPart: Found no new part (verticalDelta=${segmentDelta})`)
			return null
		}
	} else if (partDelta) {
		let playabaleParts: DBPart[] = rawParts.filter((p) => refPart._id === p._id || isPartPlayable(p))
		let refPartIndex = playabaleParts.findIndex((p) => p._id === refPart._id)
		if (refPartIndex === -1) {
			const tmpRefPart = { ...refPart, invalid: true } // make sure it won't be found as playable
			playabaleParts = sortPartsInSortedSegments([...playabaleParts, tmpRefPart], rawSegments)
			refPartIndex = playabaleParts.findIndex((p) => p._id === refPart._id)
			if (refPartIndex === -1) throw new Error(`Part "${refPart._id}" not found after insert!`)
		}

		// Get the past we are after
		const targetPartIndex = refPartIndex + partDelta
		let targetPart = playabaleParts[targetPartIndex]
		if (targetPart && targetPart._id === currentPartInstance?.part._id) {
			// Cant go to the current part (yet)
			const newIndex = targetPartIndex + (partDelta > 0 ? 1 : -1)
			targetPart = playabaleParts[newIndex]
		}

		if (targetPart) {
			// Switch to that part
			await setNextPartInner(context, cache, targetPart, true)
			return targetPart._id
		} else {
			// Nothing looked valid so do nothing
			// Note: we should try and a smaller delta if it is not -1/1
			logger.info(`moveNextPart: Found no new part (horizontalDelta=${partDelta})`)
			return null
		}
	} else {
		throw new Error(`Missing delta to move by!`)
	}
}
export async function setNextSegment(context: JobContext, data: SetNextSegmentProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'setNextSegment',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}
		},
		async (cache) => {
			let nextSegment: DBSegment | null = null
			if (data.nextSegmentId) {
				nextSegment = cache.Segments.findOne(data.nextSegmentId) || null
				if (!nextSegment) throw new Error(`Segment "${data.nextSegmentId}" not found!`)
			}

			libSetNextSegment(context, cache, null)

			// Update any future lookaheads
			await updateTimeline(context, cache)
		}
	)
}
export async function activateHold(context: JobContext, data: ActivateHoldProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'activateHold',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (!playlist.currentPartInstanceId) throw UserError.create(UserErrorMessage.NoCurrentPart)
			if (!playlist.nextPartInstanceId) throw UserError.create(UserErrorMessage.HoldNeedsNextPart)

			if (playlist.holdState) throw UserError.create(UserErrorMessage.HoldAlreadyActive)
		},
		async (cache) => {
			const playlist = cache.Playlist.doc
			const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
			if (!currentPartInstance) throw new Error(`PartInstance "${playlist.currentPartInstanceId}" not found!`)
			if (!nextPartInstance) throw new Error(`PartInstance "${playlist.nextPartInstanceId}" not found!`)

			if (
				currentPartInstance.part.holdMode !== PartHoldMode.FROM ||
				nextPartInstance.part.holdMode !== PartHoldMode.TO ||
				currentPartInstance.part.segmentId !== nextPartInstance.part.segmentId
			) {
				throw UserError.create(UserErrorMessage.HoldIncompatibleParts)
			}

			const hasDynamicallyInserted = cache.PieceInstances.findOne(
				(p) =>
					p.partInstanceId === currentPartInstance._id &&
					!!p.dynamicallyInserted &&
					// If its a continuation of an infinite adlib it is probably a graphic, so is 'fine'
					!p.infinite?.fromPreviousPart &&
					!p.infinite?.fromPreviousPlayhead
			)
			if (hasDynamicallyInserted) throw UserError.create(UserErrorMessage.HoldAfterAdlib)

			cache.Playlist.update({ $set: { holdState: RundownHoldState.PENDING } })

			await updateTimeline(context, cache)
		}
	)
}
export async function deactivateHold(context: JobContext, data: DeactivateHoldProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'deactivateHold',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (playlist.holdState !== RundownHoldState.PENDING)
				throw UserError.create(UserErrorMessage.HoldNotCancelable)
		},
		async (cache) => {
			cache.Playlist.update({ $set: { holdState: RundownHoldState.NONE } })

			await updateTimeline(context, cache)
		}
	)
}
export async function disableNextPiece(context: JobContext, data: DisableNextPieceProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'disableNextPiece',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (!playlist.currentPartInstanceId) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (cache) => {
			const playlist = cache.Playlist.doc

			const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
			if (!currentPartInstance) throw new Error(`PartInstance "${playlist.currentPartInstanceId}" not found!`)

			const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${currentPartInstance.rundownId}" not found!`)
			const showStyleBase = await context.getShowStyleBase(rundown.showStyleBaseId)

			// logger.info(o)
			// logger.info(JSON.stringify(o, '', 2))

			const allowedSourceLayers = normalizeArrayToMap(showStyleBase.sourceLayers, '_id')

			// logger.info('nowInPart', nowInPart)
			// logger.info('filteredPieces', filteredPieces)
			const getNextPiece = (partInstance: DBPartInstance, ignoreStartedPlayback: boolean) => {
				// Find next piece to disable

				let nowInPart = 0
				if (!ignoreStartedPlayback && partInstance.timings?.startedPlayback) {
					nowInPart = getCurrentTime() - partInstance.timings?.startedPlayback
				}

				const pieceInstances = cache.PieceInstances.findFetch((p) => p.partInstanceId === partInstance._id)

				const filteredPieces = pieceInstances.filter((piece: PieceInstance) => {
					const sourceLayer = allowedSourceLayers.get(piece.piece.sourceLayerId)
					if (
						sourceLayer &&
						sourceLayer.allowDisable &&
						!piece.piece.virtual &&
						piece.piece.pieceType === IBlueprintPieceType.Normal
					)
						return true
					return false
				})

				const sortedPieces: PieceInstance[] = sortPieceInstancesByStart(
					_.sortBy(filteredPieces, (piece: PieceInstance) => {
						const sourceLayer = allowedSourceLayers.get(piece.piece.sourceLayerId)
						return sourceLayer?._rank || -9999
					}),
					nowInPart
				)

				const findLast = !!data.undo

				if (findLast) sortedPieces.reverse()

				return sortedPieces.find((piece) => {
					return (
						piece.piece.enable.start >= nowInPart &&
						((!data.undo && !piece.disabled) || (data.undo && piece.disabled))
					)
				})
			}

			if (nextPartInstance?.timings) {
				// pretend that the next part never has played (even if it has)
				delete nextPartInstance.timings.startedPlayback
			}

			const partInstances: Array<[DBPartInstance | undefined, boolean]> = [
				[currentPartInstance, false],
				[nextPartInstance, true], // If not found in currently playing part, let's look in the next one:
			]
			if (data.undo) partInstances.reverse()

			let nextPieceInstance: PieceInstance | undefined

			for (const [partInstance, ignoreStartedPlayback] of partInstances) {
				if (partInstance) {
					nextPieceInstance = getNextPiece(partInstance, ignoreStartedPlayback)
					if (nextPieceInstance) break
				}
			}

			if (nextPieceInstance) {
				logger.debug((data.undo ? 'Disabling' : 'Enabling') + ' next PieceInstance ' + nextPieceInstance._id)
				cache.PieceInstances.update(nextPieceInstance._id, {
					$set: {
						disabled: !data.undo,
					},
				})

				await updateTimeline(context, cache)
			} else {
				cache.assertNoChanges()

				throw UserError.create(UserErrorMessage.DisableNoPieceFound)
			}
		}
	)
}

function _onPiecePlaybackStarted(
	context: JobContext,
	cache: CacheForPlayout,
	data: {
		pieceInstanceId: PieceInstanceId
		startedPlayback: Time
	}
) {
	const playlist = cache.Playlist.doc
	const pieceInstance = cache.PieceInstances.findOne(data.pieceInstanceId)

	if (pieceInstance) {
		const isPlaying = !!(pieceInstance.startedPlayback && !pieceInstance.stoppedPlayback)
		if (!isPlaying) {
			logger.debug(
				`onPiecePlaybackStarted: Playout reports pieceInstance "${
					data.pieceInstanceId
				}" has started playback on timestamp ${new Date(data.startedPlayback).toISOString()}`
			)
			reportPieceHasStarted(context, cache, pieceInstance, data.startedPlayback)

			// We don't need to bother with an updateTimeline(), as this hasn't changed anything, but lets us accurately add started items when reevaluating
		}
	} else if (!playlist.activationId) {
		logger.warn(`onPiecePlaybackStarted: Received for inactive RundownPlaylist "${playlist._id}"`)
	} else {
		throw new Error(`PieceInstance "${data.pieceInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
	}
}

function _onPiecePlaybackStopped(
	context: JobContext,
	cache: CacheForPlayout,
	data: {
		partInstanceId: PartInstanceId
		pieceInstanceId: PieceInstanceId
		stoppedPlayback: Time
	}
) {
	const playlist = cache.Playlist.doc
	const pieceInstance = cache.PieceInstances.findOne(data.pieceInstanceId)

	if (pieceInstance) {
		const isPlaying = !!(pieceInstance.startedPlayback && !pieceInstance.stoppedPlayback)
		if (isPlaying) {
			logger.debug(
				`onPiecePlaybackStopped: Playout reports pieceInstance "${
					data.pieceInstanceId
				}" has stopped playback on timestamp ${new Date(data.stoppedPlayback).toISOString()}`
			)

			reportPieceHasStopped(context, cache, pieceInstance, data.stoppedPlayback)
		}
	} else if (!playlist.activationId) {
		logger.warn(`onPiecePlaybackStopped: Received for inactive RundownPlaylist "${playlist._id}"`)
	} else {
		const partInstance = cache.PartInstances.findOne(data.partInstanceId)
		if (!partInstance) {
			// PartInstance not found, so we can rely on the onPartPlaybackStopped callback erroring
		} else {
			throw new Error(`PieceInstance "${data.pieceInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
		}
	}
}

async function _onPartPlaybackStarted(
	context: JobContext,
	cache: CacheForPlayout,
	data: {
		partInstanceId: PartInstanceId
		startedPlayback: Time
	}
) {
	const playingPartInstance = cache.PartInstances.findOne(data.partInstanceId)
	if (!playingPartInstance)
		throw new Error(`PartInstance "${data.partInstanceId}" in RundownPlayst "${cache.PlaylistId}" not found!`)

	// make sure we don't run multiple times, even if TSR calls us multiple times
	const hasStartedPlaying = !!playingPartInstance.timings?.startedPlayback
	if (!hasStartedPlaying) {
		logger.debug(
			`Playout reports PartInstance "${data.partInstanceId}" has started playback on timestamp ${new Date(
				data.startedPlayback
			).toISOString()}`
		)

		const playlist = cache.Playlist.doc

		const rundown = cache.Rundowns.findOne(playingPartInstance.rundownId)
		if (!rundown) throw new Error(`Rundown "${playingPartInstance.rundownId}" not found!`)

		const { currentPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(cache)

		if (playlist.currentPartInstanceId === data.partInstanceId) {
			// this is the current part, it has just started playback
			if (playlist.previousPartInstanceId) {
				if (!previousPartInstance) {
					// We couldn't find the previous part: this is not a critical issue, but is clearly is a symptom of a larger issue
					logger.error(
						`Previous PartInstance "${playlist.previousPartInstanceId}" on RundownPlaylist "${playlist._id}" could not be found.`
					)
				} else if (!previousPartInstance.timings?.duration) {
					onPartHasStoppedPlaying(cache, previousPartInstance, data.startedPlayback)
				}
			}

			reportPartInstanceHasStarted(context, cache, playingPartInstance, data.startedPlayback)
		} else if (playlist.nextPartInstanceId === data.partInstanceId) {
			// this is the next part, clearly an autoNext has taken place
			if (playlist.currentPartInstanceId) {
				if (!currentPartInstance) {
					// We couldn't find the previous part: this is not a critical issue, but is clearly is a symptom of a larger issue
					logger.error(
						`Previous PartInstance "${playlist.currentPartInstanceId}" on RundownPlaylist "${playlist._id}" could not be found.`
					)
				} else if (!currentPartInstance.timings?.duration) {
					onPartHasStoppedPlaying(cache, currentPartInstance, data.startedPlayback)
				}
			}

			cache.Playlist.update({
				$set: {
					previousPartInstanceId: playlist.currentPartInstanceId,
					currentPartInstanceId: playingPartInstance._id,
					holdState: RundownHoldState.NONE,
				},
			})

			reportPartInstanceHasStarted(context, cache, playingPartInstance, data.startedPlayback)

			// Update generated properties on the newly playing partInstance
			const currentRundown = currentPartInstance
				? cache.Rundowns.findOne(currentPartInstance.rundownId)
				: undefined
			const showStyleRundown = currentRundown ?? rundown
			const showStyle = await context.getShowStyleCompound(
				showStyleRundown.showStyleVariantId,
				showStyleRundown.showStyleBaseId
			)
			const blueprint = await context.getShowStyleBlueprint(showStyle._id)
			updatePartInstanceOnTake(
				context,
				cache,
				showStyle,
				blueprint,
				rundown,
				playingPartInstance,
				currentPartInstance
			)

			clearNextSegmentId(cache, currentPartInstance)
			resetPreviousSegment(cache)

			// Update the next partinstance
			const nextPart = selectNextPart(
				context,
				playlist,
				playingPartInstance,
				null,
				getOrderedSegmentsAndPartsFromPlayoutCache(cache)
			)
			await libSetNextPart(context, cache, nextPart)
		} else {
			// a part is being played that has not been selected for playback by Core
			// show must go on, so find next part and update the Rundown, but log an error
			const previousReported = playlist.lastIncorrectPartPlaybackReported

			if (previousReported && Date.now() - previousReported > INCORRECT_PLAYING_PART_DEBOUNCE) {
				// first time this has happened for a while, let's try to progress the show:

				cache.Playlist.update({
					$set: {
						previousPartInstanceId: null,
						currentPartInstanceId: playingPartInstance._id,
						lastIncorrectPartPlaybackReported: Date.now(), // save the time to prevent the system to go in a loop
					},
				})

				reportPartInstanceHasStarted(context, cache, playingPartInstance, data.startedPlayback)

				const nextPart = selectNextPart(
					context,
					playlist,
					playingPartInstance,
					null,
					getOrderedSegmentsAndPartsFromPlayoutCache(cache)
				)
				await libSetNextPart(context, cache, nextPart)
			}

			logger.error(
				`PartInstance "${playingPartInstance._id}" has started playback by the playout gateway, but has not been selected for playback!`
			)
		}

		// complete the take
		await afterTake(context, cache, playingPartInstance)
	}
}

function _onPartPlaybackStopped(
	context: JobContext,
	cache: CacheForPlayout,
	data: {
		partInstanceId: PartInstanceId
		stoppedPlayback: Time
	}
) {
	const playlist = cache.Playlist.doc

	const partInstance = cache.PartInstances.findOne(data.partInstanceId)
	if (partInstance) {
		// make sure we don't run multiple times, even if TSR calls us multiple times

		const isPlaying = partInstance.timings?.startedPlayback && !partInstance.timings?.stoppedPlayback
		if (isPlaying) {
			logger.debug(
				`onPartPlaybackStopped: Playout reports PartInstance "${
					data.partInstanceId
				}" has stopped playback on timestamp ${new Date(data.stoppedPlayback).toISOString()}`
			)

			reportPartInstanceHasStopped(context, cache, partInstance, data.stoppedPlayback)
		}
	} else if (!playlist.activationId) {
		logger.warn(`onPartPlaybackStopped: Received for inactive RundownPlaylist "${playlist._id}"`)
	} else if (getCurrentTime() - (playlist.resetTime ?? 0) > RESET_IGNORE_ERRORS) {
		// Ignore errors that happen just after a reset, so do nothing here.
	} else {
		throw new Error(`PartInstance "${data.partInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
	}
}

export async function onPlayoutPlaybackChanged(
	context: JobContext,
	data: OnPlayoutPlaybackChangedProps
): Promise<void> {
	return runJobWithPlayoutCache(context, data, null, async (cache) => {
		for (const change of data.changes) {
			try {
				if (change.type === PlayoutChangedType.PART_PLAYBACK_STARTED) {
					await _onPartPlaybackStarted(context, cache, {
						partInstanceId: change.data.partInstanceId,
						startedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PART_PLAYBACK_STOPPED) {
					_onPartPlaybackStopped(context, cache, {
						partInstanceId: change.data.partInstanceId,
						stoppedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PIECE_PLAYBACK_STARTED) {
					_onPiecePlaybackStarted(context, cache, {
						pieceInstanceId: change.data.pieceInstanceId,
						startedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PIECE_PLAYBACK_STOPPED) {
					_onPiecePlaybackStopped(context, cache, {
						partInstanceId: change.data.partInstanceId,
						pieceInstanceId: change.data.pieceInstanceId,
						stoppedPlayback: change.data.time,
					})
				} else {
					assertNever(change)
				}
			} catch (err) {
				logger.error(stringifyError(err))
			}
		}
	})
}

/**
 * Called from Playout-gateway when the trigger-time of a timeline object has updated
 * ( typically when using the "now"-feature )
 */
export async function handleTimelineTriggerTime(context: JobContext, data: OnTimelineTriggerTimeProps): Promise<void> {
	if (data.results.length > 0) {
		await runJobWithStudioCache(context, async (studioCache) => {
			const activePlaylists = studioCache.getActiveRundownPlaylists()

			if (activePlaylists.length === 1) {
				const activePlaylist = activePlaylists[0]
				const playlistId = activePlaylist._id
				await runJobWithPlaylistLock(context, { playlistId }, async () => {
					const rundownIDs = (
						await context.directCollections.Rundowns.findFetch({ playlistId }, { projection: { _id: 1 } })
					).map((r) => r._id)
					const partInstanceIDs = [activePlaylist.currentPartInstanceId].filter(
						(id): id is PartInstanceId => id !== null
					)

					// We only need the PieceInstances, so load just them
					const pieceInstanceCache = await DbCacheWriteCollection.createFromDatabase(
						context,
						context.directCollections.PieceInstances,
						{
							rundownId: { $in: rundownIDs },
							partInstanceId: {
								$in: partInstanceIDs,
							},
						}
					)

					// Take ownership of the playlist in the db, so that we can mutate the timeline and piece instances
					timelineTriggerTimeInner(context, studioCache, data.results, pieceInstanceCache, activePlaylist)

					await pieceInstanceCache.updateDatabaseWithData()
				})
			} else {
				timelineTriggerTimeInner(context, studioCache, data.results, undefined, undefined)
			}
		})
	}
}

function timelineTriggerTimeInner(
	context: JobContext,
	cache: CacheForStudio,
	results: OnTimelineTriggerTimeProps['results'],
	pieceInstanceCache: DbCacheWriteCollection<PieceInstance> | undefined,
	activePlaylist: DBRundownPlaylist | undefined
) {
	let lastTakeTime: number | undefined

	// ------------------------------
	const timeline = cache.Timeline.doc
	if (timeline) {
		const timelineObjs = deserializeTimelineBlob(timeline.timelineBlob)
		let tlChanged = false

		_.each(results, (o) => {
			logger.debug(`Timeline: Setting time: "${o.id}": ${o.time}`)

			const obj = timelineObjs.find((tlo) => tlo.id === o.id)
			if (obj) {
				applyToArray(obj.enable, (enable) => {
					if (enable.start === 'now') {
						enable.start = o.time
						enable.setFromNow = true

						tlChanged = true
					}
				})

				// TODO - we should do the same for the partInstance.
				// Or should we not update the now for them at all? as we should be getting the onPartPlaybackStarted immediately after

				const objPieceInstanceId = (obj.metaData as Partial<PieceTimelineMetadata> | undefined)
					?.triggerPieceInstanceId
				if (objPieceInstanceId && activePlaylist && pieceInstanceCache) {
					logger.debug('Update PieceInstance: ', {
						pieceId: objPieceInstanceId,
						time: new Date(o.time).toTimeString(),
					})

					const pieceInstance = pieceInstanceCache.findOne(objPieceInstanceId)
					if (
						pieceInstance &&
						pieceInstance.dynamicallyInserted &&
						pieceInstance.piece.enable.start === 'now'
					) {
						pieceInstanceCache.update(pieceInstance._id, {
							$set: {
								'piece.enable.start': o.time,
							},
						})

						const takeTime = pieceInstance.dynamicallyInserted
						lastTakeTime = lastTakeTime === undefined ? takeTime : Math.max(lastTakeTime, takeTime)
					}
				}
			}
		})

		if (lastTakeTime !== undefined && activePlaylist?.currentPartInstanceId && pieceInstanceCache) {
			// We updated some pieceInstance from now, so lets ensure any earlier adlibs do not still have a now
			const remainingNowPieces = pieceInstanceCache.findFetch({
				partInstanceId: activePlaylist.currentPartInstanceId,
				dynamicallyInserted: { $exists: true },
				disabled: { $ne: true },
			})
			for (const piece of remainingNowPieces) {
				const pieceTakeTime = piece.dynamicallyInserted
				if (pieceTakeTime && pieceTakeTime <= lastTakeTime && piece.piece.enable.start === 'now') {
					// Disable and hide the instance
					pieceInstanceCache.update(piece._id, {
						$set: {
							disabled: true,
							hidden: true,
						},
					})
				}
			}
		}
		if (tlChanged) {
			saveTimeline(context, cache, timelineObjs, timeline.generationVersions)
		}
	}
}

export async function executeAction(context: JobContext, data: ExecuteActionProps): Promise<ExecuteActionResult> {
	return runJobWithPlayoutCache(
		context,
		// 'executeActionInner',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (!playlist.currentPartInstanceId) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (cache) => {
			return executeActionInner(
				context,
				cache,
				{
					pieceId: data.actionDocId,
					fromPieceType: {
						$in: [ExpectedPackageDBType.ADLIB_ACTION, ExpectedPackageDBType.BASELINE_ADLIB_ACTION],
					},
				},
				async (actionContext, _rundown, _currentPartInstance, blueprint) => {
					if (!blueprint.blueprint.executeAction) throw UserError.create(UserErrorMessage.ActionsNotSupported)

					logger.info(`Executing AdlibAction "${data.actionId}": ${JSON.stringify(data.userData)}`)

					try {
						await blueprint.blueprint.executeAction(
							actionContext,
							data.actionId,
							data.userData,
							data.triggerMode
						)
					} catch (err) {
						logger.error(`Error in showStyleBlueprint.executeAction: ${stringifyError(err)}`)
						throw err
					}
				}
			)
		}
	)
}

export async function executeActionInner(
	context: JobContext,
	cache: CacheForPlayout,
	watchedPackagesFilter: MongoQuery<Omit<ExpectedPackageDBBase, 'studioId'>> | null,
	func: (
		context: ActionExecutionContext,
		rundown: DBRundown,
		currentPartInstance: DBPartInstance,
		blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>
	) => Promise<void>
): Promise<ExecuteActionResult> {
	const now = getCurrentTime()

	const playlist = cache.Playlist.doc

	const currentPartInstance = playlist.currentPartInstanceId
		? cache.PartInstances.findOne(playlist.currentPartInstanceId)
		: undefined
	if (!currentPartInstance)
		throw new Error(`Current PartInstance "${playlist.currentPartInstanceId}" could not be found.`)

	const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
	if (!rundown) throw new Error(`Current Rundown "${currentPartInstance.rundownId}" could not be found`)

	const [showStyle, watchedPackages] = await Promise.all([
		context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId),
		watchedPackagesFilter
			? WatchedPackagesHelper.create(context, context.studio._id, watchedPackagesFilter)
			: WatchedPackagesHelper.empty(context),
	])

	const blueprint = await context.getShowStyleBlueprint(showStyle._id)
	const actionContext = new ActionExecutionContext(
		{
			name: `${rundown.name}(${playlist.name})`,
			identifier: `playlist=${playlist._id},rundown=${rundown._id},currentPartInstance=${
				currentPartInstance._id
			},execution=${getRandomId()}`,
			tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT store these notes
		},
		context,
		cache,
		showStyle,
		context.getShowStyleBlueprintConfig(showStyle),
		rundown,
		watchedPackages
	)

	// If any action cannot be done due to timings, that needs to be rejected by the context
	await func(actionContext, rundown, currentPartInstance, blueprint)

	if (
		actionContext.currentPartState !== ActionPartChange.NONE ||
		actionContext.nextPartState !== ActionPartChange.NONE
	) {
		await syncPlayheadInfinitesForNextPartInstance(context, cache)
	}

	if (actionContext.nextPartState !== ActionPartChange.NONE) {
		const nextPartInstanceId = cache.Playlist.doc.nextPartInstanceId
		if (nextPartInstanceId) {
			updateExpectedDurationWithPrerollForPartInstance(cache, nextPartInstanceId)
		}
	}

	if (actionContext.takeAfterExecute) {
		await callTakeWithCache(context, cache, now)
	} else {
		if (
			actionContext.currentPartState !== ActionPartChange.NONE ||
			actionContext.nextPartState !== ActionPartChange.NONE
		) {
			await updateTimeline(context, cache)
		}
	}

	return {
		queuedPartInstanceId: actionContext.queuedPartInstanceId,
		taken: actionContext.takeAfterExecute,
	}
}
/**
 * This exists for the purpose of mocking this call for testing.
 */
export async function callTakeWithCache(context: JobContext, cache: CacheForPlayout, now: number): Promise<void> {
	return takeNextPartInnerSync(context, cache, now)
}
export async function stopPiecesOnSourceLayers(
	context: JobContext,
	data: StopPiecesOnSourceLayersProps
): Promise<void> {
	if (data.sourceLayerIds.length === 0) return
	return runJobWithPlayoutCache(
		context,
		// 'sourceLayerOnPartStop',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}
			if (!playlist.currentPartInstanceId) throw UserError.create(UserErrorMessage.NoCurrentPart)
		},
		async (cache) => {
			const partInstance = cache.PartInstances.findOne(data.partInstanceId)
			if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)
			const lastStartedPlayback = partInstance.timings?.startedPlayback
			if (!lastStartedPlayback) throw new Error(`Part "${data.partInstanceId}" has yet to start playback!`)

			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${partInstance.rundownId}" not found!`)

			const showStyleBase = await context.getShowStyleBase(rundown.showStyleBaseId)
			const sourceLayerIds = new Set(data.sourceLayerIds)
			const changedIds = innerStopPieces(
				context,
				cache,
				showStyleBase,
				partInstance,
				(pieceInstance) => sourceLayerIds.has(pieceInstance.piece.sourceLayerId),
				undefined
			)

			if (changedIds.length) {
				await syncPlayheadInfinitesForNextPartInstance(context, cache)

				await updateTimeline(context, cache)
			}
		}
	)
}

export async function updateStudioBaseline(context: JobContext, _data: void): Promise<string | false> {
	return runJobWithStudioCache(context, async (cache) => {
		const activePlaylists = cache.getActiveRundownPlaylists()

		if (activePlaylists.length === 0) {
			await updateStudioTimeline(context, cache)
			return shouldUpdateStudioBaselineInner(context, cache)
		} else {
			return shouldUpdateStudioBaselineInner(context, cache)
		}
	})
}

async function shouldUpdateStudioBaselineInner(context: JobContext, cache: CacheForStudio): Promise<string | false> {
	const studio = context.studio

	if (cache.getActiveRundownPlaylists().length > 0) return false

	const timeline = cache.Timeline.doc
	const blueprint = studio.blueprintId ? await context.directCollections.Blueprints.findOne(studio.blueprintId) : null
	if (!blueprint) return 'missingBlueprint'

	return libShouldUpdateStudioBaselineInner(getSystemVersion(), studio, timeline, blueprint)
}

export async function handleUpdateTimelineAfterIngest(
	context: JobContext,
	data: UpdateTimelineAfterIngestProps
): Promise<void> {
	await runJobWithPlaylistLock(context, data, async (playlist, lock) => {
		if (playlist && playlist.activationId && (playlist.currentPartInstanceId || playlist.nextPartInstanceId)) {
			// TODO - r37 added a retry mechanic to this. should that be kept?
			await runWithPlaylistCache(context, playlist, lock, null, async (cache) => {
				const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
				if (currentPartInstance && !currentPartInstance.timings?.startedPlayback) {
					// HACK: The current PartInstance doesn't have a start time yet, so we know an updateTimeline is coming as part of onPartPlaybackStarted
					// We mustn't run before that does, or we will get the timings in playout-gateway confused.
				} else {
					// It is safe enough (except adlibs) to update the timeline directly
					// If the playlist is active, then updateTimeline as lookahead could have been affected
					await updateTimeline(context, cache)
				}
			})
		}
	})
}
