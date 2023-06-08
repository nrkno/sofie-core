import {
	OnGenerateTimelineObj,
	PieceAbSessionInfo,
	TSR,
	AB_MEDIA_PLAYER_AUTO,
	ABResolverConfiguration,
	ICommonContext,
	ITimelineEventContext,
} from '@sofie-automation/blueprints-integration'
import { PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { TimelineObjectAbSessionInfo } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import * as _ from 'underscore'
import { SessionRequest } from './abPlaybackResolver'
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
	pieceInstanceId: PieceInstanceId | string,
	session: PieceAbSessionInfo | TimelineObjectAbSessionInfo
): string {
	const newName = session.name === AB_MEDIA_PLAYER_AUTO ? pieceInstanceId : session.name
	return `${session.pool}_${newName}`
}

export function calculateSessionTimeRanges(
	context: AbSessionHelper,
	resolvedPieces: ResolvedPieceInstance[],
	timelineObjs: OnGenerateTimelineObjExt[],
	previousAssignmentMap: SessionToPlayerMap,
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

			const sessionId = context.getPieceABSessionId(p._id, validateSessionName(p._id, session))

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
					if (session.pool === poolName) {
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

function updateObjectsToAbPlayer(
	context: ICommonContext,
	abConfiguration: Pick<ABResolverConfiguration, 'timelineObjectLayerChangeRules' | 'customApplyToObject'>,
	poolName: string,
	poolIndex: number,
	objs: OnGenerateTimelineObj<TSR.TSRTimelineContent>[]
): void {
	for (const obj of objs) {
		// The experiment: Do it via keyframes
		let updated = false

		// TODO - rewrite this to do more cleanup!
		obj.keyframes?.forEach((kf) => {
			if (kf.abSession && kf.abSession.poolName === poolName && kf.abSession.playerIndex === poolIndex) {
				kf.disabled = false
				updated = true
			}
		})

		const ruleId = obj.isLookahead ? obj.lookaheadForLayer || obj.layer : obj.layer
		if (ruleId) {
			const moveRule = abConfiguration.timelineObjectLayerChangeRules?.[ruleId]
			if (moveRule && moveRule.acceptedPoolNames.includes(poolName)) {
				if (obj.isLookahead && moveRule.allowsLookahead && obj.lookaheadForLayer) {
					// This works on the assumption that layer will contain lookaheadForLayer, but not the exact syntax.
					// Hopefully this will be durable to any potential future core changes
					const newLayer = moveRule.newLayerName(poolIndex)
					obj.layer = (obj.layer + '').replace(obj.lookaheadForLayer + '', newLayer)
					obj.lookaheadForLayer = newLayer

					updated = true
				} else if (!obj.isLookahead || (obj.isLookahead && !obj.lookaheadForLayer)) {
					obj.layer = moveRule.newLayerName(poolIndex)
					updated = true
				}
			}
		}

		if (abConfiguration.customApplyToObject) {
			const updated2 = abConfiguration.customApplyToObject(context, poolName, poolIndex, obj)

			updated = updated || updated2
		}

		if (!updated) {
			context.logWarning(`AB: Failed to move object to abPlayer ("${obj.id}" from layer: "${obj.layer}")`)
		}
	}
}

export function applyAbPlayerObjectAssignments(
	context: ITimelineEventContext,
	abConfiguration: Pick<ABResolverConfiguration, 'timelineObjectLayerChangeRules' | 'customApplyToObject'>,
	debugLog: boolean, // TODO - replace
	timelineObjs: OnGenerateTimelineObj<TSR.TSRTimelineContent>[],
	previousAssignmentMap: SessionToPlayerMap,
	resolvedAssignments: Readonly<SessionRequest[]>,
	poolName: string
): SessionToPlayerMap {
	const newAssignments: SessionToPlayerMap = {}
	let nextRank = 1
	const persistAssignment = (sessionId: string, playerId: number, lookahead: boolean): void => {
		// Track the assignment, so that the next onTimelineGenerate can try to reuse the same session
		if (newAssignments[playerId]) {
			// TODO - warn?
		}
		newAssignments[playerId] = { sessionId, slotId: playerId, lookahead, _rank: nextRank++ }
	}

	// collect objects by their sessionId
	const groupedObjectsMap = new Map<string, Array<OnGenerateTimelineObj<TSR.TSRTimelineContent>>>()
	for (const obj of timelineObjs) {
		if (obj.abSessions && obj.pieceInstanceId) {
			for (const session of obj.abSessions) {
				if (session.pool === poolName) {
					const sessionId = context.getTimelineObjectAbSessionId(
						obj,
						validateSessionName(obj.pieceInstanceId, session)
					)
					if (sessionId) {
						const existing = groupedObjectsMap.get(sessionId)
						groupedObjectsMap.set(sessionId, existing ? [...existing, obj] : [obj])
					}
				}
			}
		}
	}

	// Apply the known assignments
	for (const [sessionId, objs] of groupedObjectsMap.entries()) {
		if (sessionId !== 'undefined') {
			const request = resolvedAssignments.find((req) => req.id === sessionId)

			if (request) {
				if (request.player !== undefined) {
					updateObjectsToAbPlayer(context, abConfiguration, poolName, request.player, objs)
					persistAssignment(sessionId, request.player, !!request.lookaheadRank)
				} else {
					// A warning will already have been raised about this having no player
				}
			} else {
				// This is a group that shouldn't exist, so are likely a bug. There isnt a lot we can do beyond warn about the issue
				const objIds = _.pluck(objs, 'id')
				const prev = previousAssignmentMap[sessionId]
				if (prev) {
					updateObjectsToAbPlayer(context, abConfiguration, poolName, prev.slotId, objs)
					persistAssignment(sessionId, prev.slotId, false)
					context.logWarning(
						`AB: Found unexpected session remaining on the timeline: "${sessionId}" belonging to ${objIds.join(
							','
						)}. This may cause playback glitches`
					)
				} else {
					context.logWarning(
						`AB: Found unexpected session remaining on the timeline: "${sessionId}" belonging to ${objIds.join(
							','
						)}. This could result in black playback`
					)
				}
			}
		}
	}

	if (debugLog) {
		context.logInfo(`AB: new assignments for "${poolName}": ${JSON.stringify(newAssignments)}`)
	}
	return newAssignments
}
