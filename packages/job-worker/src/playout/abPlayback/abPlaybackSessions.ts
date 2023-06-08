import { OnGenerateTimelineObj, TSR } from '@sofie-automation/blueprints-integration'
import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionAssignments } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import * as _ from 'underscore'
import { SessionRequest } from './abPlaybackResolver'
import { AbSessionHelper } from './abSessionHelper'
import { validateSessionName } from './util'

export function calculateSessionTimeRanges(
	sessionHelper: AbSessionHelper,
	resolvedPieces: ResolvedPieceInstance[],
	timelineObjs: OnGenerateTimelineObjExt[],
	previousAssignmentMap: ABSessionAssignments,
	poolName: string
): SessionRequest[] {
	const sessionRequests: { [sessionId: string]: SessionRequest | undefined } = {}
	for (const p of resolvedPieces) {
		const abSessions = p.piece.abSessions
		if (!abSessions) continue

		const start = p.resolvedStart
		const duration = p.resolvedDuration
		const end = duration !== undefined ? start + duration : undefined

		// Track the range of each session
		for (const session of abSessions) {
			if (session.pool !== poolName) continue

			const sessionId = sessionHelper.getPieceABSessionId(p._id, validateSessionName(p._id, session))

			// Note: multiple generated sessionIds for a single piece will not work as there will not be enough info to assign objects to different players. TODO is this still true?
			const val = sessionRequests[sessionId] || undefined
			if (val) {
				// This session is already known, so extend the session to cover all the pieces
				sessionRequests[sessionId] = {
					id: sessionId,
					start: Math.min(val.start, start),
					end: val.end === undefined || end === undefined ? undefined : Math.max(val.end, end),
					optional: val.optional && (session.optional ?? false),
					lookaheadRank: undefined,
					playerId: previousAssignmentMap[sessionId]?.playerId, // Persist previous assignments
				}
			} else {
				// New session
				sessionRequests[sessionId] = {
					id: sessionId,
					start,
					end,
					optional: session.optional ?? false,
					lookaheadRank: undefined,
					playerId: previousAssignmentMap[sessionId]?.playerId, // Persist previous assignments
				}
			}
		}
	}

	const result = _.compact(Object.values<SessionRequest | undefined>(sessionRequests))

	// Include lookaheads, as they dont have pieces
	const groupedLookaheadMap = new Map<string, Array<OnGenerateTimelineObj<TSR.TSRTimelineContent>>>()
	for (const obj of timelineObjs) {
		if (
			!!obj.isLookahead &&
			!Array.isArray(obj.enable) &&
			obj.enable.duration === undefined &&
			obj.enable.end === undefined
		) {
			if (obj.abSessions && obj.pieceInstanceId) {
				for (const session of obj.abSessions) {
					if (session.pool === poolName) {
						const sessionId = sessionHelper.getTimelineObjectAbSessionId(
							obj,
							validateSessionName(obj.pieceInstanceId, session)
						)
						if (sessionId) {
							const existing = groupedLookaheadMap.get(sessionId)
							groupedLookaheadMap.set(sessionId, existing ? [...existing, obj] : [obj])
						}
					}
				}
			}
		}
	}

	const groupedLookahead = Array.from(groupedLookaheadMap.entries()).map(([id, objs]) => ({ objs, id }))
	const sortedLookaheadGroups = _.sortBy(groupedLookahead, (grp) => {
		// Find the highest priority of the objects
		const r = _.max(_.pluck(grp.objs, 'priority')) || -900
		// Invert the sort (to get descending)
		return -r
	})
	sortedLookaheadGroups.forEach((grp, i) => {
		if (!sessionRequests[grp.id]) {
			result.push({
				id: grp.id,
				start: Number.POSITIVE_INFINITY, // Distant future
				end: undefined,
				lookaheadRank: i + 1, // This is so that we can easily work out which to use first
				playerId: previousAssignmentMap[grp.id]?.playerId,
			})
		}
	})

	return result
}
