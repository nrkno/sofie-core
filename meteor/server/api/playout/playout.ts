/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Studios, StudioId, StudioRouteBehavior } from '../../../lib/collections/Studios'
import { ClientAPI } from '../../../lib/api/client'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'

import { PackageInfo } from '../../coreSystem'
import { MethodContext } from '../../../lib/api/methods'
import { StudioContentWriteAccess } from '../../security/studio'
import { check } from '../../../lib/check'
import { shouldUpdateStudioBaselineInner } from '@sofie-automation/corelib/dist/studio/baseline'
import { Timeline } from '../../../lib/collections/Timeline'

export namespace ServerPlayoutAPI {
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
