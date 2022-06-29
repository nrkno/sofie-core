/* tslint:disable:no-use-before-declare */
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Studios, StudioRouteBehavior } from '../../../lib/collections/Studios'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { PackageInfo } from '../../coreSystem'
import { StudioContentAccess } from '../../security/studio'
import { shouldUpdateStudioBaselineInner } from '@sofie-automation/corelib/dist/studio/baseline'
import { Timeline } from '../../../lib/collections/Timeline'
import { logger } from '../../logging'

export namespace ServerPlayoutAPI {
	export async function shouldUpdateStudioBaseline(access: StudioContentAccess): Promise<string | false> {
		const { studio } = access

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

			return shouldUpdateStudioBaselineInner(PackageInfo.version, studio, timeline, blueprint)
		} else {
			return false
		}
	}

	export function switchRouteSet(access: StudioContentAccess, routeSetId: string, state: boolean): void {
		logger.debug(`switchRouteSet "${access.studioId}" "${routeSetId}"=${state}`)

		const studio = access.studio

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

		Studios.update(studio._id, {
			$set: modification,
		})
	}
}
