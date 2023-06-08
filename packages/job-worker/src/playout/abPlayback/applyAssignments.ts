import {
	OnGenerateTimelineObj,
	TSR,
	ABResolverConfiguration,
	ICommonContext,
	ABTimelineLayerChangeRules,
} from '@sofie-automation/blueprints-integration'
import { ABSessionAssignments } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { logger } from '../../logging'
import * as _ from 'underscore'
import { SessionRequest } from './abPlaybackResolver'
import { AbSessionHelper } from './abSessionHelper'
import { validateSessionName } from './util'

/**
 * Apply the ab assignments for a pool to the timeline
 * @param abSessionHelper Helper for generation sessionId
 * @param blueprintContext Context for blueprint functions
 * @param abConfiguration Configuration of the ab resolver
 * @param timelineObjects The current timeline to update
 * @param previousAssignmentMap Assignments from the previous run
 * @param resolvedAssignments Assignments to apply
 * @param poolName Name of the pool being processed
 * @returns Assignments that were applied to the timeline
 */
export function applyAbPlayerObjectAssignments(
	sessionHelper: AbSessionHelper,
	blueprintContext: ICommonContext,
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
		if (newAssignments[sessionId]) {
			// TODO - warn?
		}
		newAssignments[sessionId] = { sessionId, playerId, lookahead, _rank: nextRank++ }
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
					...updateObjectsToAbPlayer(
						blueprintContext,
						abConfiguration,
						poolName,
						matchingAssignment.playerId,
						objs
					)
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
				failedObjects.push(
					...updateObjectsToAbPlayer(blueprintContext, abConfiguration, poolName, prev.playerId, objs)
				)
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
