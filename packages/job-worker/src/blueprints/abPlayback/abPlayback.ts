import {
	OnGenerateTimelineObj,
	PieceAbSessionInfo,
	TSR,
	AB_MEDIA_PLAYER_AUTO,
	ABResolverConfiguration,
	ICommonContext,
	ABTimelineLayerChangeRules,
} from '@sofie-automation/blueprints-integration'
import { PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionAssignments } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { TimelineObjectAbSessionInfo } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { logger } from '../../logging'
import * as _ from 'underscore'
import { SessionRequest } from './abPlaybackResolver'
import { AbSessionHelper } from './helper'

function validateSessionName(
	pieceInstanceId: PieceInstanceId | string,
	session: PieceAbSessionInfo | TimelineObjectAbSessionInfo
): string {
	const newName = session.name === AB_MEDIA_PLAYER_AUTO ? pieceInstanceId : session.name
	return `${session.pool}_${newName}`
}

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

function updateObjectsToAbPlayer(
	context: ICommonContext,
	abConfiguration: Pick<ABResolverConfiguration, 'timelineObjectLayerChangeRules' | 'customApplyToObject'>,
	poolName: string,
	poolIndex: number,
	objs: OnGenerateTimelineObj<TSR.TSRTimelineContent>[]
): OnGenerateTimelineObj<TSR.TSRTimelineContent>[] {
	const failedObjects: OnGenerateTimelineObj<TSR.TSRTimelineContent>[] = []

	for (const obj of objs) {
		const updatedKeyframes = applyUpdateToKeyframes(poolName, poolIndex, obj)

		const updatedLayer = applylayerMoveRule(
			abConfiguration.timelineObjectLayerChangeRules,
			poolName,
			poolIndex,
			obj
		)

		const updatedCustom =
			abConfiguration.customApplyToObject &&
			abConfiguration.customApplyToObject(context, poolName, poolIndex, obj)

		if (!updatedKeyframes && !updatedLayer && !updatedCustom) {
			failedObjects.push(obj)
		}
	}

	return failedObjects
}

function applyUpdateToKeyframes(
	poolName: string,
	poolIndex: number,
	obj: OnGenerateTimelineObj<TSR.TSRTimelineContent>
): boolean {
	if (!obj.keyframes) return false

	let updated = false

	obj.keyframes = _.compact(
		obj.keyframes.map((kf) => {
			// Preserve all non-ab keyframes
			if (!kf.abSession) return kf
			// Preserve from other ab pools
			if (kf.abSession.poolName !== poolName) return kf

			if (kf.abSession.playerIndex === poolIndex) {
				// Make sure any ab keyframe is active
				kf.disabled = false
				updated = true
				return kf
			} else {
				// Remove the keyframes for other players in the pool
				return undefined
			}
		})
	)

	return updated
}

function applylayerMoveRule(
	timelineObjectLayerChangeRules: ABTimelineLayerChangeRules | undefined,
	poolName: string,
	poolIndex: number,
	obj: OnGenerateTimelineObj<TSR.TSRTimelineContent>
): boolean {
	const ruleId = obj.isLookahead ? obj.lookaheadForLayer || obj.layer : obj.layer
	if (!ruleId) return false

	const moveRule = timelineObjectLayerChangeRules?.[ruleId]
	if (!moveRule || !moveRule.acceptedPoolNames.includes(poolName)) return false

	if (obj.isLookahead && moveRule.allowsLookahead && obj.lookaheadForLayer) {
		// This works on the assumption that layer will contain lookaheadForLayer, but not the exact syntax.
		// Hopefully this will be durable to any potential future core changes
		const newLayer = moveRule.newLayerName(poolIndex)
		obj.layer = (obj.layer + '').replace(obj.lookaheadForLayer + '', newLayer)
		obj.lookaheadForLayer = newLayer

		return true
	} else if (!obj.isLookahead || (obj.isLookahead && !obj.lookaheadForLayer)) {
		obj.layer = moveRule.newLayerName(poolIndex)
		return true
	}

	return false
}

export function applyAbPlayerObjectAssignments(
	sessionHelper: AbSessionHelper,
	context: ICommonContext,
	abConfiguration: Pick<ABResolverConfiguration, 'timelineObjectLayerChangeRules' | 'customApplyToObject'>,
	timelineObjs: OnGenerateTimelineObjExt[],
	previousAssignmentMap: ABSessionAssignments,
	resolvedAssignments: Readonly<SessionRequest[]>,
	poolName: string
): ABSessionAssignments {
	const newAssignments: ABSessionAssignments = {}
	let nextRank = 1
	const persistAssignment = (sessionId: string, playerId: number, lookahead: boolean): void => {
		// Track the assignment, so that the next onTimelineGenerate can try to reuse the same session
		if (newAssignments[playerId]) {
			// TODO - warn?
		}
		newAssignments[playerId] = { sessionId, playerId, lookahead, _rank: nextRank++ }
	}

	// collect objects by their sessionId
	const groupedObjectsMap = new Map<string, Array<OnGenerateTimelineObjExt>>()
	for (const obj of timelineObjs) {
		if (obj.abSessions && obj.pieceInstanceId) {
			for (const session of obj.abSessions) {
				if (session.pool === poolName) {
					const sessionId = sessionHelper.getTimelineObjectAbSessionId(
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

	const failedObjects: OnGenerateTimelineObj<TSR.TSRTimelineContent>[] = []
	const unexpectedSessions: string[] = []

	// Apply the known assignments
	for (const [sessionId, objs] of groupedObjectsMap.entries()) {
		if (sessionId === 'undefined') continue

		const matchingAssignment = resolvedAssignments.find((req) => req.id === sessionId)

		if (matchingAssignment) {
			if (matchingAssignment.playerId !== undefined) {
				failedObjects.push(
					...updateObjectsToAbPlayer(context, abConfiguration, poolName, matchingAssignment.playerId, objs)
				)
				persistAssignment(sessionId, matchingAssignment.playerId, !!matchingAssignment.lookaheadRank)
			} else {
				// A warning will already have been raised about this having no player
			}
		} else {
			// This is a group that shouldn't exist, so are likely a bug. There isnt a lot we can do beyond warn about the issue
			unexpectedSessions.push(`${sessionId}(${objs.map((obj) => obj.id).join(',')})`)

			// If there was a previous assignment, hopefully that is better than nothing
			const prev = previousAssignmentMap[sessionId]
			if (prev) {
				failedObjects.push(...updateObjectsToAbPlayer(context, abConfiguration, poolName, prev.playerId, objs))
				persistAssignment(sessionId, prev.playerId, false)
			}
		}
	}

	if (failedObjects.length > 0) {
		logger.warn(`ABPlayback failed to update ${failedObjects.length} to their AB session`)
		logger.debug(`Failed objects are: ${failedObjects.map((obj) => `${obj.id}@${obj.layer}`).join(', ')}`)
	}
	if (unexpectedSessions.length > 0) {
		logger.warn(`ABPlayback found ${unexpectedSessions.length} unexpected sessions on the timeline`)
		logger.debug(`Unexpected sessions are: ${unexpectedSessions.join(', ')}`)
	}

	logger.silly(`ABPlayback calculated assignments for "${poolName}": ${JSON.stringify(newAssignments)}`)

	return newAssignments
}
