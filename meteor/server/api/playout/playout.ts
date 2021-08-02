/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import { RundownHoldState } from '../../../lib/collections/Rundowns'
import { DBPart, PartId } from '../../../lib/collections/Parts'
import { isStringOrProtectedString } from '../../../lib/lib'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { Studios, StudioId, StudioRouteBehavior } from '../../../lib/collections/Studios'
import { ClientAPI } from '../../../lib/api/client'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { RundownPlaylistId, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { updateTimeline } from './timeline'
import { setNextPart as libsetNextPart } from './lib'

import { PackageInfo } from '../../coreSystem'
import { MethodContext } from '../../../lib/api/methods'
import { StudioContentWriteAccess } from '../../security/studio'
import { check } from '../../../lib/check'
import { runPlayoutOperationWithCache, PlayoutLockFunctionPriority } from './lockFunction'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from './cache'
import { profiler } from '../profiler'
import { shouldUpdateStudioBaselineInner } from '@sofie-automation/corelib/dist/studio/baseline'
import { Timeline } from '../../../lib/collections/Timeline'

export namespace ServerPlayoutAPI {
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

	export async function shouldUpdateStudioBaseline(
		context: MethodContext,
		studioId: StudioId
	): Promise<string | false> {
		const { studio } = StudioContentWriteAccess.baseline(context, studioId)

		check(studioId, String)

		// This is intentionally not in a lock/queue, as doing so will cause it to block playout performance, and being wrong is harmless

		if (studio) {
			const activePlaylists = await RundownPlaylists.findFetchAsync(
				{ studioId: studio._id, activationId: { $exists: true } },
				{ fields: { _id: 1 } }
			)
			if (activePlaylists.length > 0) return false

			const [timeline, blueprint] = await Promise.all([
				Timeline.findOneAsync(studio._id),
				studio.blueprintId
					? Blueprints.findOneAsync(studio.blueprintId, { fields: { blueprintVersion: 1 } })
					: null,
			])
			if (blueprint === undefined) return 'missingBlueprint'

			return shouldUpdateStudioBaselineInner(
				PackageInfo.versionExtended || PackageInfo.version,
				studio,
				timeline,
				blueprint
			)
		} else {
			return false
		}
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
