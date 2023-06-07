import {
	IBlueprintResolvedPieceInstance,
	OnGenerateTimelineObj,
	PieceAbSessionInfo,
	TSR,
	AB_MEDIA_PLAYER_AUTO,
} from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { TimelineObjectAbSessionInfo } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import * as _ from 'underscore'
import {
	ABResolverOptions,
	AssignmentResult,
	resolveAbAssignmentsFromRequests,
	SessionRequest,
} from './abPlaybackResolver'
import { AbSessionHelper } from './helper'

export interface AbPoolClaim {
	sessionId: string
	slotId: number
	lookahead: boolean // purely informational for debugging

	_rank: number // HACK: For countdown overlay to know which is THE 'next' clip
}

export interface SessionToPlayerMap {
	[sessionId: string]: AbPoolClaim | undefined
}
// function reversePreviousAssignment(previousAssignment: AbPoolClaim[]): SessionToPlayerMap {
// 	const previousAssignmentRev: { [sessionId: string]: AbPoolClaim | undefined } = {}

// 	for (const prev of previousAssignment) {
// 		previousAssignmentRev[prev.sessionId] = prev
// 	}

// 	return previousAssignmentRev
// }

function validateSessionName(
	pieceInstanceId: string,
	session: PieceAbSessionInfo | TimelineObjectAbSessionInfo
): string {
	const newName = session.name === AB_MEDIA_PLAYER_AUTO ? pieceInstanceId : session.name
	return `${session.pool}_${newName}`
}

export function calculateSessionTimeRanges(
	context: AbSessionHelper,
	resolvedPieces: IBlueprintResolvedPieceInstance[],
	timelineObjs: OnGenerateTimelineObj<TSR.TSRTimelineContent>[],
	previousAssignmentMap: SessionToPlayerMap,
	sessionPool: string
): SessionRequest[] {
	const piecesWantingAbSession = _.compact(
		resolvedPieces.map((piece) => {
			if (piece.piece?.abSessions) {
				const validSessions = piece.piece.abSessions.filter((s) => s.pool === sessionPool)
				if (validSessions.length > 0) {
					return literal<[IBlueprintResolvedPieceInstance, PieceAbSessionInfo[]]>([piece, validSessions])
				}
			}
			return undefined
		})
	)

	const sessionRequests: { [sessionId: string]: SessionRequest | undefined } = {}
	for (const [p, sessions] of piecesWantingAbSession) {
		const start = p.resolvedStart
		const duration = p.resolvedDuration
		const end = duration !== undefined ? start + duration : undefined

		// Track the range of each session
		for (const session of sessions) {
			const sessionId = context.getPieceABSessionId(p, validateSessionName(p._id, session))

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
					player: previousAssignmentMap[sessionId]?.slotId, // Persist previous assignments
				}
			} else {
				// New session
				sessionRequests[sessionId] = {
					id: sessionId,
					start,
					end,
					optional: session.optional ?? false,
					lookaheadRank: undefined,
					player: previousAssignmentMap[sessionId]?.slotId, // Persist previous assignments
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
					if (session.pool === sessionPool) {
						const sessionId = context.getTimelineObjectAbSessionId(
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
				player: previousAssignmentMap[grp.id]?.slotId,
			})
		}
	})

	return result
}

export function resolveAbSessions(
	context: AbSessionHelper,
	options: ABResolverOptions,
	resolvedPieces: IBlueprintResolvedPieceInstance[],
	timelineObjs: OnGenerateTimelineObj<TSR.TSRTimelineContent>[],
	previousAssignmentMap: SessionToPlayerMap,
	sessionPool: string,
	slotIds: number[],
	now: number
): AssignmentResult {
	const sessionRequests = calculateSessionTimeRanges(
		context,
		resolvedPieces,
		timelineObjs,
		previousAssignmentMap,
		sessionPool
	)

	return resolveAbAssignmentsFromRequests(options, slotIds, sessionRequests, now)
}

// export function resolveAbPlayers(
// 	context: ITimelineEventContext,
// 	config: BlueprintConfig,
// 	resolvedPieces: IBlueprintResolvedPieceInstance[],
// 	timelineObjs: OnGenerateTimelineObj<TSR.TSRTimelineContent>[],
// 	previousAssignment: AbPoolClaim[],
// 	sessionPool: string,
// 	slotIds: number[]
// ): AbPoolClaim[] {
// 	const previousAssignmentMap = reversePreviousAssignment(previousAssignment)
// 	const resolvedAssignments = resolveAbSessions(
// 		context,
// 		config,
// 		resolvedPieces,
// 		timelineObjs,
// 		previousAssignmentMap,
// 		sessionPool,
// 		slotIds,
// 		context.getCurrentTime()
// 	)

// 	const debugLog = config.studio.ABPlaybackDebugLogging
// 	if (debugLog) {
// 		context.logInfo(`AB: Resolved sessions for "${sessionPool}": ${JSON.stringify(resolvedAssignments)}`)
// 	}

// 	if (resolvedAssignments.failedRequired.length > 0) {
// 		context.logWarning(
// 			`AB: Failed to assign sessions for "${sessionPool}": ${JSON.stringify(resolvedAssignments.failedRequired)}`
// 		)
// 	}
// 	if (resolvedAssignments.failedOptional.length > 0) {
// 		context.logInfo(
// 			`AB: Failed to assign optional sessions for "${sessionPool}": ${JSON.stringify(
// 				resolvedAssignments.failedOptional
// 			)}`
// 		)
// 	}

// 	return reso
// }
