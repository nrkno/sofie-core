/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { Rundown, RundownHoldState, Rundowns } from '../../../lib/collections/Rundowns'
import { Part, DBPart, PartId } from '../../../lib/collections/Parts'
import { getCurrentTime, Time, normalizeArrayToMap, unprotectString, isStringOrProtectedString } from '../../../lib/lib'
import { StatObjectMetadata } from '../../../lib/collections/Timeline'
import { Segment, SegmentId } from '../../../lib/collections/Segments'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { Studios, StudioId, StudioRouteBehavior } from '../../../lib/collections/Studios'
import { ClientAPI } from '../../../lib/api/client'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { updateStudioTimeline, updateTimeline } from './timeline'
import {
	resetRundownPlaylist as libResetRundownPlaylist,
	setNextPart as libsetNextPart,
	setNextSegment as libSetNextSegment,
} from './lib'
import {
	prepareStudioForBroadcast,
	activateRundownPlaylist as libActivateRundownPlaylist,
	deactivateRundownPlaylistInner,
} from './actions'
import { sortPieceInstancesByStart } from './pieces'
import { PackageInfo } from '../../coreSystem'
import { getActiveRundownPlaylistsInStudioFromDb } from '../studio/lib'
import { PieceInstances, PieceInstance, PieceInstanceId } from '../../../lib/collections/PieceInstances'
import { PartInstances, PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { MethodContext } from '../../../lib/api/methods'
import { StudioContentWriteAccess } from '../../security/studio'
import { check, Match } from '../../../lib/check'
import {
	runPlayoutOperationWithCacheFromStudioOperation,
	runPlayoutOperationWithCache,
	PlayoutLockFunctionPriority,
} from './lockFunction'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache, getSelectedPartInstancesFromCache } from './cache'
import { runStudioOperationWithCache, StudioLockFunctionPriority } from '../studio/lockFunction'
import { CacheForStudio } from '../studio/cache'
import { VerifiedRundownPlaylistContentAccess } from '../lib'
import { profiler } from '../profiler'

export namespace ServerPlayoutAPI {
	/**
	 * Activate the rundownPlaylist, decativate any other running rundowns
	 */
	export async function forceResetAndActivateRundownPlaylist(
		access: VerifiedRundownPlaylistContentAccess,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<void> {
		check(rehearsal, Boolean)
		return runPlayoutOperationWithCache(
			access,
			'forceResetAndActivateRundownPlaylist',
			rundownPlaylistId,
			PlayoutLockFunctionPriority.USER_PLAYOUT,
			async (cache) => {
				const playlist = cache.Playlist.doc

				const anyOtherActivePlaylists = await getActiveRundownPlaylistsInStudioFromDb(
					playlist.studioId,
					playlist._id
				)
				if (anyOtherActivePlaylists.length > 0) {
					const errors: any[] = []
					// Try deactivating everything in parallel, although there should only ever be one active
					await Promise.allSettled(
						anyOtherActivePlaylists.map(async (otherRundownPlaylist) =>
							runPlayoutOperationWithCacheFromStudioOperation(
								'forceResetAndActivateRundownPlaylist',
								cache,
								otherRundownPlaylist,
								PlayoutLockFunctionPriority.USER_PLAYOUT,
								null,
								async (otherCache) => {
									await deactivateRundownPlaylistInner(otherCache)
								}
							).catch((e) => errors.push(e))
						)
					)
					if (errors.length > 0) {
						// Ok, something went wrong, but check if the active rundowns where deactivated?
						const anyOtherActivePlaylistsStill = await getActiveRundownPlaylistsInStudioFromDb(
							playlist.studioId,
							playlist._id
						)
						if (anyOtherActivePlaylistsStill.length) {
							// No they weren't, we can't continue..
							throw errors.join(',')
						} else {
							// They where deactivated, log the error and continue
							logger.error(errors.join(','))
						}
					}
				}
			},
			async (cache) => {
				await libResetRundownPlaylist(cache)

				await prepareStudioForBroadcast(cache, true)

				await libActivateRundownPlaylist(cache, rehearsal)
			}
		)
	}

	export async function setNextPartInner(
		cache: CacheForPlayout,
		nextPartId: PartId | DBPart | null,
		setManually?: boolean,
		nextTimeOffset?: number | undefined
	): Promise<void> {
		const playlist = cache.Playlist.doc
		if (!playlist.activationId) throw new Meteor.Error(501, `Rundown Playlist "${playlist._id}" is not active!`)
		if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE)
			throw new Meteor.Error(501, `Rundown "${playlist._id}" cannot change next during hold!`)

		let nextPart: DBPart | null = null
		if (nextPartId) {
			if (isStringOrProtectedString(nextPartId)) {
				nextPart = cache.Parts.findOne(nextPartId) || null
			} else if (_.isObject(nextPartId)) {
				nextPart = nextPartId
			}
			if (!nextPart) throw new Meteor.Error(404, `Part "${nextPartId}" not found!`)
		}

		await libsetNextPart(cache, nextPart ? { part: nextPart } : null, setManually, nextTimeOffset)

		// update lookahead and the next part when we have an auto-next
		await updateTimeline(cache)
	}
	export async function setNextSegment(
		access: VerifiedRundownPlaylistContentAccess,
		rundownPlaylistId: RundownPlaylistId,
		nextSegmentId: SegmentId | null
	): Promise<ClientAPI.ClientResponse<void>> {
		check(rundownPlaylistId, String)
		if (nextSegmentId) check(nextSegmentId, String)

		return runPlayoutOperationWithCache(
			access,
			'setNextSegment',
			rundownPlaylistId,
			PlayoutLockFunctionPriority.USER_PLAYOUT,
			async (cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist.activationId)
					throw new Meteor.Error(501, `Rundown Playlist "${rundownPlaylistId}" is not active!`)
			},
			async (cache) => {
				let nextSegment: Segment | null = null
				if (nextSegmentId) {
					nextSegment = cache.Segments.findOne(nextSegmentId) || null
					if (!nextSegment) throw new Meteor.Error(404, `Segment "${nextSegmentId}" not found!`)
				}

				libSetNextSegment(cache, nextSegment)

				// Update any future lookaheads
				await updateTimeline(cache)

				return ClientAPI.responseSuccess(undefined)
			}
		)
	}
	export async function disableNextPiece(
		access: VerifiedRundownPlaylistContentAccess,
		rundownPlaylistId: RundownPlaylistId,
		undo?: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		check(rundownPlaylistId, String)

		return runPlayoutOperationWithCache(
			access,
			'disableNextPiece',
			rundownPlaylistId,
			PlayoutLockFunctionPriority.USER_PLAYOUT,
			async (cache) => {
				const playlist = cache.Playlist.doc
				if (!playlist.currentPartInstanceId) throw new Meteor.Error(401, `No current part!`)
			},
			async (cache) => {
				const playlist = cache.Playlist.doc

				const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
				if (!currentPartInstance)
					throw new Meteor.Error(404, `PartInstance "${playlist.currentPartInstanceId}" not found!`)

				const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${currentPartInstance.rundownId}" not found!`)
				const showStyleBase = rundown.getShowStyleBase()

				// @ts-ignore stringify
				// logger.info(o)
				// logger.info(JSON.stringify(o, '', 2))

				const allowedSourceLayers = normalizeArrayToMap(showStyleBase.sourceLayers, '_id')

				// logger.info('nowInPart', nowInPart)
				// logger.info('filteredPieces', filteredPieces)
				const getNextPiece = (partInstance: PartInstance, ignoreStartedPlayback: boolean) => {
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
							!piece.piece.isTransition
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

					const findLast: boolean = !!undo

					if (findLast) sortedPieces.reverse()

					return sortedPieces.find((piece) => {
						return (
							piece.piece.enable.start >= nowInPart &&
							((!undo && !piece.disabled) || (undo && piece.disabled))
						)
					})
				}

				if (nextPartInstance?.timings) {
					// pretend that the next part never has played (even if it has)
					delete nextPartInstance.timings.startedPlayback
				}

				const partInstances: Array<[PartInstance | undefined, boolean]> = [
					[currentPartInstance, false],
					[nextPartInstance, true], // If not found in currently playing part, let's look in the next one:
				]
				if (undo) partInstances.reverse()

				let nextPieceInstance: PieceInstance | undefined

				for (const [partInstance, ignoreStartedPlayback] of partInstances) {
					if (partInstance) {
						nextPieceInstance = getNextPiece(partInstance, ignoreStartedPlayback)
						if (nextPieceInstance) break
					}
				}

				if (nextPieceInstance) {
					logger.info((undo ? 'Disabling' : 'Enabling') + ' next PieceInstance ' + nextPieceInstance._id)
					cache.PieceInstances.update(nextPieceInstance._id, {
						$set: {
							disabled: !undo,
						},
					})

					await updateTimeline(cache)

					return ClientAPI.responseSuccess(undefined)
				} else {
					cache.assertNoChanges()

					return ClientAPI.responseError(404, 'Found no future pieces')
				}
			}
		)
	}

	export async function updateStudioBaseline(context: MethodContext, studioId: StudioId): Promise<string | false> {
		StudioContentWriteAccess.baseline(context, studioId)

		check(studioId, String)

		return runStudioOperationWithCache(
			'updateStudioBaseline',
			studioId,
			StudioLockFunctionPriority.USER_PLAYOUT,
			async (cache) => {
				const activePlaylists = cache.getActiveRundownPlaylists()

				if (activePlaylists.length === 0) {
					await updateStudioTimeline(cache)
					return shouldUpdateStudioBaselineInner(cache)
				} else {
					return shouldUpdateStudioBaselineInner(cache)
				}
			}
		)
	}

	export async function shouldUpdateStudioBaseline(
		context: MethodContext,
		studioId: StudioId
	): Promise<string | false> {
		StudioContentWriteAccess.baseline(context, studioId)

		check(studioId, String)

		return runStudioOperationWithCache(
			'shouldUpdateStudioBaseline',
			studioId,
			StudioLockFunctionPriority.MISC,
			async (cache) => {
				return shouldUpdateStudioBaselineInner(cache)
			}
		)
	}
	async function shouldUpdateStudioBaselineInner(cache: CacheForStudio): Promise<string | false> {
		const studio = cache.Studio.doc

		const activePlaylists = cache.getActiveRundownPlaylists()
		if (activePlaylists.length === 0) {
			const studioTimeline = cache.Timeline.findOne(studio._id)
			if (!studioTimeline) return 'noBaseline'
			const markerObject = studioTimeline.timeline.find((x) => x.id === `baseline_version`)
			if (!markerObject) return 'noBaseline'
			// Accidental inclusion of one timeline code below - random ... don't know why
			// const studioTimeline = cache.Timeline.findOne(studioId)
			// if (!studioTimeline) return 'noBaseline'
			// const markerObject = studioTimeline.timeline.find(
			// 	(x) => x._id === protectString(`${studio._id}_baseline_version`)
			// )
			// if (!markerObject) return 'noBaseline'

			const versionsContent = (markerObject.metaData as Partial<StatObjectMetadata> | undefined)?.versions

			if (versionsContent?.core !== (PackageInfo.versionExtended || PackageInfo.version)) return 'coreVersion'

			if (versionsContent?.studio !== (studio._rundownVersionHash || 0)) return 'studio'

			if (versionsContent?.blueprintId !== unprotectString(studio.blueprintId)) return 'blueprintId'
			if (studio.blueprintId) {
				const blueprint = await Blueprints.findOneAsync(studio.blueprintId)
				if (!blueprint) return 'blueprintUnknown'
				if (versionsContent.blueprintVersion !== (blueprint.blueprintVersion || 0)) return 'blueprintVersion'
			}
		}

		return false
	}

	export function switchRouteSet(context: MethodContext, studioId: StudioId, routeSetId: string, state: boolean) {
		check(studioId, String)
		check(routeSetId, String)
		check(state, Boolean)

		const allowed = StudioContentWriteAccess.routeSet(context, studioId)
		if (!allowed) throw new Meteor.Error(403, `Not allowed to edit RouteSet on studio ${studioId}`)

		const studio = allowed.studio
		if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)

		if (studio.routeSets[routeSetId] === undefined)
			throw new Meteor.Error(404, `RouteSet "${routeSetId}" not found!`)
		const routeSet = studio.routeSets[routeSetId]
		if (routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY && state === false)
			throw new Meteor.Error(400, `RouteSet "${routeSetId}" is ACTIVATE_ONLY`)

		const modification = {}
		modification[`routeSets.${routeSetId}.active`] = state

		if (studio.routeSets[routeSetId].exclusivityGroup && state === true) {
			_.each(studio.routeSets, (otherRouteSet, otherRouteSetId) => {
				if (otherRouteSetId === routeSetId) return
				if (otherRouteSet.exclusivityGroup === routeSet.exclusivityGroup) {
					modification[`routeSets.${otherRouteSetId}.active`] = false
				}
			})
		}

		Studios.update(studioId, {
			$set: modification,
		})

		// TODO: Run update timeline here

		return ClientAPI.responseSuccess(undefined)
	}
}

interface UpdateTimelineFromIngestDataTimeout {
	timeout?: number
}
const updateTimelineFromIngestDataTimeouts = new Map<RundownPlaylistId, UpdateTimelineFromIngestDataTimeout>()
export function triggerUpdateTimelineAfterIngestData(playlistId: RundownPlaylistId) {
	if (process.env.JEST_WORKER_ID) {
		// Don't run this when in jest, as it is not useful and ends up producing errors
		return
	}

	// Lock behind a timeout, so it doesnt get executed loads when importing a rundown or there are large changes
	const data = updateTimelineFromIngestDataTimeouts.get(playlistId) ?? {}
	if (data.timeout) Meteor.clearTimeout(data.timeout)

	data.timeout = Meteor.setTimeout(() => {
		if (updateTimelineFromIngestDataTimeouts.delete(playlistId)) {
			const transaction = profiler.startTransaction('triggerUpdateTimelineAfterIngestData', 'playout')
			runPlayoutOperationWithCache(
				null,
				'triggerUpdateTimelineAfterIngestData',
				playlistId,
				PlayoutLockFunctionPriority.USER_PLAYOUT,
				null,
				async (cache) => {
					const playlist = cache.Playlist.doc

					if (playlist.activationId && (playlist.currentPartInstanceId || playlist.nextPartInstanceId)) {
						const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
						if (!currentPartInstance?.timings?.startedPlayback) {
							// HACK: The current PartInstance doesn't have a start time yet, so we know an updateTimeline is coming as part of onPartPlaybackStarted
							// We mustn't run before that does, or we will get the timings in playout-gateway confused.
						} else {
							// It is safe enough (except adlibs) to update the timeline directly
							// If the playlist is active, then updateTimeline as lookahead could have been affected
							await updateTimeline(cache)
						}
					}
				}
			).catch((e) => {
				logger.error(`triggerUpdateTimelineAfterIngestData: Execution failed: ${e}`)
			})
			transaction?.end()
		}
	}, 1000)

	updateTimelineFromIngestDataTimeouts.set(playlistId, data)
}
